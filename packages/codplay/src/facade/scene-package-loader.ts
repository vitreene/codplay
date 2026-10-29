import {
  CompiledSceneCodec,
  type CompiledFunctionCollection,
  type CompiledResource,
  type CompiledScene,
  type SceneBuildFunctionReference,
} from '../scene/compiled'
import { validateStrapCollections } from '../runtime/player/pipeline/strap-collections'
import type { StrapCollections } from '../runtime/player/pipeline'
import type { CodPlayApi, CodPlayInstance } from './facade-types'

type ScenePackageFunctionModule = Readonly<{
  file: 'scene/functions.mjs'
  references: readonly SceneBuildFunctionReference[]
}>

type ScenePackageFunctionContext = Readonly<{
  functions: CompiledFunctionCollection
  strapCollections: StrapCollections
}>

type ScenePackageFunctionModuleRuntime = Readonly<{
  functionReferences: readonly SceneBuildFunctionReference[]
  createScenePackageContext: () => unknown
}>

type ScenePackageFunctionModuleImporter = (moduleUrl: URL) => Promise<ScenePackageFunctionModuleRuntime>

const packageFunctionContexts = new WeakMap<object, Map<string, Promise<ScenePackageFunctionContext>>>()
const emptyFunctionContext: ScenePackageFunctionContext = Object.freeze({
  functions: Object.freeze({}),
  strapCollections: Object.freeze({ scene: Object.freeze({}), stories: Object.freeze({}) }),
})

type ScenePackageResource = Readonly<{
  sceneUrl: string
  file: string
  suffix: string
  type: string
  occurrences: readonly ScenePackageOccurrence[]
}>

type ScenePackageOccurrence = Readonly<{
  path: readonly (string | number)[]
  cssUrl?: string
}>

type ScenePackageManifest = Readonly<{
  format: 'codplay.scene-package.v1'
  scene: 'scene/scene.json'
  functions?: ScenePackageFunctionModule
  resources: readonly ScenePackageResource[]
  styleSheet?: ScenePackageStyleSheet
}>

type ScenePackageStyleSheetResource = Readonly<{
  tokens: readonly string[]
  sceneUrl: string
  file: string
  suffix: string
  type: 'image' | 'font'
}>

type ScenePackageFontFace = Readonly<{
  sourceOrder: number
  family: string
  src: string
  weight: string
  style: string
  stretch: string
  variationSettings: string
  unicodeRange: string
  display: string
}>

type ScenePackageStyleSheet = Readonly<{
  file: 'scene/style.css'
  classNames: readonly string[]
  resources: readonly ScenePackageStyleSheetResource[]
  fontFaces: readonly ScenePackageFontFace[]
}>

export type LoadedScenePackage = Readonly<{
  instance: CodPlayInstance
  cssSlot?: string
}>

/** One validated and resource-ready package scene without a created occurrence. */
export type PreparedScenePackage = Readonly<{
  compiledScene: CompiledScene
  functions: CompiledFunctionCollection
  strapCollections: StrapCollections
  resourceUrls: readonly string[]
  root: HTMLElement
  cssSlot?: string
}>

/** Releases cached owner/package closures when their CodPlay owner is destroyed. */
export function releaseScenePackageContexts(owner: object): void {
  packageFunctionContexts.delete(owner)
}

type MutableCompiledScene = Omit<CompiledScene, 'resources' | 'requirements'> & {
  resources: CompiledScene['resources']
  requirements: CompiledScene['requirements']
}

