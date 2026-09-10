import type { RuntimePlayer } from '../player'
import {
  isScalarTransformProperty,
  resolveTransformProperty as canonicalTransformProperty,
} from 'ace'
import {
  captureHtmlLayoutSnapshot,
} from './layout-snapshot'
import type {
  LayoutSnapshot,
  MotionBoundary,
  MotionIntent,
  MotionScheduleTransition,
  PresentationFrame,
  ScheduledMotionIntent,
} from '../motion'
import {
  createScheduledMotionIntent,
  decomposeRootMotionPose,
  deriveRelativeMotionPose,
} from '../motion'
import { buildSolvedGraph, type SolvedPerso, type SolvedScene } from '../player'
import { resolveStyleTweenTiming, type StyleTweenTiming } from '../player/pipeline'
import { isPlainRecord } from '../../shared'
import type { CompiledRecord } from '../../scene/compiled'
import type {
  HtmlMotionContainerResolution,
  HtmlMotionContainerSceneInput,
} from './motion-container'

const HTML_LAYOUT_PROPERTIES = new Set([
  'position',
  'inset',
  'insetBlock',
  'insetBlockStart',
  'insetBlockEnd',
  'insetInline',
  'insetInlineStart',
  'insetInlineEnd',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gap',
  'rowGap',
  'columnGap',
  'display',
  'flex',
  'flexBasis',
  'flexGrow',
  'flexShrink',
  'gridTemplateColumns',
  'gridTemplateRows',
])

/** Captures the current visible geometry needed by one motion presentation. */
export function captureCurrentHtmlMotionLayout(
  root: Element,
  nodes: ReadonlyMap<string, unknown>,
  scene: SolvedScene,
  itemIds: ReadonlySet<string>,
  rootKey?: string,
): LayoutSnapshot {
  return captureHtmlLayoutSnapshot(root, nodes, scene, itemIds, rootKey)
}

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

/** Resolves one HTML action transition that contributes to a geometric pose. */
export function resolveHtmlMotionActionTransition(
  action: CompiledRecord | undefined,
): MotionScheduleTransition | undefined {
  if (action === undefined || !isPlainRecord(action.style)) return undefined

  const transitions: StyleTweenTiming[] = []
  for (const [property, value] of Object.entries(action.style)) {
    if (!isHtmlMotionProperty(property)) continue
    const timing = resolveStyleTweenTiming(value)
    if (timing !== undefined) transitions.push(timing)
  }
  if (transitions.length === 0) return undefined

  // A repeated style tween is already resolved by ACE on the author node.
  // The geometric graph only represents one monotonic FIRST/LAST interval;
  // routing an alternating tween through it would replace the later legs with
  // a single straight segment. Descendants read the natural layout instead.
  if (transitions.some((timing) => timing.totalDuration !== timing.duration)) {
    return undefined
  }

  const selected = transitions.reduce((longest, timing) => (
    timing.delay + timing.duration > longest.delay + longest.duration ? timing : longest
  ))
  return Object.freeze({
    ...selected,
    captureOffsetsMs: Object.freeze([...new Set(transitions
      .map((timing) => timing.delay + timing.duration))].sort((left, right) => left - right)),
  })
}

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
        ?? captureCurrentHtmlMotionLayout(captureRoot, input.nodes, beforeScene, selection, rootKey)
      const afterStart = afterStartScene === undefined
        ? undefined
        : captureStartLayout(afterStartScene, selection, captureRoot, rootKey)
      const keyframes: LayoutSnapshot[] = []
      for (const { scene } of keyScenes) {
        input.player.presentSceneForGeometryCapture(scene)
        keyframes.push(captureCurrentHtmlMotionLayout(captureRoot, input.nodes, scene, selection, rootKey))
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
          const source = captureCurrentHtmlMotionLayout(captureRoot, input.nodes, sourceScene, selection, rootKey)
          before = mergeLayoutSnapshots(before, source, missingSourceItemIds)
          input.player.presentSceneForGeometryCapture(afterScene)
        }
      }
      const after = captureCurrentHtmlMotionLayout(captureRoot, input.nodes, afterScene, selection, rootKey)
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
    return captureCurrentHtmlMotionLayout(root, input.nodes, scene, selection, rootKey)
  }
}

/**
 * Restores the pre-occurrence-discovery preparation of a late destination by
 * adding only future moves on the destination's mounted ancestor chain.
 */
