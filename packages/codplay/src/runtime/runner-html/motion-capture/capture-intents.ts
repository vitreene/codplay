import {
  isScalarTransformProperty,
  resolveTransformProperty as canonicalTransformProperty,
} from 'ace'
import type { CompiledRecord } from '../../../scene/compiled'
import { isPlainRecord } from '../../../shared'
import type { RuntimePlayer, SolvedScene } from '../../player'
import type {
  MotionIntent,
  MotionScheduleTransition,
  ScheduledMotionIntent,
} from '../../motion'
import { createScheduledMotionIntent } from '../../motion'
import { resolveStyleTweenTiming, type StyleTweenTiming } from '../../player/pipeline'

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

export type MotionCaptureGroup = Readonly<{
  storyIds: readonly string[]
  startAt: number
  endAt: number
  structural: boolean
  intents: readonly ScheduledMotionIntent[]
}>

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

/** Expands only the destination ancestor moves needed by one capture. */
export function expandLateDestinationAncestorIntents(input: Readonly<{
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

/** Resolves the property endpoints that fall strictly inside one boundary. */
export function resolveIntermediateKeyTimes(
  intents: readonly ScheduledMotionIntent[],
  startAt: number,
  endAt: number,
): readonly number[] {
  return Object.freeze([...new Set(intents.flatMap((intent) => intent.keyTimes ?? []))]
    .filter((timeMs) => timeMs > startAt && timeMs < endAt && Number.isFinite(timeMs))
    .sort((left, right) => left - right))
}

/** Stops a replay capture at the first reset that invalidates its story scope. */
export function resolveMotionEndpointTime(
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

/** Converts one scheduled intent to the pure graph boundary contract. */
export function toMotionIntent(intent: ScheduledMotionIntent): MotionIntent {
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
export function groupMotionIntents(
  intents: readonly ScheduledMotionIntent[],
  scene: SolvedScene,
): readonly MotionCaptureGroup[] {
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

/** Identifies HTML style channels whose action tween can change a measured pose. */
function isHtmlMotionProperty(property: string): boolean {
  if (HTML_LAYOUT_PROPERTIES.has(property)) return true
  if (property === 'transform' || property === 'translate' || property === 'rotate' || property === 'scale') return true
  const canonical = canonicalTransformProperty(property)
  return canonical !== undefined && isScalarTransformProperty(canonical)
}
