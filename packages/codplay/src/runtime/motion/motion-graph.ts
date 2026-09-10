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
  MotionResetBoundary,
  MotionResetTimesByItem,
} from './types'
import type { HtmlPose } from './html-types'
import {
  buildNaturalLayoutTimeline,
  resolveNaturalLayoutBefore,
  type NaturalLayoutTimeline,
} from './motion-layout'

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
}> | Readonly<{
  kind: 'target-retarget'
  boundary: MotionBoundary
  itemId: string
  segmentId: string
  targetItemId: string
}>

/** Ephemeral index of active motion segments by the target they depend on. */
type TargetDependencyIndex = Map<string, Map<string, Readonly<{
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
type MotionGraphReadState = Pick<MotionGraph, 'tracksByItem' | 'resetTimesByItem'>

/** Mutable track with a direct segment index used only during graph preparation. */
type MutableMotionTrack = {
  itemId: string
  segments: MotionSegment[]
  segmentsById: Map<string, MotionSegment>
  segmentIndexById: Map<string, number>
}

/** Mutable graph state owned exclusively by one graph build transaction. */
type MutableMotionGraph = {
  tracksByItem: Map<string, MutableMotionTrack>
  resetTimesByItem: MotionResetTimesByItem
  presentationItemIds: Set<string>
}

/** Precomputed boundary data reused by all graph-structure decisions. */
type MotionBoundaryMetadata = Readonly<{
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

/** Builds one complete immutable motion graph from chronological layout boundaries. */
export function buildMotionGraph(
  boundaries: readonly MotionBoundary[],
  options: MotionGraphOptions = {},
): MotionGraph {
  return buildMotionGraphPreparation(boundaries, options).graph
}

/** Builds one graph and returns the natural-layout timeline used by both phases; runner-internal. */
export function buildMotionGraphPreparation(
  boundaries: readonly MotionBoundary[],
  options: MotionGraphOptions = {},
): Readonly<{
  graph: MotionGraph
  naturalLayoutTimeline: NaturalLayoutTimeline
}> {
  const resetTimesByItem = normalizeResetTimes(options.resetTimesByItem)
  const naturalLayoutTimeline = buildNaturalLayoutTimeline(boundaries)
  const { graph, operations } = buildMotionGraphStructure(boundaries, resetTimesByItem)

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
    const source = sourceLayout.items.get(operation.itemId)
      ?? (operation.kind === 'target-retarget' ? undefined : operation.before)
    const current = resolveMotionOperationCurrent(graph, sourceLayout, operation)
    if (current === undefined || source === undefined) {
      if (operation.kind === 'segment') {
        replaceMotionSegment(graph, operation.itemId, operation.segmentId, undefined)
      }
      continue
    }

    if (operation.kind === 'target-retarget') {
      const activeSegment = findTrackSegment(
        graph.tracksByItem.get(operation.itemId),
        operation.segmentId,
      )
      if (activeSegment === undefined) continue

      const to = createTargetRetargetAttachment(
        activeSegment,
        operation.boundary,
        operation.itemId,
        operation.targetItemId,
      )
      if (to === undefined) continue

      const sourceParentPose = source.parentItemId === undefined
        ? createMotionRootPose()
        : resolveMotionItem(graph, sourceLayout, source.parentItemId, operation.boundary.timeMs)?.pose
      const destinationAtBoundary = resolveAttachment(
        to,
        operation.boundary.after,
        operation.itemId,
        (parentItemId) => resolveTargetRetargetParent(
          graph,
          operation.boundary,
          parentItemId,
          operation.boundary.timeMs,
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
      replaceMotionSegment(graph, operation.itemId, operation.segmentId, {
        ...activeSegment,
        retargets: [
          ...(activeSegment.retargets ?? []),
          {
            at: operation.boundary.timeMs,
            from: createAttachment(source, retargetedFrom, sourceParentPose, sourceLayout),
            to,
          },
        ],
      })
      continue
    }

    const sourceParentPose = source.parentItemId === undefined
      ? createMotionRootPose()
      : resolveMotionItem(graph, sourceLayout, source.parentItemId, operation.boundary.timeMs)?.pose

    if (operation.kind === 'retarget') {
      const activeSegment = findTrackSegment(
        graph.tracksByItem.get(operation.itemId),
        operation.segmentId,
      )
      if (activeSegment === undefined) continue

      const to = createStaticAttachment(
        operation.after,
        operation.boundary.after,
        operation.endpointAfter,
      )
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
      replaceMotionSegment(graph, operation.itemId, operation.segmentId, {
        ...activeSegment,
        retargets: [
          ...(activeSegment.retargets ?? []),
          {
            at: operation.boundary.timeMs,
            from: createAttachment(source, retargetedFrom, sourceParentPose, sourceLayout),
            to,
          },
        ],
      })
      continue
    }

    const segment = findTrackSegment(
      graph.tracksByItem.get(operation.itemId),
      operation.segmentId,
    )
    if (segment === undefined) continue
    const from = createAttachment(source, current.pose, sourceParentPose, sourceLayout)
    const keyframes = createSegmentKeyframes(segment, operation.boundary, from, segment.to)
    replaceMotionSegment(graph, operation.itemId, operation.segmentId, {
      ...segment,
      from,
      ...(keyframes === undefined ? {} : { keyframes }),
    })
  }

  return {
    graph: finalizeMotionGraph(graph),
    naturalLayoutTimeline,
  }
}

/** Plans all segment owners before resolving any segment geometry. */
function buildMotionGraphStructure(
  boundaries: readonly MotionBoundary[],
  resetTimesByItem: MotionResetTimesByItem,
): Readonly<{
  graph: MutableMotionGraph
  operations: readonly MotionBuildOperation[]
}> {
  const mutableTracks = new Map<string, MutableMotionTrack>()
  const presentationItemIds = new Set<string>()
  const targetDependencies: TargetDependencyIndex = new Map()
  const graph: MutableMotionGraph = {
    tracksByItem: mutableTracks,
    presentationItemIds,
    resetTimesByItem,
  }
  const operations: MotionBuildOperation[] = []

  for (const boundary of [...boundaries].sort((left, right) => left.timeMs - right.timeMs)) {
    const transition = selectBoundaryTransition(boundary.intents)
    if (transition === undefined) continue
    const metadata = createMotionBoundaryMetadata(boundary)
    const targetRetargetedSegments = new Set<string>()
    for (const targetItemId of metadata.changedItemIds) {
      for (const reference of targetDependencies.get(targetItemId)?.values() ?? []) {
        // Mounting a destination that was unavailable at FIRST completes the
        // already captured move; it is not a target move and must not restart
        // the dependent item. A later change is a genuine retarget.
        if (!reference.availableAtStart
          && !boundary.before.items.has(targetItemId)
          && boundary.after.items.has(targetItemId)) continue
        if (metadata.directItemIds.has(reference.itemId)) continue
        const activeSegment = findTrackSegment(
          mutableTracks.get(reference.itemId),
          reference.segmentId,
        )
        if (activeSegment === undefined
          || boundary.timeMs < activeSegment.startAt
          || boundary.timeMs >= activeSegment.endAt) continue
        const referenceKey = motionSegmentReferenceKey(reference.itemId, reference.segmentId)
        if (targetRetargetedSegments.has(referenceKey)) continue
        targetRetargetedSegments.add(referenceKey)
        operations.push({
          kind: 'target-retarget',
          boundary,
          itemId: reference.itemId,
          segmentId: reference.segmentId,
          targetItemId,
        })
      }
    }
    const scope = metadata.scope
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
      const directIntent = metadata.directIntentByItem.get(itemId)
      // A direct mover may be absent from the immediate post-event scene when
      // its destination is not mounted yet. Its endpoint snapshot is then the
      // only valid LAST measurement; reflow siblings still use afterStart.
      const after = directIntent === undefined
        ? structuralAfter.items.get(itemId)
        : boundary.after.items.get(itemId) ?? structuralAfter.items.get(itemId)
      if (before === undefined || after === undefined) continue
      // An explicit move is meaningful even when its target relation is
      // unchanged: releasing a target emits a new move whose LAST pose has
      // changed through the target's captured geometry.
      if (directIntent === undefined && !layoutAttachmentChanged(before, after)) continue
      const endpointAfter = boundary.after.items.get(itemId) ?? after
      const timing = directIntent ?? transition
      const continuingSegment = findContinuingSegment(
        graph.tracksByItem.get(itemId),
        boundary.timeMs,
        latestResetAt(resetTimesByItem, itemId, boundary.timeMs),
      )
      if (directIntent === undefined && continuingSegment !== undefined && !isReparented(before, after)) {
        const activeSegment = continuingSegment
        if (targetRetargetedSegments.has(motionSegmentReferenceKey(itemId, activeSegment.id))) continue
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
      const eventSeq = directIntent?.eventSeq ?? transition.eventSeq
      const replacementTiming = directIntent === undefined || continuingSegment === undefined
        ? {
          duration: timing.duration,
          delay: timing.delay ?? 0,
          endAt: boundary.timeMs + (timing.delay ?? 0) + timing.duration,
        }
        : resolveReplacementTiming(continuingSegment, boundary.timeMs)
      const from = createAttachment(
        before,
        before.rootPose,
        before.parentItemId === undefined
          ? createMotionRootPose()
          : boundary.before.items.get(before.parentItemId)?.rootPose,
        boundary.before,
      )
      const to = createStaticAttachment(after, boundary.after, endpointAfter)
      const segment: MotionSegment = {
        id: segmentId,
        itemId,
        startAt: boundary.timeMs,
        ...(eventSeq === undefined ? {} : { eventSeq }),
        endAt: replacementTiming.endAt,
        duration: replacementTiming.duration,
        delay: replacementTiming.delay,
        ease: timing.ease,
        tween: prepareTween({
          from: 0,
          to: 1,
          duration: replacementTiming.duration,
          delay: replacementTiming.delay,
          ease: timing.ease,
        }),
        presentationMode: isReparented(before, after) ? 'reparent' : (directIntent?.presentationMode ?? 'local'),
        // A compiled HTML style transition is materialized on the source node
        // by the style service. It is nevertheless kept in the graph so that
        // descendants can compose against its current pose.
        materializerOwned: directIntent?.targetReflow === false,
        ...(directIntent?.path === undefined ? {} : { path: directIntent.path }),
        targetReflow: directIntent?.targetReflow === true || scope.targetContainerItemIds.has(itemId),
        direct: directIntent !== undefined,
        from,
        to,
        boundaryId: boundary.id,
      }
      removeOverlappingTargetDependencies(targetDependencies, itemId, segment.startAt)
      const track: MutableMotionTrack = mutableTracks.get(itemId) ?? {
        itemId,
        segments: [],
        segmentsById: new Map(),
        segmentIndexById: new Map(),
      }
      const segmentIndex = track.segments.length
      track.segments.push(segment)
      track.segmentsById.set(segment.id, segment)
      track.segmentIndexById.set(segment.id, segmentIndex)
      mutableTracks.set(itemId, track)
      presentationItemIds.add(itemId)
      if (segment.targetReflow) registerTargetDependencies(targetDependencies, segment, boundary.before)
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
  }

  return {
    graph,
    operations,
  }
}

/**
 * Selects the complete dependency scope and the items that may own a segment
 * at one structural boundary.
 *
 * The dependency scope is the direct movers, the source/target reflow items,
 * target containers whose measured local pose changes, and every ancestor up
 * to the root. The second set is deliberately narrower: being an ancestor is
 * enough to be retained as preparation data, but not enough to receive a FLIP
 * trajectory. A parent with its own direct intent, or a target container whose
 * own dimensions changed because of the reflow, remains a segment owner.
 */
/** Computes the boundary metadata shared by dependency and segment planning. */
function createMotionBoundaryMetadata(boundary: MotionBoundary): MotionBoundaryMetadata {
  const directItemIds = new Set<string>()
  const directIntentByItem = new Map<string, MotionIntent>()
  const nonReflowDirectItemIds = new Set<string>()
  for (const intent of boundary.intents) {
    directItemIds.add(intent.itemId)
    // Preserve Array.find() semantics when malformed input contains multiple
    // intents for one item: the first intent remains authoritative here.
    if (!directIntentByItem.has(intent.itemId)) directIntentByItem.set(intent.itemId, intent)
    if (intent.targetReflow === false) nonReflowDirectItemIds.add(intent.itemId)
  }

  return {
    directItemIds,
    directIntentByItem,
    nonReflowDirectItemIds,
    changedItemIds: resolveChangedItemIds(boundary, directItemIds),
    scope: resolveBoundaryMotionScope(boundary, directItemIds, nonReflowDirectItemIds),
  }
}

/** Selects the complete boundary scope using precomputed intent metadata. */
function resolveBoundaryMotionScope(
  boundary: MotionBoundary,
  directItemIds: ReadonlySet<string>,
  nonReflowDirectItemIds: ReadonlySet<string>,
): Readonly<{
  itemIds: ReadonlySet<string>
  segmentItemIds: ReadonlySet<string>
  targetContainerItemIds: ReadonlySet<string>
}> {
  const segmentItemIds = new Set(directItemIds)
  const targetContainerItemIds = new Set<string>()
  const targetIds = new Set<string>()
  for (const intent of boundary.intents) {
    if (intent.targetReflow === false) continue
    const before = boundary.before.items.get(intent.itemId)
    const after = boundary.after.items.get(intent.itemId)
    if (before !== undefined) targetIds.add(before.targetId)
    if (after !== undefined) targetIds.add(after.targetId)
    addTargetContainer(boundary.before, before, segmentItemIds, targetContainerItemIds)
    addTargetContainer(boundary.after, after, segmentItemIds, targetContainerItemIds)
  }
  for (const item of boundary.before.items.values()) {
    if (targetIds.has(item.targetId) && !nonReflowDirectItemIds.has(item.itemId)) {
      segmentItemIds.add(item.itemId)
    }
  }
  for (const item of boundary.after.items.values()) {
    if (targetIds.has(item.targetId) && !nonReflowDirectItemIds.has(item.itemId)) {
      segmentItemIds.add(item.itemId)
    }
  }

  const itemIds = new Set(segmentItemIds)
  addAncestorClosure(boundary.before, itemIds)
  addAncestorClosure(boundary.after, itemIds)
  return { itemIds, segmentItemIds, targetContainerItemIds }
}

/** Adds a mounted perso target when its own measured pose can reflow. */
function addTargetContainer(
  snapshot: LayoutSnapshot,
  mover: LayoutItemSnapshot | undefined,
  segmentItemIds: Set<string>,
  targetContainerItemIds: Set<string>,
): void {
  const parentItemId = mover?.parentItemId
  const targetId = mover?.targetId
  if (parentItemId === undefined || targetId === undefined || !snapshot.items.has(parentItemId)) return

  // A target perso is represented by its qualified item key as the logical
  // parent, while an outlet target is represented by its owning perso key.
  // Only the former is the container whose own dimensions changed because the
  // moved item entered or left it.
  if (parentItemId !== targetId && !parentItemId.endsWith(`:${targetId}`)) return
  segmentItemIds.add(parentItemId)
  targetContainerItemIds.add(parentItemId)
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
    const track = graph.tracksByItem.get(itemId)
    const resetAt = latestResetAt(graph.resetTimesByItem, itemId, timeMs)
    const segment = findActiveSegment(track, timeMs, resetAt)
    const progress = segment === undefined ? 1 : resolveSegmentProgress(segment, timeMs)
    const overlayStacking = resolveOverlayStackingContext(base, segment)
    const motionRoot = resolvePresentationMotionRoot(base, track, segment, timeMs, resetAt)
    items.set(itemId, {
      itemId,
      ...(base.parentItemId === undefined ? {} : { parentItemId: base.parentItemId }),
      targetId: base.targetId,
      targetOrder: base.targetOrder,
      ...(motionRoot?.motionRootKey === undefined ? {} : { motionRootKey: motionRoot.motionRootKey }),
      ...(motionRoot?.motionRootPose === undefined ? {} : { motionRootPose: motionRoot.motionRootPose }),
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

/** Resolves an operation's FIRST pose without consulting its own provisional segment. */
function resolveMotionOperationCurrent(
  graph: MotionGraphReadState,
  layout: LayoutSnapshot,
  operation: MotionBuildOperation,
): ItemPresentation | undefined {
  const excludedSegmentId = operation.kind === 'segment' ? operation.segmentId : undefined
  const current = resolveMotionItem(
    graph,
    layout,
    operation.itemId,
    operation.boundary.timeMs,
    undefined,
    undefined,
    excludedSegmentId,
  )
  if (current !== undefined || operation.kind !== 'segment') return current

  // A natural source layout may omit an HTML-only parent. The segment's
  // captured FIRST context still contains the measured ancestor chain, so it
  // is the safe fallback for the segment being built. It cannot reintroduce
  // the initial pose: this context belongs to this boundary's FIRST capture.
  const provisionalSegment = findTrackSegment(
    graph.tracksByItem.get(operation.itemId),
    operation.segmentId,
  )
  const context = provisionalSegment?.from.context
  if (context === undefined) return undefined

  const completeContext = completeMotionContext(context, layout, operation.itemId)
  return resolveMotionItem(
    graph,
    layout,
    operation.itemId,
    operation.boundary.timeMs,
    undefined,
    completeContext,
    operation.segmentId,
  )
}

/** Completes a captured attachment context with missing ancestors from the same FIRST layout. */
function completeMotionContext(
  context: ReadonlyMap<string, LayoutItemSnapshot>,
  layout: LayoutSnapshot,
  itemId: string,
): ReadonlyMap<string, LayoutItemSnapshot> {
  const completed = new Map(context)
  let current = completed.get(itemId) ?? layout.items.get(itemId)
  while (current?.parentItemId !== undefined && !completed.has(current.parentItemId)) {
    const parent = layout.items.get(current.parentItemId)
    if (parent === undefined) break
    completed.set(parent.itemId, parent)
    current = parent
  }
  return completed
}

/** Resolves one item presentation for graph construction and retargeting. */
function resolveMotionItem(
  graph: MotionGraphReadState,
  layout: LayoutSnapshot,
  itemId: string,
  timeMs: number,
  resolveKnown?: (itemId: string) => ItemPresentation | undefined,
  context?: ReadonlyMap<string, LayoutItemSnapshot>,
  excludedSegmentId?: string,
): ItemPresentation | undefined {
  const base = context?.get(itemId) ?? layout.items.get(itemId)
  if (base === undefined) return undefined
  const resolveParent = (
    parentItemId: string | undefined,
    parentContext?: ReadonlyMap<string, LayoutItemSnapshot>,
  ): HtmlPose | undefined => {
    if (parentItemId === undefined) return createMotionRootPose()
    return resolveKnown?.(parentItemId)?.pose
      ?? resolveMotionItem(
        graph,
        layout,
        parentItemId,
        timeMs,
        resolveKnown,
        parentContext ?? context,
        excludedSegmentId,
      )?.pose
  }
  const pose = resolveMotionPose(graph, layout, itemId, timeMs, resolveParent, context, excludedSegmentId)
  if (pose === undefined) return undefined
  const resetAt = latestResetAt(graph.resetTimesByItem, itemId, timeMs)
  const segment = findActiveSegment(graph.tracksByItem.get(itemId), timeMs, resetAt, excludedSegmentId)
  const endpoint = segment === undefined
    ? findMotionEndpoint(graph.tracksByItem.get(itemId), timeMs, resetAt, excludedSegmentId)
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
  graph: MotionGraphReadState,
  layout: LayoutSnapshot,
  itemId: string,
  timeMs: number,
  resolveParent: (
    parentItemId: string | undefined,
    context?: ReadonlyMap<string, LayoutItemSnapshot>,
  ) => HtmlPose | undefined,
  context?: ReadonlyMap<string, LayoutItemSnapshot>,
  excludedSegmentId?: string,
): HtmlPose | undefined {
  const base = context?.get(itemId) ?? layout.items.get(itemId)
  const track = graph.tracksByItem.get(itemId)
  const resetAt = latestResetAt(graph.resetTimesByItem, itemId, timeMs)
  const segment = findActiveSegment(track, timeMs, resetAt, excludedSegmentId)
  if (segment === undefined) {
    const endpoint = findMotionEndpoint(track, timeMs, resetAt, excludedSegmentId)
    if (endpoint !== undefined) {
      const attachment = endpoint.side === 'from'
        ? endpoint.segment.from
        : resolveSegmentRetarget(endpoint.segment, timeMs)?.to ?? endpoint.segment.to
      return resolveAttachment(attachment, layout, itemId, resolveParent, endpoint.side === 'to' && !endpoint.segment.materializerOwned)
    }
    if (base === undefined) return undefined
    const parent = resolveParent(base.parentItemId, context)
    // `rootPose` is the measured world pose from this same FIRST/LAST
    // capture. It is the correct fallback when the HTML host parent is not
    // represented in the logical layout snapshot.
    return parent === undefined ? base.rootPose : composeMotionPose(parent, base.localPose)
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
  graph: MotionGraphReadState,
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
  return {
    ...naturalLayout,
    revision: `${naturalLayout.revision}:source:${boundaryBefore.revision}:${itemId}`,
    items,
  }
}

/** Creates a source attachment from the exact already-resolved visual pose. */
function createAttachment(
  snapshot: LayoutItemSnapshot,
  visualPose: HtmlPose,
  parentPose: HtmlPose | undefined,
  contextSnapshot: LayoutSnapshot,
): MotionAttachment {
  return {
    ...(snapshot.parentItemId === undefined || parentPose === undefined ? {} : { parentItemId: snapshot.parentItemId }),
    targetId: snapshot.targetId,
    targetOrder: snapshot.targetOrder,
    localPose: parentPose === undefined
      ? decomposeRootMotionPose(visualPose)
      : deriveRelativeMotionPose(parentPose, visualPose),
    fallbackRootPose: decomposeRootMotionPose(visualPose),
    ...(snapshot.motionRootKey === undefined ? {} : { motionRootKey: snapshot.motionRootKey }),
    ...(snapshot.motionRootPose === undefined && contextSnapshot.rootPose === undefined
      ? {}
      : { motionRootPose: snapshot.motionRootPose ?? contextSnapshot.rootPose }),
    context: createAttachmentContext(snapshot, contextSnapshot),
  }
}

/** Creates one destination attachment from the measured LAST layout. */
function createStaticAttachment(
  snapshot: LayoutItemSnapshot,
  contextSnapshot: LayoutSnapshot,
  fallbackSnapshot: LayoutItemSnapshot = snapshot,
): MotionAttachment {
  return {
    ...(snapshot.parentItemId === undefined ? {} : { parentItemId: snapshot.parentItemId }),
    targetId: snapshot.targetId,
    targetOrder: snapshot.targetOrder,
    localPose: snapshot.localPose,
    fallbackRootPose: decomposeRootMotionPose(fallbackSnapshot.rootPose),
    ...(snapshot.motionRootKey === undefined && contextSnapshot.rootKey === undefined
      ? {}
      : { motionRootKey: snapshot.motionRootKey ?? contextSnapshot.rootKey }),
    ...(snapshot.motionRootPose === undefined && contextSnapshot.rootPose === undefined
      ? {}
      : { motionRootPose: snapshot.motionRootPose ?? contextSnapshot.rootPose }),
    context: createAttachmentContext(snapshot, contextSnapshot),
  }
}

/** Resolves the local HTML root that owns one currently presented item. */
function resolvePresentationMotionRoot(
  base: LayoutItemSnapshot,
  track: ItemMotionTrack | undefined,
  segment: MotionSegment | undefined,
  timeMs: number,
  resetAt?: MotionResetBoundary,
): Readonly<{ motionRootKey?: string; motionRootPose?: HtmlPose }> | undefined {
  if (segment !== undefined) {
    const retarget = resolveSegmentRetarget(segment, timeMs)
    const attachment = retarget?.to ?? segment.from
    if (attachment.motionRootKey !== undefined || attachment.motionRootPose !== undefined) return attachment
  }
  const endpoint = findMotionEndpoint(track, timeMs, resetAt)
  if (endpoint !== undefined) {
    const attachment = endpoint.side === 'from'
      ? endpoint.segment.from
      : resolveSegmentRetarget(endpoint.segment, timeMs)?.to ?? endpoint.segment.to
    if (attachment.motionRootKey !== undefined || attachment.motionRootPose !== undefined) return attachment
  }
  if (base.motionRootKey !== undefined || base.motionRootPose !== undefined) return base
  return undefined
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
        : { at: snapshot.timeMs, attachment: createStaticAttachment(item, snapshot) }
    })
    .filter((entry): entry is MotionKeyframe => entry !== undefined)
  if (measured.length === 0) return undefined

  const entries: MotionKeyframe[] = [{ at: segment.startAt, attachment: from }]
  if (segment.delay > 0) entries.push({ at: activeStartAt, attachment: from })
  entries.push(...measured)
  entries.push({ at: segment.endAt, attachment: to })
  return entries.sort((left, right) => left.at - right.at)
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

/** Returns the target identities that one destination attachment depends on. */
function targetDependencyKeys(attachment: MotionAttachment): readonly string[] {
  // A mounted target is identified by its concrete parent item. The logical
  // target id is only a fallback for root-level attachments; indexing every
  // sibling that shares that id would retarget unrelated moves.
  return [
    attachment.parentItemId ?? attachment.targetId,
  ]
}

/** Registers one active target-dependent segment in the temporary build index. */
function registerTargetDependencies(
  index: TargetDependencyIndex,
  segment: MotionSegment,
  boundaryBefore: LayoutSnapshot,
): void {
  const availableAtStart = isAttachmentAvailableAtStart(segment.to, boundaryBefore)
  for (const targetKey of targetDependencyKeys(segment.to)) {
    const references = index.get(targetKey) ?? new Map()
    references.set(segment.id, {
      itemId: segment.itemId,
      segmentId: segment.id,
      startAt: segment.startAt,
      endAt: segment.endAt,
      availableAtStart,
    })
    index.set(targetKey, references)
  }
}

/** Checks whether the complete concrete destination parent chain existed at FIRST. */
function isAttachmentAvailableAtStart(
  attachment: MotionAttachment,
  boundaryBefore: LayoutSnapshot,
): boolean {
  let parentItemId = attachment.parentItemId
  while (parentItemId !== undefined) {
    const parent = boundaryBefore.items.get(parentItemId)
    if (parent === undefined) return false
    parentItemId = parent.parentItemId
  }
  return true
}

/** Drops dependencies belonging to an older overlapping direct segment. */
function removeOverlappingTargetDependencies(
  index: TargetDependencyIndex,
  itemId: string,
  startAt: number,
): void {
  for (const [targetKey, references] of index) {
    for (const [segmentId, reference] of references) {
      if (reference.itemId !== itemId
        || reference.startAt > startAt
        || reference.endAt <= startAt) continue
      references.delete(segmentId)
    }
    if (references.size === 0) index.delete(targetKey)
  }
}

/** Identifies one segment reference without exposing the dependency index. */
function motionSegmentReferenceKey(itemId: string, segmentId: string): string {
  return `${itemId}\u0000${segmentId}`
}

/** Finds every item whose captured pose changed across a new boundary. */
function resolveChangedItemIds(
  boundary: MotionBoundary,
  directItemIds: ReadonlySet<string>,
): readonly string[] {
  const structuralAfter = boundary.afterStart
  const candidates = structuralAfter === undefined ? [] : [structuralAfter]
  const itemIds = new Set<string>([
    ...boundary.before.items.keys(),
    ...(structuralAfter === undefined ? [] : structuralAfter.items.keys()),
    ...directItemIds,
  ])

  return [...itemIds].filter((itemId) => {
    // A direct style or move intent is an explicit change even when its
    // endpoint is captured later than the logical boundary.
    if (directItemIds.has(itemId)) return true
    // Endpoint snapshots are intentionally excluded for indirect items: they
    // also contain the elapsed pose of an ancestor that is already moving.
    // Only the immediate afterStart reflow may invalidate a dependent move.
    if (structuralAfter === undefined) return false
    const before = boundary.before.items.get(itemId)
    if (before === undefined) return candidates.some((snapshot) => snapshot.items.has(itemId))
    return candidates.some((snapshot) => {
      const after = snapshot.items.get(itemId)
      return after === undefined || layoutItemPoseChanged(before, after)
    })
  })
}

/** Detects structural, local or composed world-pose changes for a target item. */
function layoutItemPoseChanged(before: LayoutItemSnapshot, after: LayoutItemSnapshot): boolean {
  return layoutAttachmentChanged(before, after) || !sameHtmlPose(before.rootPose, after.rootPose)
}

/** Compares the world-space data relevant to a target dependency. */
function sameHtmlPose(left: HtmlPose, right: HtmlPose, epsilon = 0.001): boolean {
  return nearlyEqual(left.origin.x, right.origin.x, epsilon)
    && nearlyEqual(left.origin.y, right.origin.y, epsilon)
    && nearlyEqual(left.matrix.a, right.matrix.a, epsilon)
    && nearlyEqual(left.matrix.b, right.matrix.b, epsilon)
    && nearlyEqual(left.matrix.c, right.matrix.c, epsilon)
    && nearlyEqual(left.matrix.d, right.matrix.d, epsilon)
    && nearlyEqual(left.localWidth, right.localWidth, epsilon)
    && nearlyEqual(left.localHeight, right.localHeight, epsilon)
}

/** Rebuilds one destination attachment against a newly captured target pose. */
function createTargetRetargetAttachment(
  segment: MotionSegment,
  boundary: MotionBoundary,
  itemId: string,
  targetItemId: string,
): MotionAttachment | undefined {
  const projectedItem = boundary.after.items.get(itemId)
  if (projectedItem !== undefined
    && projectedItem.parentItemId === segment.to.parentItemId
    && projectedItem.targetId === segment.to.targetId) {
    return createStaticAttachment(projectedItem, boundary.after)
  }

  const target = boundary.after.items.get(targetItemId)
    ?? boundary.afterStart?.items.get(targetItemId)
  if (target === undefined) return undefined

  const context = new Map(segment.to.context ?? [])
  let current: LayoutItemSnapshot | undefined = target
  while (current !== undefined && !context.has(current.itemId)) {
    context.set(current.itemId, current)
    current = current.parentItemId === undefined
      ? undefined
      : boundary.after.items.get(current.parentItemId)
        ?? boundary.afterStart?.items.get(current.parentItemId)
        ?? context.get(current.parentItemId)
  }

  const targetIsContainer = segment.to.parentItemId === targetItemId
    || (segment.to.parentItemId === undefined && segment.to.targetId === targetItemId)
  return {
    ...segment.to,
    fallbackRootPose: targetIsContainer
      ? decomposeRootMotionPose(composeMotionPose(target.rootPose, segment.to.localPose))
      : segment.to.fallbackRootPose,
    context,
  }
}

/** Resolves a target's pose at the retarget boundary without freezing an old target. */
function resolveTargetRetargetParent(
  graph: MotionGraphReadState,
  boundary: MotionBoundary,
  parentItemId: string | undefined,
  timeMs: number,
): HtmlPose | undefined {
  if (parentItemId === undefined) return createMotionRootPose()

  const activeTargetSegment = findActiveSegment(
    graph.tracksByItem.get(parentItemId),
    timeMs,
    latestResetAt(graph.resetTimesByItem, parentItemId, timeMs),
  )
  const currentLayout = activeTargetSegment === undefined
    ? boundary.after
    : boundary.before
  return resolveMotionItem(graph, currentLayout, parentItemId, timeMs)?.pose
    ?? boundary.after.items.get(parentItemId)?.rootPose
    ?? boundary.afterStart?.items.get(parentItemId)?.rootPose
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

/** Compares finite geometry values without making sub-pixel retargets visible. */
function nearlyEqual(left: number, right: number, epsilon: number): boolean {
  return Math.abs(left - right) <= epsilon
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

/** Shortens a replacement move so it ends with the segment it supersedes. */
function resolveReplacementTiming(
  activeSegment: MotionSegment,
  timeMs: number,
): Readonly<{ duration: number; delay: number; endAt: number }> {
  const remainingDuration = Math.max(0, activeSegment.endAt - timeMs)
  return { duration: remainingDuration, delay: 0, endAt: activeSegment.endAt }
}

/** Finds the latest segment owning one item at the requested time. */
function findActiveSegment(
  track: ItemMotionTrack | undefined,
  timeMs: number,
  resetAt?: MotionResetBoundary,
  excludedSegmentId?: string,
): MotionSegment | undefined {
  if (track === undefined) return undefined
  for (let index = track.segments.length - 1; index >= 0; index -= 1) {
    const segment = track.segments[index]!
    if (segment.id === excludedSegmentId) continue
    if (resetAt !== undefined && !isAfterReset(segment, resetAt)) continue
    if (timeMs >= segment.startAt && timeMs <= segment.endAt) return segment
  }
  return undefined
}

/** Selects the nearest segment endpoint when the item is outside an active interval. */
function findMotionEndpoint(
  track: ItemMotionTrack | undefined,
  timeMs: number,
  resetAt?: MotionResetBoundary,
  excludedSegmentId?: string,
): Readonly<{ segment: MotionSegment; side: 'from' | 'to' }> | undefined {
  if (track === undefined || track.segments.length === 0) return undefined
  const segments = resetAt === undefined
    ? track.segments
    : track.segments.filter((segment) => isAfterReset(segment, resetAt))
  // During graph construction, an operation excludes its own newly planned
  // segment. Future segments must be excluded from that FIRST lookup as well;
  // otherwise a first segment would resolve against a later segment's
  // provisional `from` pose and jump back to it.
  const eligibleSegments = excludedSegmentId === undefined
    ? segments
    : segments.filter((segment) => segment.id !== excludedSegmentId && segment.startAt <= timeMs)
  if (eligibleSegments.length === 0) return undefined
  const first = eligibleSegments[0]!
  if (timeMs < first.startAt) return { segment: first, side: 'from' }
  for (let index = eligibleSegments.length - 1; index >= 0; index -= 1) {
    const segment = eligibleSegments[index]!
    if (timeMs > segment.endAt) return { segment, side: 'to' }
  }
  return undefined
}

/** Selects an active segment that still has a future destination to retarget. */
function findContinuingSegment(
  track: ItemMotionTrack | undefined,
  timeMs: number,
  resetAt?: MotionResetBoundary,
): MotionSegment | undefined {
  if (track === undefined) return undefined
  for (let index = track.segments.length - 1; index >= 0; index -= 1) {
    const segment = track.segments[index]!
    if (resetAt !== undefined && !isAfterReset(segment, resetAt)) continue
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

/** Replaces one prepared segment inside the private build transaction. */
function replaceMotionSegment(
  graph: MutableMotionGraph,
  itemId: string,
  segmentId: string,
  replacement: MotionSegment | undefined,
): void {
  const track = graph.tracksByItem.get(itemId)
  if (track === undefined) return
  const index = track.segmentIndexById.get(segmentId)
  if (index === undefined) return

  if (replacement === undefined) {
    track.segments.splice(index, 1)
    track.segmentsById.delete(segmentId)
    track.segmentIndexById.delete(segmentId)
    for (let shiftedIndex = index; shiftedIndex < track.segments.length; shiftedIndex += 1) {
      track.segmentIndexById.set(track.segments[shiftedIndex]!.id, shiftedIndex)
    }
  }
  else {
    track.segments[index] = replacement
    track.segmentsById.set(segmentId, replacement)
  }
  if (track.segments.length === 0) {
    graph.tracksByItem.delete(itemId)
    graph.presentationItemIds.delete(itemId)
  }
}

/** Returns one segment through the preparation index when available. */
function findTrackSegment(
  track: ItemMotionTrack | MutableMotionTrack | undefined,
  segmentId: string,
): MotionSegment | undefined {
  if (track === undefined) return undefined
  if ('segmentsById' in track) return track.segmentsById.get(segmentId)
  return track.segments.find((segment) => segment.id === segmentId)
}

/** Materializes one private work graph at the presentation boundary. */
function finalizeMotionGraph(
  graph: MutableMotionGraph,
): MotionGraph {
  const tracksByItem = new Map<string, ItemMotionTrack>()
  const attachmentCache = new WeakMap<MotionAttachment, MotionAttachment>()
  for (const [itemId, track] of graph.tracksByItem) {
    const segments = track.segments.map((segment) => finalizeMotionSegment(segment, attachmentCache))
    tracksByItem.set(itemId, Object.freeze({
      itemId,
      segments: Object.freeze(segments),
    }))
  }
  const revision = createGraphRevision(tracksByItem, graph.resetTimesByItem)
  return Object.freeze({
    revision,
    tracksByItem,
    resetTimesByItem: graph.resetTimesByItem,
    presentationItemIds: Object.freeze([...graph.presentationItemIds]),
  })
}

/** Freezes one segment and its nested mutable collections at the final boundary. */
function finalizeMotionSegment(
  segment: MotionSegment,
  attachmentCache: WeakMap<MotionAttachment, MotionAttachment>,
): MotionSegment {
  const from = finalizeMotionAttachment(segment.from, attachmentCache)
  const to = finalizeMotionAttachment(segment.to, attachmentCache)
  const keyframes = segment.keyframes === undefined
    ? undefined
    : Object.freeze(segment.keyframes.map((keyframe) => Object.freeze({
      ...keyframe,
      attachment: finalizeMotionAttachment(keyframe.attachment, attachmentCache),
    })))
  const retargets = segment.retargets === undefined
    ? undefined
    : Object.freeze(segment.retargets.map((retarget) => Object.freeze({
      ...retarget,
      from: finalizeMotionAttachment(retarget.from, attachmentCache),
      to: finalizeMotionAttachment(retarget.to, attachmentCache),
    })))
  return Object.freeze({
    ...segment,
    from,
    to,
    ...(keyframes === undefined ? {} : { keyframes }),
    ...(retargets === undefined ? {} : { retargets }),
  })
}

/** Freezes one attachment once while preserving shared endpoint identity. */
function finalizeMotionAttachment(
  attachment: MotionAttachment,
  cache: WeakMap<MotionAttachment, MotionAttachment>,
): MotionAttachment {
  const existing = cache.get(attachment)
  if (existing !== undefined) return existing
  const finalized = Object.freeze({ ...attachment })
  cache.set(attachment, finalized)
  return finalized
}

/** Computes the stable graph revision once, after all operations are complete. */
function createGraphRevision(
  tracksByItem: ReadonlyMap<string, ItemMotionTrack>,
  resetTimesByItem: MotionResetTimesByItem,
): string {
  return JSON.stringify({ tracks: [...tracksByItem].map(([itemId, track]) => [
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
      eventSeq: segment.eventSeq,
      from: segment.from,
      to: segment.to,
      retargets: segment.retargets,
      keyframes: segment.keyframes,
      materializerOwned: segment.materializerOwned,
      path: segment.path,
    })),
  ]), resets: [...resetTimesByItem] })
}

/** Clones reset barriers into the immutable graph-owned representation. */
function normalizeResetTimes(resetTimesByItem: MotionResetTimesByItem | undefined): MotionResetTimesByItem {
  const normalized = new Map<string, readonly MotionResetBoundary[]>()
  for (const [itemId, times] of resetTimesByItem ?? []) {
    const valid = [...times]
      .filter((boundary) => Number.isFinite(boundary.timeMs) && Number.isFinite(boundary.eventSeq))
      .sort((left, right) => left.timeMs - right.timeMs || left.eventSeq - right.eventSeq)
      .filter((boundary, index, boundaries) => index === 0
        || boundary.timeMs !== boundaries[index - 1]!.timeMs
        || boundary.eventSeq !== boundaries[index - 1]!.eventSeq)
    if (valid.length > 0) normalized.set(itemId, Object.freeze(valid))
  }
  return normalized
}

/** Returns the latest reset barrier not later than one logical time. */
function latestResetAt(
  resetTimesByItem: MotionResetTimesByItem,
  itemId: string,
  timeMs: number,
): MotionResetBoundary | undefined {
  const times = resetTimesByItem.get(itemId)
  if (times === undefined) return undefined
  let latest: MotionResetBoundary | undefined
  for (const resetAt of times) {
    if (resetAt.timeMs > timeMs) break
    latest = resetAt
  }
  return latest
}

/** Tests whether a motion segment starts after an ordered reset boundary. */
function isAfterReset(segment: MotionSegment, reset: MotionResetBoundary): boolean {
  return segment.startAt > reset.timeMs
    || (segment.startAt === reset.timeMs
      && segment.eventSeq !== undefined
      && segment.eventSeq > reset.eventSeq)
}
