import { buildSolvedGraph, type SolvedPerso, type SolvedScene } from '../../player'
import {
  decomposeRootMotionPose,
  deriveRelativeMotionPose,
  type LayoutSnapshot,
  type PresentationFrame,
  type ScheduledMotionIntent,
} from '../../motion'

/** Replaces selected live FIRST poses with the latest transient presentation frame. */
export function mergeCurrentPresentationPoses(
  snapshot: LayoutSnapshot,
  frame: PresentationFrame | undefined,
  itemIds: ReadonlySet<string>,
): LayoutSnapshot {
  if (frame === undefined || itemIds.size === 0) return snapshot

  const items = new Map(snapshot.items)
  let changed = false
  for (const itemId of itemIds) {
    const captured = items.get(itemId)
    const presented = frame.items.get(itemId)
    if (captured === undefined || presented === undefined) continue

    const parentPose = captured.parentItemId === undefined
      ? undefined
      : frame.items.get(captured.parentItemId)?.pose
        ?? items.get(captured.parentItemId)?.rootPose
    const localPose = parentPose === undefined
      ? decomposeRootMotionPose(presented.pose)
      : deriveRelativeMotionPose(parentPose, presented.pose)
    items.set(itemId, Object.freeze({
      ...captured,
      localPose,
      rootPose: presented.pose,
      ...(presented.motionRootKey === undefined ? {} : { motionRootKey: presented.motionRootKey }),
      ...(presented.motionRootPose === undefined ? {} : { motionRootPose: presented.motionRootPose }),
    }))
    changed = true
  }

  if (!changed) return snapshot
  return Object.freeze({
    ...snapshot,
    revision: `${snapshot.revision}:current-presentation:${frame.timeMs}:${frame.graphRevision}`,
    items,
  })
}

/** Builds the runner-local key for a visible FIRST snapshot. */
export function createMotionFirstSnapshotKey(itemId: string, startAt: number): string {
  return `${itemId}:${startAt}`
}

/** Selects direct movers, source/target siblings and their ancestor closure. */
export function collectBoundarySelection(
  before: SolvedScene,
  after: SolvedScene,
  intents: readonly ScheduledMotionIntent[],
  storyIds: readonly string[],
): ReadonlySet<string> {
  const selected = new Set<string>()
  for (const intent of intents) {
    selected.add(intent.itemId)
    if (intent.targetReflow) {
      addTargetContainer(before, before.graph.targetByPerso[intent.itemId], selected)
      addTargetContainer(after, after.graph.targetByPerso[intent.itemId], selected)
      addTargetChildren(before, before.graph.targetByPerso[intent.itemId], selected)
      addTargetChildren(after, after.graph.targetByPerso[intent.itemId], selected)
    }
  }
  addAncestorClosure(before, selected, storyIds)
  addAncestorClosure(after, selected, storyIds)
  return selected
}

/** Selects a mounted perso used directly as a structural move target. */
function addTargetContainer(
  scene: SolvedScene,
  targetId: string | undefined,
  selected: Set<string>,
): void {
  if (targetId === undefined) return
  const target = Object.values(scene.persos).find((perso) => perso.persoId === targetId && perso.placement.mounted)
  if (target !== undefined) selected.add(target.key)
}

/** Adds every mounted child currently assigned to one target. */
function addTargetChildren(
  scene: SolvedScene,
  targetId: string | undefined,
  selected: Set<string>,
): void {
  if (targetId === undefined) return
  for (const itemId of scene.graph.childrenByTarget[targetId] ?? []) selected.add(itemId)
}

/** Adds logical parent chains required to derive FIRST/LAST context. */
function addAncestorClosure(scene: SolvedScene, selected: Set<string>, storyIds: readonly string[]): void {
  for (const itemId of [...selected]) {
    let parentItemId = scene.graph.parentByPerso[itemId]
    while (parentItemId !== undefined) {
      if (storyIds.length > 0 && !storyIds.includes(scene.persos[parentItemId]?.storyId ?? '')) break
      selected.add(parentItemId)
      parentItemId = scene.graph.parentByPerso[parentItemId]
    }
  }
}

