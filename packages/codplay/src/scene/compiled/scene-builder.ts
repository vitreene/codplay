import type { DiagnosticOutput, DiagnosticReport } from '../../diagnostics'
import { DiagnosticCollector } from '../../diagnostics'
import { isPlainRecord } from '../../shared'
import { SCENE_BUILD_CONFIG } from '../config/scene-build'
import { normalizeSceneDoc } from '../normalization'
import type {
  CanonicalPersoDoc,
  CanonicalSceneDoc,
  CanonicalStoryDoc,
  AuthorFunction,
  SceneListenRule,
  SceneDoc,
} from '../types'
import { CompiledSceneValidationEngine } from '../validation/compiled-scene-validation-engine'
import { SceneGuardEngine } from '../validation/scene-guard-engine'
import type {
  CapabilityValidationSnapshot,
  PersoValidationInput,
} from '../validation/validation-types'
import {
  createExtractionState,
  extractCompiledRecord,
  extractCompiledValue,
  extractFunction,
  finalizeFunctionCollection,
  finalizeFunctionSourceReferences,
  type CompiledFunctionCollection,
  type CompiledFunctionSourceReference,
} from './function-extractor'
import { compileEmitDeclaration } from './capture-compiler'
import { compileMovePath } from './move-path-compiler'
import type {
  CompiledListenRule,
  CompiledActionTargetIndex,
  CompiledPerso,
  CompiledRecord,
  CompiledEventime,
  CompiledResource,
  CompiledResourceManifest,
  CompiledScene,
  CompiledSceneData,
  CompiledStrapDeclarations,
  CompiledStory,
  CompiledStoryActivationIndex,
} from './types'
import { qualifyStructuredLengthStyles } from './length'
import { validateCompiledSceneSemantics } from './semantic-validator'
import { validateCompiledRelTargets } from './rel-target-validation'
import { validateAuthoredScrollDeclarations } from './scroll-observation-validation'
import { validateAuthoredCaptureEvents } from './capture-event-validation'
import { isRel } from '../rel'

/** Options controlling one deterministic scene compilation. */
export type SceneBuilderOptions = Readonly<{
  createdAt?: string
  schemaVersion?: string
  export?: boolean
  preloadManifest?: CompiledResourceManifest
  preloadResourceOccurrences?: readonly SceneBuildPreloadResourceOccurrence[]
  diagnosticOutput?: DiagnosticOutput
}>

/** One supported resource URL and the exact compiled payload path that references it. */
export type SceneBuildResourceReference = Readonly<{
  url: string
  type: string
  path: readonly (string | number)[]
  /** Exact CSS url(...) token to replace inside a compiled inline style value. */
  cssValue?: string
}>

/** One existing preload-manifest entry linked to its exact authored component field. */
export type SceneBuildPreloadResourceOccurrence = Readonly<{
  entryIndex: number
  storyId: string
  persoId: string
  /** Path relative to the authored perso, such as ['initial', 'src']. */
  path: readonly (string | number)[]
}>

/** One extracted function reference and its exact path in the authored SceneDoc. */
export type SceneBuildFunctionReference = CompiledFunctionSourceReference

/** Successful build result carrying the artifact and its external function collection. */
export type SceneBuildSuccess = Readonly<{
  ok: true
  compiledScene: CompiledScene
  functions: CompiledFunctionCollection
  resourceReferences?: readonly SceneBuildResourceReference[]
  functionReferences?: readonly SceneBuildFunctionReference[]
  diagnostics: DiagnosticReport
}>

/** Failed build result carrying all blocking diagnostics. */
export type SceneBuildFailure = Readonly<{
  ok: false
  diagnostics: DiagnosticReport
}>

/** Result returned by the V2 SceneDoc to CompiledScene boundary. */
export type SceneBuildResult = SceneBuildSuccess | SceneBuildFailure

/** Builds a serializable, validated V2 CompiledScene from one SceneDoc. */
export class SceneBuilder {
  private readonly guardEngine = new SceneGuardEngine()
  private readonly validationEngine: CompiledSceneValidationEngine
  private readonly options: SceneBuilderOptions

  /** Creates a builder from the immutable capability catalog used for validation. */
  constructor(catalog: CapabilityValidationSnapshot, options: SceneBuilderOptions = {}) {
    this.validationEngine = new CompiledSceneValidationEngine(catalog)
    this.options = options
  }

  /** Normalizes, validates, derives, extracts, and freezes one compiled scene. */
  build(scene: SceneDoc<string>): SceneBuildResult {
    const diagnostics = new DiagnosticCollector({ output: this.options.diagnosticOutput })
    const canonical = normalizeSceneDoc(scene)
    this.guardEngine.validate(canonical, diagnostics)

    const activeScene = withoutDisabledStories(canonical)
    validateAuthoredScrollDeclarations(activeScene, diagnostics)
    validateAuthoredCaptureEvents(activeScene, diagnostics)
    this.validationEngine.validate(
      {
        persos: listPersoValidationInputs(activeScene),
      },
      diagnostics,
    )

    if (diagnostics.hasErrors()) {
      return { ok: false, diagnostics: diagnostics.report() }
    }

    try {
      const extraction = createExtractionState()
      const compiledData = compileSceneData(activeScene, extraction, this.validationEngine)
      const functionReferences = this.options.export
        ? finalizeFunctionSourceReferences(extraction)
        : undefined
      if (functionReferences !== undefined) {
        validateSourceFunctionReferences(scene, extraction.functions, functionReferences, diagnostics)
      }
      const exportResources = this.options.export
        ? deriveExportResources(
          activeScene,
          compiledData,
          this.options.preloadManifest,
          this.options.preloadResourceOccurrences ?? [],
          diagnostics,
        )
        : undefined
      if (diagnostics.hasErrors()) {
        return { ok: false, diagnostics: diagnostics.report() }
      }
      const resourceEntries = exportResources?.entries ?? deriveResources(activeScene)
      const compiledScene: CompiledScene = {
        schemaVersion: this.options.schemaVersion ?? SCENE_BUILD_CONFIG.schemaVersion,
        createdAt: this.options.createdAt ?? new Date().toISOString(),
        scene: compiledData,
        resources: { entries: resourceEntries },
        rootNodeIds: deriveRootNodeIds(activeScene),
        requirements: deriveRequirements(activeScene, this.validationEngine, resourceEntries),
        actionTargetIndex: deriveActionTargetIndex(compiledData),
        storyActivationIndex: deriveStoryActivationIndex(compiledData),
      }
      validateCompiledSceneSemantics(compiledScene, diagnostics)
      validateCompiledRelTargets(compiledScene, diagnostics)
      if (diagnostics.hasErrors()) {
        return { ok: false, diagnostics: diagnostics.report() }
      }
      freezeValue(compiledScene)
      if (exportResources !== undefined) freezeValue(exportResources.references)
      if (functionReferences !== undefined) freezeValue(functionReferences)
      return {
        ok: true,
        compiledScene,
        functions: finalizeFunctionCollection(extraction),
        ...(exportResources === undefined ? {} : { resourceReferences: exportResources.references }),
        ...(functionReferences === undefined ? {} : { functionReferences }),
        diagnostics: diagnostics.report(),
      }
    } catch (error) {
      diagnostics.error(
        'COMPILED_VALUE_UNSUPPORTED',
        error instanceof Error ? error.message : 'One scene value cannot be compiled.',
        { context: { sceneId: canonical.id } },
      )
      return { ok: false, diagnostics: diagnostics.report() }
    }
  }
}

