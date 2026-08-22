import type { CompiledScene } from '../../scene/compiled'
import type { MoveStateDelta } from '../move'
import type { SolvedScene } from '../player/pipeline/types'
import type { MountTargetDeclaration } from '../player/pipeline/mount-targets'

/** Context supplied when one module instance is created for a player. */
export type RuntimeModuleServiceContext = Readonly<{
  playerId: string
  compiledScene: CompiledScene
  /** Resolves one player-local component after the component host has mounted it. */
  getComponentById?: (runtimeItemId: string) => unknown
}>

/** Runtime handle for one staged module seek. */
export type RuntimeModuleServiceSeekHandle = Readonly<{
  commit: () => void
  abort?: () => void
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
