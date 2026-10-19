/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodPlay, type CompiledScene, type SceneBuildResourceReference } from '../../src'
import { CompiledSceneCodec } from '../../src/scene/compiled'
import { loadScenePackage } from '../../src/facade/scene-package-loader'
import type { SceneDoc } from '../../src/scene/types'
import type { RuntimePreloadResult } from '../../src/runtime/preload'

const PACKAGE_BASE = 'https://site.example/exports/cover/'
const SCENE_URL = 'assets/0123456789abcdefabcd.svg'
const PACKAGE_FILE = 'scene/assets/0123456789abcdefabcd.svg'
const AUDIO_SCENE_URL = 'assets/0123456789abcdefabcd.mp3'
const AUDIO_PACKAGE_FILE = 'scene/assets/0123456789abcdefabcd.mp3'
const CSS_IMAGE_SCENE_URL = 'assets/abcdef0123456789abcd.svg'
const CSS_IMAGE_PACKAGE_FILE = 'scene/assets/abcdef0123456789abcd.svg'
const FONT_SCENE_URL = 'assets/fedcba9876543210fedc.woff2'
const FONT_PACKAGE_FILE = 'scene/assets/fedcba9876543210fedc.woff2'
type MutablePackageScene = Omit<CompiledScene, 'resources' | 'requirements'> & {
  resources: { entries: Array<CompiledScene['resources']['entries'][number]> }
  requirements: Omit<CompiledScene['requirements'], 'resources'> & { resources: string[] }
}

