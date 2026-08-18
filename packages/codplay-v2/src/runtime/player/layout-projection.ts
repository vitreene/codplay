import type { SolvedScene } from './pipeline'
import type { MoveStateDelta } from '../move'

/** Phase and placement changes associated with one layout projection. */
export type LayoutProjectionContext = Readonly<{
  phase: 'init' | 'frame' | 'seek'
  previousScene?: SolvedScene
  moveDeltas: readonly MoveStateDelta[]
}>

/** Projection boundary called by RuntimePlayer after each solved scene. */
export type LayoutProjection = Readonly<{
  project: (scene: SolvedScene, context?: LayoutProjectionContext) => void
  advance?: (timeMs: number) => void
  destroy?: () => void
}>
