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
  const presentationItemIds = new Set<string>()
  let graph = freezeMotionGraph(mutableTracks, presentationItemIds)

  for (const boundary of [...boundaries].sort((left, right) => left.timeMs - right.timeMs)) {
    const transition = selectBoundaryTransition(boundary.intents)
    if (transition === undefined) continue
    const scope = resolveBoundaryMotionScope(boundary)
    for (const itemId of scope.itemIds) {
      // Ancestors are part of the boundary data so their own motion can be
      // composed into the owner pose. They do not receive a second FLIP
      // segment merely because a descendant boundary needs their context.
      if (!scope.segmentItemIds.has(itemId)) continue
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
      const activeSegment = directIntent === undefined
        && !isReparented(before, after)
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
          presentationItemIds.add(itemId)
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
        endAt: boundary.timeMs + (timing.delay ?? 0) + timing.duration,
        duration: timing.duration,
        delay: timing.delay ?? 0,
        ease: timing.ease,
        tween: prepareTween({ from: 0, to: 1, duration: timing.duration, delay: timing.delay, ease: timing.ease }),
        presentationMode: isReparented(before, after) ? 'reparent' : (directIntent?.presentationMode ?? 'local'),
        // A compiled HTML style transition is materialized on the source node
        // by the style service. It is nevertheless kept in the graph so that
        // descendants can compose against its current pose.
        materializerOwned: directIntent?.targetReflow === false,
        ...(directIntent?.path === undefined ? {} : { path: directIntent.path }),
        direct: directIntent !== undefined,
        from,
        to,
        boundaryId: boundary.id,
      })
      const segments = mutableTracks.get(itemId) ?? []
      segments.push(segment)
      mutableTracks.set(itemId, segments)
      presentationItemIds.add(itemId)
    }
    graph = freezeMotionGraph(mutableTracks, presentationItemIds)
  }

  return freezeMotionGraph(mutableTracks, presentationItemIds)
}

/**
 * Selects the complete dependency scope and the items that may own a segment
 * at one structural boundary.
 *
 * The dependency scope is the direct movers, the source/target reflow items and
 * every ancestor up to the root. The second set is deliberately narrower:
 * being an ancestor is enough to be retained as preparation data, but not enough
 * to receive a FLIP trajectory. A parent with its own direct intent remains a
 * segment owner and is then composed into the requested child pose.
 */
function resolveBoundaryMotionScope(boundary: MotionBoundary): Readonly<{
  itemIds: ReadonlySet<string>
  segmentItemIds: ReadonlySet<string>
}> {
  const segmentItemIds = new Set(boundary.intents.map((intent) => intent.itemId))
  const targetIds = new Set<string>()
  for (const intent of boundary.intents) {
    if (intent.targetReflow === false) continue
    const before = boundary.before.items.get(intent.itemId)
    const after = boundary.after.items.get(intent.itemId)
    if (before !== undefined) targetIds.add(before.targetId)
    if (after !== undefined) targetIds.add(after.targetId)
  }
  for (const item of boundary.before.items.values()) {
    if (targetIds.has(item.targetId) && !boundary.intents.some((intent) => intent.itemId === item.itemId && intent.targetReflow === false)) {
      segmentItemIds.add(item.itemId)
    }
  }
  for (const item of boundary.after.items.values()) {
    if (targetIds.has(item.targetId) && !boundary.intents.some((intent) => intent.itemId === item.itemId && intent.targetReflow === false)) {
      segmentItemIds.add(item.itemId)
    }
  }

  const itemIds = new Set(segmentItemIds)
  addAncestorClosure(boundary.before, itemIds)
  addAncestorClosure(boundary.after, itemIds)
  return Object.freeze({ itemIds, segmentItemIds })
}

/** Closes one boundary scope over parent relations without reading a materializer. */
function addAncestorClosure(snapshot: LayoutSnapshot, itemIds: Set<string>): void {
  for (const itemId of [...itemIds]) {
    let parentItemId = snapshot.items.get(itemId)?.parentItemId
    while (parentItemId !== undefined && !itemIds.has(parentItemId)) {
      itemIds.add(parentItemId)
      parentItemId = snapshot.items.get(parentItemId)?.parentItemId
    }
  }
}

/** Resolves a complete root-relative presentation frame at one absolute time. */
export function resolvePresentationFrame(
  graph: MotionGraph,
  layout: LayoutSnapshot,
  timeMs: number,
): PresentationFrame {
  const items = new Map<string, ItemPresentation>()
  const poses = new Map<string, HtmlPose>()
  const visiting = new Set<string>()
  // The graph lists only sovereign trajectory owners. Parent poses needed to
  // compose one owner are retained in this private cache, never emitted as
  // presentation entries merely because they are ancestors.
  for (const itemId of graph.presentationItemIds) {
    const base = layout.items.get(itemId)
    const pose = resolvePose(itemId)
    if (base === undefined || pose === undefined) continue
    const segment = findActiveSegment(graph.tracksByItem.get(itemId), timeMs)
    const progress = segment === undefined ? 1 : resolveSegmentProgress(segment, timeMs)
    items.set(itemId, {
      itemId,
      ...(base.parentItemId === undefined ? {} : { parentItemId: base.parentItemId }),
      pose,
      representation: segment === undefined
        ? 'source'
        : segment.materializerOwned
          ? 'source'
          : (progress < 1 ? segment.presentationMode : 'source'),
      ...(segment === undefined ? {} : { activeSegmentId: segment.id }),
      progress,
    })
  }
  return Object.freeze({
    timeMs,
    graphRevision: graph.revision,
    layoutRevision: layout.revision,
    items,
  })

  function resolvePose(itemId: string): HtmlPose | undefined {
    const existing = poses.get(itemId)
    if (existing !== undefined) return existing
    if (visiting.has(itemId)) throw new Error(`Motion graph cycle detected: ${itemId}`)
    visiting.add(itemId)
    try {
      const resolved = resolveMotionPose(graph, layout, itemId, timeMs, (parentItemId) => (
        parentItemId === undefined ? createMotionRootPose() : resolvePose(parentItemId)
      ))
      if (resolved !== undefined) poses.set(itemId, resolved)
      return resolved
    } finally {
      visiting.delete(itemId)
    }
  }
}

