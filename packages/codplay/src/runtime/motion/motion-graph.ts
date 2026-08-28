import { prepareTween, resolveTweenProgress } from 'ace'
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
  MotionKeyframe,
  MotionRetarget,
  MotionSegment,
  OverlayStackingContext,
  PresentationFrame,
} from './types'
import type { HtmlPose } from './html-types'
import { buildNaturalLayoutTimeline, resolveNaturalLayoutBefore } from './motion-layout'

/** One graph operation retained between structural planning and pose resolution. */
type MotionBuildOperation = Readonly<{
  kind: 'segment' | 'retarget'
  boundary: MotionBoundary
  itemId: string
  before: LayoutItemSnapshot
  after: LayoutItemSnapshot
  structuralAfter: LayoutSnapshot
  endpointAfter: LayoutItemSnapshot
  segmentId: string
}>

/** Builds one complete immutable motion graph from chronological layout boundaries. */
export function buildMotionGraph(boundaries: readonly MotionBoundary[]): MotionGraph {
  const naturalLayoutTimeline = buildNaturalLayoutTimeline(boundaries)
  const { graph: structureGraph, operations } = buildMotionGraphStructure(boundaries)
  let graph = structureGraph

  // Resolve all geometry only after every future segment is present. This is
  // what lets an active child use the FIRST pose of an ancestor that starts
  // later, instead of mistaking that ancestor's LAST pose for its current one.
  for (const operation of operations) {
    const naturalBefore = resolveNaturalLayoutBefore(
      naturalLayoutTimeline,
      operation.boundary.timeMs,
      operation.boundary.id,
    )
    const sourceLayout = mergeBoundarySourceLayout(
      naturalBefore,
      operation.boundary.before,
      operation.itemId,
    )
    const source = sourceLayout.items.get(operation.itemId) ?? operation.before
    const current = resolveMotionItem(graph, sourceLayout, operation.itemId, operation.boundary.timeMs)
    if (current === undefined) {
      if (operation.kind === 'segment') {
        graph = replaceMotionSegment(graph, operation.itemId, operation.segmentId, undefined)
      }
      continue
    }

    const sourceParentPose = source.parentItemId === undefined
      ? createMotionRootPose()
      : resolveMotionItem(graph, sourceLayout, source.parentItemId, operation.boundary.timeMs)?.pose
    const to = createStaticAttachment(
      operation.after,
      operation.boundary.after,
      operation.endpointAfter,
    )

    if (operation.kind === 'retarget') {
      const activeSegment = graph.tracksByItem
        .get(operation.itemId)
        ?.segments.find((segment) => segment.id === operation.segmentId)
      if (activeSegment === undefined) continue

      const destinationAtBoundary = resolveAttachment(
        to,
        operation.boundary.after,
        operation.itemId,
        (parentItemId, context) => resolveBoundaryParent(
          graph,
          operation.boundary.before,
          operation.structuralAfter,
          operation.boundary.after,
          parentItemId,
          operation.boundary.timeMs,
          context,
        ),
        false,
      )
      const phase = resolveSegmentProgress(activeSegment, operation.boundary.timeMs)
      const retargetedFrom = extrapolateMotionPoseAtProgress(
        current.pose,
        destinationAtBoundary,
        phase,
        activeSegment.path,
      )
      graph = replaceMotionSegment(graph, operation.itemId, operation.segmentId, Object.freeze({
        ...activeSegment,
        retargets: Object.freeze([
          ...(activeSegment.retargets ?? []),
          Object.freeze({
            at: operation.boundary.timeMs,
            from: createAttachment(source, retargetedFrom, sourceParentPose, sourceLayout),
            to,
          }),
        ]),
      }))
      continue
    }

    const segment = graph.tracksByItem
      .get(operation.itemId)
      ?.segments.find((candidate) => candidate.id === operation.segmentId)
    if (segment === undefined) continue
    const from = createAttachment(source, current.pose, sourceParentPose, sourceLayout)
    const keyframes = createSegmentKeyframes(segment, operation.boundary, from, to)
    graph = replaceMotionSegment(graph, operation.itemId, operation.segmentId, Object.freeze({
      ...segment,
      from,
      to,
      ...(keyframes === undefined ? {} : { keyframes }),
    }))
  }

  return graph
}

