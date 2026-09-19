import { compareNumberPaths } from '../../../shared'
import type { CompiledEventime, CompiledScene } from '../../../scene/compiled'
import { TRACK_GLOBAL_ID } from '../../config/track'
import { createCompiledEventimeEventId } from '../eventime'
import type { RuntimeTraceEvent } from './track-journal'
import { buildTrackRegistry, resolveStoryTrackId } from './tracks'

/** One compiled eventime with its absolute playback position and owner track. */
export type FlattenedCompiledEventime = Readonly<{
  event: CompiledEventime
  startAt: number
  trackId: string
  trackOrder: number
  storyId?: string
  declarationPath: readonly number[]
  eventId: string
  eventSeq?: number
}>

/** Flattens one relative eventime tree while preserving its declaration order. */
export function flattenCompiledEventimes(
  eventimes: readonly CompiledEventime[],
  trackId: string,
  trackOrder: number,
  parentStartAt = 0,
  parentPath: readonly number[] = [],
  scope: 'scene' | 'story' = 'scene',
  storyId?: string,
): readonly FlattenedCompiledEventime[] {
  return eventimes.flatMap((event, index) => {
    const startAt = parentStartAt + event.startAt
    const declarationPath = [...parentPath, index]
    return [
      {
        event,
        startAt,
        trackId,
        trackOrder,
        ...(storyId === undefined ? {} : { storyId }),
        declarationPath,
        eventId: createCompiledEventimeEventId(scope, trackId, storyId, declarationPath),
      },
      ...flattenCompiledEventimes(
        event.events ?? [],
        trackId,
        trackOrder,
        startAt,
        declarationPath,
        scope,
        storyId,
      ),
    ]
  })
}

/** Collects every compiled eventime as a diagnostic occurrence for playback tracing. */
export function collectCompiledEventOccurrences(scene: CompiledScene): readonly RuntimeTraceEvent[] {
  const tracks = buildTrackRegistry(scene)
  const occurrences: FlattenedCompiledEventime[] = []
  const globalTrackOrder = tracks.tracks[TRACK_GLOBAL_ID]?.order ?? 0
  occurrences.push(...flattenCompiledEventimes(
    scene.scene.eventimes ?? [],
    TRACK_GLOBAL_ID,
    globalTrackOrder,
    0,
    [],
    'scene',
    undefined,
  ))

  for (const story of Object.values(scene.scene.stories)) {
    const trackId = resolveStoryTrackId(story)
    const trackOrder = tracks.tracks[trackId]?.order ?? 0
    occurrences.push(...flattenCompiledEventimes(
      story.eventimes ?? [],
      trackId,
      trackOrder,
      0,
      [],
      'story',
      story.id,
  ))
  }

  return occurrences
    .sort(compareCompiledEventimes)
    .map((occurrence) => ({
      eventId: occurrence.eventId,
      trackId: occurrence.trackId,
      name: occurrence.event.name,
      applyAtMs: occurrence.startAt,
      ...(occurrence.storyId === undefined ? {} : { storyId: occurrence.storyId }),
      ...(occurrence.event.visibility === undefined ? {} : { visibility: occurrence.event.visibility }),
      ...(occurrence.event.data === undefined ? {} : { data: occurrence.event.data }),
    }))
}

/** Orders compiled occurrences by time, track order and authored declaration path. */
function compareCompiledEventimes(
  left: FlattenedCompiledEventime,
  right: FlattenedCompiledEventime,
): number {
  return left.startAt - right.startAt
    || left.trackOrder - right.trackOrder
    || compareNumberPaths(left.declarationPath, right.declarationPath)
}
