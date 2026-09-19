import { prepareTween } from 'ace'
import {
  createMotionRootPose,
  extrapolateMotionPoseAtProgress,
} from '../motion-pose'
import type {
  LayoutItemSnapshot,
  LayoutSnapshot,
  MotionBoundary,
  MotionGraph,
  MotionIntent,
  MotionSegment,
} from '../types'
import {
  buildNaturalLayoutTimeline,
  resolveNaturalLayoutBefore,
  type NaturalLayoutTimeline,
} from '../motion-layout'
import {
  createAttachment,
  createSegmentKeyframes,
  createStaticAttachment,
  createTargetRetargetAttachment,
  findContinuingSegment,
  isReparented,
  layoutAttachmentChanged,
  layoutItemPoseChanged,
  mergeBoundarySourceLayout,
  resolveAttachment,
  resolveBoundaryParent,
  resolveMotionOperationCurrent,
  resolveMotionItem,
  resolveSegmentProgress,
  resolveTargetRetargetParent,
} from './graph-pose'
import {
  finalizeMotionGraph,
  findTrackSegment,
  latestResetAt,
  normalizeResetTimes,
  replaceMotionSegment,
} from './graph-finalizer'
import type {
  MotionBoundaryMetadata,
  MotionBuildOperation,
  MotionGraphOptions,
  MutableMotionGraph,
  MutableMotionTrack,
  TargetDependencyIndex,
} from './graph-types'

/** Builds one complete immutable motion graph from chronological boundaries. */
export function buildMotionGraph(
  boundaries: readonly MotionBoundary[],
  options: MotionGraphOptions = {},
): MotionGraph {
  return buildMotionGraphPreparation(boundaries, options).graph
}

/** Builds a graph and the natural-layout timeline shared by both phases. */
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

  // Resolve geometry only after every future segment is present. This lets an
  // active child use the FIRST pose of an ancestor that starts later.
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
  resetTimesByItem: import('../types').MotionResetTimesByItem,
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
      if (!scope.segmentItemIds.has(itemId)) continue
      const before = boundary.before.items.get(itemId)
      const structuralAfter = boundary.afterStart ?? boundary.after
      const directIntent = metadata.directIntentByItem.get(itemId)
      const after = directIntent === undefined
        ? structuralAfter.items.get(itemId)
        : boundary.after.items.get(itemId) ?? structuralAfter.items.get(itemId)
      if (before === undefined || after === undefined) continue
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
        ...(directIntent?.resize === undefined ? {} : { resize: directIntent.resize }),
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

  return { graph, operations }
}

/** Computes the boundary metadata shared by dependency and segment planning. */
function createMotionBoundaryMetadata(boundary: MotionBoundary): MotionBoundaryMetadata {
  const directItemIds = new Set<string>()
  const directIntentByItem = new Map<string, MotionIntent>()
  const nonReflowDirectItemIds = new Set<string>()
  for (const intent of boundary.intents) {
    directItemIds.add(intent.itemId)
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
): MotionBoundaryMetadata['scope'] {
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
    if (targetIds.has(item.targetId) && !nonReflowDirectItemIds.has(item.itemId)) segmentItemIds.add(item.itemId)
  }
  for (const item of boundary.after.items.values()) {
    if (targetIds.has(item.targetId) && !nonReflowDirectItemIds.has(item.itemId)) segmentItemIds.add(item.itemId)
  }

  const itemIds = new Set(segmentItemIds)
  addAncestorClosure(boundary.before, itemIds)
  addAncestorClosure(boundary.after, itemIds)
  return { itemIds, segmentItemIds, targetContainerItemIds }
}

/** Adds a mounted perso target when its measured pose can reflow. */
function addTargetContainer(
  snapshot: LayoutSnapshot,
  mover: LayoutItemSnapshot | undefined,
  segmentItemIds: Set<string>,
  targetContainerItemIds: Set<string>,
): void {
  const parentItemId = mover?.parentItemId
  const targetId = mover?.targetId
  if (parentItemId === undefined || targetId === undefined || !snapshot.items.has(parentItemId)) return
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

/** Registers one active target-dependent segment in the temporary build index. */
function registerTargetDependencies(
  index: TargetDependencyIndex,
  segment: MotionSegment,
  boundaryBefore: LayoutSnapshot,
): void {
  const availableAtStart = isAttachmentAvailableAtStart(segment.to, boundaryBefore)
  const targetKey = segment.to.parentItemId ?? segment.to.targetId
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

/** Checks whether the complete concrete destination parent chain existed at FIRST. */
function isAttachmentAvailableAtStart(
  attachment: MotionSegment['to'],
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
    if (directItemIds.has(itemId)) return true
    if (structuralAfter === undefined) return false
    const before = boundary.before.items.get(itemId)
    if (before === undefined) return candidates.some((snapshot) => snapshot.items.has(itemId))
    return candidates.some((snapshot) => {
      const after = snapshot.items.get(itemId)
      return after === undefined || layoutItemPoseChanged(before, after)
    })
  })
}

/** Selects the longest direct timing for one shared reflow boundary. */
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
