import type { CodPlayPublicEvent } from './facade-types'
import type { RuntimeTraceEvent } from '../runtime/player/pipeline'

/** Adapts one reached compiled or journaled occurrence to the public event contract. */
export function toPublicEvent(instanceId: string, event: RuntimeTraceEvent): CodPlayPublicEvent {
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
