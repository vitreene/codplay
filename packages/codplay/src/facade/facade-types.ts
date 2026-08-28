import type {
  Diagnostic,
  DiagnosticOutput,
  DiagnosticReport,
} from '../diagnostics'
import type {
  CompiledFunctionCollection,
  CompiledRecord,
  CompiledScene,
} from '../scene/compiled'
import type { SceneDoc } from '../scene/types'
import type {
  RuntimeCapabilityOrigin,
  RuntimeComponentDefinition,
  RuntimeComponentServiceDefinition,
  RuntimeModuleServiceDefinition,
} from '../runtime/catalog'
import type { RuntimeEventInsertMode } from '../runtime/config/event-insertion'
import type { MountTargetDeclaration, StrapCollections } from '../runtime/player/pipeline'
import type {
  RuntimePreloadApi,
  RuntimePreloadCacheApi,
  RuntimePreloadMetadata,
  RuntimePreloadManifestInput,
  RuntimePreloadMode,
  RuntimePreloadOptions,
  RuntimePreloadResult,
  RuntimePreloadState,
  RuntimePreloadStrategy,
} from '../runtime/preload'
import type { PlayerLifecycleState } from '../runtime/config/player-lifecycle'

/** One group of capability declarations composed while creating an engine. */
export type CodPlayCapabilityGroup<Definition> = Readonly<{
  register?: readonly Definition[]
  override?: readonly Definition[]
}>

/** Resource availability and metadata transferred from the external preload service. */
export type CodPlayResourceRegistration = Readonly<{
  loaded: readonly string[]
  skipped: readonly string[]
  metadata: RuntimePreloadMetadata
}>

/** Configuration dedicated to the CodPlay-owned engine and its capability catalog. */
export type CodPlayEngineOptions = Readonly<{
  components?: CodPlayCapabilityGroup<RuntimeComponentDefinition>
  services?: CodPlayCapabilityGroup<RuntimeComponentServiceDefinition>
  modules?: CodPlayCapabilityGroup<RuntimeModuleServiceDefinition>
  resources?: CodPlayResourceRegistration
  diagnosticOutput?: DiagnosticOutput
}>

/** Host-owned frame scheduling primitive injected into one CodPlay instance. */
export type CodPlayFrameScheduler = Readonly<{
  request: (callback: () => void) => number
  cancel: (requestId: number) => void
}>

/** Options for the single public CodPlay facade instance. */
export type CodPlayOptions = Readonly<{
  engine?: CodPlayEngineOptions
  frameScheduler?: CodPlayFrameScheduler
  pauseOnDocumentHidden?: boolean
  /** Retained until the preload interface is reviewed as a separate contract. */
  preload?: CodPlayPreloadOptions
}>

/** Input accepted by the engine-bound public scene compiler. */
export type CodPlayCompileInput = Readonly<{
  scene: SceneDoc
}>

/** Optional metadata for one public scene compilation. */
export type CodPlayCompileOptions = Readonly<{
  createdAt?: string
  schemaVersion?: string
}>

/** Successful public compilation result reused by instance creation. */
export type CodPlayCompileSuccess = Readonly<{
  ok: true
  compiledScene: CompiledScene
  functions: CompiledFunctionCollection
  diagnostics: DiagnosticReport
}>

/** Failed public compilation result containing structured diagnostics only. */
export type CodPlayCompileFailure = Readonly<{
  ok: false
  diagnostics: DiagnosticReport
}>

/** Result of compiling one authored SceneDoc against the engine catalog. */
export type CodPlayCompileResult = CodPlayCompileSuccess | CodPlayCompileFailure

/** Public result returned by one component, service, or module registry operation. */
export type CodPlayRegistryResult =
  | Readonly<{
      ok: true
      status: 'registered' | 'overridden'
    }>
  | Readonly<{
      ok: false
      error: CodPlayRegistryError
    }>

/** Structured error returned by one rejected registry operation. */
export type CodPlayRegistryError = Readonly<{
  code: string
  message: string
  details?: Readonly<Record<string, unknown>>
}>

/** Common public registry surface for one runtime capability family. */
export type CodPlayRegistry<Definition> = Readonly<{
  register: (definition: Definition) => CodPlayRegistryResult
  override: (definition: Definition) => CodPlayRegistryResult
}>

/** Public component definition registry. */
export type CodPlayComponents = CodPlayRegistry<RuntimeComponentDefinition>

/** Public component-service definition registry. */
export type CodPlayServices = CodPlayRegistry<RuntimeComponentServiceDefinition>

/** Public player-module definition registry. */
export type CodPlayModules = CodPlayRegistry<RuntimeModuleServiceDefinition>

/** Options for one independent public preload service. */
export type CodPlayPreloadOptions = Readonly<{
  cache?: RuntimePreloadCacheApi
  strategies?: Readonly<Record<string, RuntimePreloadStrategy>>
}>

/** Public eventime form accepted at the runtime boundary. */
export type CodPlayEventime = Readonly<{
  name: string
  startAt?: number
  visibility?: 'story' | 'scene' | 'public'
  data?: CompiledRecord
  events?: readonly CodPlayEventime[]
  mode?: RuntimeEventInsertMode
}>

/** Scene or story address carried separately from one eventime declaration. */
export type CodPlayEventimeAddress = Readonly<{
  scope: 'scene' | 'story'
  storyId?: string
  trackId?: string
}>

