import { cloneRecord, cloneValue, compareNumberPaths } from '../../../shared'
import { STRAP_SCOPE_SCENE, STRAP_SCOPE_STORY } from '../../config/strap-scope'
import { TRACK_GLOBAL_ID } from '../../config/track'
import type { CompiledEventime, CompiledRecord, CompiledScene, CompiledValue } from '../../../scene/compiled'
import { isActionSequence, isTweenAction, planActionSequenceSteps } from './action-sequence'
import { resolveActionDefinition } from './action-resolution'
import type { RuntimeTrackEvent, RuntimeTrackJournal } from './track-journal'
import { buildTrackRegistry, resolveStoryTrackId } from './tracks'
import type { MaterializedAction, MaterializedPerso, MaterializedScene } from './types'

type IndexedMaterializedAction = MaterializedAction & { declarationPath: readonly number[] }
type FlattenedEventime = Readonly<{
  event: CompiledEventime
  startAt: number
  trackId: string
  trackOrder: number
  declarationPath: readonly number[]
  eventId?: string
  eventSeq?: number
}>

/** Selects whether persisted-only facts participate in one evaluation. */
export type MaterializeOptions = Readonly<{
  includePersistOnly?: boolean
}>

/** Selects discrete occurrences active at or before one timeline position. */
export function materializeScene(
  scene: CompiledScene,
  timeMs: number,
  journal?: RuntimeTrackJournal,
  options: MaterializeOptions = {},
): MaterializedScene {
  return materializeSceneAtBoundary(scene, timeMs, true, journal, options)
}

/** Selects the exact left-side state before occurrences at one boundary. */
export function materializeSceneBeforeBoundary(
  scene: CompiledScene,
  timeMs: number,
  journal?: RuntimeTrackJournal,
  options: MaterializeOptions = {},
): MaterializedScene {
  return materializeSceneAtBoundary(scene, timeMs, false, journal, options)
}

/** Materializes one inclusive or exclusive event boundary without numeric epsilon. */
function materializeSceneAtBoundary(
  scene: CompiledScene,
  timeMs: number,
  includeBoundary: boolean,
  journal?: RuntimeTrackJournal,
  options: MaterializeOptions = {},
): MaterializedScene {
  assertTimelineTime(timeMs)
  const persos: Record<string, MaterializedPerso> = {}
  const tracks = journal?.registry ?? buildTrackRegistry(scene)
  const sceneState = cloneRecord(scene.scene.state)
  if (journal !== undefined) {
    for (const update of journal.getStateUpdates(
      STRAP_SCOPE_SCENE,
      undefined,
      timeMs,
      includeBoundary,
      options.includePersistOnly !== false,
    )) {
      applyStateUpdate(sceneState, update.update)
    }
  }
  const storyStates: Record<string, CompiledRecord> = {}

  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    const storyState = cloneRecord(story.state)
    if (journal !== undefined) {
      for (const update of journal.getStateUpdates(
        STRAP_SCOPE_STORY,
        storyId,
        timeMs,
        includeBoundary,
        options.includePersistOnly !== false,
      )) {
        applyStateUpdate(storyState, update.update)
      }
    }
    storyStates[storyId] = storyState
    const trackId = resolveStoryTrackId(story)
    const track = tracks.tracks[trackId]
    if (track === undefined) throw new Error(`Materialize track is not registered: ${trackId}`)
    const events = [
      ...(trackIsActive(journal, TRACK_GLOBAL_ID, tracks.tracks[TRACK_GLOBAL_ID]?.active ?? true)
        ? flattenEventimes(scene.scene.eventimes ?? [], TRACK_GLOBAL_ID, tracks.tracks[TRACK_GLOBAL_ID]?.order ?? 0)
        : []),
      ...(trackIsActive(journal, trackId, track.active)
        ? flattenEventimes(story.eventimes ?? [], trackId, track.order)
        : []),
      ...getLiveEventsForStory(
        journal,
        storyId,
        timeMs,
        includeBoundary,
        options.includePersistOnly !== false,
      ),
    ]
    for (const perso of story.persos) {
      const key = `${storyId}:${perso.id}`
      const actions = materializePersoActions(events, perso.actions, timeMs, includeBoundary)
      persos[key] = {
        key,
        storyId,
        persoId: perso.id,
        type: perso.type,
        initial: perso.initial,
        actions,
      }
    }
  }

  return { scene, timeMs, tracks, sceneState, storyStates, persos }
}

