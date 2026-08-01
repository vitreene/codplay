import { isPlainRecord } from '../../../shared'
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

  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    const trackId = resolveStoryTrackId(story)
    const track = tracks.tracks[trackId]
    if (track === undefined) throw new Error(`Materialize track is not registered: ${trackId}`)
    const events = trackIsActive(journal, trackId, track.active)
      ? [
          ...flattenEventimes(story.eventimes ?? [], trackId, track.order),
          ...getLiveEventsForStory(journal, trackId, storyId, timeMs, track.order),
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

  return { scene, timeMs, tracks, persos }
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
  trackId: string,
  storyId: string,
  timeMs: number,
  trackOrder: number,
): readonly FlattenedEventime[] {
  if (journal === undefined) return []
  return journal.getEvents(trackId)
    .filter((event) => event.applyAtMs <= timeMs && (event.storyId === undefined || event.storyId === storyId))
    .map((event) => toFlattenedLiveEvent(event, trackId, trackOrder))
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