/** Eventime command addressed to one CodPlay instance. */
export type CodPlayEventInput = Readonly<{
  instanceId: string
  eventime: CodPlayEventime
  address: CodPlayEventimeAddress
}>

/** Public event emitted by an eventime whose visibility is `public`. */
export type CodPlayPublicEvent = Readonly<{
  instanceId: string
  eventId: string
  eventSeq: number
  name: string
  timeMs: number
  visibility: 'public'
  data?: CompiledRecord
  context?: Readonly<Record<string, unknown>>
  meta?: Readonly<Record<string, unknown>>
}>

/** State exposed to the instance telco and its remote control. */
export type CodPlayTelcoState = Readonly<{
  instanceId: string
  status: PlayerLifecycleState
  timelineMs: number
  durationMs: number
  rate: number
  initialized: boolean
  sequenceEnded: boolean
  runtimeRevision: number
}>

/** Time-only progress value kept separate from presentation percentages. */
export type CodPlayProgress = Readonly<{
  timelineMs: number
  durationMs: number
}>

/** Listener for one public event. */
export type CodPlayEventListener = (event: CodPlayPublicEvent) => void

/** Listener for one instance telco state snapshot. */
export type CodPlayTelcoStateListener = (state: CodPlayTelcoState) => void

/** Listener for one structured diagnostic. */
export type CodPlayDiagnosticListener = (diagnostic: Diagnostic) => void

/** Public command and observation surface of one instance telco. */
export type CodPlayTelco = Readonly<{
  readonly commandInFlight: boolean
  readonly rate: number
  getState: () => CodPlayTelcoState
  getProgress: () => CodPlayProgress
  play: () => Promise<void>
  pause: () => Promise<void>
  togglePlay: () => Promise<void>
  setRate: (rate: number) => void
  seek: (timeMs: number) => Promise<void>
  rewind: () => Promise<void>
  onChange: (listener: CodPlayTelcoStateListener) => () => void
  onProgress: (listener: CodPlayTelcoStateListener) => () => void
}>

/** Public event injection and observation surface of one instance. */
export type CodPlayInstanceEvents = Readonly<{
  emit: (eventime: CodPlayEventime, address: CodPlayEventimeAddress) => Promise<void>
  onEvent: (listener: CodPlayEventListener) => () => void
}>

/** Public diagnostic observation surface of one instance. */
export type CodPlayInstanceDiagnostic = Readonly<{
  onDiagnostic: (listener: CodPlayDiagnosticListener) => () => void
}>

/** Common options used to create and initialize one public instance. */
type CodPlayInstanceOptionsBase = Readonly<{
  instanceId: string
  compiledScene: CompiledScene
  functions?: CompiledFunctionCollection
  durationMs: number
  mountTargets?: readonly MountTargetDeclaration[]
  /** Optional reusable straps used only by declarations that name external implementations. */
  strapCollections?: StrapCollections
}>

/** Options for one public instance using CodPlay's HTML/DOM materialization. */
export type CodPlayInstanceOptions = CodPlayInstanceOptionsBase & Readonly<{
  root: HTMLElement
}>

/** Public instance boundary; runtime classes and materializer internals stay hidden. */
export type CodPlayInstance = Readonly<{
  readonly instanceId: string
  readonly telco: CodPlayTelco
  readonly events: CodPlayInstanceEvents
  readonly diagnostic: CodPlayInstanceDiagnostic
}>

/** Public instance registry owned by one CodPlay owner. */
export type CodPlayInstances = Readonly<{
  create: (options: CodPlayInstanceOptions) => CodPlayInstance
  get: (instanceId: string) => CodPlayInstance | undefined
  destroy: (instanceId: string) => void
}>

/** Public shared-resource registration surface. */
export type CodPlayResources = Readonly<{
  register: (resources: CodPlayResourceRegistration) => void
}>

/** Public event channel shared by all instances of one CodPlay owner. */
export type CodPlayEvents = Readonly<{
  emit: (input: CodPlayEventInput) => Promise<void>
  onEvent: (listener: CodPlayEventListener) => () => void
}>

/** Public engine boundary for advanced clock control only. */
export type CodPlayEngine = Readonly<{
  start: () => void
  pause: () => void
  stop: () => void
  advance: (nowMs: number, marginMs?: number) => void
}>

/** Public scene construction method bound to one CodPlay capability catalog. */
export type CodPlayBuildMethod = (
  input: CodPlayCompileInput,
  options?: CodPlayCompileOptions,
) => CodPlayCompileResult

/** Public CodPlay owner boundary. */
export type CodPlayApi = Readonly<{
  readonly build: CodPlayBuildMethod
  readonly components: CodPlayComponents
  readonly services: CodPlayServices
  readonly modules: CodPlayModules
  readonly resources: CodPlayResources
  readonly events: CodPlayEvents
  readonly engine: CodPlayEngine
  readonly instances: CodPlayInstances
  readonly preload: RuntimePreloadApi
  destroy: () => void
}>

/** Compatibility names used by the facade plan. */
export type EngineFacade = CodPlayEngine
export type InstanceFacade = CodPlayInstance
export type PreloadFacade = RuntimePreloadApi

/** Public preload types re-exported with the facade surface. */
export type {
  RuntimePreloadApi,
  RuntimePreloadManifestInput,
  RuntimePreloadMode,
  RuntimePreloadOptions,
  RuntimePreloadResult,
  RuntimePreloadState,
  RuntimePreloadStrategy,
}

/** Public capability origin retained for extension declarations. */
export type { RuntimeCapabilityOrigin }