/** Verifies that every export reference still resolves to its exact author function. */
function validateSourceFunctionReferences(
  sourceScene: SceneDoc<string>,
  functions: Readonly<Record<string, AuthorFunction>>,
  references: readonly SceneBuildFunctionReference[],
  diagnostics: DiagnosticCollector,
): void {
  const seenRefs = new Set<string>()
  for (const reference of references) {
    const sourceValue = readValueAtPath(sourceScene, reference.path)
    if (seenRefs.has(reference.ref)
      || typeof sourceValue !== 'function'
      || functions[reference.ref] !== sourceValue) {
      diagnostics.error(
        'CODPLAY_EXPORT_FUNCTION_REFERENCE_UNSUPPORTED',
        `Compiled function reference does not resolve to its exact source function: ${reference.ref}.`,
        { context: { sceneId: sourceScene.id, functionRef: reference.ref, path: reference.path } },
      )
    }
    seenRefs.add(reference.ref)
  }

  if (seenRefs.size !== Object.keys(functions).length) {
    diagnostics.error(
      'CODPLAY_EXPORT_FUNCTION_REFERENCE_UNSUPPORTED',
      'Compiled function references do not cover the complete function collection.',
      { context: { sceneId: sourceScene.id, expected: Object.keys(functions).length, received: seenRefs.size } },
    )
  }
}

