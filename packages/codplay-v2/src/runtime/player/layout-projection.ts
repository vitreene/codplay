import type { SolvedScene } from './pipeline'
import type { MoveStateDelta } from '../move'

/** Phase and placement changes associated with one layout projection. */
export type LayoutProjectionContext = Readonly<{
  previousScene?: SolvedScene
  moveDeltas: readonly MoveStateDelta[]
  /** Synchronizes authored component state immediately before structural writes. */
  authoredSync?: (scene: SolvedScene) => void
}>

/** Projection boundary called by RuntimePlayer after each solved scene. */
export type LayoutProjection = Readonly<{
  project: (scene: SolvedScene, context?: LayoutProjectionContext) => void
  destroy?: () => void
}>