describe('CodPlay scene package loading', () => {
  let player: CodPlay | undefined
  let restoreImageReadiness: (() => void) | undefined
  let restoreMediaReadiness: (() => void) | undefined
  let restoreFontSet: (() => void) | undefined
  let restoreMatchMedia: (() => void) | undefined

  afterEach(() => {
    player?.destroy()
    player = undefined
    restoreImageReadiness?.()
    restoreImageReadiness = undefined
    restoreMediaReadiness?.()
    restoreMediaReadiness = undefined
    restoreFontSet?.()
    restoreFontSet = undefined
    restoreMatchMedia?.()
    restoreMatchMedia = undefined
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('restores compiler-traced media paths and waits for readiness before returning an instance', async () => {
    let releaseImageDecode: (() => void) | undefined
    let resolveDecodeStarted: (() => void) | undefined
    const decodeStarted = new Promise<void>((resolve) => { resolveDecodeStarted = resolve })
    restoreImageReadiness = stubImageReadiness(() => new Promise<void>((resolve) => {
      releaseImageDecode = resolve
      resolveDecodeStarted?.()
    }))
    player = createPlayer()
    const packageData = createPackageData(player)
    const root = document.createElement('main')
    root.id = 'package-root'
    document.body.append(root)
    const fetchMock = createPackageFetch(packageData.manifest, packageData.sceneJson)
    vi.stubGlobal('fetch', fetchMock)
    const resourceUrl = new URL(PACKAGE_FILE, PACKAGE_BASE).href
    const preload = vi.spyOn(player.preload, 'load').mockResolvedValue(createPreloadSuccess(resourceUrl))

    let loadResolved = false
    const pendingLoad = player.load(PACKAGE_BASE, { root: '#package-root' })
    void pendingLoad.then(() => { loadResolved = true }, () => undefined)
    await decodeStarted
    expect(loadResolved).toBe(false)
    releaseImageDecode?.()
    const instance = await pendingLoad

    expect(preload).toHaveBeenCalledWith({
      manifest: {
        entries: [expect.objectContaining({ url: resourceUrl, type: 'image' })],
      },
      options: { mode: 'author', container: root },
    })
    expect(instance.instanceId).toBe('codplay-load-1')
    expect(instance.telco.getState()).toMatchObject({ status: 'ready', initialized: true })
    expect(root.querySelector('img')?.src).toBe(resourceUrl)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('serializes concurrent loads through one owner and creates distinct instances', async () => {
    restoreImageReadiness = stubImageReadiness()
    player = createPlayer()
    const packageData = createPackageData(player)
    const rootA = document.createElement('main')
    const rootB = document.createElement('main')
    document.body.append(rootA, rootB)
    const fetchMock = createPackageFetch(packageData.manifest, packageData.sceneJson)
    vi.stubGlobal('fetch', fetchMock)
    let activePreloads = 0
    let maximumActivePreloads = 0
    const preload = vi.spyOn(player.preload, 'load').mockImplementation(async () => {
      activePreloads += 1
      maximumActivePreloads = Math.max(maximumActivePreloads, activePreloads)
      await Promise.resolve()
      activePreloads -= 1
      return createPreloadSuccess(new URL(PACKAGE_FILE, PACKAGE_BASE).href)
    })

    const [instanceA, instanceB] = await Promise.all([
      player.load(PACKAGE_BASE, { root: rootA }),
      player.load(PACKAGE_BASE, { root: rootB }),
    ])

    expect(instanceA.instanceId).not.toBe(instanceB.instanceId)
    expect(instanceA).not.toBe(instanceB)
    expect(rootA.querySelector('img')).not.toBe(rootB.querySelector('img'))
    expect(preload).toHaveBeenCalledTimes(2)
    expect(maximumActivePreloads).toBe(1)
  })

  it('advances loaded instances on one engine while keeping their telcos independent', async () => {
    restoreImageReadiness = stubImageReadiness()
    player = createPlayer()
    const packageData = createPackageData(player, 1_000)
    const rootA = document.createElement('main')
    const rootB = document.createElement('main')
    document.body.append(rootA, rootB)
    vi.stubGlobal('fetch', createPackageFetch(packageData.manifest, packageData.sceneJson))
    const resourceUrl = new URL(PACKAGE_FILE, PACKAGE_BASE).href
    vi.spyOn(player.preload, 'load').mockResolvedValue(createPreloadSuccess(resourceUrl))

    const [instanceA, instanceB] = await Promise.all([
      player.load(PACKAGE_BASE, { root: rootA }),
      player.load(PACKAGE_BASE, { root: rootB }),
    ])

    player.engine.advance(0)
    await Promise.all([instanceA.telco.play(), instanceB.telco.play()])
    player.engine.advance(100)
    expect(instanceA.telco.getProgress().timelineMs).toBe(100)
    expect(instanceB.telco.getProgress().timelineMs).toBe(100)

    await instanceA.telco.pause()
    await instanceA.telco.seek(250)
    player.engine.advance(200)
    expect(instanceA.telco.getProgress().timelineMs).toBe(250)
    expect(instanceB.telco.getProgress().timelineMs).toBe(200)

    player.instances.destroy(instanceA.instanceId)
    expect(player.instances.get(instanceA.instanceId)).toBeUndefined()
    player.engine.advance(300)
    expect(instanceB.telco.getProgress().timelineMs).toBe(300)
    expect(rootB.querySelector('img')).not.toBeNull()
  })

  it('shares one closure context across same-owner loads and isolates another owner', async () => {
    player = createPlayer()
    const sharedLifecycle = () => undefined
    const sceneBuild = player.build({
      scene: {
        id: 'function-context-scene',
        onStart: sharedLifecycle,
        straps: ['shared'],
        stories: { main: { id: 'main', persos: [] } },
      },
    }, { export: true })
    if (!sceneBuild.ok) throw new Error('Function context fixture scene did not compile.')
    const functionReferences = sceneBuild.functionReferences
    if (functionReferences === undefined) throw new Error('Function context fixture has no export references.')
    const startReference = functionReferences.find(({ path: segments }) => JSON.stringify(segments) === JSON.stringify(['onStart']))
    if (startReference === undefined) throw new Error('Function context fixture has no onStart reference.')

    const packageBase = PACKAGE_BASE
    const manifest = {
      format: 'codplay.scene-package.v1',
      scene: 'scene/scene.json',
      functions: { file: 'scene/functions.mjs', references: functionReferences },
      resources: [],
    }
    const codec = new CompiledSceneCodec({ diagnosticOutput: () => undefined })
    const sceneJson = codec.encode(sceneBuild.compiledScene)
    const functionContextCalls: number[] = []
    vi.stubGlobal('__codplayFunctionContextCalls', functionContextCalls)
    const fetchMock = createPackageFetch(manifest, sceneJson)
    vi.stubGlobal('fetch', fetchMock)
    let contextCreations = 0
    const moduleImporter = vi.fn(async () => ({
      functionReferences,
      createScenePackageContext: () => {
        contextCreations += 1
        let count = 0
        const onStart = () => functionContextCalls.push(++count)
        return {
          functions: { [startReference.ref]: onStart },
          strapCollections: { scene: { shared: () => [] }, stories: { main: {} } },
        }
      },
    }))

    const rootA = document.createElement('main')
    const rootB = document.createElement('main')
    document.body.append(rootA, rootB)
    const functionCollections: unknown[] = []
    const strapCollections: unknown[] = []
    const createInstance = player.instances.create.bind(player.instances)
    vi.spyOn(player.instances, 'create').mockImplementation((options) => {
      functionCollections.push(options.functions)
      strapCollections.push(options.strapCollections)
      return createInstance(options)
    })
    const first = (await loadScenePackage(player, packageBase, rootA, 'function-owner-first', moduleImporter)).instance
    await first.telco.play()
    const second = (await loadScenePackage(player, packageBase, rootB, 'function-owner-second', moduleImporter)).instance
    await second.telco.play()

    expect(functionCollections[0]).toBe(functionCollections[1])
    expect(strapCollections[0]).toBe(strapCollections[1])
    expect(functionContextCalls).toEqual([1, 2])
    expect(contextCreations).toBe(1)
    expect(moduleImporter).toHaveBeenCalledTimes(1)

    const secondPlayer = createPlayer()
    try {
      const rootC = document.createElement('main')
      document.body.append(rootC)
      const third = (await loadScenePackage(
        secondPlayer,
        packageBase,
        rootC,
        'function-owner-other',
        moduleImporter,
      )).instance
      await third.telco.play()
      expect(functionContextCalls).toEqual([1, 2, 1])
      expect(contextCreations).toBe(2)
      expect(moduleImporter).toHaveBeenCalledTimes(2)
    } finally {
      secondPlayer.destroy()
    }
  })

  it('waits for a materialized native media element to reach canplay readiness', async () => {
    let mediaReadyState = 0
    restoreMediaReadiness = stubMediaReadiness(() => mediaReadyState)
    player = createPlayer()
    const packageData = createAudioPackageData(player)
    const root = document.createElement('main')
    document.body.append(root)
    const fetchMock = createPackageFetch(packageData.manifest, packageData.sceneJson)
    vi.stubGlobal('fetch', fetchMock)
    const audioUrl = new URL(AUDIO_PACKAGE_FILE, PACKAGE_BASE).href
    const preload = vi.spyOn(player.preload, 'load').mockResolvedValue(createPreloadSuccess(audioUrl, 'audio'))

    let loadResolved = false
    const pendingLoad = player.load(PACKAGE_BASE, { root })
    void pendingLoad.then(() => { loadResolved = true }, () => undefined)
    const audio = await waitForElement<HTMLAudioElement>(root, 'audio')
    await Promise.resolve()
    expect(loadResolved).toBe(false)

    mediaReadyState = 3
    audio.dispatchEvent(new Event('canplay'))
    const instance = await pendingLoad

    expect(preload).toHaveBeenCalledWith({
      manifest: {
        entries: [expect.objectContaining({ url: audioUrl, type: 'audio' })],
      },
      options: { mode: 'author', container: root },
    })
    expect(instance.telco.getState()).toMatchObject({ status: 'ready', initialized: true })
  })

  it('loads a broadcast scene without changing an existing author instance', async () => {
    restoreImageReadiness = stubImageReadiness()
    player = createPlayer()
    const authorBuild = player.build({
      scene: {
        id: 'author-instance-scene',
        stories: {
          main: {
            id: 'main',
            persos: [{ id: 'author-title', type: 'tag', initial: { tag: 'h2', move: '@root', content: 'Author' }, actions: {} }],
          },
        },
      },
    })
    if (!authorBuild.ok) throw new Error('Author fixture did not compile.')
    const authorRoot = document.createElement('main')
    const broadcastRoot = document.createElement('main')
    document.body.append(authorRoot, broadcastRoot)
    const authorInstance = player.instances.create({
      instanceId: 'author-instance',
      compiledScene: authorBuild.compiledScene,
      functions: authorBuild.functions,
      root: authorRoot,
    })
    const authorMarkup = authorRoot.innerHTML
    const packageData = createPackageData(player)
    const fetchMock = createPackageFetch(packageData.manifest, packageData.sceneJson)
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(player.preload, 'load').mockResolvedValue(createPreloadSuccess(new URL(PACKAGE_FILE, PACKAGE_BASE).href))

    const broadcastInstance = await player.load(PACKAGE_BASE, { root: broadcastRoot })

    expect(player.instances.get('author-instance')).toBe(authorInstance)
    expect(authorRoot.innerHTML).toBe(authorMarkup)
    expect(authorInstance.telco.getState()).toMatchObject({ status: 'ready', initialized: true })
    expect(broadcastRoot.querySelector('img')?.src).toBe(new URL(PACKAGE_FILE, PACKAGE_BASE).href)
    expect(broadcastInstance.telco.getState()).toMatchObject({ status: 'ready', initialized: true })
  })

  it('installs the packaged stylesheet in the head, scopes it per root and clears it per instance', async () => {
    restoreImageReadiness = stubImageReadiness()
    player = createPlayer()
    const packageData = createCssPackageData(player)
    const rootA = document.createElement('main')
    const rootB = document.createElement('main')
    document.body.append(rootA, rootB)
    const fetchMock = createPackageFetch(packageData.manifest, packageData.sceneJson, packageData.cssText)
    vi.stubGlobal('fetch', fetchMock)
    const resourceUrl = new URL(PACKAGE_FILE, PACKAGE_BASE).href
    const cssImageUrl = new URL(CSS_IMAGE_PACKAGE_FILE, PACKAGE_BASE).href
    const fontUrl = new URL(FONT_PACKAGE_FILE, PACKAGE_BASE).href
    const fontSet = new Set<FontFace>()
    restoreFontSet = stubFontSet(fontSet)
    const setCss = player.preload.css.set.bind(player.preload.css)
    vi.spyOn(player.preload.css, 'set').mockImplementation((input) => {
      setCss(input)
      fontSet.add(createTestFontFace())
    })
    const preload = vi.spyOn(player.preload, 'load').mockResolvedValue(createPreloadSuccess(resourceUrl, 'image', [
      { url: cssImageUrl, type: 'image' },
      { url: fontUrl, type: 'font' },
    ]))

    const [instanceA, instanceB] = await Promise.all([
      player.load(PACKAGE_BASE, { root: rootA }),
      player.load(PACKAGE_BASE, { root: rootB }),
    ])
    const styles = [...document.head.querySelectorAll('style[data-codplay-preload-css-slot]')]

    expect(styles).toHaveLength(2)
    expect(styles[0]?.textContent).toContain('@scope ([data-codplay-scope=')
    expect(styles[0]?.textContent).toContain('.cp-package-title { color: navy; background-image: url(')
    expect(styles[0]?.textContent).toContain(`url("${cssImageUrl}")`)
    expect(styles[0]?.textContent).toContain(`url("${fontUrl}")`)
    expect([...fontSet].map((fontFace) => fontFace.status)).toEqual(['loaded', 'loaded'])
    expect(rootA.getAttribute('data-codplay-scope')).not.toBe(rootB.getAttribute('data-codplay-scope'))
    expect(preload).toHaveBeenCalledWith({
      manifest: [
        { entries: [expect.objectContaining({ url: resourceUrl, type: 'image' })] },
        { entries: [
          expect.objectContaining({ url: cssImageUrl, type: 'image' }),
          expect.objectContaining({ url: fontUrl, type: 'font' }),
        ] },
      ],
      options: { mode: 'author', container: rootA },
    })

    player.instances.destroy(instanceA.instanceId)

    expect(document.head.querySelector(`style[data-codplay-preload-css-slot="scene-package:${instanceA.instanceId}"]`)).toBeNull()
    expect(document.head.querySelector(`style[data-codplay-preload-css-slot="scene-package:${instanceB.instanceId}"]`)).not.toBeNull()
  })

  it('waits for the declared CSS font face before creating the broadcast instance', async () => {
    restoreImageReadiness = stubImageReadiness()
    player = createPlayer()
    const packageData = createCssPackageData(player)
    const root = document.createElement('main')
    document.body.append(root)
    const fetchMock = createPackageFetch(packageData.manifest, packageData.sceneJson, packageData.cssText)
    vi.stubGlobal('fetch', fetchMock)
    const resourceUrl = new URL(PACKAGE_FILE, PACKAGE_BASE).href
    vi.spyOn(player.preload, 'load').mockResolvedValue(createPreloadSuccess(resourceUrl, 'image', [
      { url: new URL(FONT_PACKAGE_FILE, PACKAGE_BASE).href, type: 'font' },
    ]))

    let releaseFont: (() => void) | undefined
    let resolveFontLoadStarted: (() => void) | undefined
    const fontLoadStarted = new Promise<void>((resolve) => { resolveFontLoadStarted = resolve })
    const fontSet = new Set<FontFace>()
    restoreFontSet = stubFontSet(fontSet)
    const fontFace = createTestFontFace(() => new Promise<void>((resolve) => {
      releaseFont = resolve
      resolveFontLoadStarted?.()
    }))
    const setCss = player.preload.css.set.bind(player.preload.css)
    vi.spyOn(player.preload.css, 'set').mockImplementation((input) => {
      setCss(input)
      fontSet.add(fontFace)
    })

    let loadResolved = false
    const pendingLoad = player.load(PACKAGE_BASE, { root })
    void pendingLoad.then(() => { loadResolved = true }, () => undefined)
    await fontLoadStarted
    expect(loadResolved).toBe(false)
    expect(root.children).toHaveLength(0)

    releaseFont?.()
    const instance = await pendingLoad

    expect(instance.telco.getState()).toMatchObject({ status: 'ready', initialized: true })
    expect(fontFace.status).toBe('loaded')
    expect(root.querySelector('img')).not.toBeNull()
  })

  it('rejects and cleans up when a packaged CSS font face fails', async () => {
    player = createPlayer()
    const packageData = createCssPackageData(player)
    const root = document.createElement('main')
    document.body.append(root)
    vi.stubGlobal('fetch', createPackageFetch(packageData.manifest, packageData.sceneJson, packageData.cssText))
    vi.spyOn(player.preload, 'load').mockResolvedValue(createPreloadSuccess(new URL(PACKAGE_FILE, PACKAGE_BASE).href))
    const fontSet = new Set<FontFace>()
    restoreFontSet = stubFontSet(fontSet)
    const setCss = player.preload.css.set.bind(player.preload.css)
    vi.spyOn(player.preload.css, 'set').mockImplementation((input) => {
      setCss(input)
      fontSet.add(createTestFontFace(async () => { throw new Error('invalid font bytes') }))
    })

    await expect(player.load(PACKAGE_BASE, { root })).rejects.toThrow('font failed to load (Package Probe): invalid font bytes')

    expect(root.children).toHaveLength(0)
    expect(document.head.querySelector('style[data-codplay-preload-css-slot^="scene-package:"]')).toBeNull()
    expect(player.instances.get('codplay-load-1')).toBeUndefined()
  })

  it('loads a CSS font face under an inactive condition without registering it globally', async () => {
    restoreImageReadiness = stubImageReadiness()
    player = createPlayer()
    const packageData = createCssPackageData(player)
    const sourceStyleSheet = packageData.manifest.styleSheet as Record<string, unknown>
    const sourceFaces = sourceStyleSheet.fontFaces as Array<Record<string, unknown>>
    const printFace = {
      sourceOrder: 1,
      family: 'Package Print',
      src: `url("${FONT_SCENE_URL}") format("woff2")`,
      weight: '400',
      style: 'normal',
      stretch: 'normal',
      variationSettings: 'normal',
      unicodeRange: 'U+0-10FFFF',
      display: 'auto',
    }
    const manifest = {
      ...packageData.manifest,
      styleSheet: { ...sourceStyleSheet, fontFaces: [...sourceFaces, printFace] },
    }
    const cssText = `${packageData.cssText}\n@media print { @font-face { font-family: "Package Print"; src: url("${FONT_SCENE_URL}") format("woff2"); font-weight: 400; } }`
    const root = document.createElement('main')
    document.body.append(root)
    vi.stubGlobal('fetch', createPackageFetch(manifest, packageData.sceneJson, cssText))
    const resourceUrl = new URL(PACKAGE_FILE, PACKAGE_BASE).href
    vi.spyOn(player.preload, 'load').mockResolvedValue(createPreloadSuccess(resourceUrl, 'image', [
      { url: new URL(CSS_IMAGE_PACKAGE_FILE, PACKAGE_BASE).href, type: 'image' },
      { url: new URL(FONT_PACKAGE_FILE, PACKAGE_BASE).href, type: 'font' },
    ]))

    const fontSet = new Set<FontFace>()
    restoreFontSet = stubFontSet(fontSet)
    const previousMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false })) })
    restoreMatchMedia = () => {
      if (previousMatchMedia === undefined) delete (window as unknown as { matchMedia?: typeof window.matchMedia }).matchMedia
      else Object.defineProperty(window, 'matchMedia', previousMatchMedia)
    }

    const detachedFaces: FontFace[] = []
    const fontFaceConstructor = vi.fn(function (
      family: string,
      _source: string,
      descriptors: FontFaceDescriptors,
    ) {
      const fontFace = createTestFontFace(async () => undefined, { family, ...descriptors })
      detachedFaces.push(fontFace)
      return fontFace
    })
    vi.stubGlobal('FontFace', fontFaceConstructor)
    const setCss = player.preload.css.set.bind(player.preload.css)
    vi.spyOn(player.preload.css, 'set').mockImplementation((input) => {
      setCss(input)
      fontSet.add(createTestFontFace())
    })

    const instance = await player.load(PACKAGE_BASE, { root })

    expect(instance.telco.getState()).toMatchObject({ status: 'ready', initialized: true })
    expect(window.matchMedia).toHaveBeenCalledWith('print')
    expect(fontFaceConstructor).toHaveBeenCalledWith(
      'Package Print',
      `url("${new URL(FONT_PACKAGE_FILE, PACKAGE_BASE).href}") format("woff2")`,
      expect.objectContaining({ weight: '400', style: 'normal', display: 'auto' }),
    )
    expect(detachedFaces[0]?.status).toBe('loaded')
    expect(fontSet.has(detachedFaces[0] as FontFace)).toBe(false)
  })
})

