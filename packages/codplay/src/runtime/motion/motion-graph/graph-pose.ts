import { resolveTweenProgress } from 'ace'
import {
  composeMotionPose,
  createMotionRootPose,
  decomposeRootMotionPose,
  deriveRelativeMotionPose,
  interpolateMotionPose,
  resizeMotionPose,
  sameRelativeMotionPose,
} from '../motion-pose'
import type {
  ItemMotionTrack,
  ItemPresentation,
  LayoutItemSnapshot,
  LayoutSnapshot,
  MotionAttachment,
  MotionBoundary,
  MotionGraph,
  MotionKeyframe,
  MotionResetBoundary,
  MotionRetarget,
  MotionSegment,
  OverlayStackingContext,
  PresentationFrame,
} from '../types'
import type { HtmlPose } from '../html-types'
import type { MotionBuildOperation, MotionGraphReadState } from './graph-types'
import {
  findTrackSegment,
  isAfterReset,
  latestResetAt,
} from './graph-finalizer'

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
      ...(segment?.resize === undefined ? {} : { resize: segment.resize }),
      ...(segment?.targetReflow !== true ? {} : { targetReflow: true }),
      ...(segment?.direct !== true ? {} : { direct: true }),
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
export function resolveMotionOperationCurrent(
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
  // is the safe fallback for the segment being built.
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

/** Completes a captured attachment context with missing ancestors from FIRST. */
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
export function resolveMotionItem(
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
    ...(segment?.resize === undefined ? {} : { resize: segment.resize }),
    ...(segment?.targetReflow !== true ? {} : { targetReflow: true }),
    ...(segment?.direct !== true ? {} : { direct: true }),
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

/** Resolves one item's current pose while retaining parent poses privately. */
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
    return applyMotionResize(
      interpolateMotionPose(from, to, keyframeInterval.progress, segment.path),
      segment.resize,
      keyframeInterval.to,
      resolveParent,
    )
  }

  const from = resolveAttachment(retarget?.from ?? segment.from, layout, itemId, resolveParent, false)
  const to = resolveAttachment(
    retarget?.to ?? segment.to,
    layout,
    itemId,
    resolveParent,
    !segment.materializerOwned && !segment.targetReflow,
  )
  return applyMotionResize(
    interpolateMotionPose(from, to, resolveSegmentProgress(segment, timeMs), segment.path),
    segment.resize,
    retarget?.to ?? segment.to,
    resolveParent,
  )
}

/** Applies item sizing without measuring the DOM during frame resolution. */
function applyMotionResize(
  pose: HtmlPose,
  resize: MotionSegment['resize'],
  destination: MotionAttachment,
  resolveParent: (parentItemId: string | undefined, context?: ReadonlyMap<string, LayoutItemSnapshot>) => HtmlPose | undefined,
): HtmlPose {
  if (resize === undefined) return pose
  const needsContainer = resize.width === 'container' || resize.height === 'container'
  const parent = !needsContainer || destination.parentItemId === undefined
    ? undefined
    : resolveParent(destination.parentItemId, destination.context)
  const parentNatural = !needsContainer || destination.parentItemId === undefined
    ? undefined
    : destination.context?.get(destination.parentItemId)
  const width = resolveMotionResizeAxis(
    resize.width,
    pose.localWidth,
    destination.localPose.width,
    parent?.localWidth,
    parentNatural?.localPose.width,
  )
  const height = resolveMotionResizeAxis(
    resize.height,
    pose.localHeight,
    destination.localPose.height,
    parent?.localHeight,
    parentNatural?.localPose.height,
  )
  if (width === pose.localWidth && height === pose.localHeight) return pose
  return resizeMotionPose(pose, width, height)
}

/** Resolves one size axis from the captured destination and current parent. */
function resolveMotionResizeAxis(
  policy: 'auto' | 'preserve' | 'container' | undefined,
  current: number,
  destination: number,
  parentCurrent: number | undefined,
  parentNatural: number | undefined,
): number {
  if (policy === 'preserve') return current
  if (policy !== 'container' || parentCurrent === undefined || parentNatural === undefined) return current
  return Math.max(0, parentCurrent - Math.max(0, parentNatural - destination))
}

/** Resolves a retarget parent at the boundary instead of at the mover endpoint. */
export function resolveBoundaryParent(
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
    return resolveMotionItem(graph, currentLayout, parentItemId, timeMs)?.pose
  }
  return resolveMotionItem(graph, endpointLayout, parentItemId, timeMs, undefined, context)?.pose
}

/** Resolves one static or current destination attachment in root coordinates. */
export function resolveAttachment(
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
export function mergeBoundarySourceLayout(
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
export function createAttachment(
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
export function createStaticAttachment(
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

/** Builds one segment's measured pose intervals from the player captures. */
export function createSegmentKeyframes(
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

/** Rebuilds one destination attachment against a newly captured target pose. */
export function createTargetRetargetAttachment(
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

/** Resolves a target's pose at the retarget boundary without freezing its old pose. */
export function resolveTargetRetargetParent(
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

/** Detects structural, local or composed world-pose changes for a target item. */
export function layoutItemPoseChanged(before: LayoutItemSnapshot, after: LayoutItemSnapshot): boolean {
  return layoutAttachmentChanged(before, after) || !sameHtmlPose(before.rootPose, after.rootPose)
}

/** Detects local reflow or reparentage without duplicating ancestor movement. */
export function layoutAttachmentChanged(before: LayoutItemSnapshot, after: LayoutItemSnapshot): boolean {
  return before.parentItemId !== after.parentItemId
    || before.targetId !== after.targetId
    || !sameRelativeMotionPose(before.localPose, after.localPose)
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

/** Compares finite geometry values without making sub-pixel retargets visible. */
function nearlyEqual(left: number, right: number, epsilon: number): boolean {
  return Math.abs(left - right) <= epsilon
}

/** Classifies a parent/target change as a reparent presentation. */
export function isReparented(before: LayoutItemSnapshot, after: LayoutItemSnapshot): boolean {
  return before.parentItemId !== after.parentItemId || before.targetId !== after.targetId
}

/** Selects an active segment that still has a future destination to retarget. */
export function findContinuingSegment(
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

/** Finds the latest segment owning one item at the requested time. */
export function findActiveSegment(
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

/** Selects the nearest segment endpoint when the item is outside an interval. */
export function findMotionEndpoint(
  track: ItemMotionTrack | undefined,
  timeMs: number,
  resetAt?: MotionResetBoundary,
  excludedSegmentId?: string,
): Readonly<{ segment: MotionSegment; side: 'from' | 'to' }> | undefined {
  if (track === undefined || track.segments.length === 0) return undefined
  const segments = resetAt === undefined
    ? track.segments
    : track.segments.filter((segment) => isAfterReset(segment, resetAt))
  // Future segments must be excluded from a FIRST lookup; otherwise a first
  // segment could resolve against a later segment's provisional from pose.
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

/** Resolves the latest retarget boundary crossed by one segment. */
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
export function resolveSegmentProgress(segment: MotionSegment, timeMs: number): number {
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
