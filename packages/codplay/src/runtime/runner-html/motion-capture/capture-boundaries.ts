import type { RuntimePlayer, SolvedScene } from '../../player'
import { captureHtmlLayoutSnapshot } from '../layout-snapshot'
import type {
  LayoutSnapshot,
  MotionBoundary,
  ScheduledMotionIntent,
} from '../../motion'
import {
  expandLateDestinationAncestorIntents,
  groupMotionIntents,
  resolveIntermediateKeyTimes,
  resolveMotionEndpointTime,
  toMotionIntent,
} from './capture-intents'
import {
  collectBoundarySelection,
  createMissingSourceCaptureScene,
  createMotionFirstSnapshotKey,
  mergeLayoutSnapshots,
  resolveMissingSourceItemIds,
} from './capture-snapshots'
import type {
  HtmlMotionContainerResolution,
  HtmlMotionContainerSceneInput,
} from '../motion-container'

/**
 * Presents each compiled boundary on one persistent visible host and retains
 * only its captured geometry. The player resolves the same scene at each
 * declared endpoint before the DOM pose is measured; no player, engine,
 * materializer or DOM tree is created by this operation.
 */
export function captureHtmlMotionBoundaries(input: Readonly<{
  player: RuntimePlayer
  root: Element
  nodes: ReadonlyMap<string, unknown>
  intents: readonly ScheduledMotionIntent[]
  includePersistOnly: boolean
  /** Preserves the visible pose when a new occurrence replaces stale plans. */
  firstSnapshots?: ReadonlyMap<string, LayoutSnapshot>
  /** Resolves the effective endpoint of a move replacing an active segment. */
  resolveActiveMotionEndAt?: (itemId: string, startAt: number, requestedEndAt: number) => number | undefined
  resolveMotionContainer?: (input: HtmlMotionContainerSceneInput) => HtmlMotionContainerResolution
}>): readonly MotionBoundary[] {
  const currentScene = input.player.getSolvedScene()
  if (currentScene === undefined || input.intents.length === 0) return []

  const activeMotionEndCache = new Map<string, number | undefined>()
  const resolveActiveMotionEndAt = input.resolveActiveMotionEndAt === undefined
    ? undefined
    : (itemId: string, startAt: number, requestedEndAt: number): number | undefined => {
      const key = `${itemId}:${startAt}:${requestedEndAt}`
      if (activeMotionEndCache.has(key)) return activeMotionEndCache.get(key)
      const resolved = input.resolveActiveMotionEndAt!(itemId, startAt, requestedEndAt)
      activeMotionEndCache.set(key, resolved)
      return resolved
    }

  // A structural move can reach a destination whose ancestor is mounted by a
  // later move before this move's endpoint. Preserve the existing FIRST/LAST
  // contract by preparing that narrow ancestor closure in the same capture;
  // this replaces the old full-schedule preparation removed by occurrence
  // discovery, without reopening a journal-wide scan.
  const captureIntents = expandLateDestinationAncestorIntents({
    player: input.player,
    intents: input.intents,
    includePersistOnly: input.includePersistOnly,
    resolveActiveMotionEndAt,
  })
  const boundaries: MotionBoundary[] = []
  try {
    for (const group of groupMotionIntents(captureIntents, currentScene)) {
      // FIRST is the logical state immediately before the event. For a
      // structural move, the destination may be mounted only after that
      // boundary, so it is deliberately not required to exist here.
      const beforeScene = group.structural
        ? input.player.resolveSceneBeforeBoundary(group.startAt, input.includePersistOnly)
        : input.player.resolveSceneAt(group.startAt, input.includePersistOnly)
      const afterStartScene = group.structural
        ? input.player.resolveSceneAt(group.startAt, input.includePersistOnly)
        : undefined
      const endpointTime = resolveMotionEndpointTime(
        input.player,
        group.storyIds,
        group.startAt,
        group.endAt,
        input.includePersistOnly,
        group.intents,
        resolveActiveMotionEndAt,
      )
      // The logical move is committed at startAt, but its geometric LAST is
      // the transition endpoint. Resolve the left side of that endpoint so a
      // following event scheduled at the exact same time is not imported into
      // the preceding move. The current move is already included because its
      // startAt is earlier than endAt. The same boundary data is then consumed
      // by Play and Seek.
      const afterScene = input.player.resolveSceneBeforeBoundary(endpointTime, input.includePersistOnly)
      const keyTimes = resolveIntermediateKeyTimes(group.intents, group.startAt, endpointTime)
      const keyScenes = keyTimes.map((timeMs) => Object.freeze({
        timeMs,
        scene: input.player.resolveSceneBeforeBoundary(timeMs, input.includePersistOnly),
      }))
      const selection = mergeSelections(
        collectBoundarySelection(beforeScene, afterScene, group.intents, group.storyIds),
        afterStartScene === undefined
          ? []
          : collectBoundarySelection(beforeScene, afterStartScene, group.intents, group.storyIds),
        ...keyScenes.map(({ scene }) => collectBoundarySelection(beforeScene, scene, group.intents, group.storyIds)),
      )
      const motionContainer = input.resolveMotionContainer?.({
        root: input.root,
        scenes: [beforeScene, ...(afterStartScene === undefined ? [] : [afterStartScene]), afterScene],
        itemIds: [...new Set(group.intents.map((intent) => intent.itemId))],
        storyIds: group.storyIds,
      })
      const captureRoot = motionContainer?.element ?? input.root
      const rootKey = motionContainer?.key

      input.player.presentSceneForGeometryCapture(beforeScene)
      let before = resolveFirstSnapshot(group, input.firstSnapshots)
        ?? captureHtmlLayoutSnapshot(captureRoot, input.nodes, beforeScene, selection, rootKey)
      const afterStart = afterStartScene === undefined
        ? undefined
        : captureStartLayout(afterStartScene, selection, captureRoot, rootKey)
      const keyframes: LayoutSnapshot[] = []
      for (const { scene } of keyScenes) {
        input.player.presentSceneForGeometryCapture(scene)
        keyframes.push(captureHtmlLayoutSnapshot(captureRoot, input.nodes, scene, selection, rootKey))
      }
      input.player.presentSceneForGeometryCapture(afterScene)
      const missingSourceItemIds = group.structural
        ? resolveMissingSourceItemIds(beforeScene, afterScene, group.intents)
        : []
      if (missingSourceItemIds.length > 0) {
        const sourceScene = createMissingSourceCaptureScene(beforeScene, afterScene, missingSourceItemIds)
        if (sourceScene !== undefined) {
          // This is a capture-only composition: it uses FIRST item state with
          // LAST-mounted ancestors on the same persistent author nodes. It
          // creates no analysis DOM and is restored before LAST is captured.
          input.player.presentSceneForGeometryCapture(sourceScene)
          const source = captureHtmlLayoutSnapshot(captureRoot, input.nodes, sourceScene, selection, rootKey)
          before = mergeLayoutSnapshots(before, source, missingSourceItemIds)
          input.player.presentSceneForGeometryCapture(afterScene)
        }
      }
      const after = captureHtmlLayoutSnapshot(captureRoot, input.nodes, afterScene, selection, rootKey)
      const intents = group.intents.map(toMotionIntent)
      boundaries.push(Object.freeze({
        id: `boundary:${group.startAt}:${group.endAt}:${intents.map((intent) => intent.id).join(',')}`,
        timeMs: group.startAt,
        storyIds: group.storyIds,
        before,
        ...(afterStart === undefined ? {} : { afterStart }),
        after,
        ...(keyframes.length === 0 ? {} : { keyframes: Object.freeze(keyframes) }),
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

  /** Captures the post-boundary structural layout before endpoint-only events. */
  function captureStartLayout(
    scene: SolvedScene,
    selection: ReadonlySet<string>,
    root: Element,
    rootKey: string | undefined,
  ): LayoutSnapshot {
    input.player.presentSceneForGeometryCapture(scene)
    return captureHtmlLayoutSnapshot(root, input.nodes, scene, selection, rootKey)
  }
}

/** Resolves the optional current-presentation snapshot for one motion group. */
function resolveFirstSnapshot(
  group: Readonly<{ intents: readonly ScheduledMotionIntent[] }>,
  firstSnapshots: ReadonlyMap<string, LayoutSnapshot> | undefined,
): LayoutSnapshot | undefined {
  if (firstSnapshots === undefined) return undefined
  for (const intent of group.intents) {
    const snapshot = firstSnapshots.get(createMotionFirstSnapshotKey(intent.itemId, intent.startAt))
    if (snapshot !== undefined) return snapshot
  }
  return undefined
}

/** Unions the selected branches required by two boundary layout states. */
function mergeSelections(
  ...selections: readonly (ReadonlySet<string> | readonly string[])[]
): ReadonlySet<string> {
  const merged = new Set<string>()
  for (const selection of selections) for (const itemId of selection) merged.add(itemId)
  return merged
}

/** Completes one live boundary from the visible FIRST and LAST layouts. */
export function captureHtmlLiveMotionBoundary(input: Readonly<{
  player: RuntimePlayer
  root: Element
  nodes: ReadonlyMap<string, unknown>
  first: LayoutSnapshot
  intents: readonly ScheduledMotionIntent[]
  resolveMotionContainer?: (input: HtmlMotionContainerSceneInput) => HtmlMotionContainerResolution
}>): readonly MotionBoundary[] {
  const afterScene = input.player.getSolvedScene()
  if (afterScene === undefined || input.intents.length === 0) return []
  const boundaries: MotionBoundary[] = []
  for (const group of groupMotionIntents(input.intents, afterScene)) {
    const beforeScene = input.player.resolveSceneBeforeBoundary(group.startAt, false)
    const motionContainer = input.resolveMotionContainer?.({
      root: input.root,
      scenes: [beforeScene, afterScene],
      itemIds: [...new Set(group.intents.map((intent) => intent.itemId))],
      storyIds: group.storyIds,
    })
    const captureRoot = motionContainer?.element ?? input.root
    const rootKey = motionContainer?.key ?? input.first.rootKey
    const selection = collectBoundarySelection(
      beforeScene,
      afterScene,
      group.intents,
      group.storyIds,
    )
    const after = captureHtmlLayoutSnapshot(captureRoot, input.nodes, afterScene, selection, rootKey)
    const intents = group.intents.map(toMotionIntent)
    boundaries.push(Object.freeze({
      id: `boundary:live:${group.startAt}:${group.endAt}:${intents.map((intent) => intent.id).join(',')}`,
      timeMs: group.startAt,
      storyIds: group.storyIds,
      before: input.first,
      after,
      intents: Object.freeze(intents),
    }))
  }
  return Object.freeze(boundaries)
}
