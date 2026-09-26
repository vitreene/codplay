import type { Diagnostic } from '../../diagnostics'
import type { CompiledScene } from '../../scene/compiled'
import type {
  PlayerLifecycleState,
  PlayerSeekResult,
  RuntimeEventDispatchResult,
  RuntimeEventInput,
  RuntimeLiveAction,
  RuntimeTrackEvent,
  SolvedScene,
} from '../player'

/** Commands a browser source may use without receiving the player instance. */
export type HtmlSourceAdapterPlayerPort = Readonly<{
  emit: (input: Omit<RuntimeEventInput, 'applyAtMs'> & Readonly<{ applyAtMs?: number }>) => Promise<RuntimeEventDispatchResult>
  setLiveActions: (sourceId: string, actions: readonly RuntimeLiveAction[] | undefined) => void
}>

/** Read-only scene, HTML lookup, player commands, and diagnostics for one source. */
export type HtmlSourceAdapterContext = Readonly<{
  compiledScene: CompiledScene
  getSolvedScene: () => SolvedScene | undefined
  getLifecycleState: () => PlayerLifecycleState
  getCurrentTimeMs: () => number
  /** Resolves an element by the canonical runtime key used by the solved graph. */
  resolvePersoElement: (persoKey: string) => Element | undefined
  commands: HtmlSourceAdapterPlayerPort
  reportDiagnostic: (diagnostic: Diagnostic) => void
}>

/** Lifecycle messages owned and ordered by HtmlPlayerRunner. */
export type HtmlSourceAdapter = Readonly<{
  attach: () => void
  onScenePresented?: (scene: SolvedScene) => void
  onPlaybackStateChange?: (state: PlayerLifecycleState) => void
  beforeSeek?: () => void
  afterSeek?: (scene: SolvedScene | undefined, result: PlayerSeekResult | undefined) => void
  onSequenceEnd?: (event: RuntimeTrackEvent) => void
  destroy: () => void
}>

/** Creates one browser source adapter for an initialized HTML player host. */
export type HtmlSourceAdapterFactory = (
  context: HtmlSourceAdapterContext,
) => HtmlSourceAdapter