/** Creates a CodPlay owner whose inactive clock does not open a Node message channel. */
function createPlayer(): CodPlay {
  return new CodPlay({
    pauseOnDocumentHidden: false,
    frameScheduler: { request: () => 0, cancel: () => undefined },
  })
}

/** Stubs browser image readiness while preserving and restoring the jsdom prototype. */
function stubImageReadiness(decode: () => Promise<void> = async () => undefined): () => void {
  const prototype = HTMLImageElement.prototype
  const keys = ['complete', 'naturalWidth', 'decode'] as const
  const previous = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(prototype, key)]))
  Object.defineProperty(prototype, 'complete', { configurable: true, get: () => true })
  Object.defineProperty(prototype, 'naturalWidth', { configurable: true, get: () => 1 })
  Object.defineProperty(prototype, 'decode', { configurable: true, value: decode })
  return () => {
    for (const key of keys) {
      const descriptor = previous.get(key)
      if (descriptor === undefined) delete (prototype as unknown as Record<string, unknown>)[key]
      else Object.defineProperty(prototype, key, descriptor)
    }
  }
}

/** Stubs native media readiness while preserving the jsdom prototype descriptor. */
function stubMediaReadiness(readiness: () => number): () => void {
  const prototype = HTMLMediaElement.prototype
  const previous = Object.getOwnPropertyDescriptor(prototype, 'readyState')
  Object.defineProperty(prototype, 'readyState', { configurable: true, get: readiness })
  return () => {
    if (previous === undefined) delete (prototype as unknown as Record<string, unknown>).readyState
    else Object.defineProperty(prototype, 'readyState', previous)
  }
}

