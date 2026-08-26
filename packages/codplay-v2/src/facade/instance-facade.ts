import type { DiagnosticReport } from '../diagnostics'
import {
  createRuntimeTelco,
  type RuntimeTelcoCommandResult,
  type RuntimeTelcoState,
} from '../runtime/telco'
import type { RuntimePlayer } from '../runtime/player'
import type { RuntimeTrackEvent } from '../runtime/player/pipeline'
import type {
  CodPlayEventListener,
  CodPlayInstance,
  CodPlayInstanceDiagnostic,
  CodPlayInstanceEvents,
  CodPlayProgress,
  CodPlayPublicEvent,
  CodPlayTelco,
  CodPlayTelcoState,
} from './facade-types'
import { DiagnosticChannel, publishFacadeError } from './diagnostic-channel'
import { toPublicEvent } from './public-event'

type InstanceFacadeOptions = Readonly<{
  instanceId: string
  player: RuntimePlayer
  durationMs: number
  diagnostics: DiagnosticChannel
  eventListeners: Set<CodPlayEventListener>
  onPublicEvent: (event: CodPlayPublicEvent) => void
  destroy: () => void
}>

/** Adapts one initialized RuntimePlayer to the public instance boundary. */
export class InstanceFacadeImpl implements CodPlayInstance {
  readonly instanceId: string
  readonly telco: CodPlayTelco
  readonly events: CodPlayInstanceEvents
  readonly diagnostic: CodPlayInstanceDiagnostic
  private readonly player: RuntimePlayer
  private readonly diagnostics: DiagnosticChannel
  private readonly eventListeners: Set<CodPlayEventListener>
  private readonly destroyTelco: () => void
  private readonly destroyHost: () => void
  private destroyed = false

  /** Creates the grouped instance capabilities around one initialized player. */
  constructor(options: InstanceFacadeOptions) {
    this.instanceId = options.instanceId
    this.player = options.player
    this.diagnostics = options.diagnostics
    this.eventListeners = options.eventListeners
    this.destroyHost = options.destroy
    const telco = createTelcoFacade(options)
    this.telco = telco.api
    this.destroyTelco = telco.destroy
    this.events = createEventsFacade(this.player, this.diagnostics, this.instanceId, this.eventListeners)
    this.diagnostic = {
      onDiagnostic: (listener) => this.diagnostics.onDiagnostic(listener),
    }
    this.onPublicEvent = options.onPublicEvent
  }

  private readonly onPublicEvent: (event: CodPlayPublicEvent) => void

  /** Receives one internal public event and isolates listener failures. */
  handlePublicEvent(event: RuntimeTrackEvent): void {
    if (this.destroyed) return
    const publicEvent = toPublicEvent(this.instanceId, event)
    for (const listener of this.eventListeners) {
      try {
        listener(publicEvent)
      } catch (error) {
        publishFacadeError(this.diagnostics, 'CODPLAY_EVENT_LISTENER_FAILED', error, {
          instanceId: this.instanceId,
          eventId: event.eventId,
        })
      }
    }
    this.onPublicEvent(publicEvent)
  }

  /** Publishes the diagnostics produced by one grouped engine seek. */
  publishSeekReport(report: DiagnosticReport): void {
    if (this.destroyed) return
    this.diagnostics.publishReport(report, { instanceId: this.instanceId })
  }

  /** Releases the telco, player, and listener references exactly once. */
  destroyInternal(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.eventListeners.clear()
    this.destroyTelco()
    this.destroyHost()
  }
}