/** Plans all segment owners before resolving any segment geometry. */
function buildMotionGraphStructure(
  boundaries: readonly MotionBoundary[],
): Readonly<{
  graph: MotionGraph
  operations: readonly MotionBuildOperation[]
}> {
  const mutableTracks = new Map<string, MotionSegment[]>()
  const presentationItemIds = new Set<string>()
  let graph = freezeMotionGraph(mutableTracks, presentationItemIds)
  const operations: MotionBuildOperation[] = []

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
      // Reflow is committed from the layout immediately after this boundary.
      // The endpoint snapshot is reserved for ancestor poses that are already
      // moving while this segment runs; it must not import later sibling moves.
      const structuralAfter = boundary.afterStart ?? boundary.after
      const directIntent = boundary.intents.find((intent) => intent.itemId === itemId)
      // A direct mover may be absent from the immediate post-event scene when
      // its destination is not mounted yet. Its endpoint snapshot is then the
      // only valid LAST measurement; reflow siblings still use afterStart.
      const after = directIntent === undefined
        ? structuralAfter.items.get(itemId)
        : boundary.after.items.get(itemId) ?? structuralAfter.items.get(itemId)
      if (before === undefined || after === undefined || !layoutAttachmentChanged(before, after)) continue
      const endpointAfter = boundary.after.items.get(itemId) ?? after
      const timing = directIntent ?? transition
      const activeSegment = directIntent === undefined
        && !isReparented(before, after)
        ? findContinuingSegment(graph.tracksByItem.get(itemId), boundary.timeMs)
        : undefined
      if (activeSegment !== undefined) {
        operations.push({
          kind: 'retarget',
          boundary,
          itemId,
          before,
          after,
          structuralAfter,
          endpointAfter,
          segmentId: activeSegment.id,
        })
        continue
      }

      const segmentId = `${boundary.id}:${itemId}`
      const from = createAttachment(
        before,
        before.rootPose,
        before.parentItemId === undefined
          ? createMotionRootPose()
          : boundary.before.items.get(before.parentItemId)?.rootPose,
        boundary.before,
      )
      const to = createStaticAttachment(after, boundary.after, endpointAfter)
      const segment: MotionSegment = Object.freeze({
        id: segmentId,
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
        targetReflow: directIntent?.targetReflow === true,
        direct: directIntent !== undefined,
        from,
        to,
        boundaryId: boundary.id,
      })
      const segments = mutableTracks.get(itemId) ?? []
      segments.push(segment)
      mutableTracks.set(itemId, segments)
      presentationItemIds.add(itemId)
      operations.push({
        kind: 'segment',
        boundary,
        itemId,
        before,
        after,
        structuralAfter,
        endpointAfter,
        segmentId,
      })
    }
    graph = freezeMotionGraph(mutableTracks, presentationItemIds)
  }

  return Object.freeze({
    graph: freezeMotionGraph(mutableTracks, presentationItemIds),
    operations: Object.freeze(operations),
  })
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
  const contextPoses = new Map<ReadonlyMap<string, LayoutItemSnapshot>, Map<string, HtmlPose>>()
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
    const overlayStacking = resolveOverlayStackingContext(base, segment)
    items.set(itemId, {
      itemId,
      ...(base.parentItemId === undefined ? {} : { parentItemId: base.parentItemId }),
      targetId: base.targetId,
      targetOrder: base.targetOrder,
      ...(overlayStacking === undefined ? {} : { overlayStacking }),
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

  function resolvePose(
    itemId: string,
    context?: ReadonlyMap<string, LayoutItemSnapshot>,
  ): HtmlPose | undefined {
    const useContext = context?.has(itemId) === true
    const cache = useContext
      ? (contextPoses.get(context!) ?? createContextPoseCache(context!))
      : poses
    const existing = cache.get(itemId)
    if (existing !== undefined) return existing
    if (visiting.has(itemId)) throw new Error(`Motion graph cycle detected: ${itemId}`)
    visiting.add(itemId)
    try {
      const resolved = resolveMotionPose(
        graph,
        layout,
        itemId,
        timeMs,
        (parentItemId, parentContext) => (
          parentItemId === undefined
            ? createMotionRootPose()
            : resolvePose(parentItemId, parentContext ?? context)
        ),
        context,
      )
      if (resolved !== undefined) cache.set(itemId, resolved)
      return resolved
    } finally {
      visiting.delete(itemId)
    }
  }

  /** Creates one pose cache for one captured FIRST/LAST context map. */
  function createContextPoseCache(
    context: ReadonlyMap<string, LayoutItemSnapshot>,
  ): Map<string, HtmlPose> {
    const cache = new Map<string, HtmlPose>()
    contextPoses.set(context, cache)
    return cache
  }
}

/** Resolves one item presentation for graph construction and retargeting. */
function resolveMotionItem(
  graph: MotionGraph,
  layout: LayoutSnapshot,
  itemId: string,
  timeMs: number,
  resolveKnown?: (itemId: string) => ItemPresentation | undefined,
  context?: ReadonlyMap<string, LayoutItemSnapshot>,
): ItemPresentation | undefined {
  const base = context?.get(itemId) ?? layout.items.get(itemId)
  if (base === undefined) return undefined
  const resolveParent = (
    parentItemId: string | undefined,
    parentContext?: ReadonlyMap<string, LayoutItemSnapshot>,
  ): HtmlPose | undefined => {
    if (parentItemId === undefined) return createMotionRootPose()
    return resolveKnown?.(parentItemId)?.pose
      ?? resolveMotionItem(graph, layout, parentItemId, timeMs, resolveKnown, parentContext ?? context)?.pose
  }
  const pose = resolveMotionPose(graph, layout, itemId, timeMs, resolveParent, context)
  if (pose === undefined) return undefined
  const segment = findActiveSegment(graph.tracksByItem.get(itemId), timeMs)
  const endpoint = segment === undefined
    ? findMotionEndpoint(graph.tracksByItem.get(itemId), timeMs)
    : undefined
  const progress = segment === undefined
    ? endpoint?.side === 'from' ? 0 : 1
    : resolveSegmentProgress(segment, timeMs)
  const overlayStacking = resolveOverlayStackingContext(base, segment)
  return {
    itemId,
    ...(base.parentItemId === undefined ? {} : { parentItemId: base.parentItemId }),
    targetId: base.targetId,
    targetOrder: base.targetOrder,
    ...(overlayStacking === undefined ? {} : { overlayStacking }),
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
  resolveParent: (
    parentItemId: string | undefined,
    context?: ReadonlyMap<string, LayoutItemSnapshot>,
  ) => HtmlPose | undefined,
  context?: ReadonlyMap<string, LayoutItemSnapshot>,
): HtmlPose | undefined {
  const base = context?.get(itemId) ?? layout.items.get(itemId)
  const track = graph.tracksByItem.get(itemId)
  const segment = findActiveSegment(track, timeMs)
  if (segment === undefined) {
    const endpoint = findMotionEndpoint(track, timeMs)
    if (endpoint !== undefined) {
      const attachment = endpoint.side === 'from'
        ? endpoint.segment.from
        : resolveSegmentRetarget(endpoint.segment, timeMs)?.to ?? endpoint.segment.to
      return resolveAttachment(attachment, layout, itemId, resolveParent, endpoint.side === 'to' && !endpoint.segment.materializerOwned)
    }
    if (base === undefined) return undefined
    const parent = resolveParent(base.parentItemId, context)
    return parent === undefined ? undefined : composeMotionPose(parent, base.localPose)
  }

  const retarget = resolveSegmentRetarget(segment, timeMs)
  const keyframeInterval = retarget === undefined
    ? resolveSegmentKeyframeInterval(segment, timeMs)
    : undefined
  if (keyframeInterval !== undefined) {
    const from = resolveAttachment(
      keyframeInterval.from,
      layout,
      itemId,
      resolveParent,
      false,
    )
    const to = resolveAttachment(
      keyframeInterval.to,
      layout,
      itemId,
      resolveParent,
      false,
    )
    return interpolateMotionPose(from, to, keyframeInterval.progress, segment.path)
  }

  const from = resolveAttachment(retarget?.from ?? segment.from, layout, itemId, resolveParent, false)
  const to = resolveAttachment(
    retarget?.to ?? segment.to,
    layout,
    itemId,
    resolveParent,
    !segment.materializerOwned && !segment.targetReflow,
  )
  return interpolateMotionPose(from, to, resolveSegmentProgress(segment, timeMs), segment.path)
}

/** Resolves a retarget parent at the boundary instead of at the mover endpoint. */
function resolveBoundaryParent(
  graph: MotionGraph,
  beforeLayout: LayoutSnapshot,
  afterStartLayout: LayoutSnapshot,
  endpointLayout: LayoutSnapshot,
  parentItemId: string | undefined,
  timeMs: number,
  context?: ReadonlyMap<string, LayoutItemSnapshot>,
): HtmlPose | undefined {
  if (parentItemId === undefined) return createMotionRootPose()

  const currentLayout = beforeLayout.items.has(parentItemId) ? beforeLayout : afterStartLayout
  if (currentLayout.items.has(parentItemId)) {
    // Resolve the whole current ancestor chain. A list may have no sovereign
    // track while its frame ancestor is already moving, so returning the
    // captured list root would discard that ancestor phase.
    return resolveMotionItem(graph, currentLayout, parentItemId, timeMs)?.pose
  }
  return resolveMotionItem(graph, endpointLayout, parentItemId, timeMs, undefined, context)?.pose
}

/** Resolves one static or current destination attachment in root coordinates. */
function resolveAttachment(
  attachment: MotionAttachment,
  layout: LayoutSnapshot,
  itemId: string,
  resolveParent: (
    parentItemId: string | undefined,
    context?: ReadonlyMap<string, LayoutItemSnapshot>,
  ) => HtmlPose | undefined,
  useCurrentDestination: boolean,
): HtmlPose {
  const current = useCurrentDestination ? layout.items.get(itemId) : undefined
  const effective = current !== undefined
    && current.parentItemId === attachment.parentItemId
    && current.targetId === attachment.targetId
    ? current.localPose
    : attachment.localPose
  // A dynamic destination follows the current natural parent when that parent
  // is already mounted. The attachment context remains the fallback for a
  // target branch that is not present in the current layout yet.
  const parentContext = useCurrentDestination
    && attachment.parentItemId !== undefined
    && layout.items.has(attachment.parentItemId)
    ? undefined
    : attachment.context
  const parent = resolveParent(attachment.parentItemId, parentContext)
  return parent === undefined
    ? composeMotionPose(createMotionRootPose(), attachment.fallbackRootPose)
    : composeMotionPose(parent, effective)
}

/** Adds only missing FIRST items needed to resolve a sovereign source pose. */
function mergeBoundarySourceLayout(
  naturalLayout: LayoutSnapshot,
  boundaryBefore: LayoutSnapshot,
  itemId: string,
): LayoutSnapshot {
  if (naturalLayout.items.has(itemId)) return naturalLayout
  const items = new Map(boundaryBefore.items)
  for (const [candidateId, item] of naturalLayout.items) items.set(candidateId, item)
  return Object.freeze({
    ...naturalLayout,
    revision: `${naturalLayout.revision}:source:${boundaryBefore.revision}:${itemId}`,
    items,
  })
}

/** Creates a source attachment from the exact already-resolved visual pose. */
function createAttachment(
  snapshot: LayoutItemSnapshot,
  visualPose: HtmlPose,
  parentPose: HtmlPose | undefined,
  contextSnapshot: LayoutSnapshot,
): MotionAttachment {
  return Object.freeze({
    ...(snapshot.parentItemId === undefined || parentPose === undefined ? {} : { parentItemId: snapshot.parentItemId }),
    targetId: snapshot.targetId,
    targetOrder: snapshot.targetOrder,
    localPose: parentPose === undefined
      ? decomposeRootMotionPose(visualPose)
      : deriveRelativeMotionPose(parentPose, visualPose),
    fallbackRootPose: decomposeRootMotionPose(visualPose),
    context: createAttachmentContext(snapshot, contextSnapshot),
  })
}

/** Creates one destination attachment from the measured LAST layout. */
function createStaticAttachment(
  snapshot: LayoutItemSnapshot,
  contextSnapshot: LayoutSnapshot,
  fallbackSnapshot: LayoutItemSnapshot = snapshot,
): MotionAttachment {
  return Object.freeze({
    ...(snapshot.parentItemId === undefined ? {} : { parentItemId: snapshot.parentItemId }),
    targetId: snapshot.targetId,
    targetOrder: snapshot.targetOrder,
    localPose: snapshot.localPose,
    fallbackRootPose: decomposeRootMotionPose(fallbackSnapshot.rootPose),
    context: createAttachmentContext(snapshot, contextSnapshot),
  })
}

/** Builds one segment's measured pose intervals from the same player captures. */
function createSegmentKeyframes(
  segment: MotionSegment,
  boundary: MotionBoundary,
  from: MotionAttachment,
  to: MotionAttachment,
): readonly MotionKeyframe[] | undefined {
  const activeStartAt = segment.startAt + segment.delay
  const measured = (boundary.keyframes ?? [])
    .filter((snapshot) => snapshot.timeMs > activeStartAt && snapshot.timeMs < segment.endAt)
    .map((snapshot) => {
      const item = snapshot.items.get(segment.itemId)
      return item === undefined
        ? undefined
        : Object.freeze({ at: snapshot.timeMs, attachment: createStaticAttachment(item, snapshot) })
    })
    .filter((entry): entry is MotionKeyframe => entry !== undefined)
  if (measured.length === 0) return undefined

  const entries: MotionKeyframe[] = [Object.freeze({ at: segment.startAt, attachment: from })]
  if (segment.delay > 0) entries.push(Object.freeze({ at: activeStartAt, attachment: from }))
  entries.push(...measured)
  entries.push(Object.freeze({ at: segment.endAt, attachment: to }))
  return Object.freeze(entries.sort((left, right) => left.at - right.at))
}

/** Resolves the endpoint constraints used to stack one active reparent overlay. */
function resolveOverlayStackingContext(
  base: LayoutItemSnapshot,
  segment: MotionSegment | undefined,
): OverlayStackingContext | undefined {
  if (segment === undefined || segment.presentationMode !== 'reparent' || segment.materializerOwned) {
    return undefined
  }
  // Retargets refine geometry inside an already active transition. They do
  // not change the source and destination branches that the overlay must
  // remain above for its whole lifetime.
  const source = segment.from
  const target = segment.to
  const sourceParentItemId = source.parentItemId ?? base.parentItemId
  return Object.freeze({
    sourceParentItemId,
    targetParentItemId: target.parentItemId,
    sourceAncestorItemIds: resolveAttachmentAncestorItemIds(source, sourceParentItemId),
    targetAncestorItemIds: resolveAttachmentAncestorItemIds(target, target.parentItemId),
    targetId: target.targetId,
    targetOrder: target.targetOrder,
  })
}

/** Resolves one captured endpoint chain without consulting an intermediate layout. */
function resolveAttachmentAncestorItemIds(
  attachment: MotionAttachment,
  parentItemId: string | undefined,
): readonly string[] {
  const ancestors: string[] = []
  const visited = new Set<string>()
  let currentItemId = parentItemId
  while (currentItemId !== undefined) {
    if (visited.has(currentItemId)) {
      throw new Error(`Motion attachment ancestor cycle detected: ${currentItemId}`)
    }
    visited.add(currentItemId)
    ancestors.push(currentItemId)
    currentItemId = attachment.context?.get(currentItemId)?.parentItemId
  }
  return Object.freeze(ancestors)
}

/** Captures one item's measured pose and every measured ancestor in its chain. */
function createAttachmentContext(
  snapshot: LayoutItemSnapshot,
  contextSnapshot: LayoutSnapshot,
): ReadonlyMap<string, LayoutItemSnapshot> {
  const context = new Map<string, LayoutItemSnapshot>()
  let current: LayoutItemSnapshot | undefined = snapshot
  while (current !== undefined && !context.has(current.itemId)) {
    context.set(current.itemId, current)
    current = current.parentItemId === undefined
      ? undefined
      : contextSnapshot.items.get(current.parentItemId)
  }
  return context
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

/** Selects the nearest segment endpoint when the item is outside an active interval. */
function findMotionEndpoint(
  track: ItemMotionTrack | undefined,
  timeMs: number,
): Readonly<{ segment: MotionSegment; side: 'from' | 'to' }> | undefined {
  if (track === undefined || track.segments.length === 0) return undefined
  const first = track.segments[0]!
  if (timeMs < first.startAt) return { segment: first, side: 'from' }
  for (let index = track.segments.length - 1; index >= 0; index -= 1) {
    const segment = track.segments[index]!
    if (timeMs > segment.endAt) return { segment, side: 'to' }
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
  if (resolveSegmentRetarget(segment, timeMs) === undefined) {
    const keyframeInterval = resolveSegmentKeyframeInterval(segment, timeMs)
    if (keyframeInterval !== undefined) return keyframeInterval.progress
  }
  return resolveTweenProgress(segment.tween, timeMs - segment.startAt)
}

/** Finds the measured pose interval containing one time, including delay hold. */
function resolveSegmentKeyframeInterval(
  segment: MotionSegment,
  timeMs: number,
): Readonly<{
  from: MotionAttachment
  to: MotionAttachment
  progress: number
}> | undefined {
  const keyframes = segment.keyframes
  if (keyframes === undefined || keyframes.length < 2) return undefined
  const first = keyframes[0]!
  if (timeMs <= first.at) return { from: first.attachment, to: first.attachment, progress: 0 }
  for (let index = 1; index < keyframes.length; index += 1) {
    const to = keyframes[index]!
    const from = keyframes[index - 1]!
    if (timeMs > to.at) continue
    const duration = to.at - from.at
    const progress = duration <= 0 ? 1 : Math.min(1, Math.max(0, (timeMs - from.at) / duration))
    return { from: from.attachment, to: to.attachment, progress }
  }
  const last = keyframes[keyframes.length - 1]!
  return { from: last.attachment, to: last.attachment, progress: 1 }
}

/** Replaces one prepared segment while preserving the rest of the graph. */
function replaceMotionSegment(
  graph: MotionGraph,
  itemId: string,
  segmentId: string,
  replacement: MotionSegment | undefined,
): MotionGraph {
  const tracks = new Map<string, MotionSegment[]>()
  for (const [trackItemId, track] of graph.tracksByItem) {
    tracks.set(trackItemId, [...track.segments])
  }

  const segments = tracks.get(itemId)
  if (segments === undefined) return graph
  const index = segments.findIndex((segment) => segment.id === segmentId)
  if (index < 0) return graph

  if (replacement === undefined) segments.splice(index, 1)
  else segments[index] = replacement
  if (segments.length === 0) tracks.delete(itemId)

  const presentationItemIds = new Set(graph.presentationItemIds)
  if (segments.length === 0) presentationItemIds.delete(itemId)
  return freezeMotionGraph(tracks, presentationItemIds)
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
      targetReflow: segment.targetReflow,
      direct: segment.direct,
      from: segment.from,
      to: segment.to,
      retargets: segment.retargets,
      keyframes: segment.keyframes,
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
