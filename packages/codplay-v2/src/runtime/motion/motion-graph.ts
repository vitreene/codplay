import { prepareTween, resolveTweenProgress } from '../../ace'
import {
  composeMotionPose,
  createMotionRootPose,
  decomposeRootMotionPose,
  deriveRelativeMotionPose,
  extrapolateMotionPoseAtProgress,
  interpolateMotionPose,
  sameRelativeMotionPose,
} from './motion-pose'
import type {
  ItemMotionTrack,
  ItemPresentation,
  LayoutItemSnapshot,
  LayoutSnapshot,
  MotionAttachment,
  MotionBoundary,
  MotionGraph,
  MotionIntent,
  MotionRetarget,
  MotionSegment,
  PresentationFrame,
} from './types'
import type { HtmlPose } from './html-types'

/** Builds one complete immutable motion graph from chronological layout boundaries. */
export function buildMotionGraph(boundaries: readonly MotionBoundary[]): MotionGraph {
  const mutableTracks = new Map<string, MotionSegment[]>()
  let graph = freezeMotionGraph(mutableTracks)

  for (const boundary of [...boundaries].sort((left, right) => left.timeMs - right.timeMs)) {
    const transition = selectBoundaryTransition(boundary.intents)
    if (transition === undefined) continue
    const itemIds = new Set([...boundary.before.items.keys(), ...boundary.after.items.keys()])
    for (const itemId of itemIds) {
      const before = boundary.before.items.get(itemId)
      const after = boundary.after.items.get(itemId)
      if (before === undefined || after === undefined || !layoutAttachmentChanged(before, after)) continue
      const directIntent = boundary.intents.find((intent) => intent.itemId === itemId)
      const timing = directIntent ?? transition
      const current = resolveMotionItem(graph, boundary.before, itemId, boundary.timeMs)
      if (current === undefined) continue
      const sourceParentPose = before.parentItemId === undefined
        ? createMotionRootPose()
        : resolveMotionItem(graph, boundary.before, before.parentItemId, boundary.timeMs)?.pose
      const from = createAttachment(before, current.pose, sourceParentPose)
      const to = createStaticAttachment(after)
      const activeSegment = directIntent === undefined && !isReparented(before, after)
        ? findContinuingSegment(graph.tracksByItem.get(itemId), boundary.timeMs)
        : undefined
      if (activeSegment !== undefined) {
        const destinationAtBoundary = resolveAttachment(
          to,
          boundary.after,
          itemId,
          (parentItemId) => resolveLayoutParent(graph, boundary.after, parentItemId, boundary.timeMs),
          true,
        )
        const phase = resolveSegmentProgress(activeSegment, boundary.timeMs)
        const retargetedFrom = extrapolateMotionPoseAtProgress(current.pose, destinationAtBoundary, phase, activeSegment.path)
        const segments = mutableTracks.get(itemId) ?? []
        const index = segments.findIndex((segment) => segment.id === activeSegment.id)
        if (index >= 0) {
          segments[index] = Object.freeze({
            ...activeSegment,
            retargets: Object.freeze([
              ...(activeSegment.retargets ?? []),
              Object.freeze({
                at: boundary.timeMs,
                from: createAttachment(before, retargetedFrom, sourceParentPose),
                to,
              }),
            ]),
          })
          mutableTracks.set(itemId, segments)
          continue
        }
      }
      const segment: MotionSegment = Object.freeze({
        id: `${boundary.id}:${itemId}`,
        itemId,
        startAt: boundary.timeMs,
        endAt: boundary.timeMs + timing.duration,
        duration: timing.duration,
        ease: timing.ease,
        projectionMode: isReparented(before, after) ? 'reparent' : (directIntent?.projectionMode ?? 'local'),
        ...(directIntent?.path === undefined ? {} : { path: directIntent.path }),
        direct: directIntent !== undefined,
        from,
        to,
        boundaryId: boundary.id,
      })
      const segments = mutableTracks.get(itemId) ?? []
      segments.push(segment)
      mutableTracks.set(itemId, segments)
    }
    graph = freezeMotionGraph(mutableTracks)
  }

  return graph
}

