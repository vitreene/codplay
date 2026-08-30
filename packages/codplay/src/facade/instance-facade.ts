import type { DiagnosticReport } from '../diagnostics'
import {
  createRuntimeTelco,
  type RuntimeTelcoCommandResult,
  type RuntimeTelcoState,
} from '../runtime/telco'
import type { RuntimePlayer } from '../runtime/player'
import type {
  RuntimeSnapshotPatch,
  RuntimeSnapshotSetResult,
  RuntimeTrackEvent,
} from '../runtime/player/pipeline'
import type { HtmlPlayerRunner } from '../runtime/runner-html'
import type {
  CodPlayEventListener,
  CodPlayInstance,
  CodPlayInstanceDiagnostic,
  CodPlayInstanceEvents,
  CodPlayProgress,
  CodPlayPublicEvent,
  CodPlaySnapshot,
  CodPlaySnapshotApi,
  CodPlaySnapshotPatch,
  CodPlaySnapshotSetResult,
  CodPlayTraceListener,
  CodPlayTelco,
  CodPlayTelcoState,
} from './facade-types'
import { DiagnosticChannel, publishFacadeError } from './diagnostic-channel'
import { toPublicEvent } from './public-event'

type InstanceFacadeOptions = Readonly<{
  instanceId: string
  player: RuntimePlayer
  runner: HtmlPlayerRunner
  durationMs?: number
  diagnostics: DiagnosticChannel
  eventListeners: Set<CodPlayEventListener>
  traceListeners: Set<CodPlayTraceListener>
  onPublicEvent: (event: CodPlayPublicEvent) => void
  onPlaybackStateChange: (state: 'playing' | 'paused') => void
  destroy: () => void
}>

/** Adapts one initialized RuntimePlayer to the public instance boundary. */
export class InstanceFacadeImpl implements CodPlayInstance {
  readonly instanceId: string
  readonly telco: CodPlayTelco
  readonly events: CodPlayInstanceEvents
  readonly diagnostic: CodPlayInstanceDiagnostic
  readonly snapshot: CodPlaySnapshotApi
  private readonly player: RuntimePlayer
  private readonly diagnostics: DiagnosticChannel
  private readonly eventListeners: Set<CodPlayEventListener>
  private readonly traceListeners: Set<CodPlayTraceListener>
  private readonly destroyTelco: () => void
  private readonly destroyHost: () => void
  private destroyed = false

