import type { TimelineEvent } from '../core/events/types'
import type { HorizonSnapshot, SeekPolicy } from './types'

type TrackMetaResolver = (trackId: string) => { role?: string } | null

/**
 * Returns true when at least one loaded track is marked as master.
 */
export function hasMasterTracks(loadedTrackIds: string[], getTrackMeta: TrackMetaResolver): boolean {
  return loadedTrackIds.some((trackId) => getTrackMeta(trackId)?.role === 'master')
}

/**
 * Returns true when one event belongs to a master track.
 */
export function isMasterTrackEvent(event: TimelineEvent, getTrackMeta: TrackMetaResolver): boolean {
  if (!event.trackId) {
    return false
  }

  return getTrackMeta(event.trackId)?.role === 'master'
}

/**
 * Returns true when one event is replayable for the current seek reconstruction.
 */
export function shouldReplayEventForSeek(
  event: TimelineEvent,
  playedReplayEndMs: number,
  loadedTrackIds: string[],
  getTrackMeta: TrackMetaResolver
): boolean {
  if (event.ms <= playedReplayEndMs) {
    return true
  }

  if (!hasMasterTracks(loadedTrackIds, getTrackMeta)) {
    return true
  }

  return isMasterTrackEvent(event, getTrackMeta)
}

/**
 * Resolves the current seek cap from canonical horizon values.
 */
export function resolveSeekEndMsFromPolicy(
  seekPolicy: SeekPolicy,
  input: Pick<HorizonSnapshot, 'playedEndMs' | 'projectedMasterEndMs' | 'authorEndMs'>
): number {
  switch (seekPolicy) {
    case 'disabled':
      return 0
    case 'played-only':
      return input.playedEndMs
    case 'master-projected':
      return Math.max(input.playedEndMs, input.projectedMasterEndMs)
    case 'author-unrestricted':
    default:
      return input.authorEndMs
  }
}