/** Resolves a complete root-relative presentation frame at one absolute time. */
export function resolvePresentationFrame(
  graph: MotionGraph,
  layout: LayoutSnapshot,
  timeMs: number,
): PresentationFrame {
  const items = new Map<string, ItemPresentation>()
  const visiting = new Set<string>()
  for (const itemId of layout.items.keys()) resolve(itemId)
  return Object.freeze({
    timeMs,
    graphRevision: graph.revision,
    layoutRevision: layout.revision,
    items,
  })

  function resolve(itemId: string): ItemPresentation | undefined {
    const existing = items.get(itemId)
    if (existing !== undefined) return existing
    if (visiting.has(itemId)) throw new Error(`Motion graph cycle detected: ${itemId}`)
    visiting.add(itemId)
    try {
      const resolved = resolveMotionItem(graph, layout, itemId, timeMs, resolve)
      if (resolved !== undefined) items.set(itemId, resolved)
      return resolved
    } finally {
      visiting.delete(itemId)
    }
  }
}

/** Resolves one item against active segments and recursively moving attachments. */
function resolveMotionItem(
  graph: MotionGraph,
  layout: LayoutSnapshot,
  itemId: string,
  timeMs: number,
  resolveKnown?: (itemId: string) => ItemPresentation | undefined,
): ItemPresentation | undefined {
  const base = layout.items.get(itemId)
  if (base === undefined) return undefined
  const resolveParent = (parentItemId: string | undefined): HtmlPose | undefined => {
    if (parentItemId === undefined) return createMotionRootPose()
    return resolveKnown?.(parentItemId)?.pose
      ?? resolveMotionItem(graph, layout, parentItemId, timeMs, resolveKnown)?.pose
  }
  const segment = findActiveSegment(graph.tracksByItem.get(itemId), timeMs)
  if (segment === undefined) {
    const parent = resolveParent(base.parentItemId)
    if (parent === undefined) return undefined
    return {
      itemId,
      ...(base.parentItemId === undefined ? {} : { parentItemId: base.parentItemId }),
      pose: composeMotionPose(parent, base.localPose),
      representation: 'source',
      progress: 1,
    }
  }

  const retarget = resolveSegmentRetarget(segment, timeMs)
  const from = resolveAttachment(retarget?.from ?? segment.from, layout, itemId, resolveParent, false)
  const to = resolveAttachment(retarget?.to ?? segment.to, layout, itemId, resolveParent, true)
  const progress = resolveSegmentProgress(segment, timeMs)
  return {
    itemId,
    ...(base.parentItemId === undefined ? {} : { parentItemId: base.parentItemId }),
    pose: interpolateMotionPose(from, to, progress, segment.path),
    representation: progress < 1 ? segment.projectionMode : 'source',
    activeSegmentId: segment.id,
    progress,
  }
}

/** Resolves one parent pose from a boundary layout while retaining prior motion segments. */
function resolveLayoutParent(
  graph: MotionGraph,
  layout: LayoutSnapshot,
  parentItemId: string | undefined,
  timeMs: number,
): HtmlPose | undefined {
  if (parentItemId === undefined) return createMotionRootPose()
  return resolveMotionItem(graph, layout, parentItemId, timeMs)?.pose
}

/** Resolves one static or current destination attachment in root coordinates. */
function resolveAttachment(
  attachment: MotionAttachment,
  layout: LayoutSnapshot,
  itemId: string,
  resolveParent: (parentItemId: string | undefined) => HtmlPose | undefined,
  useCurrentDestination: boolean,
): HtmlPose {
  const current = useCurrentDestination ? layout.items.get(itemId) : undefined
  const effective = current !== undefined
    && current.parentItemId === attachment.parentItemId
    && current.targetId === attachment.targetId
    ? current.localPose
    : attachment.localPose
  const parent = resolveParent(attachment.parentItemId)
  return parent === undefined
    ? composeMotionPose(createMotionRootPose(), attachment.fallbackRootPose)
    : composeMotionPose(parent, effective)
}

