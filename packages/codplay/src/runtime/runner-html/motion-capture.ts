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
  ScheduledMotionIntent,
} from '../motion'
import { buildSolvedGraph, type SolvedPerso, type SolvedScene } from '../player'
import { isPlainRecord } from '../../shared'
import type { CompiledRecord } from '../../scene/compiled'

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
): LayoutSnapshot {
  return captureHtmlLayoutSnapshot(root, nodes, scene, itemIds)
}

/** Resolves one HTML action transition that contributes to a geometric pose. */
export function resolveHtmlMotionActionTransition(
  action: CompiledRecord | undefined,
): MotionScheduleTransition | undefined {
  if (action === undefined || !isPlainRecord(action.style)) return undefined

  let selected: MotionScheduleTransition | undefined
  for (const [property, value] of Object.entries(action.style)) {
    if (!isHtmlMotionProperty(property)) continue
    const transition = readStyleTransition(value)
    if (transition === undefined) continue
    const selectedEnd = selected === undefined
      ? Number.NEGATIVE_INFINITY
      : (selected.delay ?? 0) + selected.duration
    const transitionEnd = (transition.delay ?? 0) + transition.duration
    if (selected === undefined || transitionEnd > selectedEnd) selected = transition
  }
  return selected
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
    for (const group of groupMotionIntents(input.intents)) {
      // FIRST is the logical state immediately before the event. For a
      // structural move, the destination may be mounted only after that
      // boundary, so it is deliberately not required to exist here.
      const beforeScene = group.structural
        ? input.player.resolveSceneBeforeBoundary(group.startAt, input.includePersistOnly)
        : input.player.resolveSceneAt(group.startAt, input.includePersistOnly)
      const afterStartScene = group.structural
        ? input.player.resolveSceneAt(group.startAt, input.includePersistOnly)
        : undefined
      // The logical move is committed at startAt, but its geometric LAST is
      // the transition endpoint. Resolve the left side of that endpoint so a
      // following event scheduled at the exact same time is not imported into
      // the preceding move. The current move is already included because its
      // startAt is earlier than endAt. The same boundary data is then consumed
      // by Play and Seek.
      const afterScene = input.player.resolveSceneBeforeBoundary(group.endAt, input.includePersistOnly)
      const selection = mergeSelections(
        collectBoundarySelection(beforeScene, afterScene, group.intents),
        afterStartScene === undefined
          ? []
          : collectBoundarySelection(beforeScene, afterStartScene, group.intents),
      )

      input.player.presentSceneForGeometryCapture(beforeScene)
      let before = captureCurrentHtmlMotionLayout(input.root, input.nodes, beforeScene, selection)
      const afterStart = afterStartScene === undefined
        ? undefined
        : captureStartLayout(afterStartScene, selection)
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
          const source = captureCurrentHtmlMotionLayout(input.root, input.nodes, sourceScene, selection)
          before = mergeLayoutSnapshots(before, source, missingSourceItemIds)
          input.player.presentSceneForGeometryCapture(afterScene)
        }
      }
      const after = captureCurrentHtmlMotionLayout(input.root, input.nodes, afterScene, selection)
      const intents = group.intents.map(toMotionIntent)
      boundaries.push(Object.freeze({
        id: `boundary:${group.startAt}:${group.endAt}:${intents.map((intent) => intent.id).join(',')}`,
        timeMs: group.startAt,
        before,
        ...(afterStart === undefined ? {} : { afterStart }),
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

  /** Captures the post-boundary structural layout before endpoint-only events. */
  function captureStartLayout(
    scene: SolvedScene,
    selection: ReadonlySet<string>,
  ): LayoutSnapshot {
    input.player.presentSceneForGeometryCapture(scene)
    return captureCurrentHtmlMotionLayout(input.root, input.nodes, scene, selection)
  }
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
}>): readonly MotionBoundary[] {
  const afterScene = input.player.getSolvedScene()
  if (afterScene === undefined || input.intents.length === 0) return []
  const boundaries: MotionBoundary[] = []
  for (const group of groupMotionIntents(input.intents)) {
    const selection = collectBoundarySelection(
      input.player.resolveSceneBeforeBoundary(group.startAt, false),
      afterScene,
      group.intents,
    )
    const after = captureCurrentHtmlMotionLayout(input.root, input.nodes, afterScene, selection)
    const intents = group.intents.map(toMotionIntent)
    boundaries.push(Object.freeze({
      id: `boundary:live:${group.startAt}:${group.endAt}:${intents.map((intent) => intent.id).join(',')}`,
      timeMs: group.startAt,
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
    delay: intent.delay,
    ease: intent.ease,
    presentationMode: intent.presentationMode,
    targetReflow: intent.targetReflow,
    ...(intent.path === undefined ? {} : { path: intent.path }),
  })
}

/** Groups simultaneous direct moves into one browser capture transaction. */
function groupMotionIntents(
  intents: readonly ScheduledMotionIntent[],
): readonly Readonly<{
  startAt: number
  endAt: number
  structural: boolean
  intents: readonly ScheduledMotionIntent[]
}>[] {
  const grouped = new Map<string, {
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
    const structural = intent.targetReflow
    const key = `${intent.startAt}:${intent.endAt}:${structural ? 'structural' : 'pose'}`
    const group = grouped.get(key) ?? {
      startAt: intent.startAt,
      endAt: intent.endAt,
      structural,
      intents: [],
    }
    group.intents.push(intent)
    grouped.set(key, group)
  }
  return Object.freeze([...grouped.values()]
    .sort((left, right) => left.startAt - right.startAt || left.endAt - right.endAt)
    .map((group) => Object.freeze({
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
): ReadonlySet<string> {
  const selected = new Set<string>()
  for (const intent of intents) {
    selected.add(intent.itemId)
    if (intent.targetReflow) {
      addTargetChildren(before, before.graph.targetByPerso[intent.itemId], selected)
      addTargetChildren(after, after.graph.targetByPerso[intent.itemId], selected)
    }
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

/** Adds logical parent chains required to derive FIRST/LAST context. */
function addAncestorClosure(scene: SolvedScene, selected: Set<string>): void {
  for (const itemId of [...selected]) {
    let parentItemId = scene.graph.parentByPerso[itemId]
    while (parentItemId !== undefined) {
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

/** Reads one action style tween timing without evaluating or materializing it. */
function readStyleTransition(value: unknown): MotionScheduleTransition | undefined {
  if (!isPlainRecord(value) || !('to' in value)) return undefined
  const rawDuration = value.duration
  const duration = rawDuration === undefined ? 1000 : rawDuration
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return undefined
  const rawDelay = value.delay
  const delay = rawDelay === undefined ? 0 : rawDelay
  if (typeof delay !== 'number' || !Number.isFinite(delay) || delay < 0) return undefined
  if (value.ease !== undefined && typeof value.ease !== 'string') return undefined
  return Object.freeze({
    duration,
    delay,
    ease: typeof value.ease === 'string' ? value.ease : 'out(2)',
  })
}