/** Validates and prepares one compiled scene package without creating an occurrence. */
export async function prepareScenePackage(
  owner: Pick<CodPlayApi, 'engine' | 'preload' | 'resources'>,
  scenePath: string,
  rootInput: HTMLElement | string,
  cssSlot: string,
  moduleImporter: ScenePackageFunctionModuleImporter = importFunctionModuleFromUrl,
): Promise<PreparedScenePackage> {
  const root = resolveRoot(rootInput)
  const baseUrl = resolvePackageBase(scenePath)
  const response = await fetch(new URL('export-manifest.json', baseUrl))
  if (!response.ok) throw new Error(`Scene package manifest request failed (${response.status}).`)
  const packageManifest = parsePackageManifest(await response.json())
  const sceneResponse = await fetch(new URL(packageManifest.scene, baseUrl))
  if (!sceneResponse.ok) throw new Error(`Compiled scene request failed (${sceneResponse.status}).`)

  const codec = new CompiledSceneCodec({ diagnosticOutput: () => undefined })
  const decoded = codec.decode(await sceneResponse.text())
  if (!decoded.ok) {
    const errors = decoded.diagnostics.errors.map((entry) => entry.message).join(' ')
    throw new Error(`Compiled scene is invalid: ${errors}`)
  }

  const compiledScene = restorePackageResourceUrls(decoded.value, packageManifest, baseUrl)
  const validatedScene = codec.decode(codec.encode(compiledScene))
  if (!validatedScene.ok) throw new Error('Restored compiled scene failed codec validation.')

  const functionContext = packageManifest.functions === undefined
    ? emptyFunctionContext
    : await loadPackageFunctionContext(owner, packageManifest.functions, baseUrl, moduleImporter)
  const strapIssues = validateStrapCollections(
    validatedScene.value,
    functionContext.strapCollections,
    functionContext.functions,
  )
  if (strapIssues.length > 0) {
    throw new Error(strapIssues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'))
  }

  const stylesheet = packageManifest.styleSheet === undefined
    ? undefined
    : await loadPackageStyleSheet(packageManifest.styleSheet, baseUrl)

  await owner.engine.prepareScene(validatedScene.value)
  const stylesheetEntries: CompiledResource[] = stylesheet?.resources.map((resource) => ({
    url: resource.url,
    type: resource.type,
    policy: { cache: 'immutable' },
  })) ?? []
  const preloaded = await owner.preload.load({
    manifest: stylesheetEntries.length === 0
      ? validatedScene.value.resources
      : [validatedScene.value.resources, { entries: stylesheetEntries }],
    options: { mode: 'author', container: root },
  })
  if (!preloaded.ok) {
    const details = preloaded.error.details?.map((entry) => `${entry.details.url}: ${entry.details.error}`).join('; ')
    throw new Error(details === undefined
      ? preloaded.error.message
      : `${preloaded.error.message} ${details}`)
  }

  owner.resources.register({
    loaded: preloaded.data.loaded,
    skipped: preloaded.data.skipped,
    metadata: preloaded.data.metadata,
    media: preloaded.data.media,
  })
  const stylesheetSlot = stylesheet === undefined ? undefined : cssSlot
  try {
    if (stylesheet !== undefined && stylesheetSlot !== undefined) {
      const existingFontFaces = stylesheet.fontFaces.length === 0 ? undefined : snapshotFontFaces()
      owner.preload.css.set({ slot: stylesheetSlot, cssText: stylesheet.cssText, container: root })
      await waitForPackageFontFaces(stylesheetSlot, stylesheet.fontFaces, existingFontFaces ?? new Set())
    }
    return {
      compiledScene: validatedScene.value,
      functions: functionContext.functions,
      strapCollections: functionContext.strapCollections,
      resourceUrls: validatedScene.value.resources.entries.map((entry) => entry.url),
      root,
      ...(stylesheetSlot === undefined ? {} : { cssSlot: stylesheetSlot }),
    }
  } catch (error) {
    if (stylesheetSlot !== undefined) owner.preload.css.clear(stylesheetSlot)
    throw error
  }
}

/** Loads one prepared package as an occurrence while retaining CodPlay's existing lifecycle. */
export async function loadScenePackage(
  owner: Pick<CodPlayApi, 'engine' | 'instances' | 'preload' | 'resources'>,
  scenePath: string,
  rootInput: HTMLElement | string,
  instanceId: string,
  moduleImporter: ScenePackageFunctionModuleImporter = importFunctionModuleFromUrl,
): Promise<LoadedScenePackage> {
  const prepared = await prepareScenePackage(
    owner,
    scenePath,
    rootInput,
    `scene-package:${instanceId}`,
    moduleImporter,
  )
  try {
    const instance = owner.instances.create({
      instanceId,
      compiledScene: prepared.compiledScene,
      functions: prepared.functions,
      strapCollections: prepared.strapCollections,
      root: prepared.root,
    })
    await waitForRenderedResources(prepared.root, new Set(prepared.resourceUrls))
    return { instance, ...(prepared.cssSlot === undefined ? {} : { cssSlot: prepared.cssSlot }) }
  } catch (error) {
    if (prepared.cssSlot !== undefined) owner.preload.css.clear(prepared.cssSlot)
    owner.instances.destroy(instanceId)
    throw error
  }
}

/** Creates or reuses one function and strap context for this owner/package pair. */
async function loadPackageFunctionContext(
  owner: object,
  descriptor: ScenePackageFunctionModule,
  baseUrl: URL,
  moduleImporter: ScenePackageFunctionModuleImporter,
): Promise<ScenePackageFunctionContext> {
  let ownerContexts = packageFunctionContexts.get(owner)
  if (ownerContexts === undefined) {
    ownerContexts = new Map()
    packageFunctionContexts.set(owner, ownerContexts)
  }
  const packageKey = baseUrl.href
  const existing = ownerContexts.get(packageKey)
  if (existing !== undefined) return existing

  const pendingContext = importFunctionModule(descriptor, baseUrl, moduleImporter)
  ownerContexts.set(packageKey, pendingContext)
  try {
    return await pendingContext
  } catch (error) {
    ownerContexts.delete(packageKey)
    if (ownerContexts.size === 0) packageFunctionContexts.delete(owner)
    throw error
  }
}

/** Imports the generated factory and verifies its collection against manifest references. */
async function importFunctionModule(
  descriptor: ScenePackageFunctionModule,
  baseUrl: URL,
  importModule: ScenePackageFunctionModuleImporter,
): Promise<ScenePackageFunctionContext> {
  const moduleUrl = new URL(descriptor.file, baseUrl)
  const moduleRuntime = await importModule(moduleUrl)
  if (typeof moduleRuntime.createScenePackageContext !== 'function') {
    throw new Error('Scene package function module does not export createScenePackageContext().')
  }
  if (!sameFunctionReferences(descriptor.references, moduleRuntime.functionReferences)) {
    throw new Error('Scene package function module references do not match its manifest.')
  }
  return parseFunctionContext(moduleRuntime.createScenePackageContext(), descriptor.references)
}

/** Imports a generated function module through the browser's native ESM loader. */
async function importFunctionModuleFromUrl(moduleUrl: URL): Promise<ScenePackageFunctionModuleRuntime> {
  return await import(/* @vite-ignore */ moduleUrl.href) as ScenePackageFunctionModuleRuntime
}

/** Checks that the factory returns exactly one callable for every compiled reference. */
function parseFunctionContext(
  value: unknown,
  references: readonly SceneBuildFunctionReference[],
): ScenePackageFunctionContext {
  if (!isPlainRecord(value) || !isPlainRecord(value.functions)) {
    throw new Error('Scene package function factory returned an invalid function collection.')
  }
  const expectedRefs = new Set(references.map((reference) => reference.ref))
  const actualRefs = Object.keys(value.functions)
  if (actualRefs.length !== expectedRefs.size || actualRefs.some((ref) => !expectedRefs.has(ref))) {
    throw new Error('Scene package function factory returned references that do not match the manifest.')
  }
  for (const ref of expectedRefs) {
    if (typeof value.functions[ref] !== 'function') {
      throw new Error(`Scene package function reference is unavailable: ${ref}.`)
    }
  }
  return {
    functions: value.functions as CompiledFunctionCollection,
    strapCollections: parseStrapCollections(value.strapCollections),
  }
}

/** Validates the runtime module's scoped external strap collections. */
function parseStrapCollections(value: unknown): StrapCollections {
  if (!isPlainRecord(value) || !isPlainRecord(value.scene) || !isPlainRecord(value.stories)) {
    throw new Error('Scene package strapCollections must have the shape { scene, stories }.')
  }
  for (const [name, strap] of Object.entries(value.scene)) {
    if (typeof strap !== 'function') throw new Error(`Scene package scene strap is not callable: ${name}.`)
  }
  for (const [storyId, collection] of Object.entries(value.stories)) {
    if (!isPlainRecord(collection)) throw new Error(`Scene package story straps are invalid: ${storyId}.`)
    for (const [name, strap] of Object.entries(collection)) {
      if (typeof strap !== 'function') throw new Error(`Scene package story strap is not callable: ${storyId}.${name}.`)
    }
  }
  return value as unknown as StrapCollections
}

/** Compares manifest and generated module function paths in declaration order. */
function sameFunctionReferences(
  expected: readonly SceneBuildFunctionReference[],
  actual: readonly SceneBuildFunctionReference[],
): boolean {
  return Array.isArray(actual)
    && expected.length === actual.length
    && expected.every((reference, index) => {
      const candidate = actual[index]
      return candidate !== undefined
        && candidate.ref === reference.ref
        && Array.isArray(candidate.path)
        && candidate.path.length === reference.path.length
        && reference.path.every((segment, segmentIndex) => candidate.path[segmentIndex] === segment)
    })
}

/** Fetches one packaged stylesheet and rebases only compiler-emitted asset paths. */
async function loadPackageStyleSheet(styleSheet: ScenePackageStyleSheet, baseUrl: URL): Promise<Readonly<{
  cssText: string
  resources: readonly Readonly<{ url: string; type: 'image' | 'font' }>[]
  fontFaces: readonly ScenePackageFontFace[]
}>> {
  const response = await fetch(new URL(styleSheet.file, baseUrl))
  if (!response.ok) throw new Error(`Scene package stylesheet request failed (${response.status}).`)
  let cssText = await response.text()
  const fontFaces = styleSheet.fontFaces.map((fontFace) => ({ ...fontFace }))
  const resources = styleSheet.resources.map((resource) => {
    const tokenUrl = `url(${JSON.stringify(resource.sceneUrl)})`
    const packageUrl = `${new URL(resource.file, baseUrl).href}${resource.suffix}`
    const replacementUrl = `url(${JSON.stringify(packageUrl)})`
    const occurrences = cssText.split(tokenUrl).length - 1
    if (occurrences === 0) {
      throw new Error(`Scene package stylesheet is missing compiler resource token: ${resource.sceneUrl}`)
    }
    cssText = cssText.replaceAll(tokenUrl, replacementUrl)
    for (const fontFace of fontFaces) fontFace.src = fontFace.src.replaceAll(tokenUrl, replacementUrl)
    return { url: packageUrl, type: resource.type }
  })
  return { cssText, resources, fontFaces }
}

/** Snapshots existing FontFace objects so the package is matched to its own stylesheet. */
function snapshotFontFaces(): Set<FontFace> {
  const fontSet = globalThis.document?.fonts
  if (fontSet === undefined) throw new Error('CodPlay scene package fonts require the browser FontFaceSet API.')
  return new Set(Array.from(fontSet))
}

/** Waits for every CSS face declared by this package's scoped stylesheet. */
async function waitForPackageFontFaces(
  cssSlot: string,
  expectedFaces: readonly ScenePackageFontFace[],
  existingFaces: ReadonlySet<FontFace>,
): Promise<void> {
  if (expectedFaces.length === 0) return
  const styleElement = Array.from(globalThis.document.head.querySelectorAll<HTMLStyleElement>('style[data-codplay-preload-css-slot]'))
    .find((element) => element.getAttribute('data-codplay-preload-css-slot') === cssSlot)
  if (styleElement === undefined || styleElement.sheet === null) {
    throw new Error(`CodPlay scene package stylesheet slot is unavailable: ${cssSlot}`)
  }

  let cssRules: CSSRuleList
  try {
    cssRules = styleElement.sheet.cssRules
  } catch (error) {
    throw new Error(`CodPlay scene package stylesheet cannot be inspected: ${formatError(error)}`)
  }
  const actualFaces = collectPackageFontFaceRules(cssRules)
  if (actualFaces.length !== expectedFaces.length) {
    throw new Error(`CodPlay scene package declares ${expectedFaces.length} font faces but its stylesheet exposes ${actualFaces.length}.`)
  }

  const registeredFaces = Array.from(globalThis.document.fonts ?? [])
    .filter((fontFace) => !existingFaces.has(fontFace))
  const waits: Promise<void>[] = []
  const usedFaces = new Set<FontFace>()
  for (let index = 0; index < expectedFaces.length; index += 1) {
    const expected = expectedFaces[index]
    const actual = actualFaces[index]
    if (expected === undefined || actual === undefined) continue
    const ruleFace = describeCssFontFace(actual.rule, index)
    if (!sameFontFaceDescriptor(expected, ruleFace)
      || ruleFace.src.trim() !== '' && normalizeFontSource(expected.src) !== normalizeFontSource(ruleFace.src)) {
      throw new Error(`CodPlay scene package font face ${index} does not match its compiled manifest.`)
    }
    const fontFace = actual.active
      ? registeredFaces.find((candidate) => !usedFaces.has(candidate)
        && sameFontFaceDescriptor(expected, describeRuntimeFontFace(candidate)))
      : undefined
    if (expected.src.trim() === '') {
      throw new Error(`CodPlay scene package font face has no CSS source: ${expected.family}`)
    }
    const faceToLoad = actual.active
      ? fontFace
      : createDetachedFontFace(expected)
    if (faceToLoad === undefined) {
      throw new Error(`CodPlay scene package font face is missing from document.fonts: ${expected.family}`)
    }
    if (actual.active) usedFaces.add(faceToLoad)
    if (typeof faceToLoad.load !== 'function') {
      throw new Error(`CodPlay scene package font face cannot be loaded: ${expected.family}`)
    }
    waits.push(faceToLoad.load().then(() => {
      if (faceToLoad.status !== 'loaded') throw new Error(`FontFace did not reach loaded state: ${expected.family}`)
    }).catch((error: unknown) => {
      throw new Error(`CodPlay scene package font failed to load (${expected.family}): ${formatError(error)}`)
    }))
  }
  await Promise.all(waits)
}

/** Finds CSS @font-face rules and records whether their enclosing conditions are active. */
function collectPackageFontFaceRules(rules: CSSRuleList, active = true): Array<{
  rule: CSSRule & { style: CSSStyleDeclaration }
  active: boolean
}> {
  const faces: Array<{ rule: CSSRule & { style: CSSStyleDeclaration }; active: boolean }> = []
  for (const rule of Array.from(rules)) {
    if (rule.type === 5 && 'style' in rule) {
      faces.push({ rule: rule as CSSRule & { style: CSSStyleDeclaration }, active })
      continue
    }
    if (!('cssRules' in rule)) continue
    const groupingRule = rule as CSSRule & { cssRules: CSSRuleList; conditionText?: string; media?: MediaList }
    const nextActive = active && isCssGroupingRuleActive(groupingRule)
    faces.push(...collectPackageFontFaceRules(groupingRule.cssRules, nextActive))
  }
  return faces
}

/** Evaluates the grouping conditions that can disable a CSS font face. */
function isCssGroupingRuleActive(rule: CSSRule & { conditionText?: string; media?: MediaList }): boolean {
  if (rule.type === 4) {
    const mediaText = rule.conditionText ?? rule.media?.mediaText ?? ''
    const matchMedia = globalThis.document.defaultView?.matchMedia
    if (typeof matchMedia !== 'function') return true
    return matchMedia.call(globalThis.document.defaultView, mediaText).matches
  }
  if (typeof rule.conditionText === 'string' && rule.constructor.name === 'CSSSupportsRule') {
    const supports = globalThis.CSS?.supports
    return typeof supports !== 'function' || supports(rule.conditionText)
  }
  return true
}

/** Reads the font descriptors exposed by one browser CSSFontFaceRule. */
function describeCssFontFace(rule: CSSRule & { style: CSSStyleDeclaration }, sourceOrder: number): ScenePackageFontFace {
  const style = rule.style
  return {
    sourceOrder,
    family: normalizeFontFamily(style.getPropertyValue('font-family')),
    src: style.getPropertyValue('src'),
    weight: normalizeFontDescriptor(style.getPropertyValue('font-weight') || 'normal'),
    style: normalizeFontDescriptor(style.getPropertyValue('font-style') || 'normal'),
    stretch: normalizeFontDescriptor(style.getPropertyValue('font-stretch') || 'normal'),
    variationSettings: normalizeFontDescriptor(style.getPropertyValue('font-variation-settings') || 'normal'),
    unicodeRange: normalizeFontDescriptor(style.getPropertyValue('unicode-range') || 'U+0-10FFFF'),
    display: normalizeFontDescriptor(style.getPropertyValue('font-display') || 'auto'),
  }
}

/** Loads an inactive face from its CSS source without registering it globally. */
function createDetachedFontFace(expected: ScenePackageFontFace): FontFace | undefined {
  if (typeof globalThis.FontFace !== 'function') return undefined
  return new globalThis.FontFace(expected.family, expected.src, {
    weight: expected.weight,
    style: expected.style,
    stretch: expected.stretch,
    variationSettings: expected.variationSettings,
    unicodeRange: expected.unicodeRange,
    display: expected.display as FontDisplay,
  })
}

/** Reads the equivalent descriptors from a registered FontFace object. */
function describeRuntimeFontFace(fontFace: FontFace): ScenePackageFontFace {
  return {
    sourceOrder: 0,
    family: normalizeFontFamily(fontFace.family),
    src: '',
    weight: normalizeFontDescriptor(fontFace.weight || 'normal'),
    style: normalizeFontDescriptor(fontFace.style || 'normal'),
    stretch: normalizeFontDescriptor(fontFace.stretch || 'normal'),
    variationSettings: normalizeFontDescriptor(fontFace.variationSettings || 'normal'),
    unicodeRange: normalizeFontDescriptor(fontFace.unicodeRange || 'U+0-10FFFF'),
    display: normalizeFontDescriptor(fontFace.display || 'auto'),
  }
}

/** Compares the descriptors that identify one package font face. */
function sameFontFaceDescriptor(left: ScenePackageFontFace, right: ScenePackageFontFace): boolean {
  return normalizeFontFamily(left.family) === normalizeFontFamily(right.family)
    && normalizeFontDescriptor(left.weight) === normalizeFontDescriptor(right.weight)
    && normalizeFontDescriptor(left.style) === normalizeFontDescriptor(right.style)
    && normalizeFontDescriptor(left.stretch) === normalizeFontDescriptor(right.stretch)
    && normalizeFontDescriptor(left.variationSettings) === normalizeFontDescriptor(right.variationSettings)
    && normalizeFontDescriptor(left.unicodeRange) === normalizeFontDescriptor(right.unicodeRange)
    && normalizeFontDescriptor(left.display) === normalizeFontDescriptor(right.display)
}

/** Normalizes one CSS family serialization from CSSOM or FontFace. */
function normalizeFontFamily(value: string): string {
  const trimmed = value.trim()
  const first = trimmed[0]
  const unquoted = (first === '"' || first === "'") && trimmed.at(-1) === first
    ? trimmed.slice(1, -1)
    : trimmed
  return unquoted.replace(/\\([\da-fA-F]{1,6})\s?/g, (_match, hex: string) => {
    const codePoint = Number.parseInt(hex, 16)
    return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '\uFFFD'
  }).replace(/\\([\\"'])/g, '$1').replace(/\s+/g, ' ').trim()
}

/** Normalizes whitespace and casing for CSS font descriptors. */
function normalizeFontDescriptor(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Normalizes spacing around CSS font source functions without changing URL case. */
function normalizeFontSource(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/(["'])(.*?)\1/g, '«$2»')
}

/** Formats one unknown error for the export loader's contextual failures. */
function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Waits for materialized native image and media nodes that belong to this package. */
async function waitForRenderedResources(root: HTMLElement, resourceUrls: ReadonlySet<string>): Promise<void> {
  const waits = new Set<Promise<void>>()
  for (const element of root.querySelectorAll('img, audio, video, source')) {
    if (!resourceUrls.has(readElementResourceUrl(element))) continue
    if (element instanceof HTMLImageElement) {
      waits.add(waitForImage(element))
      continue
    }
    const media = element instanceof HTMLSourceElement
      ? element.parentElement?.closest('audio, video')
      : element
    if (media instanceof HTMLMediaElement) waits.add(waitForMedia(media))
  }
  await Promise.all(waits)
}

/** Waits until one materialized image is loaded and decoded. */
function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    if (image.naturalWidth === 0) return Promise.reject(new Error(`Scene image failed to load: ${image.src}`))
    return typeof image.decode === 'function'
      ? image.decode().then(() => undefined)
      : Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      image.removeEventListener('load', onLoad)
      image.removeEventListener('error', onError)
    }
    const onLoad = (): void => {
      cleanup()
      const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve()
      void decoded.then(() => resolve(), reject)
    }
    const onError = (): void => {
      cleanup()
      reject(new Error(`Scene image failed to load: ${image.src}`))
    }
    image.addEventListener('load', onLoad, { once: true })
    image.addEventListener('error', onError, { once: true })
  })
}

/** Waits until one materialized native media element can play or reports an error. */
function waitForMedia(media: HTMLMediaElement): Promise<void> {
  if (media.readyState >= 3) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      media.removeEventListener('canplay', onReady)
      media.removeEventListener('canplaythrough', onReady)
      media.removeEventListener('error', onError)
    }
    const onReady = (): void => {
      if (media.readyState < 3) return
      cleanup()
      resolve()
    }
    const onError = (): void => {
      cleanup()
      reject(new Error(`Scene media failed to load: ${media.currentSrc || media.src}`))
    }
    media.addEventListener('canplay', onReady)
    media.addEventListener('canplaythrough', onReady)
    media.addEventListener('error', onError, { once: true })
    if (media.readyState >= 3) onReady()
  })
}

