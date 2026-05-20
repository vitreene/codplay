import type {
  TrackEventRef,
  TrackManagerApi,
  TrackManagerCommandResult,
  TrackManagerStoryEvent
} from './types'
import {
  TrackManagerCodec,
  type TrackBucket
} from './track-manager-validation'

const TRACK_MANAGER_ERROR = {
  unknownTrack: 'AUTHOR_TRACK_UNKNOWN'
} as const

/**
 * Implements one deterministic track manager for runtime timeline execution.
 */
export class TrackManager implements TrackManagerApi {
  private readonly trackById = new Map<string, TrackBucket>()
  private readonly codec = new TrackManagerCodec()
  private emitRefs = false
  private generatedEventIndex = 0

  readonly state = {
    activeTrackIds: [] as string[],
    loadedTrackIds: [] as string[]
  }

  /**
   * Loads one full track set and resets all runtime cursors.
   */
  load(input: {
    tracks: Record<string, unknown>
    options?: { emitRefs?: boolean }
  }): TrackManagerCommandResult {
    this.trackById.clear()
    this.emitRefs = input.options?.emitRefs === true
    this.generatedEventIndex = 0

    for (const [trackId, rawTrack] of Object.entries(input.tracks)) {
      this.trackById.set(
        trackId,
        this.codec.normalizeTrackBucket(trackId, rawTrack, this.trackById.size, () => this.createGeneratedEventId(trackId))
      )
    }

    this.syncState()
    return {
      ok: true,
      data: undefined
    }
  }

  /**
   * Activates or deactivates tracks without retroactive catch-up.
   */
  setActiveTracks(input: {
    activate?: string[]
    deactivate?: string[]
    reason?: string
  }): TrackManagerCommandResult {
    for (const trackId of input.activate ?? []) {
      const track = this.trackById.get(trackId)
      if (track) {
        track.active = true
      }
    }

    for (const trackId of input.deactivate ?? []) {
      const track = this.trackById.get(trackId)
      if (track) {
        track.active = false
      }
    }

    this.syncState()
    return {
      ok: true,
      data: undefined
    }
  }

  /**
   * Appends one batch of live events to a single track.
   */
  appendLiveEvents(input: {
    trackId: string
    events: TrackManagerStoryEvent[]
  }): TrackManagerCommandResult {
    return this.appendEvents(input.trackId, input.events)
  }

  /**
   * Anchors portable story eventimes into the shared timeline.
   */
  appendAnchoredEventimes(input: {
    trackId: string
    anchorMs: number
    storyId: string
    eventimes: import('./types').TrackManagerEventimeNode[]
  }): TrackManagerCommandResult<{ appendedCount: number }> {
    const events = this.codec.flattenAnchoredEventimes(
      input.eventimes,
      input.trackId,
      input.storyId,
      input.anchorMs,
      () => this.createGeneratedEventId(input.trackId)
    )
    const appendResult = this.appendEvents(input.trackId, events)
    if (!appendResult.ok) {
      return appendResult
    }

    return {
      ok: true,
      data: {
        appendedCount: events.length
      }
    }
  }

  /**
   * Ensures one runtime track exists for generated helper events.
   */
  ensureTrack(input: {
    trackId: string
    order?: number
    source?: import('../core/events/types').RuntimeEventSource
    active?: boolean
    role?: string
  }): TrackManagerCommandResult {
    if (this.trackById.has(input.trackId)) {
      return {
        ok: true,
        data: undefined
      }
    }

    this.trackById.set(
      input.trackId,
      this.codec.normalizeTrackBucket(
        input.trackId,
        {
          order: input.order,
          source: input.source,
          active: input.active,
          role: input.role,
          events: []
        },
        this.trackById.size,
        () => this.createGeneratedEventId(input.trackId)
      )
    )
    this.syncState()
    return {
      ok: true,
      data: undefined
    }
  }

  /**
   * Recomputes each track cursor from one target timeline position.
   */
  syncCursor(input: { nowMs: number }): void {
    for (const track of this.trackById.values()) {
      let nextIndex = 0
      while (nextIndex < track.events.length && track.events[nextIndex].ms <= input.nowMs) {
        nextIndex += 1
      }

      track.nextIndex = nextIndex
    }
  }

  /**
   * Collects all events due at or before the provided time.
   */
  collectDueEvents(input: { nowMs: number }): {
    events: TrackManagerStoryEvent[]
    refs?: TrackEventRef[]
  } {
    const dueEvents: TrackManagerStoryEvent[] = []
    const refs: TrackEventRef[] = []

    for (const track of [...this.trackById.values()].sort((left, right) => left.order - right.order)) {
      if (!track.active) {
        continue
      }

      while (track.nextIndex < track.events.length) {
        const event = track.events[track.nextIndex]
        if (event.ms > input.nowMs) {
          break
        }

        dueEvents.push(event)
        refs.push({
          eventOffset: event.ms,
          trackId: track.id,
          index: event.index,
          source: event.source
        })
        track.nextIndex += 1
      }
    }

    return {
      events: this.codec.sortCollectedTrackEvents(dueEvents, this.trackById.values()),
      refs: this.emitRefs ? refs : undefined
    }
  }

  /**
   * Returns all loaded events in deterministic order.
   */
  getAllEvents(options: { activeOnly?: boolean } = {}): TrackManagerStoryEvent[] {
    const tracks = options.activeOnly
      ? [...this.trackById.values()].filter((track) => track.active)
      : this.trackById.values()
    return this.codec.sortAllTrackEvents(tracks)
  }

  /**
   * Returns runtime metadata for one track when available.
   */
  getTrackMeta(trackId: string): import('./types').TrackRuntimeMeta | null {
    const track = this.trackById.get(trackId)
    if (!track) {
      return null
    }

    return {
      trackId: track.id,
      order: track.order,
      source: track.source,
      active: track.active,
      role: track.role
    }
  }

  /**
   * Creates one generated event identifier.
   */
  private createGeneratedEventId(trackId: string): string {
    const eventId = `evt-track-${trackId}-${this.generatedEventIndex}`
    this.generatedEventIndex += 1
    return eventId
  }

  /**
   * Syncs public state arrays from current buckets.
   */
  private syncState(): void {
    this.state.loadedTrackIds = [...this.trackById.keys()]
    this.state.activeTrackIds = [...this.trackById.values()]
      .filter((track) => track.active)
      .map((track) => track.id)
  }

  /**
   * Appends one batch of events to a track and keeps deterministic ordering.
   */
  private appendEvents(trackId: string, events: TrackManagerStoryEvent[]): TrackManagerCommandResult {
    const track = this.trackById.get(trackId)
    if (!track) {
      return {
        ok: false,
        error: {
          code: TRACK_MANAGER_ERROR.unknownTrack,
          message: `Track '${trackId}' does not exist.`
        }
      }
    }

    track.events.push(
      ...events.map((event, index) => ({
        ...event,
        trackId,
        index: Number.isFinite(event.index) ? event.index : this.generatedEventIndex + index
      }))
    )
    this.codec.sortTrackEvents(track)
    this.syncState()
    return {
      ok: true,
      data: undefined
    }
  }
}