function expandLateDestinationAncestorIntents(input: Readonly<{
  player: RuntimePlayer
  intents: readonly ScheduledMotionIntent[]
  includePersistOnly: boolean
  resolveActiveMotionEndAt?: (itemId: string, startAt: number, requestedEndAt: number) => number | undefined
}>): readonly ScheduledMotionIntent[] {
  const expanded = new Map(input.intents.map((intent) => [intent.id, intent]))
  const pending = [...input.intents]

  for (let index = 0; index < pending.length; index += 1) {
    const intent = pending[index]
    if (intent === undefined || intent.startAt < 0 || !intent.targetReflow) continue

    const beforeScene = input.player.resolveSceneBeforeBoundary(
      intent.startAt,
      input.includePersistOnly,
    )
    const endpointTime = resolveMotionEndpointTime(
      input.player,
      resolveMotionIntentStoryIds(intent, beforeScene),
      intent.startAt,
      intent.endAt,
      input.includePersistOnly,
      [intent],
      input.resolveActiveMotionEndAt,
    )
    if (endpointTime <= intent.startAt) continue

    const afterScene = input.player.resolveSceneBeforeBoundary(
      endpointTime,
      input.includePersistOnly,
    )
    const ancestorIds = resolveDestinationAncestorIds(afterScene, intent.itemId)
    if (ancestorIds.size === 0 || !hasLateDestinationAncestor(beforeScene, afterScene, ancestorIds)) continue

    for (const occurrence of afterScene.moveOccurrences ?? []) {
      const action = occurrence.action
      if (!ancestorIds.has(occurrence.itemId)
        || action.startAt <= intent.startAt
        || action.startAt >= endpointTime) continue

      const eventId = action.eventId
        ?? `${occurrence.itemId}:${action.name}:${action.declarationPath.join('.')}`
      const supportIntent = createScheduledMotionIntent({
        id: action.eventId === undefined
          ? `motion:${eventId}:${action.startAt}`
          : `motion:${eventId}`,
        eventId,
        itemId: occurrence.itemId,
        declarationPath: action.declarationPath,
        startAt: action.startAt,
        eventSeq: action.eventSeq,
        storyIds: resolveSupportStoryIds(beforeScene, afterScene, occurrence.itemId),
        action: action.action,
        resolveActionTransition: resolveHtmlMotionActionTransition,
      })
      if (supportIntent === undefined || expanded.has(supportIntent.id)) continue

      expanded.set(supportIntent.id, supportIntent)
      pending.push(supportIntent)
    }
  }

  return Object.freeze([...expanded.values()]
    .sort((left, right) => left.startAt - right.startAt
      || left.endAt - right.endAt
      || compareMotionDeclarationPaths(left.declarationPath, right.declarationPath)))
}

/** Resolves the mounted destination parent chain at one motion endpoint. */
function resolveDestinationAncestorIds(scene: SolvedScene, itemId: string): ReadonlySet<string> {
  const ancestorIds = new Set<string>()
  let parentItemId = scene.graph.parentByPerso[itemId]
  while (parentItemId !== undefined && !ancestorIds.has(parentItemId)) {
    ancestorIds.add(parentItemId)
    parentItemId = scene.graph.parentByPerso[parentItemId]
  }
  return ancestorIds
}

/** Checks whether the endpoint destination uses an ancestor unavailable at FIRST. */
function hasLateDestinationAncestor(
  before: SolvedScene,
  after: SolvedScene,
  ancestorIds: ReadonlySet<string>,
): boolean {
  for (const itemId of ancestorIds) {
    if (after.persos[itemId]?.placement.mounted === true
      && before.persos[itemId]?.placement.mounted !== true) return true
  }
  return false
}

/** Resolves the story scope touched by one supporting ancestor move. */
function resolveSupportStoryIds(
  before: SolvedScene,
  after: SolvedScene,
  itemId: string,
): readonly string[] {
  return Object.freeze([...new Set([
    ...resolveMotionStoryIds(before, itemId),
    ...resolveMotionStoryIds(after, itemId),
  ])].sort())
}

/** Resolves the story ids carried by one solved scene item and its target. */
function resolveMotionStoryIds(scene: SolvedScene, itemId: string): readonly string[] {
  const perso = scene.persos[itemId]
  if (perso === undefined) return Object.freeze([])
  const storyIds = new Set<string>([perso.storyId])
  const targetStoryId = perso.placement.target?.storyId
  if (targetStoryId !== undefined) storyIds.add(targetStoryId)
  const parentStoryId = perso.placement.parentKey === undefined
    ? undefined
    : scene.persos[perso.placement.parentKey]?.storyId
  if (parentStoryId !== undefined) storyIds.add(parentStoryId)
  return Object.freeze([...storyIds])
}