/** Waits for a scene element after asynchronous package loading reaches materialization. */
async function waitForElement<ElementType extends Element>(root: HTMLElement, selector: string): Promise<ElementType> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const element = root.querySelector<ElementType>(selector)
    if (element !== null) return element
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error(`Scene package did not materialize ${selector}.`)
}

/** Builds a small compiler result and its package-only URL mapping for loader tests. */
function createPackageData(owner: CodPlay, sequenceEndMs?: number): Readonly<{
  manifest: Record<string, unknown>
  sceneJson: string
}> {
  const source: SceneDoc<string> = {
    id: 'package-load-scene',
    ...(sequenceEndMs === undefined
      ? {}
      : { eventimes: [{ name: 'sequence:end', startAt: sequenceEndMs }] }),
    stories: {
      main: {
        id: 'main',
        persos: [{ id: 'cover', type: 'img', initial: { src: '/assets/cover.svg', move: '@root' }, actions: {} }],
      },
    },
  }
  const result = owner.build({ scene: source }, { export: true })
  if (!result.ok) throw new Error('Loader fixture scene did not compile.')
  const reference = result.resourceReferences?.[0]
  if (reference === undefined) throw new Error('Loader fixture has no compiler resource reference.')
  const compiledScene = packageScene(result.compiledScene, reference)
  return {
    manifest: {
      format: 'codplay.scene-package.v1',
      scene: 'scene/scene.json',
      functions: [],
      resources: [{
        sceneUrl: SCENE_URL,
        file: PACKAGE_FILE,
        suffix: '',
        type: 'image',
        occurrences: [reference.path],
      }],
    },
    sceneJson: JSON.stringify(compiledScene),
  }
}