  /** Creates the grouped instance capabilities around one initialized player. */
  constructor(options: InstanceFacadeOptions) {
    this.instanceId = options.instanceId
    this.player = options.player
    this.diagnostics = options.diagnostics
    this.eventListeners = options.eventListeners
    this.traceListeners = options.traceListeners
    this.destroyHost = options.destroy
    const telco = createTelcoFacade(options)
    this.telco = telco.api
    this.destroyTelco = telco.destroy
    this.events = createEventsFacade(this.player, this.diagnostics, this.instanceId, this.eventListeners)
    this.snapshot = createSnapshotFacade(this.player, this.diagnostics, this.instanceId, () => this.destroyed)
    this.diagnostic = {
      onDiagnostic: (listener) => this.diagnostics.onDiagnostic(listener),
      onTrace: (listener) => {
        this.traceListeners.add(listener)
        return () => { this.traceListeners.delete(listener) }
      },
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

  /** Releases the telco, player, and listener references exactly once. */
  destroyInternal(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.eventListeners.clear()
    this.traceListeners.clear()
    this.destroyTelco()
    this.destroyHost()
  }
}

/** Creates the direct logical snapshot port owned by one public instance. */
function createSnapshotFacade(
  player: RuntimePlayer,
  diagnostics: DiagnosticChannel,
  instanceId: string,
  isDestroyed: () => boolean,
): CodPlaySnapshotApi {
  return {
    get: (): CodPlaySnapshot | null => {
      if (isDestroyed()) return null
      const snapshot = player.getSnapshot()
      if (snapshot === undefined) return null
      return {
        timeMs: snapshot.timeMs,
        states: snapshot.states.map((state) => ({
          target: { storyId: state.storyId, persoId: state.persoId },
          state: state.state,
        })),
      }
    },
    set: (patches: readonly CodPlaySnapshotPatch[]): CodPlaySnapshotSetResult => {
      if (isDestroyed()) return { ok: false, code: 'INSTANCE_DESTROYED' }
      try {
        const result = player.setSnapshot(patches.map((patch): RuntimeSnapshotPatch => ({
          storyId: patch.target.storyId,
          persoId: patch.target.persoId,
          timeMs: patch.timeMs,
          state: patch.state,
        })))
        publishSnapshotResultDiagnostic(diagnostics, instanceId, result)
        return result
      } catch (error) {
        publishFacadeError(diagnostics, 'CODPLAY_SNAPSHOT_SET_FAILED', error, { instanceId })
        throw error
      }
    },
    clear: (): void => {
      if (isDestroyed()) return
      try {
        player.clearSnapshot()
      } catch (error) {
        publishFacadeError(diagnostics, 'CODPLAY_SNAPSHOT_CLEAR_FAILED', error, { instanceId })
        throw error
      }
    },
  }
}

/** Publishes a stable diagnostic for a rejected public snapshot operation. */
function publishSnapshotResultDiagnostic(
  diagnostics: DiagnosticChannel,
  instanceId: string,
  result: RuntimeSnapshotSetResult,
): void {
  if (result.ok) return
  publishFacadeError(
    diagnostics,
    `CODPLAY_SNAPSHOT_${result.code}`,
    `Snapshot operation rejected: ${result.code}.`,
    { instanceId },
  )
}

/** Creates the public telco around the runner's transport boundary. */
function createTelcoFacade(options: InstanceFacadeOptions): Readonly<{
  api: CodPlayTelco
  destroy: () => void
}> {
  const target = {
    getLifecycleState: () => options.player.getLifecycleState(),
    getCurrentTimeMs: () => options.player.getCurrentTimeMs(),
    getSequenceEnded: () => options.player.hasSequenceEnded(),
    getDurationMs: () => options.player.getDiscoveredDurationMs(),
    getRate: () => options.player.getRate(),
    subscribe: (listener: () => void) => options.player.subscribeTransport(listener),
    play: () => {
      options.runner.play()
      options.onPlaybackStateChange('playing')
    },
    pause: () => {
      options.runner.pause()
      options.onPlaybackStateChange('paused')
    },
    setRate: (rate: number) => options.runner.setRate(rate),
    seek: (timeMs: number): Readonly<{ ok: boolean }> => {
      const result = options.runner.seek(timeMs)
      publishSeekDiagnostics(options.diagnostics, options.instanceId, result.diagnostics)
      return { ok: result.ok }
    },
  }
  const runtimeTelco = createRuntimeTelco({
    target,
    durationMs: options.durationMs,
  })
  let observedLifecycle = options.player.getLifecycleState()
  const stopLifecycleObservation = options.player.subscribeTransport(() => {
    const nextLifecycle = options.player.getLifecycleState()
    if (nextLifecycle === observedLifecycle) return
    observedLifecycle = nextLifecycle
    if (nextLifecycle === 'paused') options.onPlaybackStateChange('paused')
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
  return {
    api,
    destroy: () => {
      stopLifecycleObservation()
      runtimeTelco.destroy()
    },
  }
}

/** Creates the public event capability without exposing the internal journal. */
function createEventsFacade(
  player: RuntimePlayer,
  diagnostics: DiagnosticChannel,
  instanceId: string,
  eventListeners: Set<CodPlayEventListener>,
): CodPlayInstanceEvents {
  return {
    emit: async (eventime, target) => {
      try {
        await player.emitEventime(eventime, target)
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
