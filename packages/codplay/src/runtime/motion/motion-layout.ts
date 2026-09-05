import { composeMotionPose, createMotionRootPose } from './motion-pose'
import type { LayoutItemSnapshot, LayoutSnapshot, MotionBoundary } from './types'

/** One immutable natural-layout state valid from a logical boundary onward. */
export type NaturalLayoutEntry = Readonly<{
  startAt: number
  snapshot: LayoutSnapshot
}>

/** Timeline of natural layouts assembled once from captured boundary snapshots. */
export type NaturalLayoutTimeline = Readonly<{
  entries: readonly NaturalLayoutEntry[]
  beforeByBoundaryId: ReadonlyMap<string, LayoutSnapshot>
}>

/** One captured snapshot applied at the time at which it actually exists. */
type SnapshotEvent = Readonly<{
  timeMs: number
  order: number
  phase: 'before' | 'after'
  boundary: MotionBoundary
  snapshot: LayoutSnapshot
}>

/** Builds the natural-layout timeline without reading a materializer or the DOM. */
export function buildNaturalLayoutTimeline(
  boundaries: readonly MotionBoundary[],
): NaturalLayoutTimeline {
  const events = createSnapshotEvents(boundaries)
  const entries: NaturalLayoutEntry[] = []
  const beforeByBoundaryId = new Map<string, LayoutSnapshot>()
  const directMotionItemIds = new Set(boundaries.flatMap((boundary) => boundary.intents.map((intent) => intent.itemId)))
  const currentItems = new Map<string, LayoutItemSnapshot>()
  let currentRootPose = createMotionRootPose()
  let currentRootKey: string | undefined
  let currentRevision = 'empty'

  for (const event of events) {
    const afterSnapshot = event.phase === 'before'
      ? event.boundary.afterStart ?? event.boundary.after
      : event.boundary.after
    const boundaryItemIds = resolveBoundaryItemIds(event.boundary, directMotionItemIds, afterSnapshot)
    if (event.phase === 'before') {
      applyBeforeSnapshot(
        event.boundary.before,
        currentItems,
        boundaryItemIds,
        directMotionItemIds,
        new Set(event.boundary.intents.map((intent) => intent.itemId)),
      )
      beforeByBoundaryId.set(event.boundary.id, createSnapshot(
        event.boundary.before.timeMs,
        event.boundary.before.revision,
        event.boundary.before.rootPose ?? currentRootPose,
        event.boundary.before.rootKey ?? currentRootKey,
        currentItems,
      ))
      applyCommittedBoundaryStartSnapshot(event.boundary, currentItems, boundaryItemIds)
    }
    else {
      applyAfterSnapshot(
        event.boundary.before,
        event.snapshot,
        currentItems,
        boundaryItemIds,
        directMotionItemIds,
        new Set(event.boundary.intents.map((intent) => intent.itemId)),
      )
    }
    if (event.snapshot.rootPose !== undefined) currentRootPose = event.snapshot.rootPose
    if (event.snapshot.rootKey !== undefined) currentRootKey = event.snapshot.rootKey
    currentRevision = event.snapshot.revision

    const startAt = entries.length === 0 ? Number.NEGATIVE_INFINITY : event.timeMs
    entries.push({
      startAt,
      snapshot: createSnapshot(event.timeMs, currentRevision, currentRootPose, currentRootKey, currentItems),
    })
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    beforeByBoundaryId,
  })
}