/** Provides deterministic ordering for generated support intents. */
function compareMotionDeclarationPaths(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return left.length - right.length
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

/** Builds the runner-local key for a visible FIRST snapshot. */
export function createMotionFirstSnapshotKey(itemId: string, startAt: number): string {
  return `${itemId}:${startAt}`
}

/** Resolves the property endpoints that fall strictly inside one boundary. */
function resolveIntermediateKeyTimes(
  intents: readonly ScheduledMotionIntent[],
  startAt: number,
  endAt: number,
): readonly number[] {
  return Object.freeze([...new Set(intents.flatMap((intent) => intent.keyTimes ?? []))]
    .filter((timeMs) => timeMs > startAt && timeMs < endAt && Number.isFinite(timeMs))
    .sort((left, right) => left - right))
}

/** Stops a replay capture at the first reset that invalidates its story scope. */
function resolveMotionEndpointTime(
  player: RuntimePlayer,
  storyIds: readonly string[],
  startAt: number,
  endAt: number,
  includePersistOnly: boolean,
  intents: readonly ScheduledMotionIntent[],
  resolveActiveMotionEndAt: ((itemId: string, startAt: number, requestedEndAt: number) => number | undefined) | undefined,
): number {
  const journal = player.trackJournal
  let endpoint = resolveActiveMotionEndAt === undefined
    ? endAt
    : Math.min(
      endAt,
      ...intents
        .map((intent) => resolveActiveMotionEndAt(intent.itemId, startAt, endAt))
        .filter((value): value is number => value !== undefined && Number.isFinite(value) && value > startAt),
    )
  if (journal === undefined) return endpoint
  for (const storyId of storyIds) {
    const reset = journal.getStoryResetBoundaries(storyId, includePersistOnly)
      .find((boundary) => boundary.applyAtMs > startAt && boundary.applyAtMs < endpoint)
    if (reset !== undefined) endpoint = reset.applyAtMs
  }
  return endpoint
}

/** Unions the selected branches required by two boundary layout states. */
function mergeSelections(
  ...selections: readonly (ReadonlySet<string> | readonly string[])[]
): ReadonlySet<string> {
  const merged = new Set<string>()
  for (const selection of selections) for (const itemId of selection) merged.add(itemId)
  return merged
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
    const after = captureCurrentHtmlMotionLayout(captureRoot, input.nodes, afterScene, selection, rootKey)
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

/** Converts one scheduled intent to the pure graph boundary contract. */
function toMotionIntent(intent: ScheduledMotionIntent): MotionIntent {
  return Object.freeze({
    id: intent.id,
    itemId: intent.itemId,
    startAt: intent.startAt,
    ...(intent.eventSeq === undefined ? {} : { eventSeq: intent.eventSeq }),
    duration: intent.duration,
    delay: intent.delay,
    ease: intent.ease,
    presentationMode: intent.presentationMode,
    ...(intent.resize === undefined ? {} : { resize: intent.resize }),
    targetReflow: intent.targetReflow,
    ...(intent.path === undefined ? {} : { path: intent.path }),
  })
}

/** Resolves the logical scope carried by an occurrence, with a scene fallback. */
function resolveMotionIntentStoryIds(
  intent: ScheduledMotionIntent,
  scene: SolvedScene,
): readonly string[] {
  const carried = intent.storyIds ?? []
  if (carried.length > 0) return Object.freeze([...new Set(carried)].sort())
  const storyId = scene.persos[intent.itemId]?.storyId
  return storyId === undefined ? Object.freeze([]) : Object.freeze([storyId])
}

/** Groups simultaneous direct moves into one browser capture transaction. */
function groupMotionIntents(
  intents: readonly ScheduledMotionIntent[],
  scene: SolvedScene,
): readonly Readonly<{
  storyIds: readonly string[]
  startAt: number
  endAt: number
  structural: boolean
  intents: readonly ScheduledMotionIntent[]
}>[] {
  const grouped = new Map<string, {
    storyIds: readonly string[]
    startAt: number
    endAt: number
    structural: boolean
    intents: ScheduledMotionIntent[]
  }>()
  for (const intent of intents) {
    // A capture closed at t=0 may receive the documented default persist
    // duration and therefore an anchor below the playable timeline. Such a
    // fact is journaled, but it has no materializable motion boundary.
    if (intent.startAt < 0) continue
    const storyIds = resolveMotionIntentStoryIds(intent, scene)
    const structural = intent.targetReflow
    const scopeKey = storyIds.length === 1 ? storyIds[0]! : '<root>'
    const key = `${scopeKey}:${intent.startAt}:${intent.endAt}:${structural ? 'structural' : 'pose'}`
    const group = grouped.get(key) ?? {
      storyIds,
      startAt: intent.startAt,
      endAt: intent.endAt,
      structural,
      intents: [],
    }
    group.storyIds = Object.freeze([...new Set([...group.storyIds, ...storyIds])])
    group.intents.push(intent)
    grouped.set(key, group)
  }
  return Object.freeze([...grouped.values()]
    .sort((left, right) => left.startAt - right.startAt || left.endAt - right.endAt)
    .map((group) => Object.freeze({
      storyIds: group.storyIds,
      startAt: group.startAt,
      endAt: group.endAt,
      structural: group.structural,
      intents: Object.freeze([...group.intents]),
    })))
}

/**
 * Selects direct movers, source/target siblings and their ancestor closure.
 * Unrelated branches are not read by the geometry capture.
 */
function collectBoundarySelection(
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
function resolveMissingSourceItemIds(
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
function createMissingSourceCaptureScene(
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
function mergeLayoutSnapshots(
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

/** Identifies HTML style channels whose action tween can change a measured pose. */
function isHtmlMotionProperty(property: string): boolean {
  if (HTML_LAYOUT_PROPERTIES.has(property)) return true
  if (property === 'transform' || property === 'translate' || property === 'rotate' || property === 'scale') return true
  const canonical = canonicalTransformProperty(property)
  return canonical !== undefined && isScalarTransformProperty(canonical)
}
