/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { CodPlay } from '../../src'
import { CompiledSceneCodec } from '../../src/scene/compiled'
import { loadScenePackage } from '../../src/facade/scene-package-loader'

const temporaryDirectories = []
const PACKAGE_ORIGIN = 'https://outside-project.example/'

describe('scene export acceptance', () => {
  let player
  let restoreNativeMedia

  afterEach(async () => {
    player?.destroy()
    player = undefined
    restoreNativeMedia?.()
    restoreNativeMedia = undefined
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
  })

  it('loads a moved package without its source and executes its packaged lifecycle and capture functions', async () => {
    const directory = await createTemporaryDirectory()
    const sourceDirectory = path.join(directory, 'source-project')
    const buildDirectory = path.join(directory, 'build-output')
    const externalProject = path.join(directory, 'independent-site', 'public', 'programs', 'scene-a')
    const sourceFile = path.join(sourceDirectory, 'scene.ts')
    const sourceModule = [
      "import { mark } from './trace.ts'",
      'const initCaptureState = () => { mark("capture:init"); return { value: 0 } }',
      'const trackCommand = ({ sample }) => { mark("capture:track"); return { captureState: { value: sample.clientX } } }',
      'const endCapture = ({ captureState }) => { mark("capture:end"); return { events: [{ name: "capture:stored", visibility: "public", data: { value: captureState.value } }] } }',
      'export const scene = {',
      "  id: 'external-package-functions',",
      '  init: () => mark("init"),',
      '  onStart: () => mark("onStart"),',
      '  onSequenceEnd: () => mark("onSequenceEnd"),',
      "  eventimes: [{ name: 'sequence:end', startAt: 100 }],",
      '  stories: { main: {',
      "    id: 'main',",
      '    persos: [{',
      "      id: 'capture-button',",
      "      type: 'tag',",
      "      initial: { tag: 'button', content: 'Capture', move: '@root' },",
      '      actions: {},',
      '      emit: { pointerdown: {',
      "        event: { name: 'capture:start', visibility: 'public' },",
      '        capture: {',
      "          trackOn: ['pointermove'],",
      "          endOn: ['pointerup'],",
      '          initCaptureState,',
      '          trackCommand,',
      '          endCapture,',
      "          endEmit: { name: 'capture:ended', visibility: 'public' },",
      '        },',
      '      } },',
      '    }],',
      '  } },',
      '}',
      '',
    ].join('\n')
    await mkdir(sourceDirectory, { recursive: true })
    await writeFile(sourceFile, sourceModule)
    await writeFile(path.join(sourceDirectory, 'trace.ts'), [
      'export function mark(name: string) {',
      '  globalThis.__scenePackageAcceptanceCalls.push(name)',
      '}',
      '',
    ].join('\n'))

    const sourcePackage = path.join(buildDirectory, 'scene-package')
    await runSceneExportCommand(sourceFile, sourcePackage, directory)
    await mkdir(path.dirname(externalProject), { recursive: true })
    await rename(path.join(buildDirectory, 'scene-package'), externalProject)
    await rm(sourceDirectory, { recursive: true, force: true })

    const manifestText = await readFile(path.join(externalProject, 'export-manifest.json'), 'utf8')
    const manifest = JSON.parse(manifestText)
    const functionsFile = path.join(externalProject, manifest.functions.file)
    const functionsText = await readFile(functionsFile, 'utf8')
    expect(manifest.functions.file).toBe('scene/functions.mjs')
    expect(manifest.functions.references.map(({ path: segments }) => segments)).toEqual(expect.arrayContaining([
      ['init'],
      ['onStart'],
      ['onSequenceEnd'],
      ['stories', 'main', 'persos', 0, 'emit', 'pointerdown', 'capture', 'initCaptureState'],
      ['stories', 'main', 'persos', 0, 'emit', 'pointerdown', 'capture', 'trackCommand'],
      ['stories', 'main', 'persos', 0, 'emit', 'pointerdown', 'capture', 'endCapture'],
    ]))
    expect(functionsText).not.toContain(sourceDirectory)
    expect(functionsText).not.toMatch(/\bfrom\s+['"]|\bimport\s*\(/)
    await expect(readFile(sourceFile, 'utf8')).rejects.toThrow()
    await expect(readFile(path.join(externalProject, 'codplay.js'))).rejects.toThrow()

    const packageBase = new URL('programs/scene-a/', PACKAGE_ORIGIN)
    const requestedFiles = []
    vi.stubGlobal('__scenePackageAcceptanceCalls', [])
    vi.stubGlobal('fetch', async (input) => {
      const url = new URL(String(input))
      if (url.origin !== packageBase.origin || !url.pathname.startsWith(packageBase.pathname)) {
        throw new Error(`Package request escaped the external project: ${url.href}`)
      }
      const relativePath = decodeURIComponent(url.pathname.slice(packageBase.pathname.length))
      requestedFiles.push(relativePath)
      const body = await readFile(path.join(externalProject, relativePath), 'utf8')
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(body),
        text: async () => body,
      }
    })

    player = createPlayer()
    const root = document.createElement('main')
    root.id = 'external-scene-root'
    document.body.append(root)
    const moduleImporter = vi.fn(async (moduleUrl) => {
      expect(moduleUrl.href).toBe(new URL(manifest.functions.file, packageBase).href)
      return importNativeEsm(functionsFile)
    })
    const instance = (await loadScenePackage(player, packageBase.href, root, 'external-scene', moduleImporter)).instance
    const calls = globalThis.__scenePackageAcceptanceCalls
    expect(calls).toEqual(['init'])

    player.engine.advance(0)
    await instance.telco.play()
    expect(calls).toContain('onStart')

    const button = root.querySelector('button')
    expect(button).not.toBeNull()
    button?.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 4, clientX: 0, clientY: 0 }))
    document.dispatchEvent(createPointerEvent('pointermove', { pointerId: 4, clientX: 37, clientY: 9, movementX: 37, movementY: 9 }))
    document.dispatchEvent(createPointerEvent('pointerup', { pointerId: 4, clientX: 37, clientY: 9 }))
    await flushSourceTasks()

    expect(calls).toEqual(expect.arrayContaining(['capture:init', 'capture:track', 'capture:end']))

    player.engine.advance(200)
    await flushSourceTasks()
    expect(calls).toContain('onSequenceEnd')
    expect(requestedFiles.sort()).toEqual(['export-manifest.json', manifest.scene])
    expect(moduleImporter).toHaveBeenCalledOnce()
  })

  it('preloads initial and future media once and reuses them through seek, reset, replay and destroy', async () => {
    const mediaState = stubNativeMedia()
    restoreNativeMedia = mediaState.restore
    player = createPlayer()
    const packageData = createMediaSwapPackageData(player)
    const root = document.createElement('main')
    root.id = 'media-package-root'
    document.body.append(root)
    vi.stubGlobal('fetch', createPackageFetch(packageData.manifest, packageData.sceneJson))

    const instance = await player.load(PACKAGE_BASE_URL, { root })
    expect(mediaState.loads).toHaveLength(2)
    expect(root.querySelector('video')?.src).toBe(packageData.mediaUrls[0])

    await instance.telco.seek(150)
    expect(root.querySelector('video')?.src).toBe(packageData.mediaUrls[1])
    await instance.telco.seek(0)
    expect(root.querySelector('video')?.src).toBe(packageData.mediaUrls[0])
    await instance.telco.reset()
    await instance.telco.play()
    await instance.telco.seek(150)
    expect(root.querySelector('video')?.src).toBe(packageData.mediaUrls[1])
    await instance.telco.seek(0)
    expect(root.querySelector('video')?.src).toBe(packageData.mediaUrls[0])
    expect(mediaState.loads).toHaveLength(2)

    player.instances.destroy(instance.instanceId)
    expect(root.childElementCount).toBe(0)
    expect(mediaState.loads).toHaveLength(2)
    player.destroy()
    player = undefined
    expect(document.body.querySelectorAll('video')).toHaveLength(0)
    expect(mediaState.loads).toHaveLength(2)
  })

  it('releases failed module imports without creating an instance and allows a clean retry', async () => {
    player = createPlayer()
    const onStart = () => undefined
    const build = player.build({
      scene: {
        id: 'failed-module-retry-fixture',
        onStart,
        stories: { main: { id: 'main', persos: [] } },
      },
    }, { export: true })
    if (!build.ok || build.functionReferences === undefined) throw new Error('Retry fixture did not produce function references.')
    const manifest = {
      format: 'codplay.scene-package.v1',
      scene: 'scene/scene.json',
      functions: { file: 'scene/functions.mjs', references: build.functionReferences },
      resources: [],
    }
    const codec = new CompiledSceneCodec({ diagnosticOutput: () => undefined })
    vi.stubGlobal('fetch', createPackageFetch(manifest, codec.encode(build.compiledScene)))
    const root = document.createElement('main')
    document.body.append(root)

    const failedImporter = vi.fn(async () => { throw new Error('function module unavailable') })
    await expect(loadScenePackage(player, PACKAGE_BASE_URL, root, 'module-retry', failedImporter))
      .rejects.toThrow('function module unavailable')
    expect(player.instances.get('module-retry')).toBeUndefined()
    expect(root.childElementCount).toBe(0)

    const startReference = build.functionReferences.find(({ path: segments }) => JSON.stringify(segments) === JSON.stringify(['onStart']))
    if (startReference === undefined) throw new Error('Retry fixture has no onStart reference.')
    const workingImporter = vi.fn(async () => ({
      functionReferences: build.functionReferences,
      createScenePackageContext: () => ({
        functions: { [startReference.ref]: onStart },
        strapCollections: { scene: {}, stories: {} },
      }),
    }))
    const recovered = (await loadScenePackage(player, PACKAGE_BASE_URL, root, 'module-retry', workingImporter)).instance
    expect(player.instances.get(recovered.instanceId)).toBe(recovered)
    expect(workingImporter).toHaveBeenCalledOnce()
  })

  it('cleans preloaded native video nodes when an external package resource fails', async () => {
    const mediaState = stubNativeMedia('error')
    restoreNativeMedia = mediaState.restore
    player = createPlayer()
    const packageData = createMediaSwapPackageData(player)
    const root = document.createElement('main')
    document.body.append(root)
    vi.stubGlobal('fetch', createPackageFetch(packageData.manifest, packageData.sceneJson))

    await expect(player.load(PACKAGE_BASE_URL, { root })).rejects.toThrow(/resource|preload/i)
    expect(player.instances.get('codplay-load-1')).toBeUndefined()
    expect(root.childElementCount).toBe(0)
    expect(document.body.querySelectorAll('video')).toHaveLength(0)
    expect(mediaState.loads).toHaveLength(2)
  })

  it.fails('keeps a future preloaded video from becoming visible outside the scene root', async () => {
    restoreNativeMedia = stubNativeMedia().restore
    player = createPlayer()
    const packageData = createMediaSwapPackageData(player)
    const root = document.createElement('main')
    document.body.append(root)
    vi.stubGlobal('fetch', createPackageFetch(packageData.manifest, packageData.sceneJson))

    await player.load(PACKAGE_BASE_URL, { root })
    const videosOutsideRoot = [...document.body.querySelectorAll('video')].filter((video) => !root.contains(video))
    expect(videosOutsideRoot).toHaveLength(0)
  })
})