/** Expands one perso's event occurrences into the active action occurrences. */
function materializePersoActions(
  sourceEvents: readonly FlattenedEventime[],
  actions: Readonly<Record<string, CompiledValue>>,
  timeMs: number,
  includeBoundary: boolean,
): readonly IndexedMaterializedAction[] {
  const orderedEvents = [...sourceEvents].sort(compareFlattenedEventimes)
  const materialized: IndexedMaterializedAction[] = []

  for (let eventIndex = 0; eventIndex < orderedEvents.length; eventIndex += 1) {
    const flattened = orderedEvents[eventIndex]
    if (flattened.event.name === 'tween:stop') continue
    const action = resolveActionDefinition(actions[flattened.event.name], flattened.event.data)
    if (action === null) continue

    if (isActionSequence(action)) {
      const plannedSteps = planActionSequenceSteps(action)
      for (let stepIndex = 0; stepIndex < plannedSteps.length; stepIndex += 1) {
        const step = plannedSteps[stepIndex]
        const startAt = flattened.startAt + step.offsetMs
        const superseded = isTweenAction(step.action)
          ? hasAnySupersedingTrigger(orderedEvents, eventIndex, flattened.event.name, timeMs, includeBoundary)
          : hasPendingSequenceStepReplacement(
              orderedEvents,
              eventIndex,
              flattened.event.name,
              startAt,
              timeMs,
              includeBoundary,
            )
        if (superseded) continue
        if (isTweenAction(step.action) && hasTweenStop(orderedEvents, eventIndex, startAt, timeMs, includeBoundary)) continue
        const activeAction = createMaterializedAction(
          flattened,
          startAt,
          step.action,
          timeMs,
          includeBoundary,
          stepIndex,
        )
        if (activeAction !== null) materialized.push(activeAction)
      }
      continue
    }

    if (isTweenAction(action) && (
      hasAnySupersedingTrigger(orderedEvents, eventIndex, flattened.event.name, timeMs, includeBoundary)
      || hasTweenStop(orderedEvents, eventIndex, flattened.startAt, timeMs, includeBoundary)
    )) continue
    const activeAction = createMaterializedAction(
      flattened,
      flattened.startAt,
      action,
      timeMs,
      includeBoundary,
    )
    if (activeAction !== null) materialized.push(activeAction)
  }

  return materialized.sort(compareMaterializedActions)
}

/** Creates one active materialized action while enforcing the boundary policy. */
function createMaterializedAction(
  flattened: FlattenedEventime,
  startAt: number,
  action: CompiledRecord,
  timeMs: number,
  includeBoundary: boolean,
  sequenceIndex?: number,
): IndexedMaterializedAction | null {
  if (startAt > timeMs || (!includeBoundary && startAt === timeMs)) return null
  return {
    name: flattened.event.name,
    startAt,
    elapsedMs: timeMs - startAt,
    trackId: flattened.trackId,
    trackOrder: flattened.trackOrder,
    eventId: sequenceIndex === undefined
      ? flattened.eventId
      : createDerivedEventId(flattened, `${flattened.event.name}:sequence:${sequenceIndex}`),
    eventSeq: flattened.eventSeq,
    declarationPath: sequenceIndex === undefined
      ? flattened.declarationPath
      : [...flattened.declarationPath, sequenceIndex],
    eventData: flattened.event.data,
    action,
  }
}

/** Invalidates a sequence step that had not started before a replacement trigger. */
function hasPendingSequenceStepReplacement(
  orderedEvents: readonly FlattenedEventime[],
  sourceIndex: number,
  eventName: string,
  stepStartAt: number,
  timeMs: number,
  includeBoundary: boolean,
): boolean {
  for (let index = sourceIndex + 1; index < orderedEvents.length; index += 1) {
    const candidate = orderedEvents[index]
    if (candidate.startAt > stepStartAt) break
    if (candidate.startAt > timeMs || (!includeBoundary && candidate.startAt === timeMs)) continue
    if (candidate.event.name === eventName) return true
  }
  return false
}

/** Invalidates an older tween when any later occurrence of its action key is due. */
function hasAnySupersedingTrigger(
  orderedEvents: readonly FlattenedEventime[],
  sourceIndex: number,
  eventName: string,
  timeMs: number,
  includeBoundary: boolean,
): boolean {
  for (let index = sourceIndex + 1; index < orderedEvents.length; index += 1) {
    const candidate = orderedEvents[index]
    if (candidate.startAt > timeMs || (!includeBoundary && candidate.startAt === timeMs)) break
    if (candidate.event.name === eventName) return true
  }
  return false
}