/** Follows only one compiler-provided source path and never scans the scene. */
function readValueAtPath(root: unknown, sourcePath: readonly (string | number)[]): unknown {
  let value = root
  for (const segment of sourcePath) {
    if (typeof segment === 'number') {
      if (!Array.isArray(value) || segment < 0 || segment >= value.length) return undefined
      value = value[segment]
      continue
    }
    if ((typeof value !== 'object' && typeof value !== 'function')
      || value === null
      || !Object.hasOwn(value, segment)) return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

/** Derives the immutable action-to-perso target index from compiled declarations. */
function deriveActionTargetIndex(scene: CompiledSceneData): CompiledActionTargetIndex {
  const index: Record<string, Array<{ storyId: string; persoId: string }>> = {}
  for (const story of Object.values(scene.stories)) {
    for (const perso of story.persos) {
      for (const actionName of Object.keys(perso.actions)) {
        const targets = index[actionName] ?? (index[actionName] = [])
        targets.push({ storyId: story.id, persoId: perso.id })
      }
    }
  }
  return index
}

/** Removes disabled stories before validation payload derivation and compilation. */
function withoutDisabledStories(scene: CanonicalSceneDoc): CanonicalSceneDoc {
  return {
    ...scene,
    stories: Object.fromEntries(Object.entries(scene.stories).filter(([, story]) => story.disabled !== true)),
  }
}

/** Projects active persos into the validation input consumed by the catalog engine. */
function listPersoValidationInputs(scene: CanonicalSceneDoc): readonly PersoValidationInput[] {
  return Object.values(scene.stories).flatMap((story) => story.persos.map((perso, index) => ({
    ...perso,
    storyId: story.id,
    validationPath: `stories.${story.id}.persos[${index}]`,
  })))
}

/** Compiles the scene payload while replacing every author function with a reference. */
function compileSceneData(
  scene: CanonicalSceneDoc,
  state: ReturnType<typeof createExtractionState>,
  validationEngine: CompiledSceneValidationEngine,
): CompiledSceneData {
  return {
    id: scene.id,
    name: scene.name,
    stories: Object.fromEntries(
      Object.entries(scene.stories).map(([storyId, story]) => [storyId, compileStory(
        story,
        `scene.stories.${storyId}`,
        state,
        validationEngine,
        ['stories', storyId],
      )]),
    ),
    initial: extractCompiledRecord(scene.initial, 'scene.initial', state, ['initial']),
    straps: compileStrapDeclarations(scene.straps, 'scene.straps', state, ['straps']),
    listen: scene.listen.map((rule, index) => compileListenRule(rule, `scene.listen[${index}]`, state, ['listen', index])),
    eventimes: scene.eventimes?.map((eventime, index) => extractCompiledValue(eventime, `scene.eventimes[${index}]`, state, ['eventimes', index]) as CompiledEventime),
    state: extractCompiledRecord(scene.state, 'scene.state', state, ['state']),
    tracks: extractCompiledRecord(scene.tracks, 'scene.tracks', state, ['tracks']) ?? {},
    defaults: extractCompiledRecord(scene.defaults, 'scene.defaults', state, ['defaults']),
    init: scene.init === undefined ? undefined : extractFunction(scene.init as AuthorFunction, 'scene.init', state, ['init']),
    onStart: scene.onStart === undefined ? undefined : extractFunction(scene.onStart as AuthorFunction, 'scene.onStart', state, ['onStart']),
    onSequenceEnd: scene.onSequenceEnd === undefined
      ? undefined
      : extractFunction(scene.onSequenceEnd as AuthorFunction, 'scene.onSequenceEnd', state, ['onSequenceEnd']),
  }
}

/** Compiles one active story and all of its authored payloads. */
function compileStory(
  story: CanonicalStoryDoc,
  scope: string,
  state: ReturnType<typeof createExtractionState>,
  validationEngine: CompiledSceneValidationEngine,
  sourcePath: readonly (string | number)[],
): CompiledStory {
  return {
    id: story.id,
    name: story.name,
    trackId: story.trackId,
    initial: extractCompiledRecord(story.initial, `${scope}.initial`, state, [...sourcePath, 'initial']),
    persos: story.persos.map((perso, index) => compilePerso(
      perso,
      `${scope}.persos[${index}]`,
      state,
      validationEngine,
      [...sourcePath, 'persos', index],
    )),
    tracks: extractCompiledRecord(story.tracks, `${scope}.tracks`, state, [...sourcePath, 'tracks']),
    straps: compileStrapDeclarations(story.straps, `${scope}.straps`, state, [...sourcePath, 'straps']),
    listen: story.listen.map((rule, index) => compileListenRule(rule, `${scope}.listen[${index}]`, state, [...sourcePath, 'listen', index])),
    eventimes: story.eventimes?.map((eventime, index) => extractCompiledValue(eventime, `${scope}.eventimes[${index}]`, state, [...sourcePath, 'eventimes', index]) as CompiledEventime),
    state: extractCompiledRecord(story.state, `${scope}.state`, state, [...sourcePath, 'state']),
    init: story.init === undefined ? undefined : extractFunction(story.init, `${scope}.init`, state, [...sourcePath, 'init']),
  }
}

/** Compiles local strap functions while preserving arrays as explicit references. */
function compileStrapDeclarations(
  straps: CanonicalSceneDoc['straps'],
  scope: string,
  state: ReturnType<typeof createExtractionState>,
  sourcePath: readonly (string | number)[],
): CompiledStrapDeclarations | undefined {
  if (straps === undefined) return undefined
  if (Array.isArray(straps)) return [...straps]
  return Object.fromEntries(
    Object.entries(straps).map(([name, fn]) => [name, extractFunction(fn, `${scope}.${name}`, state, [...sourcePath, name])]),
  )
}

/** Compiles one perso including initial values, actions, list, and emit data. */
function compilePerso(
  perso: CanonicalPersoDoc,
  scope: string,
  state: ReturnType<typeof createExtractionState>,
  validationEngine: CompiledSceneValidationEngine,
  sourcePath: readonly (string | number)[],
): CompiledPerso {
  const sanitizedInitial = validationEngine.sanitizeInitial(perso.type, perso.initial)
  const relationFreeInitial = removeRelFromInitial(sanitizedInitial)
  const compiledInitial = qualifyStructuredLengthStyles(
    extractCompiledRecord(
      compileMovePath(relationFreeInitial, `${scope}.initial`) as Record<string, unknown>,
      `${scope}.initial`,
      state,
      [...sourcePath, 'initial'],
    ) ?? {},
  ) as CompiledRecord
  const compiledRel = compileRel(sanitizedInitial.rel, `${scope}.initial.rel`, state, [...sourcePath, 'initial', 'rel'])
  return {
    id: perso.id,
    name: perso.name,
    type: perso.type,
    initial: compiledInitial,
    rel: compiledRel,
    actions: Object.fromEntries(
      Object.entries(perso.actions).map(([name, value]) => {
        const sanitizedValue = isPlainRecord(value)
          ? validationEngine.sanitizeAction(perso.type, value)
          : value
        const immutableValue = removeRelFromAction(sanitizedValue)
        const compiledValue = extractCompiledValue(
          compileMovePath(immutableValue, `${scope}.actions.${name}`),
          `${scope}.actions.${name}`,
          state,
          [...sourcePath, 'actions', name],
        )
        return [name, qualifyStructuredLengthStyles(compiledValue)]
      }),
    ),
    list: extractCompiledRecord(perso.list, `${scope}.list`, state, [...sourcePath, 'list']),
    emit: compileEmitDeclaration(perso.emit, `${scope}.emit`, state, [...sourcePath, 'emit']),
  }
}

/** Extracts one valid relation without allowing native runtime values into the artifact. */
function compileRel(
  value: unknown,
  scope: string,
  state: ReturnType<typeof createExtractionState>,
  sourcePath: readonly (string | number)[],
): CompiledPerso['rel'] {
  if (!isRel(value)) return undefined
  return extractCompiledRecord(value as Record<string, unknown>, scope, state, sourcePath) as CompiledPerso['rel']
}

/** Removes the common relation before the component-specific initial reaches the artifact. */
function removeRelFromInitial(value: Record<string, unknown>): Record<string, unknown> {
  if (!('rel' in value)) return value
  const { rel: _ignored, ...withoutRel } = value
  return withoutRel
}

/** Removes the reserved relation field from one action or action sequence. */
function removeRelFromAction(value: unknown): unknown {
  if (isPlainRecord(value)) {
    if (!('rel' in value)) return value
    const { rel: _ignored, ...withoutRel } = value
    return withoutRel
  }
  if (!Array.isArray(value)) return value
  return value.map((step) => {
    if (!isPlainRecord(step) || !isPlainRecord(step.action) || !('rel' in step.action)) return step
    const { rel: _ignored, ...withoutRel } = step.action
    return { ...step, action: withoutRel }
  })
}

/** Compiles one listen rule and extracts all transform functions in declaration order. */
function compileListenRule(
  rule: SceneListenRule,
  scope: string,
  state: ReturnType<typeof createExtractionState>,
  sourcePath: readonly (string | number)[],
): CompiledListenRule {
  return {
    on: rule.on,
    active: rule.active,
    reset: rule.reset,
    transform: rule.transform?.map((fn, index) => extractFunction(fn as unknown as AuthorFunction, `${scope}.transform[${index}]`, state, [...sourcePath, 'transform', index])),
    emit: rule.emit?.map((value, index) => extractCompiledValue(value, `${scope}.emit[${index}]`, state, [...sourcePath, 'emit', index]) as CompiledRecord),
    straps: rule.straps,
  }
}

/** Derives the exact activation-rule index kept with one compiled artifact. */
function deriveStoryActivationIndex(scene: CompiledSceneData): CompiledStoryActivationIndex {
  return Object.fromEntries(
    Object.entries(scene.stories).map(([storyId, story]) => [
      storyId,
      Object.fromEntries(
        story.listen.flatMap((rule, index) => rule.active === true
          ? [[rule.on, index] as const]
          : []),
      ),
    ]),
  )
}

/** Derives the ordered unique root candidates from initial and action placements. */
function deriveRootNodeIds(scene: CanonicalSceneDoc): readonly string[] {
  const ids: string[] = []
  for (const story of Object.values(scene.stories)) {
    for (const perso of story.persos) {
      const placements = [perso.initial, ...Object.values(perso.actions).filter(isPlainRecord)]
      if (placements.some(hasRootPlacement) && !ids.includes(perso.id)) {
        ids.push(perso.id)
      }
    }
  }
  return ids
}

/** Detects one authored placement that can mount a perso at the page root. */
function hasRootPlacement(value: Record<string, unknown>): boolean {
  if (value.move === SCENE_BUILD_CONFIG.rootToken) {
    return true
  }
  return isPlainRecord(value.move) && value.move.target === SCENE_BUILD_CONFIG.rootToken
}

/** Derives required component, service, module, library, and resource names. */
function deriveRequirements(
  scene: CanonicalSceneDoc,
  validationEngine: CompiledSceneValidationEngine,
  resources: readonly CompiledResource[] = deriveResources(scene),
): CompiledScene['requirements'] {
  const components = new Set<string>()
  const services = new Set<string>()
  const modules = new Set<string>()
  const libraries = new Set<string>()
  for (const story of Object.values(scene.stories)) {
    for (const perso of story.persos) {
      components.add(perso.type)
      for (const service of validationEngine.servicesFor(perso.type)) {
        services.add(service)
      }
      for (const moduleService of validationEngine.modulesFor(perso.type)) {
        modules.add(moduleService)
      }
      for (const library of validationEngine.librariesFor(perso.type)) {
        libraries.add(library)
      }
    }
  }
  return {
    components: [...components],
    services: [...services],
    modules: [...modules],
    libraries: [...libraries],
    resources: resources.map((resource) => resource.url),
  }
}

/** Derives export-only media closure and exact locations without changing the JSON schema. */
function deriveExportResources(
  scene: CanonicalSceneDoc,
  compiledData: CompiledSceneData,
  preloadManifest: CompiledResourceManifest | undefined,
  preloadResourceOccurrences: readonly SceneBuildPreloadResourceOccurrence[],
  diagnostics: DiagnosticCollector,
): Readonly<{ entries: readonly CompiledResource[]; references: readonly SceneBuildResourceReference[] }> {
  const entries = new Map<string, CompiledResource>()
  const references: SceneBuildResourceReference[] = []

  for (const [storyKey, story] of Object.entries(scene.stories)) {
    for (const [persoIndex, perso] of story.persos.entries()) {
      const basePath: readonly (string | number)[] = [
        'scene', 'stories', storyKey, 'persos', persoIndex,
      ]
      inspectExportStateResources(
        scene.id, perso.initial, [...basePath, 'initial'], perso, storyKey, diagnostics, entries, references,
      )
      if (perso.type === 'img') {
        collectExportSource(scene.id, perso.initial.src, 'image', [...basePath, 'initial', 'src'], perso, storyKey, diagnostics, entries, references)
        collectImagePartMediaAttributes(scene.id, perso.initial.img, [...basePath, 'initial', 'img'], perso, storyKey, diagnostics, entries, references)
          collectExportActionSources(scene.id, perso, storyKey, basePath, diagnostics, entries, references, (action, path) => {
          collectExportSource(scene.id, action.src, 'image', [...path, 'src'], perso, storyKey, diagnostics, entries, references)
          collectImagePartMediaAttributes(scene.id, action.img, [...path, 'img'], perso, storyKey, diagnostics, entries, references)
        })
      } else if (perso.type === 'media') {
        collectExportSource(scene.id, perso.initial.src, undefined, [...basePath, 'initial', 'src'], perso, storyKey, diagnostics, entries, references)
        rejectMediaPartSource(scene.id, perso.initial.video, [...basePath, 'initial', 'video'], perso, storyKey, diagnostics)
        collectExportActionSources(scene.id, perso, storyKey, basePath, diagnostics, entries, references, (action, path) => {
          collectExportSource(scene.id, action.src, undefined, [...path, 'src'], perso, storyKey, diagnostics, entries, references)
          rejectMediaPartSource(scene.id, action.video, [...path, 'video'], perso, storyKey, diagnostics)
        })
      } else if (perso.type === 'rive') {
        collectExportSource(scene.id, perso.initial.src, 'rive', [...basePath, 'initial', 'src'], perso, storyKey, diagnostics, entries, references)
      } else if (perso.type === 'tag') {
        const tagName = typeof perso.initial.tag === 'string' ? perso.initial.tag.toLowerCase() : ''
        const expectedType = tagName === 'img' ? 'image'
          : tagName === 'audio' || tagName === 'video' ? tagName
            : undefined
        collectTagMediaAttributes(scene.id, perso.initial, [...basePath, 'initial'], tagName, expectedType, perso, storyKey, diagnostics, entries, references)
        collectExportActionSources(scene.id, perso, storyKey, basePath, diagnostics, entries, references, (action, path) => {
          collectTagMediaAttributes(scene.id, action, path, tagName, expectedType, perso, storyKey, diagnostics, entries, references)
        })
      }
    }
  }

  collectPreloadResourceOccurrences(
    scene,
    compiledData,
    preloadManifest,
    preloadResourceOccurrences,
    diagnostics,
    entries,
    references,
  )

  return { entries: [...entries.values()], references }
}

/** Links existing preload entries to exact compiled fields and diagnoses unlinked custom entries. */
function collectPreloadResourceOccurrences(
  scene: CanonicalSceneDoc,
  compiledData: CompiledSceneData,
  manifestInput: unknown,
  occurrencesInput: unknown,
  diagnostics: DiagnosticCollector,
  entries: Map<string, CompiledResource>,
  references: SceneBuildResourceReference[],
): void {
  const seenPaths = new Set<string>()
  const linkedEntryIndexes = new Set<number>()
  const manifestEntries = readPreloadManifestEntries(scene.id, manifestInput, diagnostics)
  const occurrences = readPreloadResourceOccurrences(scene.id, occurrencesInput, diagnostics)
  for (const rawOccurrence of occurrences) {
    if (!isPlainRecord(rawOccurrence)) {
      reportInvalidPreloadOccurrence(scene.id, diagnostics, rawOccurrence, 'Preload resource occurrence must be an object.')
      continue
    }
    const entryIndex = Number.isInteger(rawOccurrence.entryIndex) && (rawOccurrence.entryIndex as number) >= 0
      ? rawOccurrence.entryIndex as number
      : undefined
    const storyId = typeof rawOccurrence.storyId === 'string' ? rawOccurrence.storyId : undefined
    const persoId = typeof rawOccurrence.persoId === 'string' ? rawOccurrence.persoId : undefined
    const path = Array.isArray(rawOccurrence.path) ? rawOccurrence.path : undefined
    const resource = entryIndex === undefined ? undefined : manifestEntries[entryIndex]
    if (entryIndex !== undefined && resource !== undefined) linkedEntryIndexes.add(entryIndex)
    if (entryIndex === undefined || storyId === undefined || persoId === undefined || path === undefined) {
      reportInvalidPreloadOccurrence(scene.id, diagnostics, rawOccurrence, 'Preload resource occurrence must identify a manifest entry, story, perso and path.', resource)
      continue
    }
    const occurrence = {
      entryIndex,
      storyId,
      persoId,
      path: path as readonly (string | number)[],
    }
    const storyMatches = Object.entries(scene.stories).filter(([, story]) => story.id === storyId)
    const story = storyMatches[0]?.[1]
    const storyKey = storyMatches[0]?.[0]
    const persoMatches = story?.persos.flatMap((perso, index) => perso.id === persoId ? [{ perso, index }] : []) ?? []
    const target = persoMatches[0]
    if (storyMatches.length !== 1 || story === undefined || storyKey === undefined || persoMatches.length !== 1 || target === undefined) {
      reportInvalidPreloadOccurrence(scene.id, diagnostics, rawOccurrence, 'Preload resource occurrence must identify exactly one active story and perso.', resource)
      continue
    }

    if (!isPlainRecord(resource)
      || typeof resource.url !== 'string'
      || resource.url.length === 0
      || typeof resource.type !== 'string'
      || resource.type.length === 0
      || !isPlainRecord(resource.policy)
      || !Array.isArray(occurrence.path)
      || occurrence.path.length === 0
      || occurrence.path.some((segment) => typeof segment !== 'string'
        && (typeof segment !== 'number' || !Number.isInteger(segment) || segment < 0))) {
      reportInvalidPreloadOccurrence(scene.id, diagnostics, rawOccurrence, 'Preload resource occurrence does not identify a valid preload-manifest entry.', resource)
      continue
    }
    if (isNonLocalResourceUrl(resource.url)) {
      reportInvalidPreloadOccurrence(scene.id, diagnostics, rawOccurrence, 'Only local preload resource paths are supported by this export step.', resource)
      continue
    }

    const authoredValue = readValueAtPath(target.perso, occurrence.path)
    const compiledDataPath = ['stories', storyKey, 'persos', target.index, ...occurrence.path] as const
    const compiledPath = ['scene', ...compiledDataPath] as const
    const compiledValue = readValueAtPath(compiledData, compiledDataPath)
    if (authoredValue !== resource.url || compiledValue !== resource.url) {
      reportInvalidPreloadOccurrence(scene.id, diagnostics, rawOccurrence, 'Preload resource occurrence does not resolve to the same authored and compiled URL.', resource)
      continue
    }

    const pathKey = JSON.stringify(compiledPath)
    if (seenPaths.has(pathKey)) {
      reportInvalidPreloadOccurrence(scene.id, diagnostics, rawOccurrence, 'A compiled resource occurrence is declared more than once.', resource)
      continue
    }
    seenPaths.add(pathKey)

    const existing = entries.get(resource.url)
    if (existing !== undefined && existing.type !== resource.type) {
      reportInvalidPreloadOccurrence(scene.id, diagnostics, rawOccurrence, 'One resource URL is declared with conflicting preload types.', resource)
      continue
    }
    if (existing === undefined) entries.set(resource.url, resource as unknown as CompiledResource)
    references.push({ url: resource.url, type: resource.type, path: compiledPath })
  }

  for (const [entryIndex, resource] of manifestEntries.entries()) {
    if (!isPlainRecord(resource)
      || typeof resource.url !== 'string'
      || typeof resource.type !== 'string'
      || resource.type.length === 0
      || !isPlainRecord(resource.policy)) {
      diagnostics.error(
        'CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED',
        'Preload manifest entry is malformed.',
        { refs: { sceneId: scene.id }, context: { sceneId: scene.id, entryIndex } },
        `export-preload-resource-malformed:${entryIndex}`,
      )
      continue
    }
    if (['image', 'audio', 'video', 'rive', 'font', 'css'].includes(resource.type)) continue
    if (linkedEntryIndexes.has(entryIndex)) continue
    diagnostics.error(
      'CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED',
      'Custom preload resource has no exact component occurrence declaration.',
      {
        refs: { sceneId: scene.id },
        context: { sceneId: scene.id, entryIndex, url: resource.url, type: resource.type },
      },
      `export-preload-resource-unmapped:${entryIndex}`,
    )
  }
}

/** Validates a preload manifest during export compilation. */
function readPreloadManifestEntries(
  sceneId: string,
  manifest: unknown,
  diagnostics: DiagnosticCollector,
): readonly unknown[] {
  if (manifest === undefined) return []
  if (!isPlainRecord(manifest) || !Array.isArray(manifest.entries)) {
    diagnostics.error(
      'CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED',
      'Preload manifest must contain an entries array.',
      { refs: { sceneId }, context: { sceneId } },
      'export-preload-manifest-invalid',
    )
    return []
  }
  return manifest.entries
}

/** Validates the preload occurrence list during export compilation. */
function readPreloadResourceOccurrences(
  sceneId: string,
  occurrences: unknown,
  diagnostics: DiagnosticCollector,
): readonly unknown[] {
  if (occurrences === undefined) return []
  if (!Array.isArray(occurrences)) {
    diagnostics.error(
      'CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED',
      'Preload resource occurrences must be an array.',
      { refs: { sceneId }, context: { sceneId } },
      'export-preload-occurrences-invalid',
    )
    return []
  }
  return occurrences
}

/** Reports malformed or stale metadata attached to a preload resource occurrence. */
function reportInvalidPreloadOccurrence(
  sceneId: string,
  diagnostics: DiagnosticCollector,
  occurrence: unknown,
  message: string,
  resource?: unknown,
): void {
  const occurrenceRecord = isPlainRecord(occurrence) ? occurrence : undefined
  const storyId = typeof occurrenceRecord?.storyId === 'string' ? occurrenceRecord.storyId : undefined
  const persoId = typeof occurrenceRecord?.persoId === 'string' ? occurrenceRecord.persoId : undefined
  const path = Array.isArray(occurrenceRecord?.path) ? occurrenceRecord.path : undefined
  const entryIndexValue = occurrenceRecord?.entryIndex
  const entryIndex = typeof entryIndexValue === 'number' && Number.isInteger(entryIndexValue)
    ? entryIndexValue
    : undefined
  const resourceRecord = isPlainRecord(resource) ? resource : undefined
  diagnostics.error(
    'CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED',
    message,
    {
      refs: { sceneId, ...(storyId === undefined ? {} : { storyId }), ...(persoId === undefined ? {} : { persoId }) },
      context: {
        sceneId,
        ...(storyId === undefined ? {} : { storyId }),
        ...(persoId === undefined ? {} : { persoId }),
        ...(path === undefined ? {} : { path: [...path] }),
        ...(entryIndex === undefined ? {} : { entryIndex }),
        ...(typeof resourceRecord?.url === 'string' ? { url: resourceRecord.url } : {}),
        ...(typeof resourceRecord?.type === 'string' ? { type: resourceRecord.type } : {}),
      },
    },
    `export-preload-resource:${entryIndex ?? 'invalid'}:${storyId ?? 'unknown'}:${persoId ?? 'unknown'}:${path?.join('.') ?? 'unknown'}`,
  )
}

/** Checks common initial/action fields for media or CSS resources outside the packaged source paths. */
function inspectExportStateResources(
  sceneId: string,
  state: Record<string, unknown>,
  path: readonly (string | number)[],
  perso: CanonicalSceneDoc['stories'][string]['persos'][number],
  storyId: string,
  diagnostics: DiagnosticCollector,
  entries: Map<string, CompiledResource>,
  references: SceneBuildResourceReference[],
): void {
  if (typeof state.markup === 'string'
    && /<\s*(?:img|audio|video|source|track|script|style|link|iframe|frame|embed|object|image|use)\b|\b(?:src|srcset|poster)\s*=|url\s*\(/i.test(state.markup)) {
    addExportDiagnostic(sceneId, diagnostics, perso, storyId, [...path, 'markup'], state.markup,
      'Markup contains media, CSS or code resources that this export step does not package.')
  }
  collectCssUrlReferences(sceneId, state, path, perso, storyId, diagnostics, entries, references)
}

/** Applies the common resource checks to every direct action and static sequence step. */
function collectExportActionSources(
  sceneId: string,
  perso: CanonicalSceneDoc['stories'][string]['persos'][number],
  storyId: string,
  basePath: readonly (string | number)[],
  diagnostics: DiagnosticCollector,
  entries: Map<string, CompiledResource>,
  references: SceneBuildResourceReference[],
  visit: (action: Record<string, unknown>, path: readonly (string | number)[]) => void,
): void {
  collectActionSources(perso.actions, [...basePath, 'actions'], (action, path) => {
    inspectExportStateResources(sceneId, action, path, perso, storyId, diagnostics, entries, references)
    visit(action, path)
  })
}

/** Collects static inline CSS URL resources from state fields and records their compiler paths. */
function collectCssUrlReferences(
  sceneId: string,
  value: unknown,
  path: readonly (string | number)[],
  perso: CanonicalSceneDoc['stories'][string]['persos'][number],
  storyId: string,
  diagnostics: DiagnosticCollector,
  entries: Map<string, CompiledResource>,
  references: SceneBuildResourceReference[],
): void {
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) {
      collectCssUrlReferences(sceneId, child, [...path, index], perso, storyId, diagnostics, entries, references)
    }
    return
  }
  if (!isPlainRecord(value)) return

  for (const [key, child] of Object.entries(value)) {
    if (key === 'style') {
      collectInlineStyleValue(sceneId, child, [...path, key], perso, storyId, diagnostics, entries, references)
      continue
    }
    if (Array.isArray(child) || isPlainRecord(child)) {
      collectCssUrlReferences(sceneId, child, [...path, key], perso, storyId, diagnostics, entries, references)
    }
  }
}

/** Collects URLs from CSS style values and refuses references the package cannot materialize. */
function collectInlineStyleValue(
  sceneId: string,
  value: unknown,
  path: readonly (string | number)[],
  perso: CanonicalSceneDoc['stories'][string]['persos'][number],
  storyId: string,
  diagnostics: DiagnosticCollector,
  entries: Map<string, CompiledResource>,
  references: SceneBuildResourceReference[],
): void {
  if (typeof value === 'string') {
    const existingReferences = new Set(references
      .filter((reference) => reference.cssValue !== undefined && samePath(reference.path, path))
      .map((reference) => `${reference.url}\u0000${reference.cssValue}`))
    for (const { value: url, raw } of findInlineCssUrls(value)) {
      const diagnosticPath = path
      if (url === '' || url.includes('\\')) {
        addExportDiagnostic(sceneId, diagnostics, perso, storyId, diagnosticPath, url,
          'Inline CSS resource path is empty or uses unsupported escaping.')
        continue
      }
      if (url.startsWith('#') || /^data:/i.test(url)) continue
      if (isNonLocalResourceUrl(url)) {
        addExportDiagnostic(sceneId, diagnostics, perso, storyId, diagnosticPath, url,
          'Inline CSS resource URLs must be local to the exported scene.')
        continue
      }
      const type = inferExportMediaType(url)
      if (type !== 'image') {
        addExportDiagnostic(sceneId, diagnostics, perso, storyId, diagnosticPath, url,
          'Inline CSS url() references must resolve to a supported image file.')
        continue
      }
      const existingEntry = entries.get(url)
      if (existingEntry !== undefined && existingEntry.type !== type) {
        addExportDiagnostic(sceneId, diagnostics, perso, storyId, diagnosticPath, url,
          `The same URL is used as both ${existingEntry.type} and ${type}.`)
        continue
      }
      if (existingEntry === undefined) {
        entries.set(url, { url, type, policy: { cache: 'default', priority: 'normal' } })
      }
      const referenceKey = `${url}\u0000${raw}`
      if (existingReferences.has(referenceKey)) continue
      references.push({ url, type, path, cssValue: raw })
      existingReferences.add(referenceKey)
    }
    return
  }
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) {
      collectInlineStyleValue(sceneId, child, [...path, index], perso, storyId, diagnostics, entries, references)
    }
    return
  }
  if (!isPlainRecord(value)) return
  for (const [key, child] of Object.entries(value)) {
    collectInlineStyleValue(sceneId, child, [...path, key], perso, storyId, diagnostics, entries, references)
  }
}

