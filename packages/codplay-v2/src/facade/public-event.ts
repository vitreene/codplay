import type { CodPlayPublicEvent } from './facade-types'
import type { RuntimeTrackEvent } from '../runtime/player/pipeline'

/** Adapts one journal event to the public event contract. */
export function toPublicEvent(instanceId: string, event: RuntimeTrackEvent): CodPlayPublicEvent {
  return {
    instanceId,
    eventId: event.eventId,
    eventSeq: event.eventSeq,
    name: event.name,
    timeMs: event.applyAtMs,
    visibility: 'public',
    data: event.data,
    context: event.context,
    meta: event.meta,
  }
}
