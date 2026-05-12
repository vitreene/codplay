import { sortRuntimeEvents } from '../core/events/sort'
import { RUNTIME_EVENT_SOURCE } from '../core/events/constants'
import type { TrackMeta } from '../core/events/types'
import type { TrackManagerEventimeNode, TrackManagerStoryEvent } from './types'

export type TrackBucket = {
  id: string
  order: number
  source: TrackMeta['source']
  active: boolean
  events: TrackManagerStoryEvent[]
  nextIndex: number
}

/**
 * Encodes and sorts track events for the TrackManager runtime.
 */
export class TrackManagerCodec {
  /**
   * Sorts one track bucket event list with stable global event ordering.
   */
  sortTrackEvents(track: TrackBucket): void {
    const trackMeta: Record<string, TrackMeta> = {
      [track.id]: {
        order: track.order,
        source: track.source
      }
    }
    track.events = sortRuntimeEvents(track.events, trackMeta) as TrackManagerStoryEvent[]
  }

  /**
   * Converts one raw track payload into a normalized runtime bucket.
   */
  normalizeTrackBucket(
    trackId: string,
    rawTrack: unknown,
    fallbackOrder: number,
    createGeneratedEventId: () => string
  ): TrackBucket {
    const trackRecord = typeof rawTrack === 'object' && rawTrack !== null
      ? (rawTrack as Record<string, unknown>)
      : {}
    const source =
      trackRecord.source === RUNTIME_EVENT_SOURCE.user ||
      trackRecord.source === RUNTIME_EVENT_SOURCE.system ||
      trackRecord.source === RUNTIME_EVENT_SOURCE.story
        ? trackRecord.source
        : RUNTIME_EVENT_SOURCE.story
    const rawEvents = Array.isArray(trackRecord.events) ? trackRecord.events : []
    const events: TrackManagerStoryEvent[] = []

    for (const rawEvent of rawEvents) {
      if (typeof rawEvent !== 'object' || rawEvent === null) {
        continue
      }

      const event = rawEvent as Record<string, unknown>
      const name = typeof event.name === 'string' ? event.name : ''
      if (name.length === 0) {
        continue
      }

      const ms = Number.isFinite(event.ms) ? Math.max(0, Number(event.ms)) : 0
      const index = Number.isFinite(event.index) ? Number(event.index) : events.length
      events.push({
        id: typeof event.id === 'string' ? event.id : createGeneratedEventId(),
        ms,
        name,
        index,
        source,
        trackId,
        payload:
          typeof event.payload === 'object' && event.payload !== null
            ? (event.payload as Record<string, unknown>)
            : undefined
      })
    }

    const track: TrackBucket = {
      id: trackId,
      order: Number.isFinite(trackRecord.order) ? Number(trackRecord.order) : fallbackOrder,
      source,
      active: trackRecord.active !== false,
      events,
      nextIndex: 0
    }
    this.sortTrackEvents(track)
    return track
  }

  /**
   * Flattens one eventime tree into append-only absolute timeline events.
   */
  flattenAnchoredEventimes(
    eventimes: TrackManagerEventimeNode[],
    trackId: string,
    storyId: string,
    anchorMs: number,
    createGeneratedEventId: () => string,
    parentOffsetMs = 0
  ): TrackManagerStoryEvent[] {
    const result: TrackManagerStoryEvent[] = []

    for (const eventime of eventimes) {
      const currentOffsetMs = parentOffsetMs + Math.max(0, eventime.startAt)
      result.push({
        id: createGeneratedEventId(),
        ms: anchorMs + currentOffsetMs,
        name: eventime.name,
        index: result.length,
        source: RUNTIME_EVENT_SOURCE.story,
        trackId,
        payload: eventime.data
      })

      if (Array.isArray(eventime.events) && eventime.events.length > 0) {
        result.push(
          ...this.flattenAnchoredEventimes(eventime.events, trackId, storyId, anchorMs, createGeneratedEventId, currentOffsetMs)
        )
      }
    }

    return result.map((event, index) => ({
      ...event,
      id: event.id.length > 0 ? event.id : `evt-${storyId}-${trackId}-${index}`,
      index
    }))
  }

  /**
   * Sorts a full event collection across all loaded tracks.
   */
  sortAllTrackEvents(tracks: Iterable<TrackBucket>): TrackManagerStoryEvent[] {
    const trackList = [...tracks]
    const trackMeta = Object.fromEntries(
      trackList.map((track) => [track.id, { order: track.order, source: track.source }])
    ) as Record<string, TrackMeta>

    return sortRuntimeEvents(
      trackList.flatMap((track) => track.events),
      trackMeta
    ) as TrackManagerStoryEvent[]
  }

  /**
   * Sorts one collected due-event batch against currently loaded track metadata.
   */
  sortCollectedTrackEvents(
    events: TrackManagerStoryEvent[],
    tracks: Iterable<TrackBucket>
  ): TrackManagerStoryEvent[] {
    const trackMeta = Object.fromEntries(
      [...tracks].map((track) => [track.id, { order: track.order, source: track.source }])
    ) as Record<string, TrackMeta>

    return sortRuntimeEvents(events, trackMeta) as TrackManagerStoryEvent[]
  }
}
