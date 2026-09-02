import type { CompiledEventime, CompiledScene } from '../../scene/compiled'
import {
  MOVE_ORDER_MODE_APPEND,
  MOVE_ORDER_MODE_AUTO,
  MOVE_ORDER_MODE_FIRST,
  MOVE_ORDER_MODE_LAST,
  MOVE_ORDER_MODE_PREPEND,
  type MoveOrderMode,
} from '../config/move'
import { diffSolvedScenes, type MoveStateDelta } from '../move'
import type { SolvedScene } from './pipeline'
import type { RuntimeStructuralOrder } from '../engine'

/** One immutable child-order snapshot opened by a compiled event boundary. */
export type StructuralSnapshot = Readonly<{
  timeMs: number
  revision: string
  childrenByTarget: Readonly<Record<string, readonly string[]>>
}>

/** Resolves one structural ordering history independently of Play and Seek. */
export class StructuralTimeline {
  private readonly initial: StructuralSnapshot
  private readonly snapshots: readonly StructuralSnapshot[]

  /** Builds every order boundary once from pure solved scenes. */
  constructor(
    compiledScene: CompiledScene,
    resolveBaseSceneAt: (timeMs: number) => SolvedScene,
    resolveBaseSceneBefore: (timeMs: number) => SolvedScene,
    resolveStructuralOrder?: (
      previousOrder: RuntimeStructuralOrder,
      scene: SolvedScene,
      deltas: readonly MoveStateDelta[],
    ) => RuntimeStructuralOrder,
    runtimeEventTimes: readonly number[] = [],
  ) {
    const built = buildStructuralSnapshots(
      compiledScene,
      resolveBaseSceneAt,
      resolveBaseSceneBefore,
      resolveStructuralOrder,
      runtimeEventTimes,
    )
    this.initial = built.initial
    this.snapshots = built.snapshots
  }

  /** Returns the unique complete order valid at one absolute logical time. */
  resolveAt(timeMs: number): StructuralSnapshot {
    let resolved = this.initial
    for (const snapshot of this.snapshots) {
      if (snapshot.timeMs > timeMs) break
      resolved = snapshot
    }
    return resolved
  }

  /** Returns the complete order immediately before one event boundary. */
  resolveBefore(timeMs: number): StructuralSnapshot {
    let resolved = this.initial
    for (const snapshot of this.snapshots) {
      if (snapshot.timeMs >= timeMs) break
      resolved = snapshot
    }
    return resolved
  }

  /** Returns every event boundary in chronological order. */
  getBoundaries(): readonly StructuralSnapshot[] {
    return this.snapshots
  }
}

/** Collects every compiled event boundary used by state and movement planning. */
export function collectCompiledEventStartTimes(scene: CompiledScene): readonly number[] {
  const times = new Set<number>()
  collectEventTimes(scene.scene.eventimes ?? [], 0, times)
  for (const story of Object.values(scene.scene.stories)) collectEventTimes(story.eventimes ?? [], 0, times)
  return [...times].sort((left, right) => left - right)
}

/** Builds deterministic structural states without a live module reducer. */
function buildStructuralSnapshots(
  compiledScene: CompiledScene,
  resolveBaseSceneAt: (timeMs: number) => SolvedScene,
  resolveBaseSceneBefore: (timeMs: number) => SolvedScene,
  resolveStructuralOrder?: (
    previousOrder: RuntimeStructuralOrder,
    scene: SolvedScene,
    deltas: readonly MoveStateDelta[],
  ) => RuntimeStructuralOrder,
  runtimeEventTimes: readonly number[] = [],
): Readonly<{ initial: StructuralSnapshot; snapshots: readonly StructuralSnapshot[] }> {
  let previousScene = resolveBaseSceneBefore(0)
  let order = cloneOrder(previousScene.graph.childrenByTarget)
  const initial = createSnapshot(0, order)
  const snapshots: StructuralSnapshot[] = []
  const startTimes = collectStructuralEventStartTimes(compiledScene, runtimeEventTimes)
  if (startTimes[0] !== 0) snapshots.push(initial)

  for (const timeMs of startTimes) {
    const nextScene = resolveBaseSceneAt(timeMs)
    const deltas = diffSolvedScenes(previousScene, nextScene)
    order = resolveStructuralOrder === undefined
      ? applyStructuralDeltas(order, nextScene, deltas)
      : resolveStructuralOrder(order, nextScene, deltas)
    snapshots.push(createSnapshot(timeMs, order))
    previousScene = nextScene
  }
  return Object.freeze({ initial, snapshots: Object.freeze(snapshots) })
}

