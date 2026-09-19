import type {
  LayoutItemSnapshot,
  LayoutSnapshot,
  MotionBoundary,
  MotionGraph,
  MotionIntent,
  MotionResetTimesByItem,
  MotionSegment,
} from '../types'

/** One graph operation retained between structural planning and pose resolution. */
export type MotionBuildOperation = Readonly<{
  kind: 'segment' | 'retarget'
  boundary: MotionBoundary
  itemId: string
  before: LayoutItemSnapshot
  after: LayoutItemSnapshot
  structuralAfter: LayoutSnapshot
  endpointAfter: LayoutItemSnapshot
  segmentId: string
}> | Readonly<{
  kind: 'target-retarget'
  boundary: MotionBoundary
  itemId: string
  segmentId: string
  targetItemId: string
}>

/** Ephemeral index of active motion segments by the target they depend on. */
export type TargetDependencyIndex = Map<string, Map<string, Readonly<{
  itemId: string
  segmentId: string
  startAt: number
  endAt: number
  /** False when the destination parent was not mounted at the move FIRST. */
  availableAtStart: boolean
}>>>

/** Optional logical reset barriers used while rebuilding one motion graph. */
export type MotionGraphOptions = Readonly<{
  resetTimesByItem?: MotionResetTimesByItem
}>

/** Read-only graph state needed while resolving prepared poses. */
export type MotionGraphReadState = Pick<MotionGraph, 'tracksByItem' | 'resetTimesByItem'>

/** Mutable track with direct indexes used only during graph preparation. */
export type MutableMotionTrack = {
  itemId: string
  segments: MotionSegment[]
  segmentsById: Map<string, MotionSegment>
  segmentIndexById: Map<string, number>
}

/** Mutable graph state owned exclusively by one graph build transaction. */
export type MutableMotionGraph = {
  tracksByItem: Map<string, MutableMotionTrack>
  resetTimesByItem: MotionResetTimesByItem
  presentationItemIds: Set<string>
}

/** Precomputed boundary data reused by all graph-structure decisions. */
export type MotionBoundaryMetadata = Readonly<{
  directItemIds: ReadonlySet<string>
  directIntentByItem: ReadonlyMap<string, MotionIntent>
  nonReflowDirectItemIds: ReadonlySet<string>
  changedItemIds: readonly string[]
  scope: Readonly<{
    itemIds: ReadonlySet<string>
    segmentItemIds: ReadonlySet<string>
    targetContainerItemIds: ReadonlySet<string>
  }>
}>
