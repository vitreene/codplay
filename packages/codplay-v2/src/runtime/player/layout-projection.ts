import type { SolvedScene } from './pipeline'
import type { MoveStateDelta } from '../move'

/** Structural render state supplied by a capability such as list. */
export type LayoutProjectionState = Readonly<{
  /** Graph revision of the scene for which this state was consumed. */
  graphRevision?: string
  childrenByTarget?: Readonly<Record<string, readonly string[]>>
  touchedItemIds?: readonly string[]
}>

/** Phase and placement changes associated with one layout projection. */
export type LayoutProjectionContext = Readonly<{
  previousScene?: SolvedScene
  moveDeltas: readonly MoveStateDelta[]
  /** Synchronizes authored component state immediately before structural writes. */
  authoredSync?: (scene: SolvedScene) => void
  /** Supplies authoritative structural order and touched items for this projection. */
  layoutState?: LayoutProjectionState
}>

/** Projection boundary called by RuntimePlayer after each solved scene. */
export type LayoutProjection = Readonly<{
  project: (scene: SolvedScene, context?: LayoutProjectionContext) => void
  destroy?: () => void
}>
