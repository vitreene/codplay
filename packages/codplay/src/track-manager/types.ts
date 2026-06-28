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

export type TrackRuntimeMeta = {
  trackId: string
  order: number
  source: RuntimeEventSource
  active: boolean
  role?: string
}

export type TrackAuthorMeta = {
  active?: boolean
  role?: string
} & Record<string, unknown>

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
  resetActiveTracks: () => void
  resetCursor: () => void
  syncCursor: (input: { nowMs: number }) => void
  collectDueEvents: (input: { nowMs: number }) => {
    events: TrackManagerStoryEvent[]
    refs?: TrackEventRef[]
  }
  collectNextDueEvent: (input: { nowMs: number }) => TrackManagerStoryEvent | null
  getAllEvents: (options?: { activeOnly?: boolean }) => TrackManagerStoryEvent[]
  getTrackMeta: (trackId: string) => TrackRuntimeMeta | null
  state: TrackManagerStateSnapshot
}