/** Adds a compiled package stylesheet fixture with one compiler-owned local image token. */
function createCssPackageData(owner: CodPlay): Readonly<{
  manifest: Record<string, unknown>
  sceneJson: string
  cssText: string
}> {
  const packageData = createPackageData(owner)
  return {
    manifest: {
      ...packageData.manifest,
      styleSheet: {
        file: 'scene/style.css',
        classNames: ['cp-package-title'],
        fontFaces: [{
          sourceOrder: 0,
          family: 'Package Probe',
          src: `url("${FONT_SCENE_URL}") format("woff2")`,
          weight: '700',
          style: 'normal',
          stretch: 'normal',
          variationSettings: 'normal',
          unicodeRange: 'U+0-10FFFF',
          display: 'auto',
        }],
        resources: [{
          tokens: ['codplay-resource-0'],
          sceneUrl: CSS_IMAGE_SCENE_URL,
          file: CSS_IMAGE_PACKAGE_FILE,
          suffix: '',
          type: 'image',
        }, {
          tokens: ['codplay-resource-1'],
          sceneUrl: FONT_SCENE_URL,
          file: FONT_PACKAGE_FILE,
          suffix: '',
          type: 'font',
        }],
      },
    },
    sceneJson: packageData.sceneJson,
    cssText: `@font-face { font-family: "Package Probe"; src: url("${FONT_SCENE_URL}") format("woff2"); font-weight: 700; font-style: normal; font-stretch: normal; font-variation-settings: normal; }\n.cp-package-title { color: navy; background-image: url("${CSS_IMAGE_SCENE_URL}"); }`,
  }
}

