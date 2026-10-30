import type { SelectionFrameValue } from '../decor-editor/types'
import type { MotionGeometryPose } from './geometry'
import type { MotionOverlayGhost, MotionOverlaySegment } from './overlay'

export type MotionGeometryProjection = Readonly<{
  selection: Readonly<{
    geometry: MotionGeometryPose
    enabled: boolean
  }> | null
  segments: readonly MotionOverlaySegment[]
  ghosts: readonly MotionOverlayGhost[]
  initialGhost: SelectionFrameValue | null
}>

export type MotionGeometryStore = Readonly<{
  get: () => MotionGeometryProjection
  publish: (projection: MotionGeometryProjection) => void
  subscribe: (listener: (projection: MotionGeometryProjection) => void) => () => void
}>

const EMPTY_PROJECTION: MotionGeometryProjection = Object.freeze({
  selection: null,
  segments: [],
  ghosts: [],
  initialGhost: null,
})

/** Creates the one published geometry projection consumed by the frame and motion overlay. */
export function createMotionGeometryStore(): MotionGeometryStore {
  let projection = EMPTY_PROJECTION
  const listeners = new Set<(projection: MotionGeometryProjection) => void>()

  return {
    get: () => projection,
    publish: (next) => {
      projection = next
      for (const listener of listeners) listener(projection)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      listener(projection)
      return () => { listeners.delete(listener) }
    },
  }
}