/** Creates a source attachment from the exact already-resolved visual pose. */
function createAttachment(
  snapshot: LayoutItemSnapshot,
  visualPose: HtmlPose,
  parentPose: HtmlPose | undefined,
): MotionAttachment {
  return Object.freeze({
    ...(snapshot.parentItemId === undefined || parentPose === undefined ? {} : { parentItemId: snapshot.parentItemId }),
    targetId: snapshot.targetId,
    localPose: parentPose === undefined
      ? decomposeRootMotionPose(visualPose)
      : deriveRelativeMotionPose(parentPose, visualPose),
    fallbackRootPose: decomposeRootMotionPose(visualPose),
  })
}

/** Creates one destination attachment from the immediate post-event layout. */
function createStaticAttachment(snapshot: LayoutItemSnapshot): MotionAttachment {
  return Object.freeze({
    ...(snapshot.parentItemId === undefined ? {} : { parentItemId: snapshot.parentItemId }),
    targetId: snapshot.targetId,
    localPose: snapshot.localPose,
    fallbackRootPose: decomposeRootMotionPose(snapshot.rootPose),
  })
}

/** Detects local reflow or reparentage without duplicating ancestor movement. */
function layoutAttachmentChanged(before: LayoutItemSnapshot, after: LayoutItemSnapshot): boolean {
  return before.parentItemId !== after.parentItemId
    || before.targetId !== after.targetId
    || !sameRelativeMotionPose(before.localPose, after.localPose)
}

/** Classifies a parent/target change as a reparent projection regardless of author defaults. */
function isReparented(before: LayoutItemSnapshot, after: LayoutItemSnapshot): boolean {
  return before.parentItemId !== after.parentItemId || before.targetId !== after.targetId
}

/** Uses an item's own timing, or the longest direct timing for shared reflow. */
function selectBoundaryTransition(intents: readonly MotionIntent[]): MotionIntent | undefined {
  return [...intents].sort((left, right) => left.duration - right.duration).at(-1)
}

/** Finds the latest segment owning one item at the requested time. */
function findActiveSegment(track: ItemMotionTrack | undefined, timeMs: number): MotionSegment | undefined {
  if (track === undefined) return undefined
  return [...track.segments]
    .reverse()
    .find((segment) => timeMs >= segment.startAt && timeMs <= segment.endAt)
}

/** Selects an active segment that still has a future destination to retarget. */
function findContinuingSegment(track: ItemMotionTrack | undefined, timeMs: number): MotionSegment | undefined {
  if (track === undefined) return undefined
  return [...track.segments]
    .reverse()
    .find((segment) => timeMs >= segment.startAt && timeMs < segment.endAt)
}

/** Selects the latest endpoint pair whose exact retarget boundary has been crossed. */
function resolveSegmentRetarget(segment: MotionSegment, timeMs: number): MotionRetarget | undefined {
  return [...(segment.retargets ?? [])]
    .reverse()
    .find((retarget) => retarget.at <= timeMs)
}

/** Resolves one segment's eased progress from absolute logical time. */
function resolveSegmentProgress(segment: MotionSegment, timeMs: number): number {
  return resolveTweenProgress(
    prepareTween({ from: 0, to: 1, duration: segment.duration, ease: segment.ease }),
    timeMs - segment.startAt,
  )
}

/** Freezes mutable planner tracks into the public graph contract. */
function freezeMotionGraph(tracks: ReadonlyMap<string, readonly MotionSegment[]>): MotionGraph {
  const tracksByItem = new Map<string, ItemMotionTrack>()
  for (const [itemId, segments] of tracks) {
    tracksByItem.set(itemId, Object.freeze({ itemId, segments: Object.freeze([...segments]) }))
  }
  const revision = JSON.stringify([...tracksByItem].map(([itemId, track]) => [
    itemId,
    track.segments.map((segment) => ({
      id: segment.id,
      startAt: segment.startAt,
      endAt: segment.endAt,
      duration: segment.duration,
      ease: segment.ease,
      projectionMode: segment.projectionMode,
      direct: segment.direct,
      from: segment.from,
      to: segment.to,
      retargets: segment.retargets,
      path: segment.path,
    })),
  ]))
  return Object.freeze({ revision, tracksByItem })
}
