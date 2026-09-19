import type {
  CodPlayEventInput,
  CodPlayEventListener,
  CodPlayEvents,
  CodPlayPublicEvent,
} from '../facade-types'
import { DiagnosticChannel, publishFacadeError } from '../diagnostic-channel'

/** Owns engine-wide public event listeners and their failure isolation. */
export class EngineEventChannel {
  private readonly listeners = new Set<CodPlayEventListener>()
  private readonly diagnostics: DiagnosticChannel

  constructor(diagnostics: DiagnosticChannel) {
    this.diagnostics = diagnostics
  }

  /** Creates the public event surface over one addressed instance operation. */
  createPublicRegistry(emit: (input: CodPlayEventInput) => Promise<void>): CodPlayEvents {
    return {
      emit,
      onEvent: (listener) => {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      },
    }
  }

  /** Forwards one public event to every engine-level observer. */
  forward(event: CodPlayPublicEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        publishFacadeError(this.diagnostics, 'CODPLAY_EVENT_LISTENER_FAILED', error, {
          instanceId: event.instanceId,
          eventId: event.eventId,
        })
      }
    }
  }

  /** Removes all engine-level observers during owner teardown. */
  destroy(): void {
    this.listeners.clear()
  }
}
