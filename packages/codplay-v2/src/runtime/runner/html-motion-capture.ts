import type { RuntimePlayer } from '../player'
import {
  captureHtmlLayoutSnapshot,
} from './html-layout-snapshot'
import type {
  LayoutSnapshot,
  MotionBoundary,
  MotionIntent,
  ScheduledMotionIntent,
} from '../motion'
import type { SolvedScene } from '../player'

/** Captures the current visible geometry needed by one motion presentation. */
export function captureCurrentHtmlMotionLayout(
  root: Element,
  nodes: ReadonlyMap<string, unknown>,
  scene: SolvedScene,
  itemIds: ReadonlySet<string>,
): LayoutSnapshot {
  return captureHtmlLayoutSnapshot(root, nodes, scene, itemIds)
}

/**
 * Presents each compiled boundary on one persistent visible host and retains
 * only its before/after geometry. No player, engine, materializer or DOM tree
 * is created by this operation.
 */
export function captureHtmlMotionBoundaries(input: Readonly<{
  player: RuntimePlayer
  root: Element
  nodes: ReadonlyMap<string, unknown>
  intents: readonly ScheduledMotionIntent[]
  includePersistOnly: boolean
}>): readonly MotionBoundary[] {
  const currentScene = input.player.getSolvedScene()
  if (currentScene === undefined || input.intents.length === 0) return []

  const boundaries: MotionBoundary[] = []
  try {
    for (const [timeMs, scheduledIntents] of groupMotionIntents(input.intents)) {
      const beforeScene = input.player.resolveSceneBeforeBoundary(timeMs, input.includePersistOnly)
      const afterScene = input.player.resolveSceneAt(timeMs, input.includePersistOnly)
      const selection = collectBoundarySelection(beforeScene, afterScene, scheduledIntents)

      input.player.presentSceneForGeometryCapture(beforeScene)
      const before = captureCurrentHtmlMotionLayout(input.root, input.nodes, beforeScene, selection)
      input.player.presentSceneForGeometryCapture(afterScene)
      const after = captureCurrentHtmlMotionLayout(input.root, input.nodes, afterScene, selection)
      const intents = scheduledIntents.map(toMotionIntent)
      boundaries.push(Object.freeze({
        id: `boundary:${timeMs}:${intents.map((intent) => intent.id).join(',')}`,
        timeMs,
        before,
        after,
        intents: Object.freeze(intents),
      }))
    }
  } finally {
    // The normal player presentation remains the authority for media/module
    // side effects. This final geometry-only restore prevents the capture pass
    // from leaving a historical boundary visible to the author.
    input.player.presentSceneForGeometryCapture(currentScene)
  }
  return Object.freeze(boundaries)
}

/**
 * Completes one live boundary from the visible FIRST snapshot captured before
 * an event close and the visible LAST materialization produced by that close.
 */
export function captureHtmlLiveMotionBoundary(input: Readonly<{
  player: RuntimePlayer
  root: Element
  nodes: ReadonlyMap<string, unknown>
  first: LayoutSnapshot
  intents: readonly ScheduledMotionIntent[]
}>): readonly MotionBoundary[] {
  const afterScene = input.player.getSolvedScene()
  if (afterScene === undefined || input.intents.length === 0) return []
  const boundaries: MotionBoundary[] = []
  for (const [timeMs, scheduledIntents] of groupMotionIntents(input.intents)) {
    const selection = collectBoundarySelection(
      input.player.resolveSceneBeforeBoundary(timeMs, false),
      afterScene,
      scheduledIntents,
    )
    const after = captureCurrentHtmlMotionLayout(input.root, input.nodes, afterScene, selection)
    const intents = scheduledIntents.map(toMotionIntent)
    boundaries.push(Object.freeze({
      id: `boundary:live:${timeMs}:${intents.map((intent) => intent.id).join(',')}`,
      timeMs,
      before: input.first,
      after,
      intents: Object.freeze(intents),
    }))
  }
  return Object.freeze(boundaries)
}

/** Converts one scheduled intent to the pure graph boundary contract. */
function toMotionIntent(intent: ScheduledMotionIntent): MotionIntent {
  return Object.freeze({
    id: intent.id,
    itemId: intent.itemId,
    startAt: intent.startAt,
    duration: intent.duration,
    ease: intent.ease,
    presentationMode: intent.presentationMode,
    ...(intent.path === undefined ? {} : { path: intent.path }),
  })
}

/** Groups simultaneous direct moves into one browser capture transaction. */
function groupMotionIntents(
  intents: readonly ScheduledMotionIntent[],
): ReadonlyMap<number, readonly ScheduledMotionIntent[]> {
  const grouped = new Map<number, ScheduledMotionIntent[]>()
  for (const intent of intents) {
    // A capture closed at t=0 may receive the documented default persist
    // duration and therefore an anchor below the playable timeline. Such a
    // fact is journaled, but it has no materializable motion boundary.
    if (intent.startAt < 0) continue
    const entries = grouped.get(intent.startAt) ?? []
    entries.push(intent)
    grouped.set(intent.startAt, entries)
  }
  return new Map([...grouped].sort(([left], [right]) => left - right))
}

/**
 * Selects direct movers, source/target siblings and their ancestor closure.
 * Unrelated branches are not read by the geometry capture.
 */
function collectBoundarySelection(
  before: SolvedScene,
  after: SolvedScene,
  intents: readonly ScheduledMotionIntent[],
): ReadonlySet<string> {
  const selected = new Set<string>()
  for (const intent of intents) {
    selected.add(intent.itemId)
    addTargetChildren(before, before.graph.targetByPerso[intent.itemId], selected)
    addTargetChildren(after, after.graph.targetByPerso[intent.itemId], selected)
  }
  addAncestorClosure(before, selected)
  addAncestorClosure(after, selected)
  return selected
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

/** Adds mounted parent chains required to derive local poses. */
function addAncestorClosure(scene: SolvedScene, selected: Set<string>): void {
  for (const itemId of [...selected]) {
    let parentItemId = scene.graph.parentByPerso[itemId]
    while (parentItemId !== undefined) {
      const parent = scene.persos[parentItemId]
      if (parent?.placement.mounted) selected.add(parentItemId)
      parentItemId = scene.graph.parentByPerso[parentItemId]
    }
  }
}