const PACKAGE_BASE_URL = 'https://site.example/exports/media-case/'

/** Creates an owner without an active frame channel so integration time advances explicitly. */
function createPlayer() {
  return new CodPlay({
    pauseOnDocumentHidden: false,
    frameScheduler: { request: () => 0, cancel: () => undefined },
  })
}

/** Builds and relocates no resources: every media value is owned by this test fixture. */
function createMediaSwapPackageData(owner) {
  const source = {
    id: 'owned-media-package-fixture',
    eventimes: [{ name: 'sequence:end', startAt: 300 }],
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'clip',
          type: 'media',
          initial: { tag: 'video', src: '/owned-fixture/first.mp4', move: '@root' },
          actions: { switch: { src: '/owned-fixture/second.mp4' } },
        }],
        eventimes: [{ name: 'switch', startAt: 100 }],
      },
    },
  }
  const result = owner.build({ scene: source }, { export: true })
  if (!result.ok) throw new Error('Owned media package fixture did not compile.')
  const referenceMap = new Map()
  for (const reference of result.resourceReferences ?? []) {
    const occurrences = referenceMap.get(reference.url) ?? []
    occurrences.push(reference)
    referenceMap.set(reference.url, occurrences)
  }

  const digests = ['0123456789abcdefabcd', 'fedcba9876543210fedc']
  const mediaUrls = [...referenceMap.keys()].map((_, index) => `assets/${digests[index]}.mp4`)
  const mediaPackages = [...referenceMap.entries()].map(([sourceUrl, references], index) => ({
    sourceUrl,
    sceneUrl: mediaUrls[index],
    file: `scene/${mediaUrls[index]}`,
    suffix: '',
    type: 'video',
    occurrences: references.map(({ path: occurrencePath }) => occurrencePath),
  }))
  const sceneCopy = JSON.parse(JSON.stringify(result.compiledScene))
  for (const { sourceUrl, sceneUrl } of mediaPackages) {
    for (const reference of referenceMap.get(sourceUrl) ?? []) writePath(sceneCopy, reference.path, sceneUrl)
    sceneCopy.resources.entries = sceneCopy.resources.entries.map((entry) => (
      entry.url === sourceUrl ? { ...entry, url: sceneUrl } : entry
    ))
  }
  sceneCopy.requirements.resources = sceneCopy.resources.entries.map(({ url }) => url)
  const codec = new CompiledSceneCodec({ diagnosticOutput: () => undefined })
  return {
    manifest: {
      format: 'codplay.scene-package.v1',
      scene: 'scene/scene.json',
      functions: [],
      resources: mediaPackages.map(({ sourceUrl: _sourceUrl, ...resource }) => resource),
    },
    sceneJson: codec.encode(sceneCopy),
    mediaUrls: mediaPackages.map(({ file }) => new URL(file, PACKAGE_BASE_URL).href),
  }
}