/** Finds local url(...) tokens while ignoring quoted strings and CSS comments. */
function findInlineCssUrls(value: string): Array<Readonly<{ value: string; raw: string }>> {
  const references: Array<Readonly<{ value: string; raw: string }>> = []
  let index = 0
  while (index < value.length) {
    if (value.startsWith('/*', index)) {
      const commentEnd = value.indexOf('*/', index + 2)
      index = commentEnd < 0 ? value.length : commentEnd + 2
      continue
    }
    if (value[index] === '"' || value[index] === "'") {
      index = skipInlineCssString(value, index)
      continue
    }
    if (value.slice(index, index + 3).toLowerCase() === 'url'
      && !isInlineCssIdentifier(value[index - 1])) {
      let open = index + 3
      while (/\s/.test(value[open] ?? '')) open += 1
      if (value[open] === '(') {
        const end = findInlineCssFunctionEnd(value, open)
        if (end === undefined) {
          references.push({ value: '', raw: value.slice(index) })
          break
        }
        const rawArgument = value.slice(open + 1, end).trim()
        const url = rawArgument.length >= 2
          && (rawArgument[0] === '"' || rawArgument[0] === "'")
          ? rawArgument.slice(1, -1)
          : rawArgument
        references.push({ value: url, raw: value.slice(index, end + 1) })
        index = end + 1
        continue
      }
    }
    index += 1
  }
  return references
}