/** Returns the current package source for one native media element. */
function readElementResourceUrl(element: Element): string {
  if (element instanceof HTMLImageElement || element instanceof HTMLMediaElement || element instanceof HTMLSourceElement) {
    return 'currentSrc' in element && typeof element.currentSrc === 'string' && element.currentSrc.length > 0
      ? element.currentSrc
      : element.src
  }
  return ''
}

/** Resolves a package directory relative to the current document URL. */
function resolvePackageBase(scenePath: string): URL {
  if (typeof globalThis.document === 'undefined') {
    throw new Error('CodPlay.load() requires a browser document.')
  }
  const baseUrl = new URL(scenePath, globalThis.document.baseURI)
  if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/'
  return baseUrl
}

/** Resolves a CSS selector or verifies a supplied HTML element root. */
function resolveRoot(rootInput: HTMLElement | string): HTMLElement {
  if (typeof globalThis.document === 'undefined') {
    throw new Error('CodPlay.load() requires a browser document.')
  }
  const root = typeof rootInput === 'string'
    ? globalThis.document.querySelector(rootInput)
    : rootInput
  if (!isHTMLElement(root)) {
    throw new Error(typeof rootInput === 'string'
      ? `CodPlay.load() could not resolve root selector: ${rootInput}`
      : 'CodPlay.load() root must be an HTMLElement.')
  }
  return root
}