/** Creates the public telco around the RuntimePlayer transport target. */
function createTelcoFacade(options: InstanceFacadeOptions): Readonly<{
  api: CodPlayTelco
  destroy: () => void
}> {
  const target = {
    getLifecycleState: () => options.player.getLifecycleState(),
    getCurrentTimeMs: () => options.player.getCurrentTimeMs(),
    getRate: () => options.player.getRate(),
    subscribe: (listener: () => void) => options.player.subscribeTransport(listener),
    play: () => options.player.play(),
    pause: () => options.player.pause(),
    setRate: (rate: number) => options.player.setRate(rate),
    seek: (timeMs: number): Readonly<{ ok: boolean }> => {
      const result = options.player.seek(timeMs)
      publishSeekDiagnostics(options.diagnostics, options.instanceId, result.diagnostics)
      return { ok: result.ok }
    },
  }
  const runtimeTelco = createRuntimeTelco({
    target,
    durationMs: options.durationMs,
  })

  const api: CodPlayTelco = {
    get commandInFlight(): boolean {
      return runtimeTelco.commandInFlight
    },
    get rate(): number {
      return runtimeTelco.rate
    },
    getState: () => toPublicTelcoState(options.instanceId, runtimeTelco.getState()),
    getProgress: (): CodPlayProgress => {
      const state = runtimeTelco.getState()
      return { timelineMs: state.timelineMs, durationMs: state.durationMs }
    },
    play: () => runTelcoCommand(runtimeTelco.play(), options.diagnostics, options.instanceId),
    pause: () => runTelcoCommand(runtimeTelco.pause(), options.diagnostics, options.instanceId),
    togglePlay: () => runTelcoCommand(runtimeTelco.togglePlay(), options.diagnostics, options.instanceId),
    setRate: (rate) => {
      try {
        runtimeTelco.setRate(rate)
      } catch (error) {
        publishFacadeError(options.diagnostics, 'CODPLAY_TELCO_RATE_FAILED', error, {
          instanceId: options.instanceId,
        })
      }
    },
    seek: (timeMs) => runTelcoCommand(runtimeTelco.seek(timeMs), options.diagnostics, options.instanceId),
    rewind: () => runTelcoCommand(runtimeTelco.rewind(), options.diagnostics, options.instanceId),
    onChange: (listener) => runtimeTelco.onChange((state) => {
      try {
        listener(toPublicTelcoState(options.instanceId, state))
      } catch (error) {
        publishFacadeError(options.diagnostics, 'CODPLAY_TELCO_LISTENER_FAILED', error, {
          instanceId: options.instanceId,
        })
      }
    }),
    onProgress: (listener) => runtimeTelco.onProgress((state) => listener(toPublicTelcoState(options.instanceId, state))),
  }
  return { api, destroy: () => runtimeTelco.destroy() }
}

/** Creates the public event capability without exposing the internal journal. */
function createEventsFacade(
  player: RuntimePlayer,
  diagnostics: DiagnosticChannel,
  instanceId: string,
  eventListeners: Set<CodPlayEventListener>,
): CodPlayInstanceEvents {
  return {
    emit: async (eventime, address) => {
      try {
        player.emitEventime(eventime, address)
      } catch (error) {
        publishFacadeError(diagnostics, 'CODPLAY_EVENTIME_EMIT_FAILED', error, { instanceId })
      }
    },
    onEvent: (listener) => {
      eventListeners.add(listener)
      return () => { eventListeners.delete(listener) }
    },
  }
}

/** Converts one internal command result into diagnostics without an error envelope. */
async function runTelcoCommand(
  command: Promise<RuntimeTelcoCommandResult>,
  diagnostics: DiagnosticChannel,
  instanceId: string,
): Promise<void> {
  const result = await command
  if (result.ok) return
  publishFacadeError(diagnostics, result.error.code, result.error.message, { instanceId })
}

/** Publishes seek diagnostics with the instance reference at the facade boundary. */
function publishSeekDiagnostics(
  diagnostics: DiagnosticChannel,
  instanceId: string,
  report: DiagnosticReport,
): void {
  diagnostics.publishReport(report, { instanceId })
}

/** Adapts the internal telco state while keeping the instance identity explicit. */
function toPublicTelcoState(instanceId: string, state: RuntimeTelcoState): CodPlayTelcoState {
  return { instanceId, ...state }
}
