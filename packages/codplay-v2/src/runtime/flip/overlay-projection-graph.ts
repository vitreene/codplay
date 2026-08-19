import {
  composeRelativeFlipPose,
  deriveRelativeFlipPose,
  FlipHistoricalPoseCache,
  resolveFlipPoseGraph,
  type RelativeFlipPose,
} from './flip-pose-graph'
import { prepareTween, resolveTweenProgress } from '../../ace'
import type { FlipCapture, HtmlFlipProjection, ResolvedFlipPose } from './types'

/** Lifecycle state of one independently projected world overlay. */
export type OverlayProjectionState = 'capture' | 'handoff'

/** One node in the recursive overlay ownership graph. */
export type OverlayProjectionNode = Readonly<{
  itemId: string
  captureId: string
  handle: unknown
  state: OverlayProjectionState
  /** Active parent whose trajectory composes a stable-sibling capture. */
  captureParentItemId?: string
  destinationTargetId?: string
  parentItemId?: string
  relativePose?: RelativeFlipPose
}>

/** Resolves one persisted capture by its primary or grouped identity. */
export type OverlayCaptureResolver = (captureId: string) => FlipCapture | undefined

/** Creates the direct-capture state for one overlay node. */
export function createOverlayCaptureNode(input: Readonly<{
  itemId: string
  captureId: string
  handle: unknown
  captureParentItemId?: string
  destinationTargetId?: string
}>): OverlayProjectionNode {
  return {
    itemId: input.itemId,
    captureId: input.captureId,
    handle: input.handle,
    state: 'capture',
    ...(input.captureParentItemId === undefined ? {} : { captureParentItemId: input.captureParentItemId }),
    ...(input.destinationTargetId === undefined ? {} : { destinationTargetId: input.destinationTargetId }),
  }
}

/** Resolves one overlay node recursively from its root parent to its leaf. */
export function resolveOverlayProjectionPose(
  node: OverlayProjectionNode,
  nodes: ReadonlyMap<string, OverlayProjectionNode>,
  timeMs: number,
  resolveCapture: OverlayCaptureResolver,
  projection: Pick<HtmlFlipProjection, 'captureHistoricalPose'>,
  historicalPoseCache: FlipHistoricalPoseCache,
  visiting = new Set<string>(),
): ResolvedFlipPose | undefined {
  if (visiting.has(node.itemId)) throw new Error(`FLIP overlay projection cycle detected: ${node.itemId}`)
  visiting.add(node.itemId)
  try {
    if (node.state === 'capture') {
      const capture = resolveCapture(node.captureId)
      if (capture === undefined) return undefined
      const parent = node.captureParentItemId === undefined
        ? undefined
        : nodes.get(node.captureParentItemId)
      if (parent !== undefined) {
        const entry = capture.entries.find((candidate) => candidate.itemId === node.itemId)
        const parentAtCurrent = resolveOverlayProjectionPose(
          parent,
          nodes,
          timeMs,
          resolveCapture,
          projection,
          historicalPoseCache,
          visiting,
        )
        const parentAtStart = resolveOverlayProjectionPose(
          parent,
          nodes,
          capture.startAt,
          resolveCapture,
          projection,
          historicalPoseCache,
          visiting,
        )
        const parentAtEnd = resolveOverlayProjectionPose(
          parent,
          nodes,
          capture.endAt,
          resolveCapture,
          projection,
          historicalPoseCache,
          visiting,
        )
        if (entry !== undefined && parentAtStart !== undefined && parentAtEnd !== undefined) {
          const relativeFrom = deriveRelativeFlipPose(parentAtStart.pose, entry.from)
          const relativeTo = deriveRelativeFlipPose(parentAtEnd.pose, entry.to)
          const progress = resolveItemProgress(entry, timeMs)
          const relative = interpolateRelativeFlipPose(relativeFrom, relativeTo, progress)
          if (parentAtCurrent === undefined) return undefined
          return {
            itemId: node.itemId,
            mode: 'overlay-world',
            pose: composeRelativeFlipPose(relative, parentAtCurrent.pose),
            progress,
            captureId: capture.captureId,
          }
        }
      }
      return resolveFlipPoseGraph(capture, timeMs, projection, historicalPoseCache)
        .find((pose) => pose.itemId === node.itemId)
    }

    if (node.parentItemId === undefined || node.relativePose === undefined) {
      throw new Error(`FLIP overlay handoff is incomplete: ${node.itemId}`)
    }
    const parent = nodes.get(node.parentItemId)
    if (parent === undefined) return undefined
    const parentPose = resolveOverlayProjectionPose(
      parent,
      nodes,
      timeMs,
      resolveCapture,
      projection,
      historicalPoseCache,
      visiting,
    )
    if (parentPose === undefined) return undefined
    return {
      itemId: node.itemId,
      mode: 'overlay-world',
      pose: composeRelativeFlipPose(node.relativePose, parentPose.pose),
      progress: 1,
      captureId: node.captureId,
    }
  } finally {
    visiting.delete(node.itemId)
  }
}