/** Checks the existing HTMLElement boundary used by the HTML player runtime. */
function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof value === 'object' && value !== null
    && 'nodeType' in value && value.nodeType === 1
    && 'appendChild' in value && typeof value.appendChild === 'function'
    && 'getBoundingClientRect' in value && typeof value.getBoundingClientRect === 'function'
}

/** Validates the versioned package manifest before any package file is used. */
function parsePackageManifest(value: unknown): ScenePackageManifest {
  if (!isPlainRecord(value)
    || value.format !== 'codplay.scene-package.v1'
    || value.scene !== 'scene/scene.json'
    || !Array.isArray(value.resources)) {
    throw new Error('Scene package manifest has an unsupported format.')
  }

  const functions = parseFunctionDescriptor(value.functions)
  const resources = value.resources.map((entry, index) => parsePackageResource(entry, index))
  const urls = new Set<string>()
  for (const resource of resources) {
    if (urls.has(resource.sceneUrl)) throw new Error(`Duplicate scene package resource: ${resource.sceneUrl}`)
    urls.add(resource.sceneUrl)
  }
  const styleSheet = value.styleSheet === undefined ? undefined : parsePackageStyleSheet(value.styleSheet)
  return {
    format: 'codplay.scene-package.v1',
    scene: 'scene/scene.json',
    ...(functions === undefined ? {} : { functions }),
    resources,
    ...(styleSheet === undefined ? {} : { styleSheet }),
  }
}

