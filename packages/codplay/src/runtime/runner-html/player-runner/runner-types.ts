import type { Diagnostic } from '../../../diagnostics'
import type { CompiledFunctionCollection, CompiledScene } from '../../../scene/compiled'
import type { RuntimeEngine, Ticker } from '../../engine'
import type { RuntimeIdleOptions } from '../../idle'
import type {
  ForeignContentSurface,
  InputComponentSurface,
  MaterializedPart,
  MediaComponentSurface,
} from '../../components'
import type { RuntimeCapabilityCatalog } from '../../catalog'
import type { RuntimeCaptureState } from '../../capture'
import type {
  RuntimePlayer,
  PlayerInitResult,
  RuntimeEventInput,
  SolvedScene,
  StrapCollections,
} from '../../player'
import type { HtmlSourceAdapterFactory } from '../source-adapter'
import type { RuntimeMoveOccurrence } from '../../materializer'
import type {
  RuntimePreloadApi,
  RuntimePreloadFailure,
  RuntimePreloadManifestInput,
  RuntimePreloadMediaResources,
  RuntimePreloadMetadata,
  RuntimePreloadOptions,
  RuntimePreloadSuccess,
} from '../../preload'
import type {
  LayoutSnapshot,
} from '../../motion'

/** One instance-local root target mapped to the runner's supplied root element. */
export type HtmlRootTarget = Readonly<{
  id: string
  storyId: string
}>

/** Selects the resolved occurrences whose groups need a geometry capture. */
export type MotionBoundaryRebuildOptions = Readonly<{
  occurrences?: readonly RuntimeMoveOccurrence[]
  /** Visible FIRST snapshots for occurrences replacing stale story plans. */
  presentationFirstSnapshots?: ReadonlyMap<string, LayoutSnapshot>
}>

/** Options for the standalone preload, init and play sequence. */
export type HtmlPlayerRunOptions = Readonly<{
  preload: RuntimePreloadApi
  manifest?: RuntimePreloadManifestInput
  preloadOptions?: RuntimePreloadOptions
  ticker?: Ticker
}>

/** Result of one standalone preload and playback run. */
export type HtmlPlayerRunResult =
  | Readonly<{ ok: true; phase: 'run'; preload: RuntimePreloadSuccess; init: Extract<PlayerInitResult, { ok: true }> }>
  | Readonly<{ ok: false; phase: 'library'; error: string }>
  | Readonly<{ ok: false; phase: 'preload'; preload: RuntimePreloadFailure }>
  | Readonly<{ ok: false; phase: 'init'; preload: RuntimePreloadSuccess; init: Extract<PlayerInitResult, { ok: false }> }>

/** Mutable DOM registries owned by one HTML player host. */
export type HtmlPlayerRunnerNodes = {
  persoNodes: Map<string, unknown>
  persoParts: Map<string, readonly MaterializedPart[]>
  targetNodes: Map<string, unknown>
}

/** Construction contract for the logical HTML player and motion graph. */
export type HtmlPlayerRunnerOptions = Readonly<{
  id: string
  compiledScene: CompiledScene
  root: HTMLElement
  catalog: RuntimeCapabilityCatalog
  /** Resources already made available to the visible engine. */
  resources?: readonly string[]
  /** Metadata already obtained from the external preload boundary. */
  resourceMetadata?: RuntimePreloadMetadata
  /** Native media handoffs already retained by the external preload boundary. */
  resourceMedia?: RuntimePreloadMediaResources
  engine?: RuntimeEngine
  ticker?: Ticker
  /** Optional inactivity policy overriding the shared engine default. */
  idle?: RuntimeIdleOptions
  /** Initial HTML projection scale; one cqw is the scene-root width divided by 100. */
  numericLengthScale?: number
  /** Prefix before `part` in comment-based HTML markers; defaults to `data-`. */
  partMarkerPrefix?: string
  functions?: CompiledFunctionCollection
  /** Optional reusable straps selected by named declarations in the scene. */
  strapCollections?: StrapCollections
  /** Event target used by the classic HTML pointer capture source. */
  captureEventTarget?: EventTarget
  /** Mirrors the authoring behavior: block scene input unless playing. */
  enableInteractionLock?: boolean
  /** Receives source-adapter failures instead of hiding them in native listeners. */
  onCaptureError?: (error: unknown) => void
  /** Receives structured diagnostics emitted by the generic DOM event source. */
  onEmitDiagnostic?: (diagnostic: Diagnostic) => void
  /** Optional browser sources composed at the HTML host boundary. */
  sourceAdapterFactories?: readonly HtmlSourceAdapterFactory[]
  /** Observes one completed HTML capture sample for a materializer-specific preview. */
  onCaptureTrack?: (input: Readonly<{
    captureId: string
    persoKey: string
    sample: Readonly<Record<string, unknown>>
    captureState: RuntimeCaptureState
  }>) => void
  /** Resolves one materializer-dependent value once when a pointer capture ends. */
  resolveEndCaptureState?: (input: Readonly<{
    captureId: string
    persoKey: string
    captureState: RuntimeCaptureState
    event: Event
  }>) => RuntimeCaptureState | undefined
  /** Releases materializer-specific preview resources after one capture closes. */
  onCaptureClose?: (input: Readonly<{
    captureId: string
    persoKey: string
    completed: boolean
  }>) => void
  /** Forwards public eventimes to the enclosing facade without another journal. */
  onPublicEvent?: (event: import('../../player/pipeline').RuntimeTrackEvent) => void
  /** Forwards live events and compiled eventimes reached during playback. */
  onTrace?: (event: import('../../player/pipeline').RuntimeTraceEvent) => void
}>

/** Dependencies for the runner-owned motion controller. */
export type HtmlPlayerMotionContext = Readonly<{
  compiledScene: CompiledScene
  root: HTMLElement
  nodes: HtmlPlayerRunnerNodes
  motionContainerResolver: import('../motion-container').HtmlMotionContainerResolver
  getPlayer: () => RuntimePlayer
  getComponentStateRevision: (itemId: string) => number
  presentSceneForGeometryCapture: (scene: SolvedScene) => void
  getCurrentTimeMs: () => number
  getPersistOnlyMode: () => boolean
}>

/** Result returned by one component surface lookup. */
export type HtmlComponentSurface =
  | MediaComponentSurface
  | InputComponentSurface
  | ForeignContentSurface
  | undefined

/** Event input accepted by the runner's live event convenience method. */
export type HtmlPlayerEventInput = Omit<RuntimeEventInput, 'applyAtMs'> & { applyAtMs?: number }