/** Combines immutable compiled and journaled runtime boundaries once per rebuild. */
function collectStructuralEventStartTimes(
  compiledScene: CompiledScene,
  runtimeEventTimes: readonly number[],
): readonly number[] {
  return [...new Set([
    ...collectCompiledEventStartTimes(compiledScene),
    ...runtimeEventTimes.filter((timeMs) => Number.isFinite(timeMs) && timeMs >= 0),
  ])].sort((left, right) => left - right)
}

/** Applies one complete event boundary through the default structural policy. */
export function applyStructuralDeltas(
  previousOrder: Readonly<Record<string, readonly string[]>>,
  nextScene: SolvedScene,
  deltas: readonly MoveStateDelta[],
  policy?: StructuralOrderPolicy,
): Readonly<Record<string, readonly string[]>> {
  const order = new Map<string, string[]>(Object.entries(previousOrder).map(([targetId, itemIds]) => [targetId, [...itemIds]]))

  for (const delta of deltas) {
    const fromTargetId = delta.fromTargetId
    const toTargetId = delta.toTargetId
    const sameTarget = fromTargetId !== undefined && fromTargetId === toTargetId
    const previousIndex = fromTargetId === undefined ? -1 : (order.get(fromTargetId) ?? []).indexOf(delta.persoKey)
    const targetOperation = delta.operation === 'mount' || !sameTarget ? 'add' : 'move'
    const shouldReorder = policy?.shouldReorder(
      targetOperation,
      toTargetId,
      delta.toPlacement?.mode,
      delta.toPlacement?.reorder,
    ) ?? delta.toPlacement?.reorder !== false
    const shouldReorderOnRemove = fromTargetId === undefined || sameTarget
      ? shouldReorder
      : policy?.shouldReorder(
        'remove',
        fromTargetId,
        delta.toPlacement?.mode,
        delta.toPlacement?.reorder,
      ) ?? true

    policy?.onDelta?.(delta, {
      sameTarget,
      targetReordered: shouldReorder,
      sourceReordered: shouldReorderOnRemove,
    })

    if (fromTargetId !== undefined && (!sameTarget || shouldReorder)) removeItem(order, fromTargetId, delta.persoKey)
    if (!delta.mountedAfter || toTargetId === undefined) continue

    if (sameTarget && !shouldReorder && previousIndex >= 0) {
      insertAt(order, toTargetId, delta.persoKey, previousIndex)
      continue
    }
    insertByMode(order, toTargetId, delta.persoKey, shouldReorder ? delta.toPlacement?.mode : undefined)
  }

  reconcileMembership(order, nextScene)
  if (policy?.resolveTargetOrder === undefined) {
    for (const delta of deltas) {
      if (delta.fromTargetId !== undefined
        && (delta.operation === 'unmount' || delta.fromTargetId !== delta.toTargetId)
        && (policy?.shouldReorder(
          'remove',
          delta.fromTargetId,
          delta.toPlacement?.mode,
          delta.toPlacement?.reorder,
        ) ?? true)) {
        reapplyPersistentEdges(order, nextScene, delta.fromTargetId)
      }
    }
  } else {
    for (const [targetId, itemIds] of order) {
      order.set(targetId, [...policy.resolveTargetOrder(targetId, itemIds, nextScene)])
    }
  }
  return freezeOrder(order)
}

/** Policy used by one capability to decide whether an order may change. */
export type StructuralOrderPolicy = Readonly<{
  shouldReorder: (
    operation: 'add' | 'move' | 'remove',
    targetId: string | undefined,
    mode: MoveOrderMode | undefined,
    reorder: boolean | undefined,
  ) => boolean
  onDelta?: (delta: MoveStateDelta, context: StructuralOrderDeltaContext) => void
  resolveTargetOrder?: (
    targetId: string,
    itemIds: readonly string[],
    scene: SolvedScene,
  ) => readonly string[]
}>

/** Structural facts exposed to a capability while one boundary is reduced. */
export type StructuralOrderDeltaContext = Readonly<{
  sameTarget: boolean
  targetReordered: boolean
  sourceReordered: boolean
}>

