import type { DiagnosticOutput, DiagnosticReport } from '../../diagnostics'
import { DiagnosticCollector } from '../../diagnostics'
import { isPlainRecord } from '../../shared'
import { SCENE_BUILD_CONFIG } from '../config/scene-build'
import { normalizeSceneDoc } from '../normalization'
import type {
  CanonicalPersoDoc,
  CanonicalSceneDoc,
  CanonicalStoryDoc,
  SceneListenRule,
  SceneDoc,
} from '../types'
import { CompiledSceneValidationEngine } from '../validation/compiled-scene-validation-engine'
import { SceneGuardEngine } from '../validation/scene-guard-engine'
import type { CapabilityValidationSnapshot } from '../validation/validation-types'
import {
  createExtractionState,
  extractCompiledRecord,
  extractCompiledValue,
  extractFunction,
  finalizeFunctionCollection,
  type CompiledFunctionCollection,
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
  CompiledScene,
  CompiledSceneData,
  CompiledStory,
} from './types'
import { sanitizeMarkupTemplate } from '../validation/markup-sanitizer'
import { validateCompiledSceneSemantics } from './semantic-validator'

/** Options controlling one deterministic scene compilation. */
export type SceneBuilderOptions = Readonly<{
  createdAt?: string
  schemaVersion?: string
  diagnosticOutput?: DiagnosticOutput
}>

