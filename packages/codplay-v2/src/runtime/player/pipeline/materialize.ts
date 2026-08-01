import { isPlainRecord } from '../../../shared'
import { STRAP_SCOPE_SCENE, STRAP_SCOPE_STORY } from '../../config/strap-scope'
import type { CompiledEventime, CompiledRecord, CompiledScene, CompiledValue } from '../../../scene/compiled'
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

/** Selects discrete occurrences active at one timeline position. */
export function materializeScene(scene: CompiledScene, timeMs: number, journal?: RuntimeTrackJournal): MaterializedScene {
  assertTimelineTime(timeMs)
  const persos: Record<string, MaterializedPerso> = {}
  const tracks = journal?.registry ?? buildTrackRegistry(scene)
  const sceneState = cloneRecord(scene.scene.state)
  if (journal !== undefined) {
    for (const update of journal.getStateUpdates(STRAP_SCOPE_SCENE, undefined, timeMs)) {
      applyStateUpdate(sceneState, update.update)
    }
  }
  const storyStates: Record<string, CompiledRecord> = {}

  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    const storyState = cloneRecord(story.state)
    if (journal !== undefined) {
      for (const update of journal.getStateUpdates(STRAP_SCOPE_STORY, storyId, timeMs)) {
        applyStateUpdate(storyState, update.update)
      }
    }
    storyStates[storyId] = storyState
    const trackId = resolveStoryTrackId(story)
    const track = tracks.tracks[trackId]
    if (track === undefined) throw new Error(`Materialize track is not registered: ${trackId}`)
    const events = trackIsActive(journal, trackId, track.active)
      ? [
          ...flattenEventimes(story.eventimes ?? [], trackId, track.order),
          ...getLiveEventsForStory(journal, storyId, timeMs),
        ]
      : []
    for (const perso of story.persos) {
      const key = `${storyId}:${perso.id}`
      const actions = events
        .map((event) => toActiveAction(event, perso.actions, timeMs))
        .filter((action): action is IndexedMaterializedAction => action !== null)
        .sort(compareMaterializedActions)
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

/** Converts one flattened compiled event into an active action for one perso. */
function toActiveAction(
  flattened: FlattenedEventime,
  actions: Readonly<Record<string, CompiledValue>>,
  timeMs: number,
): IndexedMaterializedAction | null {
  if (flattened.startAt > timeMs) return null
  const actionValue = actions[flattened.event.name]
  const action = isPlainRecord(actionValue)
    ? actionValue
    : actionValue === null && flattened.event.data !== undefined
      ? flattened.event.data
      : null
  if (action === null) return null
  return {
    name: flattened.event.name,
    startAt: flattened.startAt,
    elapsedMs: timeMs - flattened.startAt,
    trackId: flattened.trackId,
    trackOrder: flattened.trackOrder,
    eventId: flattened.eventId,
    eventSeq: flattened.eventSeq,
    declarationPath: flattened.declarationPath,
    eventData: flattened.event.data,
    action: action as CompiledRecord,
  }
}

/** Preserves declaration order for same-time actions while sorting chronology. */
function compareMaterializedActions(
  left: IndexedMaterializedAction,
  right: IndexedMaterializedAction,
): number {
  return left.startAt - right.startAt
    || left.trackOrder - right.trackOrder
    || compareDeclarationPaths(left.declarationPath, right.declarationPath)
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
): readonly FlattenedEventime[] {
  if (journal === undefined) return []
  return journal.getEventsForStory(storyId)
    .filter((event) => {
      const track = journal.registry.tracks[event.trackId]
      return event.applyAtMs <= timeMs && track !== undefined && journal.isTrackActive(event.trackId)
    })
    .map((event) => toFlattenedLiveEvent(event, event.trackId, journal.registry.tracks[event.trackId]?.order ?? 0))
}

/** Converts one live journal event into the materialize event representation. */
function toFlattenedLiveEvent(event: RuntimeTrackEvent, trackId: string, trackOrder: number): FlattenedEventime {
  return {
    event: { name: event.name, startAt: event.applyAtMs, data: event.data },
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

/** Compares nested declaration paths without depending on object or map order. */
function compareDeclarationPaths(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = left[index] - right[index]
    if (difference !== 0) return difference
  }
  return left.length - right.length
}

/** Rejects invalid timeline inputs before the hot evaluation path. */
function assertTimelineTime(timeMs: number): void {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new Error('Materialize time must be a finite non-negative number.')
  }
}

/** Clones one optional compiled state record into a mutable evaluation copy. */
function cloneRecord(record: CompiledRecord | undefined): Record<string, CompiledValue> {
  if (record === undefined) return {}
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, cloneValue(value)]))
}

/** Applies one replayable shallow state patch without mutating compiled input. */
function applyStateUpdate(state: Record<string, CompiledValue>, update: CompiledRecord | undefined): void {
  if (update === undefined) return
  for (const [key, value] of Object.entries(update)) state[key] = cloneValue(value)
}

/** Clones one recursive compiled value for a materialized state copy. */
function cloneValue(value: CompiledValue): CompiledValue {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (isPlainRecord(value)) return cloneRecord(value)
  return value
}
