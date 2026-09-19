import { isPlainRecord } from '../../../shared'
import type { RuntimeMoveOccurrence } from '../../materializer'
import type { SolvedScene } from '../pipeline'

/** Collects move actions that became relevant at one normal presentation boundary. */
export function collectMoveOccurrences(
  previousScene: SolvedScene | undefined,
  scene: SolvedScene,
  options: Readonly<{
    forceActive?: boolean
    resolveBeforeScene?: (timeMs: number) => SolvedScene
  }> = {},
): readonly RuntimeMoveOccurrence[] {
  const occurrences: RuntimeMoveOccurrence[] = []
  const previousTimeMs = previousScene?.timeMs
  const movingBackward = previousTimeMs !== undefined && scene.timeMs < previousTimeMs
  const currentMoves = scene.moveOccurrences ?? []
  const previousMoves = previousScene?.moveOccurrences ?? []
  const forceActive = options.forceActive === true

  // A forward frame that only advances a time-dependent action reuses the same
  // materialized move list. A backward seek is different: the target graph may
  // have been physically partitioned by a reset, so the active move must be
  // offered again even when materialization reused the same action array.
  if (previousScene !== undefined && previousMoves === currentMoves && !movingBackward && !forceActive) return []

  const previousKeys = new Set(previousMoves.map(({ action }) => actionOccurrenceKey(action)))
  for (const { itemId, action } of currentMoves) {
    const key = actionOccurrenceKey(action)
    const newlyVisible = forceActive
      ? isMoveActiveAt(action.action.move, action.startAt, scene.timeMs)
      : previousScene === undefined
        ? action.startAt === scene.timeMs
        : movingBackward
          ? isMoveActiveAt(action.action.move, action.startAt, scene.timeMs)
          : (action.startAt > (previousTimeMs ?? Number.NEGATIVE_INFINITY)
            && action.startAt <= scene.timeMs) || !previousKeys.has(key)
    if (!newlyVisible) continue

    const beforeScene = options.resolveBeforeScene?.(action.startAt) ?? previousScene ?? scene
    const beforeStoryIds = resolveMotionStoryIds(beforeScene, itemId)
    const afterStoryIds = resolveMotionStoryIds(scene, itemId)
    occurrences.push(Object.freeze({
      itemId,
      startAt: action.startAt,
      ...(action.eventId === undefined ? {} : { eventId: action.eventId }),
      ...(action.eventSeq === undefined ? {} : { eventSeq: action.eventSeq }),
      declarationPath: Object.freeze([...action.declarationPath]),
      action,
      beforeStoryIds,
      afterStoryIds,
    }))
  }

  return Object.freeze(occurrences)
}

/** Collects the logical stories touched by one item's current placement. */
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

/** Identifies one materialized action occurrence across adjacent scenes. */
function actionOccurrenceKey(action: Readonly<{
  name: string
  startAt: number
  eventId?: string
  declarationPath: readonly number[]
}>): string {
  return `${action.eventId ?? action.name}:${action.startAt}:${action.declarationPath.join('.')}`
}

/** Reports whether a move transition is active at a backward seek target. */
function isMoveActiveAt(moveValue: unknown, startAt: number, timeMs: number): boolean {
  if (!isPlainRecord(moveValue) || !isPlainRecord(moveValue.transition)) return false
  const transition = moveValue.transition
  const duration = transition.duration
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return false
  const delay = transition.delay
  const delayMs = delay === undefined
    ? 0
    : typeof delay === 'number' && Number.isFinite(delay) && delay >= 0
      ? delay
      : 0
  // The captured FIRST must also cover the delay hold before interpolation.
  return timeMs >= startAt && timeMs <= startAt + delayMs + duration
}