/** Resolves one item presentation for graph construction and retargeting. */
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
  const pose = resolveMotionPose(graph, layout, itemId, timeMs, resolveParent)
  if (pose === undefined) return undefined
  const segment = findActiveSegment(graph.tracksByItem.get(itemId), timeMs)
  const progress = segment === undefined ? 1 : resolveSegmentProgress(segment, timeMs)
  return {
    itemId,
    ...(base.parentItemId === undefined ? {} : { parentItemId: base.parentItemId }),
    pose,
    representation: segment === undefined
      ? 'source'
      : segment.materializerOwned
        ? 'source'
        : (progress < 1 ? segment.presentationMode : 'source'),
    ...(segment === undefined ? {} : { activeSegmentId: segment.id }),
    progress,
  }
}

/** Resolves one item's current pose while retaining parent poses only privately. */
function resolveMotionPose(
  graph: MotionGraph,
  layout: LayoutSnapshot,
  itemId: string,
  timeMs: number,
  resolveParent: (parentItemId: string | undefined) => HtmlPose | undefined,
): HtmlPose | undefined {
  const base = layout.items.get(itemId)
  if (base === undefined) return undefined
  const segment = findActiveSegment(graph.tracksByItem.get(itemId), timeMs)
  if (segment === undefined) {
    const parent = resolveParent(base.parentItemId)
    return parent === undefined ? undefined : composeMotionPose(parent, base.localPose)
  }

  const retarget = resolveSegmentRetarget(segment, timeMs)
  const from = resolveAttachment(retarget?.from ?? segment.from, layout, itemId, resolveParent, false)
  const to = resolveAttachment(
    retarget?.to ?? segment.to,
    layout,
    itemId,
    resolveParent,
    !segment.materializerOwned,
  )
  return interpolateMotionPose(from, to, resolveSegmentProgress(segment, timeMs), segment.path)
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

/** Classifies a parent/target change as a reparent presentation regardless of author defaults. */
function isReparented(before: LayoutItemSnapshot, after: LayoutItemSnapshot): boolean {
  return before.parentItemId !== after.parentItemId || before.targetId !== after.targetId
}

/** Uses an item's own timing, or the longest direct timing for shared reflow. */
function selectBoundaryTransition(intents: readonly MotionIntent[]): MotionIntent | undefined {
  let longest: MotionIntent | undefined
  for (const intent of intents) {
    const endAt = intent.startAt + (intent.delay ?? 0) + intent.duration
    const longestEndAt = longest === undefined
      ? Number.NEGATIVE_INFINITY
      : longest.startAt + (longest.delay ?? 0) + longest.duration
    if (longest === undefined || endAt > longestEndAt) longest = intent
  }
  return longest
}

/** Finds the latest segment owning one item at the requested time. */
function findActiveSegment(track: ItemMotionTrack | undefined, timeMs: number): MotionSegment | undefined {
  if (track === undefined) return undefined
  for (let index = track.segments.length - 1; index >= 0; index -= 1) {
    const segment = track.segments[index]!
    if (timeMs >= segment.startAt && timeMs <= segment.endAt) return segment
  }
  return undefined
}

/** Selects an active segment that still has a future destination to retarget. */
function findContinuingSegment(track: ItemMotionTrack | undefined, timeMs: number): MotionSegment | undefined {
  if (track === undefined) return undefined
  for (let index = track.segments.length - 1; index >= 0; index -= 1) {
    const segment = track.segments[index]!
    if (timeMs >= segment.startAt && timeMs < segment.endAt) return segment
  }
  return undefined
}

/** Selects the latest endpoint pair whose exact retarget boundary has been crossed. */
function resolveSegmentRetarget(segment: MotionSegment, timeMs: number): MotionRetarget | undefined {
  const retargets = segment.retargets
  if (retargets === undefined) return undefined
  for (let index = retargets.length - 1; index >= 0; index -= 1) {
    const retarget = retargets[index]!
    if (retarget.at <= timeMs) return retarget
  }
  return undefined
}

/** Resolves one segment's eased progress from absolute logical time. */
function resolveSegmentProgress(segment: MotionSegment, timeMs: number): number {
  return resolveTweenProgress(segment.tween, timeMs - segment.startAt)
}

/** Freezes mutable planner tracks into the public graph contract. */
function freezeMotionGraph(
  tracks: ReadonlyMap<string, readonly MotionSegment[]>,
  presentationItemIds: ReadonlySet<string>,
): MotionGraph {
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
      delay: segment.delay,
      ease: segment.ease,
      presentationMode: segment.presentationMode,
      direct: segment.direct,
      from: segment.from,
      to: segment.to,
      retargets: segment.retargets,
      materializerOwned: segment.materializerOwned,
      path: segment.path,
    })),
  ]))
  return Object.freeze({
    revision,
    tracksByItem,
    presentationItemIds: Object.freeze([...presentationItemIds]),
  })
}