/** Returns the matching closing parenthesis of one CSS function, honoring strings and comments. */
function findInlineCssFunctionEnd(value: string, open: number): number | undefined {
  let depth = 1
  let index = open + 1
  while (index < value.length) {
    if (value.startsWith('/*', index)) {
      const commentEnd = value.indexOf('*/', index + 2)
      index = commentEnd < 0 ? value.length : commentEnd + 2
      continue
    }
    if (value[index] === '"' || value[index] === "'") {
      index = skipInlineCssString(value, index)
      continue
    }
    if (value[index] === '(') depth += 1
    if (value[index] === ')') {
      depth -= 1
      if (depth === 0) return index
    }
    index += 1
  }
  return undefined
}

/** Advances past a CSS string and its escaped characters. */
function skipInlineCssString(value: string, start: number): number {
  const quote = value[start]
  let index = start + 1
  while (index < value.length) {
    if (value[index] === '\\') {
      index += 2
      continue
    }
    if (value[index] === quote) return index + 1
    index += 1
  }
  return value.length
}

/** Checks whether a value character continues a CSS identifier. */
function isInlineCssIdentifier(value: string | undefined): boolean {
  return value !== undefined && /[a-z0-9_-]/i.test(value)
}

/** Compares two compiler paths by their exact sequence of string and array segments. */
function samePath(left: readonly (string | number)[], right: readonly (string | number)[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

/** Collects source values from a direct action or each authored static sequence step. */
function collectActionSources(
  actions: Readonly<Record<string, unknown>>,
  path: readonly (string | number)[],
  visit: (action: Record<string, unknown>, path: readonly (string | number)[]) => void,
): void {
  for (const [name, value] of Object.entries(actions)) {
    const actionPath = [...path, name]
    if (isPlainRecord(value)) {
      visit(value, actionPath)
      continue
    }
    if (!Array.isArray(value)) continue
    for (const [index, step] of value.entries()) {
      if (!isPlainRecord(step) || !isPlainRecord(step.action)) continue
      visit(step.action, [...actionPath, index, 'action'])
    }
  }
}

/** Collects the supported native media fields of one generic tag state. */
function collectTagMediaAttributes(
  sceneId: string,
  state: Record<string, unknown>,
  statePath: readonly (string | number)[],
  tagName: string,
  expectedType: 'image' | 'audio' | 'video' | undefined,
  perso: CanonicalSceneDoc['stories'][string]['persos'][number],
  storyId: string,
  diagnostics: DiagnosticCollector,
  entries: Map<string, CompiledResource>,
  references: SceneBuildResourceReference[],
): void {
  if (tagName === 'style' || tagName === 'script') {
    addExportDiagnostic(sceneId, diagnostics, perso, storyId, [...statePath, 'tag'], tagName,
      `Native ${tagName} elements are not supported by this media export step.`)
    return
  }
  if (!isPlainRecord(state.attr)) return
  const attributes = state.attr
  for (const attribute of tagName === 'video' ? ['poster', 'srcset']
    : tagName === 'img' || tagName === 'source' ? ['srcset']
      : tagName === 'track' ? ['src']
        : []) {
    if (attributes[attribute] === undefined) continue
    addExportDiagnostic(sceneId, diagnostics, perso, storyId, [...statePath, 'attr', attribute], attributes[attribute],
      `Native ${tagName}.${attribute} resources are not part of this export step.`)
  }
  for (const attribute of getUnsupportedNativeResourceAttributes(tagName)) {
    if (attributes[attribute] === undefined) continue
    addExportDiagnostic(sceneId, diagnostics, perso, storyId, [...statePath, 'attr', attribute], attributes[attribute],
      `Native ${tagName}.${attribute} resources are not part of this export step.`)
  }

  if (attributes.src === undefined) return
  if (tagName !== 'img' && tagName !== 'audio' && tagName !== 'video' && tagName !== 'source') {
    addExportDiagnostic(sceneId, diagnostics, perso, storyId, [...statePath, 'attr', 'src'], attributes.src,
      `Native ${tagName}.src resources are not part of this export step.`)
    return
  }
  collectExportSource(
    sceneId,
    attributes.src,
    expectedType,
    [...statePath, 'attr', 'src'],
    perso,
    storyId,
    diagnostics,
    entries,
    references,
  )
}

/** Lists URL-bearing native attributes that the media export step cannot close. */
function getUnsupportedNativeResourceAttributes(tagName: string): readonly string[] {
  if (tagName === 'link') return ['href']
  if (tagName === 'object') return ['data']
  if (tagName === 'iframe' || tagName === 'frame') return ['srcdoc']
  if (tagName === 'image' || tagName === 'use') return ['href', 'xlink:href']
  return []
}

/** Collects the image part's native source while rejecting unsupported responsive source sets. */
function collectImagePartMediaAttributes(
  sceneId: string,
  part: unknown,
  partPath: readonly (string | number)[],
  perso: CanonicalSceneDoc['stories'][string]['persos'][number],
  storyId: string,
  diagnostics: DiagnosticCollector,
  entries: Map<string, CompiledResource>,
  references: SceneBuildResourceReference[],
): void {
  if (!isPlainRecord(part) || !isPlainRecord(part.attr)) return
  if (part.attr.srcset !== undefined) {
    addExportDiagnostic(sceneId, diagnostics, perso, storyId, [...partPath, 'attr', 'srcset'], part.attr.srcset,
      'Responsive image srcset resources are not part of this export step.')
  }
  collectExportSource(sceneId, part.attr.src, 'image', [...partPath, 'attr', 'src'], perso, storyId, diagnostics, entries, references)
}

/** Rejects media part source overrides that bypass the component's managed source and preload handoff. */
function rejectMediaPartSource(
  sceneId: string,
  part: unknown,
  partPath: readonly (string | number)[],
  perso: CanonicalSceneDoc['stories'][string]['persos'][number],
  storyId: string,
  diagnostics: DiagnosticCollector,
): void {
  if (!isPlainRecord(part) || !isPlainRecord(part.attr)) return
  for (const attribute of ['src', 'poster', 'srcset']) {
    if (part.attr[attribute] === undefined) continue
    addExportDiagnostic(sceneId, diagnostics, perso, storyId, [...partPath, 'attr', attribute], part.attr[attribute],
      `media.video.attr.${attribute} bypasses the managed media source preload path.`)
  }
}

/** Adds one validated media source and its exact compiled location, or reports why it cannot export. */
function collectExportSource(
  sceneId: string,
  value: unknown,
  expectedType: 'image' | 'audio' | 'video' | 'rive' | undefined,
  path: readonly (string | number)[],
  perso: CanonicalSceneDoc['stories'][string]['persos'][number],
  storyId: string,
  diagnostics: DiagnosticCollector,
  entries: Map<string, CompiledResource>,
  references: SceneBuildResourceReference[],
): void {
  if (value === undefined) return
  if (typeof value !== 'string' || value.length === 0) {
    addExportDiagnostic(sceneId, diagnostics, perso, storyId, path, value, 'Media source must be a non-empty URL string.')
    return
  }

  if (isNonLocalResourceUrl(value)) {
    addExportDiagnostic(sceneId, diagnostics, perso, storyId, path, value,
      'Only local media paths are supported by this export step.')
    return
  }

  const actualType = inferExportMediaType(value)
  const type = expectedType ?? actualType
  if (type === undefined || actualType !== type) {
    addExportDiagnostic(sceneId, diagnostics, perso, storyId, path, value,
      `Media source must have a supported ${expectedType ?? 'audio or video'} file extension.`)
    return
  }

  if (!entries.has(value)) {
    entries.set(value, {
      url: value,
      type,
      policy: { cache: 'default', priority: 'normal' },
    })
  }
  references.push({ url: value, type, path })
}

/** Recognizes only media formats packaged by the export step without changing author builds. */
function inferExportMediaType(url: string): 'image' | 'audio' | 'video' | 'rive' | undefined {
  const path = url.split(/[?#]/, 1)[0] ?? url
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase()
  if (extension === '.flac' || extension === '.m4a' || extension === '.oga') return 'audio'
  const type = SCENE_BUILD_CONFIG.resourceTypeByExtension[extension as keyof typeof SCENE_BUILD_CONFIG.resourceTypeByExtension]
  return type === 'image' || type === 'audio' || type === 'video' || type === 'rive' ? type : undefined
}

/** Rejects schemes and protocol-relative URLs that this local-file export cannot materialize. */
function isNonLocalResourceUrl(url: string): boolean {
  return url.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(url)
}

/** Emits a contextual blocking diagnostic for an export resource the current tranche cannot close. */
function addExportDiagnostic(
  sceneId: string,
  diagnostics: DiagnosticCollector,
  perso: CanonicalSceneDoc['stories'][string]['persos'][number],
  storyId: string,
  path: readonly (string | number)[],
  value: unknown,
  reason: string,
): void {
  const url = typeof value === 'string' ? value : undefined
  diagnostics.error(
    'CODPLAY_EXPORT_MEDIA_REFERENCE_UNSUPPORTED',
    reason,
    {
      refs: { sceneId, storyId, persoId: perso.id },
      context: { sceneId, path: [...path], componentType: perso.type, url },
    },
    `export-media:${storyId}:${perso.id}:${path.join('.')}`,
  )
}

/** Derives a compact resource manifest from authored media source fields. */
function deriveResources(scene: CanonicalSceneDoc): readonly CompiledResource[] {
  const entries = new Map<string, CompiledResource>()
  for (const story of Object.values(scene.stories)) {
    for (const perso of story.persos) {
      collectResource(perso.initial, entries)
      for (const action of Object.values(perso.actions)) {
        if (isPlainRecord(action)) {
          collectResource(action, entries)
        }
      }
    }
  }
  return [...entries.values()]
}

/** Collects source URLs recursively without reading the filesystem or the DOM. */
function collectResource(
  value: Record<string, unknown>,
  entries: Map<string, CompiledResource>,
): void {
  if (typeof value.src === 'string' && !entries.has(value.src)) {
    const type = inferResourceType(value.src)
    if (type !== undefined) {
      entries.set(value.src, {
        url: value.src,
        type,
        policy: { cache: 'default', priority: 'normal' },
      })
    }
  }
}

/** Infers the portable resource category from the configured URL extension. */
function inferResourceType(url: string): string | undefined {
  const path = url.split(/[?#]/, 1)[0] ?? url
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase()
  return SCENE_BUILD_CONFIG.resourceTypeByExtension[extension as keyof typeof SCENE_BUILD_CONFIG.resourceTypeByExtension]
}

/** Freezes the compiled artifact recursively so runtime consumers cannot mutate it. */
function freezeValue(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return
  }
  for (const child of Object.values(value)) {
    freezeValue(child)
  }
  Object.freeze(value)
}
