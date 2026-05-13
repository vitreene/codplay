import type { RuntimeEventSource } from '../core/events/types'

export type TrackManagerEventimeNode = {
  name: string
  startAt: number
  data?: Record<string, unknown>
  events?: TrackManagerEventimeNode[]
}

export type TrackManagerStoryEvent = {
  id: string
  ms: number
  name: string
  index: number
  source: RuntimeEventSource
  trackId?: string
  payload?: Record<string, unknown>
  scopeStoryId?: string
}

export type TrackEventRef = {
  eventOffset: number
  trackId: string
  index?: number
  source?: string
}

export type TrackManagerCommandResult<T = void> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: {
        code: string
        message: string
        details?: unknown
      }
    }

export type TrackManagerStateSnapshot = {
  activeTrackIds: string[]
  loadedTrackIds: string[]
}

export type TrackManagerApi = {
  load: (input: {
    tracks: Record<string, unknown>
    options?: { emitRefs?: boolean }
  }) => TrackManagerCommandResult
  setActiveTracks: (input: {
    activate?: string[]
    deactivate?: string[]
    reason?: string
  }) => TrackManagerCommandResult
  appendLiveEvents: (input: {
    trackId: string
    events: TrackManagerStoryEvent[]
  }) => TrackManagerCommandResult
  appendAnchoredEventimes: (input: {
    trackId: string
    anchorMs: number
    storyId: string
    eventimes: TrackManagerEventimeNode[]
  }) => TrackManagerCommandResult<{ appendedCount: number }>
  syncCursor: (input: { nowMs: number }) => void
  collectDueEvents: (input: { nowMs: number }) => {
    events: TrackManagerStoryEvent[]
    refs?: TrackEventRef[]
  }
  getAllEvents: () => TrackManagerStoryEvent[]
  state: TrackManagerStateSnapshot
}