/** Successful build result carrying the artifact and its external function collection. */
export type SceneBuildSuccess = Readonly<{
  ok: true
  compiledScene: CompiledScene
  functions: CompiledFunctionCollection
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
  build(scene: SceneDoc): SceneBuildResult {
    const diagnostics = new DiagnosticCollector({ output: this.options.diagnosticOutput })
    const canonical = normalizeSceneDoc(scene)
    this.guardEngine.validate(canonical, diagnostics)

    const activeScene = withoutDisabledStories(canonical)
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
      const compiledScene: CompiledScene = {
        schemaVersion: this.options.schemaVersion ?? SCENE_BUILD_CONFIG.schemaVersion,
        createdAt: this.options.createdAt ?? new Date().toISOString(),
        scene: compiledData,
        resources: { entries: deriveResources(activeScene) },
        rootNodeIds: deriveRootNodeIds(activeScene),
        requirements: deriveRequirements(activeScene, this.validationEngine),
        actionTargetIndex: deriveActionTargetIndex(compiledData),
      }
      validateCompiledSceneSemantics(compiledScene, diagnostics)
      if (diagnostics.hasErrors()) {
        return { ok: false, diagnostics: diagnostics.report() }
      }
      freezeValue(compiledScene)
      return {
        ok: true,
        compiledScene,
        functions: finalizeFunctionCollection(extraction),
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
function listPersoValidationInputs(scene: CanonicalSceneDoc): readonly CanonicalPersoDoc[] {
  return Object.values(scene.stories).flatMap((story) => story.persos)
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
      Object.entries(scene.stories).map(([storyId, story]) => [storyId, compileStory(story, `scene.stories.${storyId}`, state, validationEngine)]),
    ),
    initial: extractCompiledRecord(scene.initial, 'scene.initial', state),
    straps: scene.straps,
    listen: scene.listen.map((rule, index) => compileListenRule(rule, `scene.listen[${index}]`, state)),
    state: extractCompiledRecord(scene.state, 'scene.state', state),
    tracks: extractCompiledRecord(scene.tracks, 'scene.tracks', state) ?? {},
    defaults: extractCompiledRecord(scene.defaults, 'scene.defaults', state),
    init: scene.init === undefined ? undefined : extractFunction(scene.init, 'scene.init', state),
    onStart: scene.onStart === undefined ? undefined : extractFunction(scene.onStart, 'scene.onStart', state),
    onSequenceEnd: scene.onSequenceEnd === undefined
      ? undefined
      : extractFunction(scene.onSequenceEnd, 'scene.onSequenceEnd', state),
  }
}

/** Compiles one active story and all of its authored payloads. */
function compileStory(
  story: CanonicalStoryDoc,
  scope: string,
  state: ReturnType<typeof createExtractionState>,
  validationEngine: CompiledSceneValidationEngine,
): CompiledStory {
  return {
    id: story.id,
    name: story.name,
    trackId: story.trackId,
    initial: extractCompiledRecord(story.initial, `${scope}.initial`, state),
    persos: story.persos.map((perso, index) => compilePerso(perso, `${scope}.persos[${index}]`, state, validationEngine)),
    tracks: extractCompiledRecord(story.tracks, `${scope}.tracks`, state),
    straps: story.straps,
    listen: story.listen.map((rule, index) => compileListenRule(rule, `${scope}.listen[${index}]`, state)),
    eventimes: story.eventimes?.map((eventime, index) => extractCompiledValue(eventime, `${scope}.eventimes[${index}]`, state) as CompiledEventime),
    state: extractCompiledRecord(story.state, `${scope}.state`, state),
    init: story.init === undefined ? undefined : extractFunction(story.init, `${scope}.init`, state),
  }
}

/** Compiles one perso including initial values, actions, list, and emit data. */
function compilePerso(
  perso: CanonicalPersoDoc,
  scope: string,
  state: ReturnType<typeof createExtractionState>,
  validationEngine: CompiledSceneValidationEngine,
): CompiledPerso {
  const sanitizedInitial = validationEngine.sanitizeInitial(perso.type, perso.initial)
  const compiledInitial = extractCompiledRecord(compileMovePath(sanitizedInitial, `${scope}.initial`) as Record<string, unknown>, `${scope}.initial`, state) ?? {}
  const initial = typeof sanitizedInitial.markup === 'string'
    ? {
        ...compiledInitial,
        markup: sanitizeMarkupTemplate(
          sanitizedInitial.markup,
          `${scope}.initial.markup`,
          validationEngine.markupSanitizersFor(perso.type),
        ),
      }
    : compiledInitial
  return {
    id: perso.id,
    name: perso.name,
    type: perso.type,
    initial,
    actions: Object.fromEntries(
      Object.entries(perso.actions).map(([name, value]) => {
        const sanitizedValue = isPlainRecord(value)
          ? validationEngine.sanitizeAction(perso.type, value)
          : value
        return [name, extractCompiledValue(compileMovePath(sanitizedValue, `${scope}.actions.${name}`), `${scope}.actions.${name}`, state)]
      }),
    ),
    list: extractCompiledRecord(perso.list, `${scope}.list`, state),
    emit: compileEmitDeclaration(perso.emit, `${scope}.emit`, state),
  }
}

/** Compiles one listen rule and extracts all transform functions in declaration order. */
function compileListenRule(
  rule: SceneListenRule,
  scope: string,
  state: ReturnType<typeof createExtractionState>,
): CompiledListenRule {
  return {
    on: rule.on,
    transform: rule.transform?.map((fn, index) => extractFunction(fn, `${scope}.transform[${index}]`, state)),
    emit: rule.emit?.map((value, index) => extractCompiledValue(value, `${scope}.emit[${index}]`, state) as CompiledRecord),
    straps: rule.straps,
  }
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

/** Derives required component, service, module, and resource capability names. */
function deriveRequirements(
  scene: CanonicalSceneDoc,
  validationEngine: CompiledSceneValidationEngine,
): CompiledScene['requirements'] {
  const components = new Set<string>()
  const services = new Set<string>()
  const modules = new Set<string>()
  for (const story of Object.values(scene.stories)) {
    for (const perso of story.persos) {
      components.add(perso.type)
      for (const service of validationEngine.servicesFor(perso.type)) {
        services.add(service)
      }
      for (const moduleService of validationEngine.modulesFor(perso.type)) {
        modules.add(moduleService)
      }
    }
  }
  return {
    components: [...components],
    services: [...services],
    modules: [...modules],
    resources: deriveResourceUrls(scene),
  }
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

/** Derives resource URLs in the same stable order as the manifest. */
function deriveResourceUrls(scene: CanonicalSceneDoc): readonly string[] {
  return deriveResources(scene).map((entry) => entry.url)
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