/** Invalidates a tween step at or after a later logical tween stop event. */
function hasTweenStop(
  orderedEvents: readonly FlattenedEventime[],
  sourceIndex: number,
  tweenStartAt: number,
  timeMs: number,
  includeBoundary: boolean,
): boolean {
  for (let index = sourceIndex + 1; index < orderedEvents.length; index += 1) {
    const candidate = orderedEvents[index]
    if (candidate.startAt < tweenStartAt) continue
    if (candidate.startAt > timeMs || (!includeBoundary && candidate.startAt === timeMs)) return false
    if (candidate.event.name === 'tween:stop') return true
  }
  return false
}

/** Creates a stable derived event identity for one sequence step. */
function createDerivedEventId(flattened: FlattenedEventime, suffix: string): string {
  const source = flattened.eventId ?? `${flattened.event.name}@${flattened.startAt}:${flattened.declarationPath.join('.')}`
  return `${source}:${suffix}`
}

/** Preserves declaration order for same-time actions while sorting chronology. */
function compareMaterializedActions(
  left: IndexedMaterializedAction,
  right: IndexedMaterializedAction,
): number {
  return left.startAt - right.startAt
    || left.trackOrder - right.trackOrder
    || compareNumberPaths(left.declarationPath, right.declarationPath)
}

/** Preserves source chronology and declaration order while expanding sequences. */
function compareFlattenedEventimes(left: FlattenedEventime, right: FlattenedEventime): number {
  return left.startAt - right.startAt
    || left.trackOrder - right.trackOrder
    || compareNumberPaths(left.declarationPath, right.declarationPath)
}

/** Flattens relative eventimes into absolute timeline positions. */
function flattenEventimes(
  eventimes: readonly CompiledEventime[],
  trackId: string,
  trackOrder: number,
  parentStartAt = 0,
  parentPath: readonly number[] = [],
): readonly FlattenedEventime[] {
  return eventimes.flatMap((event, index) => {
    const startAt = parentStartAt + event.startAt
    const declarationPath = [...parentPath, index]
    return [
      { event, startAt, trackId, trackOrder, declarationPath },
      ...flattenEventimes(event.events ?? [], trackId, trackOrder, startAt, declarationPath),
    ]
  })
}

/** Selects live events for one story and converts them to the common eventime shape. */
function getLiveEventsForStory(
  journal: RuntimeTrackJournal | undefined,
  storyId: string,
  timeMs: number,
  includeBoundary: boolean,
  includePersistOnly: boolean,
): readonly FlattenedEventime[] {
  if (journal === undefined) return []
  return journal.getEventsForStory(storyId)
    .filter((event) => {
      const track = journal.registry.tracks[event.trackId]
      return (event.applyAtMs < timeMs || (includeBoundary && event.applyAtMs === timeMs))
        && (includePersistOnly || event.mode !== 'persist-only')
        && track !== undefined
        && journal.isTrackActive(event.trackId)
    })
    .map((event) => toFlattenedLiveEvent(event, event.trackId, journal.registry.tracks[event.trackId]?.order ?? 0))
}

/** Converts one live journal event into the materialize event representation. */
function toFlattenedLiveEvent(event: RuntimeTrackEvent, trackId: string, trackOrder: number): FlattenedEventime {
  return {
    event: { name: event.name, startAt: event.applyAtMs, visibility: event.visibility, data: event.data },
    startAt: event.applyAtMs,
    trackId,
    trackOrder,
    eventId: event.eventId,
    eventSeq: event.eventSeq,
    declarationPath: [Number.MAX_SAFE_INTEGER, event.eventSeq],
  }
}

/** Reads the mutable track activity layer without mutating compiled metadata. */
function trackIsActive(journal: RuntimeTrackJournal | undefined, trackId: string, initialActive: boolean): boolean {
  return journal === undefined ? initialActive : journal.isTrackActive(trackId)
}

/** Rejects invalid timeline inputs before the hot evaluation path. */
function assertTimelineTime(timeMs: number): void {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new Error('Materialize time must be a finite non-negative number.')
  }
}

/** Applies one replayable shallow state patch without mutating compiled input. */
function applyStateUpdate(state: Record<string, CompiledValue>, update: CompiledRecord | undefined): void {
  if (update === undefined) return
  for (const [key, value] of Object.entries(update)) state[key] = cloneValue(value)
}