/** Installs an isolated iterable FontFaceSet for one loader test. */
function stubFontSet(fontSet: Set<FontFace>): () => void {
  const previous = Object.getOwnPropertyDescriptor(document, 'fonts')
  Object.defineProperty(document, 'fonts', { configurable: true, value: fontSet })
  return () => {
    if (previous === undefined) delete (document as unknown as { fonts?: FontFaceSet }).fonts
    else Object.defineProperty(document, 'fonts', previous)
  }
}

/** Creates a deterministic FontFace stand-in with the package descriptor values. */
function createTestFontFace(
  load: () => Promise<void> = async () => undefined,
  descriptors: Partial<Pick<FontFace, 'family' | 'weight' | 'style' | 'stretch' | 'variationSettings' | 'unicodeRange' | 'display'>> = {},
): FontFace {
  let status: FontFace['status'] = 'unloaded'
  const fontFace = {
    family: 'Package Probe',
    weight: '700',
    style: 'normal',
    stretch: 'normal',
    variationSettings: 'normal',
    unicodeRange: 'U+0-10FFFF',
    display: 'auto',
    ...descriptors,
    get status() { return status },
    async load() {
      await load()
      status = 'loaded'
      return fontFace
    },
  }
  return fontFace as unknown as FontFace
}

/** Builds a native audio-tag package from the public compiler occurrence metadata. */
function createAudioPackageData(owner: CodPlay): Readonly<{
  manifest: Record<string, unknown>
  sceneJson: string
}> {
  const result = owner.build({
    scene: {
      id: 'package-load-audio-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'audio',
            type: 'tag',
            initial: { tag: 'audio', attr: { src: '/assets/voice.mp3' }, move: '@root' },
            actions: {},
          }],
        },
      },
    },
  }, { export: true })
  if (!result.ok) throw new Error('Native audio package fixture did not compile.')
  const reference = result.resourceReferences?.[0]
  if (reference === undefined) throw new Error('Native audio package fixture has no compiler reference.')
  return {
    manifest: {
      format: 'codplay.scene-package.v1',
      scene: 'scene/scene.json',
      functions: [],
      resources: [{
        sceneUrl: AUDIO_SCENE_URL,
        file: AUDIO_PACKAGE_FILE,
        suffix: '',
        type: 'audio',
        occurrences: [reference.path],
      }],
    },
    sceneJson: JSON.stringify(packageScene(result.compiledScene, reference, AUDIO_SCENE_URL)),
  }
}

