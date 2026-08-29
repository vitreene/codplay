import type { RuntimeTrackEvent } from '../runtime/player/pipeline'
import type { CodPlayTraceEvent } from './facade-types'

/** Adapts one internal runtime event to the public diagnostic trace context. */
export function toTraceEvent(instanceId: string, event: RuntimeTrackEvent): CodPlayTraceEvent {
  return {
    instanceId,
    eventId: event.eventId,
    eventSeq: event.eventSeq,
    name: event.name,
    timeMs: event.applyAtMs,
    trackId: event.trackId,
    storyId: event.storyId,
    visibility: event.visibility,
    data: event.data,
    context: event.context,
    meta: event.meta,
    mode: event.mode,
  }
}