/** Reconciles reducer output with the exact solved target membership. */
function reconcileMembership(order: Map<string, string[]>, scene: SolvedScene): void {
  const targets = new Set([...order.keys(), ...Object.keys(scene.graph.childrenByTarget)])
  for (const targetId of targets) {
    const expected = scene.graph.childrenByTarget[targetId] ?? []
    const expectedSet = new Set(expected)
    const current = (order.get(targetId) ?? []).filter((itemId) => expectedSet.has(itemId))
    for (const itemId of expected) if (!current.includes(itemId)) current.push(itemId)
    order.set(targetId, current)
  }
}

/** Reapplies persistent first/last placement policies after one removal. */
function reapplyPersistentEdges(order: Map<string, string[]>, scene: SolvedScene, targetId: string): void {
  const itemIds = order.get(targetId)
  if (itemIds === undefined) return
  for (const itemId of [...itemIds]) {
    const mode = scene.persos[itemId]?.placement.mode
    if (mode === MOVE_ORDER_MODE_FIRST || mode === MOVE_ORDER_MODE_PREPEND) {
      removeItem(order, targetId, itemId)
      insertAt(order, targetId, itemId, 0)
    } else if (mode === MOVE_ORDER_MODE_LAST || mode === MOVE_ORDER_MODE_APPEND) {
      removeItem(order, targetId, itemId)
      insertAt(order, targetId, itemId, itemIds.length)
    }
  }
}

/** Inserts one item according to the generic move order contract. */
function insertByMode(order: Map<string, string[]>, targetId: string, itemId: string, mode?: MoveOrderMode): void {
  const itemIds = order.get(targetId) ?? []
  order.set(targetId, itemIds)
  if (itemIds.includes(itemId)) return
  if (mode === MOVE_ORDER_MODE_FIRST || mode === MOVE_ORDER_MODE_PREPEND) insertAt(order, targetId, itemId, 0)
  else if (typeof mode === 'number' && Number.isFinite(mode)) insertAt(order, targetId, itemId, mode)
  else if (mode === MOVE_ORDER_MODE_AUTO || mode === MOVE_ORDER_MODE_LAST || mode === MOVE_ORDER_MODE_APPEND || mode === undefined) {
    insertAt(order, targetId, itemId, itemIds.length)
  }
}

/** Inserts one item at a bounded index after removing any previous occurrence. */
function insertAt(order: Map<string, string[]>, targetId: string, itemId: string, index: number): void {
  const itemIds = order.get(targetId) ?? []
  const existing = itemIds.indexOf(itemId)
  if (existing >= 0) itemIds.splice(existing, 1)
  itemIds.splice(Math.max(0, Math.min(Math.trunc(index), itemIds.length)), 0, itemId)
  order.set(targetId, itemIds)
}

/** Removes one item from one target order when present. */
function removeItem(order: Map<string, string[]>, targetId: string, itemId: string): void {
  const itemIds = order.get(targetId)
  if (itemIds === undefined) return
  const index = itemIds.indexOf(itemId)
  if (index >= 0) itemIds.splice(index, 1)
}

/** Creates one frozen snapshot with a stable structural revision. */
function createSnapshot(timeMs: number, order: Readonly<Record<string, readonly string[]>>): StructuralSnapshot {
  const childrenByTarget = Object.freeze(Object.fromEntries(
    Object.entries(order).map(([targetId, itemIds]) => [targetId, Object.freeze([...itemIds])]),
  ))
  return Object.freeze({ timeMs, revision: JSON.stringify(childrenByTarget), childrenByTarget })
}

/** Clones one solved order for the mutable boundary reducer. */
function cloneOrder(order: Readonly<Record<string, readonly string[]>>): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(Object.entries(order).map(([targetId, itemIds]) => [targetId, [...itemIds]]))
}

/** Freezes one mutable order map after a complete boundary. */
function freezeOrder(order: ReadonlyMap<string, readonly string[]>): Readonly<Record<string, readonly string[]>> {
  const entries = [...order].map(([targetId, itemIds]) => [targetId, Object.freeze([...itemIds])])
  return Object.freeze(Object.fromEntries(entries))
}

/** Flattens nested eventimes into absolute boundaries. */
function collectEventTimes(eventimes: readonly CompiledEventime[], parentStartAt: number, times: Set<number>): void {
  for (const event of eventimes) {
    const startAt = parentStartAt + event.startAt
    times.add(startAt)
    collectEventTimes(event.events ?? [], startAt, times)
  }
}
