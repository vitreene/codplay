import { createMotionRootPose } from './motion-pose'
import type { LayoutItemSnapshot, LayoutSnapshot, MotionBoundary } from './types'

/** One immutable natural-layout state valid from a logical boundary onward. */
export type NaturalLayoutEntry = Readonly<{
  startAt: number
  snapshot: LayoutSnapshot
}>

/** Timeline of natural layouts assembled once from captured boundary snapshots. */
export type NaturalLayoutTimeline = Readonly<{
  entries: readonly NaturalLayoutEntry[]
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
  const directMotionItemIds = new Set(boundaries.flatMap((boundary) => boundary.intents.map((intent) => intent.itemId)))
  const currentItems = new Map<string, LayoutItemSnapshot>()
  let currentRootPose = createMotionRootPose()
  let currentRevision = 'empty'

  for (const event of events) {
    const boundaryItemIds = resolveBoundaryItemIds(event.boundary, directMotionItemIds)
    if (event.phase === 'before') applyBeforeSnapshot(event.snapshot, currentItems, boundaryItemIds)
    else applyAfterSnapshot(event.boundary.before, event.snapshot, currentItems, boundaryItemIds)
    if (event.snapshot.rootPose !== undefined) currentRootPose = event.snapshot.rootPose
    currentRevision = event.snapshot.revision

    const startAt = entries.length === 0 ? Number.NEGATIVE_INFINITY : event.timeMs
    entries.push({
      startAt,
      snapshot: createSnapshot(event.timeMs, currentRevision, currentRootPose, currentItems),
    })
  }

  return Object.freeze({ entries: Object.freeze(entries) })
}

/** Selects boundary participants without letting dependency snapshots overwrite sovereign movers. */
function resolveBoundaryItemIds(
  boundary: MotionBoundary,
  directMotionItemIds: ReadonlySet<string>,
): ReadonlySet<string> {
  const directItemIds = new Set(boundary.intents.map((intent) => intent.itemId))
  const reflowTargetIds = new Set<string>()
  for (const intent of boundary.intents) {
    if (intent.targetReflow !== true) continue
    const before = boundary.before.items.get(intent.itemId)
    const after = boundary.after.items.get(intent.itemId)
    if (before !== undefined) reflowTargetIds.add(before.targetId)
    if (after !== undefined) reflowTargetIds.add(after.targetId)
  }

  const selected = new Set<string>()
  for (const itemId of new Set([...boundary.before.items.keys(), ...boundary.after.items.keys()])) {
    const before = boundary.before.items.get(itemId)
    const after = boundary.after.items.get(itemId)
    const isReflowParticipant = (before !== undefined && reflowTargetIds.has(before.targetId))
      || (after !== undefined && reflowTargetIds.has(after.targetId))
    if (directItemIds.has(itemId) || isReflowParticipant || !directMotionItemIds.has(itemId)) selected.add(itemId)
  }
  return selected
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
    return createSnapshot(timeMs, `${timeMs}:empty`, createMotionRootPose(), new Map())
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

/** Applies the natural state observed immediately before one boundary. */
function applyBeforeSnapshot(
  snapshot: LayoutSnapshot,
  currentItems: Map<string, LayoutItemSnapshot>,
  selectedItemIds: ReadonlySet<string>,
): void {
  for (const [itemId, item] of snapshot.items) {
    if (selectedItemIds.has(itemId)) currentItems.set(itemId, item)
  }
}

/** Applies one after snapshot while removing items explicitly absent after the boundary. */
function applyAfterSnapshot(
  before: LayoutSnapshot,
  after: LayoutSnapshot,
  currentItems: Map<string, LayoutItemSnapshot>,
  selectedItemIds: ReadonlySet<string>,
): void {
  for (const itemId of before.items.keys()) {
    if (selectedItemIds.has(itemId) && !after.items.has(itemId)) currentItems.delete(itemId)
  }
  for (const [itemId, item] of after.items) {
    if (selectedItemIds.has(itemId)) currentItems.set(itemId, item)
  }
}

/** Freezes one assembled natural layout and detaches its item map from the builder. */
function createSnapshot(
  timeMs: number,
  revision: string,
  rootPose: LayoutSnapshot['rootPose'],
  items: ReadonlyMap<string, LayoutItemSnapshot>,
): LayoutSnapshot {
  return Object.freeze({
    timeMs,
    revision: `${revision}:${timeMs}`,
    rootPose,
    items: new Map(items),
  })
}