/** Validates the optional generated function module record. */
function parseFunctionDescriptor(value: unknown): ScenePackageFunctionModule | undefined {
  if (Array.isArray(value) && value.length === 0) return undefined
  if (!isPlainRecord(value)
    || value.file !== 'scene/functions.mjs'
    || !Array.isArray(value.references)) {
    throw new Error('Scene package function module record is invalid.')
  }
  const references = value.references.map((reference, index) => parseFunctionReference(reference, index))
  const refs = new Set<string>()
  for (const reference of references) {
    if (refs.has(reference.ref)) throw new Error(`Duplicate scene package function reference: ${reference.ref}`)
    refs.add(reference.ref)
  }
  return { file: 'scene/functions.mjs', references }
}

/** Validates one function reference and its structured source path. */
function parseFunctionReference(value: unknown, index: number): SceneBuildFunctionReference {
  if (!isPlainRecord(value)
    || typeof value.ref !== 'string'
    || value.ref.length === 0
    || !Array.isArray(value.path)
    || value.path.length === 0
    || value.path.some((segment) => typeof segment !== 'string'
      && (typeof segment !== 'number' || !Number.isInteger(segment) || segment < 0))) {
    throw new Error(`Scene package function reference ${index} is invalid.`)
  }
  return { ref: value.ref, path: value.path as Array<string | number> }
}

