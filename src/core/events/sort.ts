import { RUNTIME_EVENT_SOURCE } from './constants'
import type { TimelineEvent, TrackMeta } from './types'

export type TrackMetaMap = Record<string, TrackMeta>

/**
 * Resolves the effective track order for one timeline event.
 */
function getTrackOrder(event: TimelineEvent, trackMeta: TrackMetaMap): number {
  if (!event.trackId) {
    return 0
  }

  return trackMeta[event.trackId]?.order ?? 0
}

/**
 * Resolves whether an event should be ordered after non-user events.
 */
function getSourcePriority(event: TimelineEvent): number {
  return event.source === RUNTIME_EVENT_SOURCE.user ? 1 : 0
}

/**
 * Sorts runtime events deterministically according to V1 ordering rules.
 */
export function sortRuntimeEvents(events: TimelineEvent[], trackMeta: TrackMetaMap): TimelineEvent[] {
  const withStableIndex = events.map((event, stableIndex) => ({ event, stableIndex }))

  withStableIndex.sort((left, right) => {
    const byMs = left.event.ms - right.event.ms
    if (byMs !== 0) {
      return byMs
    }

    const byTrackOrder = getTrackOrder(left.event, trackMeta) - getTrackOrder(right.event, trackMeta)
    if (byTrackOrder !== 0) {
      return byTrackOrder
    }

    const byIndex = left.event.index - right.event.index
    if (byIndex !== 0) {
      return byIndex
    }

    const bySource = getSourcePriority(left.event) - getSourcePriority(right.event)
    if (bySource !== 0) {
      return bySource
    }

    return left.stableIndex - right.stableIndex
  })

  return withStableIndex.map((entry) => entry.event)
}