/** Runs the public Node export command against one test-owned source fixture. */
async function runSceneExportCommand(sceneFile, destination, workingDirectory) {
  const commandFile = path.resolve('tools/scene-export/cli.mjs')
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [commandFile, '--scene', sceneFile, '--export', destination], {
      cwd: workingDirectory,
      env: { ...process.env, INIT_CWD: workingDirectory },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`Scene export CLI failed (${signal ?? code}): ${stderr}`))
    })
  })
}

/** Writes one package URL at the exact occurrence path returned by the compiler. */
function writePath(root, segments, value) {
  let parent = root
  for (const segment of segments.slice(0, -1)) parent = parent[segment]
  parent[segments.at(-1)] = value
}

/** Reads the manifest and compiled scene through the same fetch surface used by a site. */
function createPackageFetch(manifest, sceneJson) {
  return vi.fn(async (input) => {
    const isManifest = String(input).endsWith('/export-manifest.json')
    return {
      ok: true,
      status: 200,
      json: async () => manifest,
      text: async () => (isManifest ? JSON.stringify(manifest) : sceneJson),
    }
  })
}

/** Stubs native media readiness and records every browser preload operation. */
function stubNativeMedia(readinessEvent = 'canplaythrough') {
  const prototype = HTMLMediaElement.prototype
  const currentTimes = new WeakMap()
  const previousDescriptors = new Map(['readyState', 'duration', 'currentTime'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(prototype, key),
  ]))
  Object.defineProperty(prototype, 'readyState', { configurable: true, get: () => 4 })
  Object.defineProperty(prototype, 'duration', { configurable: true, get: () => 10 })
  Object.defineProperty(prototype, 'currentTime', {
    configurable: true,
    get() { return currentTimes.get(this) ?? 0 },
    set(value) { currentTimes.set(this, value) },
  })
  const loads = []
  vi.spyOn(prototype, 'load').mockImplementation(function () {
    loads.push(this.src)
    this.dispatchEvent(new Event(readinessEvent))
  })
  vi.spyOn(prototype, 'pause').mockImplementation(() => undefined)
  vi.spyOn(prototype, 'play').mockResolvedValue(undefined)
  const restore = () => {
    for (const [key, descriptor] of previousDescriptors) {
      if (descriptor === undefined) delete prototype[key]
      else Object.defineProperty(prototype, key, descriptor)
    }
  }
  return { loads, restore }
}

/** Creates one DOM pointer event with only the fields consumed by CodPlay's capture adapter. */
function createPointerEvent(type, fields) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  for (const [name, value] of Object.entries(fields)) Object.defineProperty(event, name, { value })
  return event
}

/** Lets queued capture source adapter callbacks settle between native DOM events. */
async function flushSourceTasks() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** Imports one package file with Node's native ESM loader instead of the test bundler. */
function importNativeEsm(moduleFile) {
  const require = createRequire(pathToFileURL(path.resolve('package.json')))
  return require(moduleFile)
}

/** Creates one isolated temporary source/external-project directory for acceptance tests. */
async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codplay-scene-package-acceptance-'))
  temporaryDirectories.push(directory)
  return directory
}