/** Finds direct movers that have no measurable FIRST because an ancestor is detached. */
export function resolveMissingSourceItemIds(
  before: SolvedScene,
  after: SolvedScene,
  intents: readonly ScheduledMotionIntent[],
): readonly string[] {
  return Object.freeze([...new Set(intents
    .map((intent) => intent.itemId)
    .filter((itemId) => before.persos[itemId]?.placement.mounted !== true
      && after.persos[itemId]?.placement.mounted === true
      && before.persos[itemId]?.placement.targetId !== undefined))])
}

/** Builds a capture-only scene with FIRST movers attached to LAST-mounted context. */
export function createMissingSourceCaptureScene(
  before: SolvedScene,
  after: SolvedScene,
  sourceItemIds: readonly string[],
): SolvedScene | undefined {
  const persos: Record<string, SolvedPerso> = { ...after.persos }
  let prepared = false
  for (const itemId of sourceItemIds) {
    const sourcePerso = before.persos[itemId]
    const destinationPerso = after.persos[itemId]
    if (sourcePerso === undefined || destinationPerso?.placement.mounted !== true) continue
    if (sourcePerso.placement.targetId === undefined || sourcePerso.placement.target === undefined) continue

    const sourceParentId = before.graph.parentByPerso[itemId]
    if (sourceParentId !== undefined && after.persos[sourceParentId]?.placement.mounted !== true) continue

    persos[itemId] = {
      ...sourcePerso,
      placement: { ...sourcePerso.placement, mounted: true },
    }
    prepared = true
  }
  if (!prepared) return undefined

  return {
    ...after,
    persos,
    graph: buildSolvedGraph(persos, resolveCaptureOrder(before, after, persos)),
  }
}

/** Keeps authored child order while allowing a capture-only source reparent. */
function resolveCaptureOrder(
  before: SolvedScene,
  after: SolvedScene,
  persos: Readonly<Record<string, SolvedPerso>>,
): Readonly<Record<string, readonly string[]>> {
  const targetIds = new Set(Object.values(persos)
    .filter((perso) => perso.placement.mounted && perso.placement.targetId !== undefined)
    .map((perso) => perso.placement.targetId!))
  const result: Record<string, readonly string[]> = {}
  for (const targetId of targetIds) {
    const natural = new Set(Object.values(persos)
      .filter((perso) => perso.placement.mounted && perso.placement.targetId === targetId)
      .map((perso) => perso.key))
    const candidates = [
      ...(after.graph.childrenByTarget[targetId] ?? []),
      ...(before.graph.childrenByTarget[targetId] ?? []),
      ...Object.keys(persos),
    ]
    result[targetId] = Object.freeze([...new Set(candidates)].filter((itemId) => natural.has(itemId)))
  }
  return Object.freeze(result)
}

/** Merges one capture-only source measurement into the ordinary FIRST snapshot. */
export function mergeLayoutSnapshots(
  base: LayoutSnapshot,
  source: LayoutSnapshot,
  sourceItemIds: readonly string[],
): LayoutSnapshot {
  const items = new Map(base.items)
  const mergeIds = resolveSourceMergeItemIds(source, sourceItemIds)
  for (const itemId of mergeIds) {
    const item = source.items.get(itemId)
    if (item !== undefined) items.set(itemId, item)
  }
  return Object.freeze({
    ...base,
    revision: `${base.revision}:missing-source:${source.revision}`,
    items,
  })
}

/** Keeps only each hybrid mover and the ancestor context needed to attach it. */
function resolveSourceMergeItemIds(
  source: LayoutSnapshot,
  sourceItemIds: readonly string[],
): ReadonlySet<string> {
  const mergeIds = new Set<string>()
  for (const sourceItemId of sourceItemIds) {
    let itemId: string | undefined = sourceItemId
    while (itemId !== undefined && !mergeIds.has(itemId)) {
      mergeIds.add(itemId)
      const item = source.items.get(itemId)
      itemId = item?.parentItemId
    }
  }
  return mergeIds
}