/** Interpolates a sibling's local reflow between its parent-relative endpoints. */
function interpolateRelativeFlipPose(
  from: RelativeFlipPose,
  to: RelativeFlipPose,
  progress: number,
): RelativeFlipPose {
  return {
    origin: [
      lerp(from.origin[0], to.origin[0], progress),
      lerp(from.origin[1], to.origin[1], progress),
    ],
    matrix: {
      a: lerp(from.matrix.a, to.matrix.a, progress),
      b: lerp(from.matrix.b, to.matrix.b, progress),
      c: lerp(from.matrix.c, to.matrix.c, progress),
      d: lerp(from.matrix.d, to.matrix.d, progress),
      e: lerp(from.matrix.e, to.matrix.e, progress),
      f: lerp(from.matrix.f, to.matrix.f, progress),
    },
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress),
  }
}

/** Resolves one item capture's own eased progress independently of its parent. */
function resolveItemProgress(
  entry: Readonly<{ startAt: number; duration: number; ease: string }>,
  timeMs: number,
): number {
  return resolveTweenProgress(
    prepareTween({ from: 0, to: 1, duration: entry.duration, ease: entry.ease }),
    timeMs - entry.startAt,
  )
}

/** Linearly interpolates one scalar component of a relative pose. */
function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

/** Converts one completed direct node into a relative handoff to an active parent. */
export function createOverlayHandoffNode(
  node: OverlayProjectionNode,
  parent: OverlayProjectionNode,
  timeMs: number,
  nodes: ReadonlyMap<string, OverlayProjectionNode>,
  resolveCapture: OverlayCaptureResolver,
  projection: Pick<HtmlFlipProjection, 'captureHistoricalPose'>,
  historicalPoseCache: FlipHistoricalPoseCache,
): OverlayProjectionNode | undefined {
  if (node.state !== 'capture') return undefined
  const childPose = resolveOverlayProjectionPose(
    node,
    nodes,
    timeMs,
    resolveCapture,
    projection,
    historicalPoseCache,
  )
  const parentPose = resolveOverlayProjectionPose(
    parent,
    nodes,
    timeMs,
    resolveCapture,
    projection,
    historicalPoseCache,
  )
  if (childPose === undefined || parentPose === undefined) return undefined
  return {
    ...node,
    state: 'handoff',
    parentItemId: parent.itemId,
    relativePose: deriveRelativeFlipPose(parentPose.pose, childPose.pose),
  }
}

/** Reports whether one overlay node still has a visible parent trajectory. */
export function isOverlayNodeContinuing(
  node: OverlayProjectionNode,
  nodes: ReadonlyMap<string, OverlayProjectionNode>,
  timeMs: number,
  includeEndpoint: boolean,
  resolveCapture: OverlayCaptureResolver,
  visiting = new Set<string>(),
): boolean {
  if (visiting.has(node.itemId)) throw new Error(`FLIP overlay projection cycle detected: ${node.itemId}`)
  visiting.add(node.itemId)
  try {
    if (node.state === 'capture') {
      const capture = resolveCapture(node.captureId)
      if (capture === undefined) return false
      return includeEndpoint ? timeMs <= capture.endAt : timeMs < capture.endAt
    }
    if (node.parentItemId === undefined) return false
    const parent = nodes.get(node.parentItemId)
    return parent === undefined
      ? false
      : isOverlayNodeContinuing(parent, nodes, timeMs, includeEndpoint, resolveCapture, visiting)
  } finally {
    visiting.delete(node.itemId)
  }
}