/** Validates one CSS file and its compiler-declared dependency list. */
function parsePackageStyleSheet(value: unknown): ScenePackageStyleSheet {
  if (!isPlainRecord(value)
    || value.file !== 'scene/style.css'
    || !Array.isArray(value.classNames)
    || value.classNames.some((name) => typeof name !== 'string' || name.length === 0)
    || !Array.isArray(value.resources)
    || !Array.isArray(value.fontFaces)) {
    throw new Error('Scene package stylesheet record is invalid.')
  }
  const resources = value.resources.map((entry, index) => parseStyleSheetResource(entry, index))
  const fontFaces = value.fontFaces.map((entry, index) => parseStyleSheetFontFace(entry, index))
  const tokens = new Set<string>()
  for (const resource of resources) {
    for (const token of resource.tokens) {
      if (tokens.has(token)) throw new Error(`Duplicate scene package CSS token: ${token}`)
      tokens.add(token)
    }
  }
  return { file: 'scene/style.css', classNames: value.classNames as string[], resources, fontFaces }
}

/** Validates one CSS font-face record emitted in compiled source order. */
function parseStyleSheetFontFace(value: unknown, index: number): ScenePackageFontFace {
  if (!isPlainRecord(value)
    || value.sourceOrder !== index
    || typeof value.family !== 'string'
    || value.family.trim() === ''
    || typeof value.src !== 'string'
    || value.src.trim() === ''
    || typeof value.weight !== 'string'
    || typeof value.style !== 'string'
    || typeof value.stretch !== 'string'
    || typeof value.variationSettings !== 'string'
    || typeof value.unicodeRange !== 'string'
    || typeof value.display !== 'string') {
    throw new Error(`Scene package CSS font face ${index} is invalid.`)
  }
  return {
    sourceOrder: index,
    family: value.family,
    src: value.src,
    weight: value.weight,
    style: value.style,
    stretch: value.stretch,
    variationSettings: value.variationSettings,
    unicodeRange: value.unicodeRange,
    display: value.display,
  }
}