/** Rewrites one copied scene fixture at exact compiler-provided occurrence paths. */
function packageScene(
  source: CompiledScene,
  reference: SceneBuildResourceReference,
  sceneUrl = SCENE_URL,
): CompiledScene {
  const compiledScene = JSON.parse(JSON.stringify(source)) as MutablePackageScene
  writePath(compiledScene, reference.path, sceneUrl)
  compiledScene.resources.entries = compiledScene.resources.entries.map((entry) => ({ ...entry, url: sceneUrl }))
  compiledScene.requirements.resources = [sceneUrl]
  return compiledScene as CompiledScene
}

/** Writes one JSON value at the compiler path used by the package fixture. */
function writePath(root: unknown, path: readonly (string | number)[], value: string): void {
  let parent = root as Record<string | number, unknown>
  for (const segment of path.slice(0, -1)) parent = parent[segment] as Record<string | number, unknown>
  parent[path.at(-1)!] = value
}

/** Stubs the two package fetches without relying on a demo or a live server. */
function createPackageFetch(manifest: Record<string, unknown>, sceneJson: string, cssText = '') {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const isManifest = url.endsWith('/export-manifest.json')
    const isStyleSheet = url.endsWith('/scene/style.css')
    return {
      ok: true,
      status: 200,
      json: async () => manifest,
      text: async () => (isManifest ? JSON.stringify(manifest) : isStyleSheet ? cssText : sceneJson),
    } as Response
  })
}

/** Returns the exact success shape consumed by the existing preload registration path. */
function createPreloadSuccess(
  url: string,
  type: string = 'image',
  additionalResources: readonly Readonly<{ url: string; type: string }>[] = [],
): RuntimePreloadResult {
  const urls = [url, ...additionalResources.map((resource) => resource.url)]
  return {
    ok: true,
    data: {
      loaded: urls,
      skipped: [],
      metadata: Object.fromEntries([
        [url, { type }],
        ...additionalResources.map((resource) => [resource.url, { type: resource.type }]),
      ]),
    },
  }
}