/** Applies the structural destination slots after the exact boundary start. */
function applyCommittedBoundaryStartSnapshot(
  boundary: MotionBoundary,
  currentItems: Map<string, LayoutItemSnapshot>,
  selectedItemIds: ReadonlySet<string>,
): void {
  if (!boundary.intents.some((intent) => intent.targetReflow === true)) return

  const committedAfter = boundary.afterStart ?? boundary.after
  const directItemIds = new Set(boundary.intents
    .filter((intent) => intent.targetReflow === true)
    .map((intent) => intent.itemId))
  const reflowTargetIds = new Set<string>()
  for (const intent of boundary.intents) {
    if (intent.targetReflow !== true) continue
    const before = boundary.before.items.get(intent.itemId)
    const after = committedAfter.items.get(intent.itemId)
    if (before !== undefined) reflowTargetIds.add(before.targetId)
    if (after !== undefined) reflowTargetIds.add(after.targetId)
  }

  // A direct structural mover commits its destination relation at startAt as
  // well. Its visible pose is still resolved from FIRST by the motion graph,
  // but the natural layout must expose its afterStart slot to active segments
  // that use the current destination before a later reflow boundary.
  for (const itemId of directItemIds) {
    // The destination may not be mounted in afterStart yet. In that case the
    // direct mover still has a valid destination relation in LAST; retain it
    // in the prepared natural layout instead of leaving the mover at FIRST.
    const committedItem = boundary.afterStart?.items.get(itemId) ?? boundary.after.items.get(itemId)
    if (committedItem !== undefined && selectedItemIds.has(itemId)) {
      currentItems.set(itemId, committedItem)
    }
  }

  // A structural move commits its new layout at startAt. Its direct mover is
  // presented from FIRST by the motion graph, while the remaining target
  // children already occupy their LAST local slots in the author DOM.
  for (const itemId of new Set([...boundary.before.items.keys(), ...committedAfter.items.keys()])) {
    if (directItemIds.has(itemId)) continue
    const before = boundary.before.items.get(itemId)
    const after = committedAfter.items.get(itemId)
    const isReflowParticipant = (before !== undefined && reflowTargetIds.has(before.targetId))
      || (after !== undefined && reflowTargetIds.has(after.targetId))
    if (!isReflowParticipant || after === undefined) continue
    if (before === undefined) {
      currentItems.set(itemId, after)
      continue
    }

    const parentPose = before.parentItemId === undefined
      ? createMotionRootPose()
      : boundary.before.items.get(before.parentItemId)?.rootPose
        ?? currentItems.get(before.parentItemId)?.rootPose
    currentItems.set(itemId, {
      ...before,
      targetId: after.targetId,
      targetOrder: after.targetOrder,
      localPose: after.localPose,
      rootPose: parentPose === undefined
        ? after.rootPose
        : composeMotionPose(parentPose, after.localPose),
    })
  }
}

/** Selects boundary participants without letting dependency snapshots overwrite sovereign movers. */
function resolveBoundaryItemIds(
  boundary: MotionBoundary,
  directMotionItemIds: ReadonlySet<string>,
  after: LayoutSnapshot,
): ReadonlySet<string> {
  const directItemIds = new Set(boundary.intents.map((intent) => intent.itemId))
  const reflowTargetIds = new Set<string>()
  for (const intent of boundary.intents) {
    if (intent.targetReflow !== true) continue
    const before = boundary.before.items.get(intent.itemId)
    const afterItem = after.items.get(intent.itemId)
    if (before !== undefined) reflowTargetIds.add(before.targetId)
    if (afterItem !== undefined) reflowTargetIds.add(afterItem.targetId)
  }

  const selected = new Set<string>()
  for (const itemId of new Set([...boundary.before.items.keys(), ...after.items.keys()])) {
    const before = boundary.before.items.get(itemId)
    const afterItem = after.items.get(itemId)
    const isReflowParticipant = (before !== undefined && reflowTargetIds.has(before.targetId))
      || (afterItem !== undefined && reflowTargetIds.has(afterItem.targetId))
    if (directItemIds.has(itemId) || isReflowParticipant || !directMotionItemIds.has(itemId)) selected.add(itemId)
  }
  addAncestorClosure(boundary.before, selected)
  addAncestorClosure(after, selected)
  return selected
}

/** Adds every measured ancestor required to compose one selected local pose. */
function addAncestorClosure(snapshot: LayoutSnapshot, selected: Set<string>): void {
  for (const itemId of [...selected]) {
    let parentItemId = snapshot.items.get(itemId)?.parentItemId
    while (parentItemId !== undefined) {
      selected.add(parentItemId)
      parentItemId = snapshot.items.get(parentItemId)?.parentItemId
    }
  }
}

