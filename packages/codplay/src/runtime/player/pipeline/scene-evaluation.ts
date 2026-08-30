import { isPlainRecord } from '../../../shared'
import type { CompiledEventime, CompiledRecord, CompiledScene, CompiledValue } from '../../../scene/compiled'
import { TRACK_GLOBAL_ID } from '../../config/track'
import { isActionSequence, isTweenAction, planActionSequenceSteps, type CompiledTweenAction } from './action-sequence'
import { resolveStyleTweenTiming } from './style-timing'
import type { RuntimeTrackJournal } from './track-journal'
import type { SolvedScene } from './types'

/** Collects every boundary that may change the reconstructed logical state. */
export function collectLogicalEvaluationBoundaries(
  scene: CompiledScene,
  journal?: RuntimeTrackJournal,
): readonly number[] {
  const times = new Set<number>()
  for (const story of Object.values(scene.scene.stories)) {
    collectStoryEventBoundaries(story.eventimes ?? [], 0, story.persos, times)
  }
  for (const event of journal?.getAllEvents() ?? []) {
    times.add(event.applyAtMs)
    for (const story of Object.values(scene.scene.stories)) {
      if (event.storyId === undefined && event.cascade !== true && event.trackId !== TRACK_GLOBAL_ID) continue
      if (event.storyId !== undefined && event.storyId !== story.id && event.cascade !== true && event.trackId !== TRACK_GLOBAL_ID) continue
      collectActionSequenceBoundaries(story.persos, event.name, event.applyAtMs, times)
    }
  }
  return [...times].sort((left, right) => left - right)
}

/** Reports whether one solved scene still has a time-varying logical action. */
export function hasActiveTimeDependentStateActions(
  scene: Pick<SolvedScene, 'persos'>,
): boolean {
  return Object.values(scene.persos).some((perso) => (perso.actions ?? []).some((action) =>
    isActiveTimeDependentAction(action.action, action.elapsedMs)))
}

/** Checks the core action forms whose resolved state changes with elapsed time. */
function isActiveTimeDependentAction(action: CompiledRecord, elapsedMs: number): boolean {
  if (isTweenAction(action as unknown as CompiledValue)) {
    return elapsedMs < (action as unknown as CompiledTweenAction).duration
  }
  const style = action.style
  if (!isPlainRecord(style)) return false
  return Object.values(style).some((value) => {
    const timing = resolveStyleTweenTiming(value as CompiledValue)
    return timing !== undefined && elapsedMs < timing.delay + timing.duration
  })
}

/** Flattens one story's eventimes and includes internal action-sequence starts. */
function collectStoryEventBoundaries(
  eventimes: readonly CompiledEventime[],
  parentStartAt: number,
  persos: readonly Readonly<{ actions: Readonly<Record<string, CompiledValue>> }>[],
  times: Set<number>,
): void {
  for (const event of eventimes) {
    const startAt = parentStartAt + event.startAt
    times.add(startAt)
    collectActionSequenceBoundaries(persos, event.name, startAt, times)
    collectStoryEventBoundaries(event.events ?? [], startAt, persos, times)
  }
}

/** Adds the internal start positions of every sequence bound to one event name. */
function collectActionSequenceBoundaries(
  persos: readonly Readonly<{ actions: Readonly<Record<string, CompiledValue>> }>[],
  eventName: string,
  startAt: number,
  times: Set<number>,
): void {
  for (const perso of persos) {
    const action = perso.actions[eventName]
    if (!isActionSequence(action)) continue
    for (const step of planActionSequenceSteps(action)) times.add(startAt + step.offsetMs)
  }
}
