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
import type { Ticker } from '../runtime/time'
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

/** Configuration used to create one public V2 engine. */
export type CodPlayEngineConfig = Readonly<{
  components?: CodPlayCapabilityGroup<RuntimeComponentDefinition>
  services?: CodPlayCapabilityGroup<RuntimeComponentServiceDefinition>
  modules?: CodPlayCapabilityGroup<RuntimeModuleServiceDefinition>
  resources?: CodPlayResourceRegistration
  ticker?: Ticker
  diagnosticOutput?: DiagnosticOutput
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

/** Public compiler bound to the engine's locked capability catalog. */
export type CodPlayEngineBuilder = Readonly<{
  compile: (input: CodPlayCompileInput, options?: CodPlayCompileOptions) => CodPlayCompileResult
}>

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

/** Eventime command addressed to one engine instance. */
export type CodPlayEngineEventInput = Readonly<{
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

/** Public instance registry owned by one engine. */
export type CodPlayEngineInstances = Readonly<{
  create: (options: CodPlayInstanceOptions) => CodPlayInstance
  get: (instanceId: string) => CodPlayInstance | undefined
  destroy: (instanceId: string) => void
}>

/** Public shared-resource registration surface. */
export type CodPlayEngineResources = Readonly<{
  register: (resources: CodPlayResourceRegistration) => void
}>

/** Public event channel shared by all instances of one engine. */
export type CodPlayEngineEvents = Readonly<{
  emit: (input: CodPlayEngineEventInput) => Promise<void>
  onEvent: (listener: CodPlayEventListener) => () => void
}>

/** Public engine boundary for addressing, ordering, and instance ownership. */
export type CodPlayEngine = Readonly<{
  readonly builder: CodPlayEngineBuilder
  readonly instances: CodPlayEngineInstances
  readonly resources: CodPlayEngineResources
  readonly events: CodPlayEngineEvents
  start: (ticker?: Ticker) => void
  pause: () => void
  stop: () => void
  advance: (nowMs: number, marginMs?: number) => void
  destroy: () => void
}>

/** Public CodPlay namespace. */
export type CodPlayFacade = Readonly<{
  engine: Readonly<{
    create: (config?: CodPlayEngineConfig) => CodPlayEngine
  }>
  preload: Readonly<{
    create: (options?: CodPlayPreloadOptions) => RuntimePreloadApi
  }>
}>

/** Public CodPlay entry point exported by the V2 package. */
export type CodPlayApi = CodPlayFacade

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
