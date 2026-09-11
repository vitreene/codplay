import type { CompiledScene } from '../../scene/compiled'
import type { MoveStateDelta } from '../move'
import type { SolvedScene } from '../player/pipeline/types'
import type { MountTargetDeclaration } from '../player/pipeline/mount-targets'
import type { RuntimeComponentSurfaceResolver } from '../components/component-surface-types'
import type {
  ComponentActionOccurrence,
  ComponentAnimation,
} from '../components/component-types'

/** Context supplied when one module instance is created for a player. */
export type RuntimeModuleServiceContext = Readonly<{
  playerId: string
  compiledScene: CompiledScene
  /** Resolves typed operations published by player-local mounted components. */
  componentSurfaces?: RuntimeComponentSurfaceResolver
}>

/** Runtime handle for one staged module seek. */
export type RuntimeModuleServiceSeekHandle = Readonly<{
  commit: () => void
  abort?: () => void
}>

/** Identifies why the component runtime is delivering one state update. */
export type RuntimeComponentUpdatePhase = 'normal' | 'seek' | 'geometry-capture'

/** Context shared by generic module hooks around one component update. */
export type RuntimeComponentUpdateContext = Readonly<{
  componentId: string
  storyId: string
  persoId: string
  componentType: string
  state: Readonly<Record<string, unknown>>
  timeMs: number
  activeActions: readonly ComponentActionOccurrence[]
  phase: RuntimeComponentUpdatePhase
  /** Adds a player-clocked presentation stream to this component update. */
  registerAnimation: (animation: ComponentAnimation) => void
}>

/** Complete structural order returned by one runtime capability policy. */
export type RuntimeStructuralOrder = Readonly<Record<string, readonly string[]>>

/** Resolves one structural boundary without reading or mutating a materializer. */
export type RuntimeStructuralOrderResolver = (
  previousOrder: RuntimeStructuralOrder,
  scene: SolvedScene,
  deltas: readonly MoveStateDelta[],
) => RuntimeStructuralOrder

/** Hooks exposed by one player-scoped module instance. */
export type RuntimeModuleServiceInstance = Readonly<{
  initializeScene?: (scene: SolvedScene) => void
  /** Runs immediately before the component receives one logical update. */
  beforeComponentUpdate?: (context: RuntimeComponentUpdateContext) => void
  /** Runs immediately after the component successfully receives one update. */
  afterComponentUpdate?: (context: RuntimeComponentUpdateContext) => void
  /** Cleans module state when the component update fails after preparation. */
  onComponentUpdateError?: (context: RuntimeComponentUpdateContext, error: unknown) => void
  /** Receives the solved scene after its component state has been synchronized. */
  onScenePresented?: (scene: SolvedScene, playbackState: 'playing' | 'paused') => void
  /** Receives a player lifecycle transition at the current logical time. */
  onPlaybackStateChange?: (state: 'playing' | 'paused', timeMs: number) => void
  /** Receives a validated player rate change for native runtime clocks. */
  onRateChange?: (rate: number) => void
  /** Supplies an alternate logical clock when the module owns the active source clock. */
  resolveTimelineMs?: (fallbackTimeMs: number) => number
  /** Pauses module-owned native playback before the player reconstructs a seek target. */
  beforeSeek?: (timeMs: number) => void
  getMountTargets?: () => readonly MountTargetDeclaration[]
  /** Resets policy history before the canonical structural timeline is rebuilt. */
  resetStructuralOrder?: () => void
  resolveStructuralOrder?: RuntimeStructuralOrderResolver
  prepareSeek?: (scene: SolvedScene) => RuntimeModuleServiceSeekHandle
  onMoveDelta?: (delta: MoveStateDelta) => void
  destroy?: () => void
}>