/** Validates one CSS asset reference emitted by the export compiler. */
function parseStyleSheetResource(value: unknown, index: number): ScenePackageStyleSheetResource {
  if (!isPlainRecord(value)
    || !Array.isArray(value.tokens)
    || value.tokens.length === 0
    || value.tokens.some((token) => typeof token !== 'string' || !/^codplay-resource-\d+$/.test(token))
    || typeof value.sceneUrl !== 'string'
    || typeof value.file !== 'string'
    || typeof value.suffix !== 'string'
    || (value.type !== 'image' && value.type !== 'font')) {
    throw new Error(`Scene package CSS resource ${index} is invalid.`)
  }
  const scenePath = value.sceneUrl.split(/[?#]/, 1)[0] ?? ''
  if (!/^assets\/[a-f0-9]{20}(?:\.[a-z0-9]+)?$/.test(scenePath)
    || value.file !== `scene/${scenePath}`
    || value.suffix !== value.sceneUrl.slice(scenePath.length)
    || value.suffix !== '' && !/^[?#]/.test(value.suffix)) {
    throw new Error(`Scene package CSS resource ${index} has an invalid relative path.`)
  }
  return {
    tokens: value.tokens as string[],
    sceneUrl: value.sceneUrl,
    file: value.file,
    suffix: value.suffix,
    type: value.type,
  }
}

/** Validates one file record and its compiler-provided occurrence paths. */
function parsePackageResource(value: unknown, index: number): ScenePackageResource {
  if (!isPlainRecord(value)
    || typeof value.sceneUrl !== 'string'
    || typeof value.file !== 'string'
    || typeof value.suffix !== 'string'
    || typeof value.type !== 'string'
    || value.type.length === 0
    || !Array.isArray(value.occurrences)
    || value.occurrences.length === 0) {
    throw new Error(`Scene package resource ${index} is invalid.`)
  }

  const scenePath = value.sceneUrl.split(/[?#]/, 1)[0] ?? ''
  if (!/^assets\/[a-f0-9]{20}(?:\.[a-z0-9]+)?$/.test(scenePath)
    || value.file !== `scene/${scenePath}`
    || value.suffix !== value.sceneUrl.slice(scenePath.length)
    || value.suffix !== '' && !/^[?#]/.test(value.suffix)
    || value.file.split('/').includes('..')) {
    throw new Error(`Scene package resource ${index} has an invalid relative path.`)
  }

  const occurrences = value.occurrences.map((entry) => {
    const occurrence = Array.isArray(entry) ? { path: entry } : entry
    if (!isPlainRecord(occurrence)
      || !Array.isArray(occurrence.path)
      || occurrence.path.length < 2
      || occurrence.path.some((segment) => typeof segment !== 'string'
        && (typeof segment !== 'number' || !Number.isInteger(segment) || segment < 0))
      || occurrence.cssUrl !== undefined && typeof occurrence.cssUrl !== 'string') {
      throw new Error(`Scene package resource ${index} has an invalid occurrence path.`)
    }
    return {
      path: occurrence.path as readonly (string | number)[],
      ...(typeof occurrence.cssUrl === 'string' ? { cssUrl: occurrence.cssUrl } : {}),
    }
  })
  return {
    sceneUrl: value.sceneUrl,
    file: value.file,
    suffix: value.suffix,
    type: value.type,
    occurrences,
  }
}

/** Rewrites only compiler-provided occurrences and resource declarations on a detached copy. */
function restorePackageResourceUrls(
  source: CompiledScene,
  packageManifest: ScenePackageManifest,
  baseUrl: URL,
): CompiledScene {
  const scene = JSON.parse(JSON.stringify(source)) as MutableCompiledScene
  const resourceBySceneUrl = new Map<string, Readonly<{ url: string; type: string }>>()

  for (const resource of packageManifest.resources) {
    const url = `${new URL(resource.file, baseUrl).href}${resource.suffix}`
    resourceBySceneUrl.set(resource.sceneUrl, { url, type: resource.type })
    for (const occurrence of resource.occurrences) {
      if (occurrence.cssUrl !== undefined) {
        const cssValue = readPath(scene, occurrence.path)
        if (typeof cssValue !== 'string' || !cssValue.includes(occurrence.cssUrl)) {
          throw new Error(`Compiled scene CSS resource occurrence does not match package manifest: ${resource.sceneUrl}`)
        }
        const restoredCssUrl = `url(${JSON.stringify(url)})`
        writePath(scene, occurrence.path, cssValue.replaceAll(occurrence.cssUrl, restoredCssUrl))
      } else {
        if (readPath(scene, occurrence.path) !== resource.sceneUrl) {
          throw new Error(`Compiled scene resource occurrence does not match package manifest: ${resource.sceneUrl}`)
        }
        writePath(scene, occurrence.path, url)
      }
    }
  }

  if (resourceBySceneUrl.size !== source.resources.entries.length) {
    throw new Error('Scene package manifest does not close the compiled resource list.')
  }
  const resourceEntries = source.resources.entries.map((entry) => {
    const resource = resourceBySceneUrl.get(entry.url)
    if (resource === undefined || resource.type !== entry.type) {
      throw new Error(`Scene package manifest is missing compiled resource: ${entry.url}`)
    }
    return { ...entry, url: resource.url }
  })
  scene.resources = { entries: resourceEntries }
  scene.requirements = {
    ...scene.requirements,
    resources: resourceEntries.map((entry) => entry.url),
  }
  return scene
}

/** Reads one compiler-owned occurrence path without searching the scene payload. */
function readPath(root: unknown, path: readonly (string | number)[]): unknown {
  let value = root
  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!Array.isArray(value)) return undefined
      value = value[segment]
      continue
    }
    if (!isPlainRecord(value)) return undefined
    value = value[segment]
  }
  return value
}

/** Replaces the value at one compiler-owned occurrence path. */
function writePath(root: unknown, path: readonly (string | number)[], replacement: string): void {
  const parent = readPath(root, path.slice(0, -1))
  const finalSegment = path.at(-1)
  if (finalSegment === undefined) throw new Error('Scene package occurrence path is empty.')
  if (typeof finalSegment === 'number') {
    if (!Array.isArray(parent) || finalSegment >= parent.length) throw new Error('Scene package occurrence path is invalid.')
    parent[finalSegment] = replacement
    return
  }
  if (!isPlainRecord(parent) || !(finalSegment in parent)) throw new Error('Scene package occurrence path is invalid.')
  parent[finalSegment] = replacement
}

/** Checks the plain JSON records used by the package and compiled-scene boundaries. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