/** Expands each boundary into ordered events at its real before/after times. */
function createSnapshotEvents(boundaries: readonly MotionBoundary[]): readonly SnapshotEvent[] {
  const events: SnapshotEvent[] = []
  boundaries.forEach((boundary, boundaryIndex) => {
    events.push({
      timeMs: boundary.before.timeMs,
      order: boundaryIndex * 2,
      phase: 'before',
      boundary,
      snapshot: boundary.before,
    })
    events.push({
      timeMs: boundary.after.timeMs,
      order: boundaryIndex * 2 + 1,
      phase: 'after',
      boundary,
      snapshot: boundary.after,
    })
  })
  return Object.freeze(events.sort((left, right) => left.timeMs - right.timeMs || left.order - right.order))
}

/** Resolves the immutable natural layout valid at one absolute time. */
export function resolveNaturalLayout(
  timeline: NaturalLayoutTimeline,
  timeMs: number,
): LayoutSnapshot {
  if (timeline.entries.length === 0) {
    return createSnapshot(timeMs, `${timeMs}:empty`, createMotionRootPose(), undefined, new Map())
  }

  let low = 0
  let high = timeline.entries.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (timeline.entries[middle]!.startAt <= timeMs) low = middle
    else high = middle - 1
  }
  return timeline.entries[low]!.snapshot
}

/** Resolves the natural layout immediately before one exact logical boundary. */
export function resolveNaturalLayoutBefore(
  timeline: NaturalLayoutTimeline,
  timeMs: number,
  boundaryId?: string,
): LayoutSnapshot {
  if (boundaryId !== undefined) {
    const boundarySnapshot = timeline.beforeByBoundaryId.get(boundaryId)
    if (boundarySnapshot !== undefined) return boundarySnapshot
  }
  if (timeline.entries.length === 0) {
    return createSnapshot(timeMs, `${timeMs}:empty`, createMotionRootPose(), undefined, new Map())
  }

  let low = 0
  let high = timeline.entries.length - 1
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2)
    if (timeline.entries[middle]!.startAt < timeMs) low = middle
    else high = middle - 1
  }
  return timeline.entries[low]!.snapshot
}

/** Applies the natural state observed immediately before one boundary. */
function applyBeforeSnapshot(
  snapshot: LayoutSnapshot,
  currentItems: Map<string, LayoutItemSnapshot>,
  selectedItemIds: ReadonlySet<string>,
  directMotionItemIds: ReadonlySet<string>,
  boundaryDirectItemIds: ReadonlySet<string>,
): void {
  for (const [itemId, item] of snapshot.items) {
    if (!selectedItemIds.has(itemId)) continue
    if (boundaryDirectItemIds.has(itemId) || !directMotionItemIds.has(itemId) || !currentItems.has(itemId)) {
      currentItems.set(itemId, item)
    }
  }
}

/** Applies one after snapshot while removing items explicitly absent after the boundary. */
function applyAfterSnapshot(
  before: LayoutSnapshot,
  after: LayoutSnapshot,
  currentItems: Map<string, LayoutItemSnapshot>,
  selectedItemIds: ReadonlySet<string>,
  directMotionItemIds: ReadonlySet<string>,
  boundaryDirectItemIds: ReadonlySet<string>,
): void {
  for (const itemId of before.items.keys()) {
    if (!selectedItemIds.has(itemId) || after.items.has(itemId)) continue
    if (boundaryDirectItemIds.has(itemId) || !directMotionItemIds.has(itemId)) currentItems.delete(itemId)
  }
  for (const [itemId, item] of after.items) {
    if (!selectedItemIds.has(itemId)) continue
    if (boundaryDirectItemIds.has(itemId) || !directMotionItemIds.has(itemId) || !currentItems.has(itemId)) {
      currentItems.set(itemId, item)
    }
  }
}

/** Freezes one assembled natural layout and detaches its item map from the builder. */
function createSnapshot(
  timeMs: number,
  revision: string,
  rootPose: LayoutSnapshot['rootPose'],
  rootKey: LayoutSnapshot['rootKey'],
  items: ReadonlyMap<string, LayoutItemSnapshot>,
): LayoutSnapshot {
  return Object.freeze({
    timeMs,
    revision: `${revision}:${timeMs}`,
    rootPose,
    ...(rootKey === undefined ? {} : { rootKey }),
    items: new Map(items),
  })
}
