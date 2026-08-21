import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  PLAYER_LIFECYCLE_PLAYING,
  type PlayerLifecycleState,
} from '../config/player-lifecycle'
import type { FrameScheduler } from '../time'
import type {
  RuntimeTelco,
  RuntimeTelcoCommandResult,
  RuntimeTelcoOptions,
  RuntimeTelcoState,
} from './types'

/** Creates the browser scheduler used by the default telco progress observer. */
function createDefaultScheduler(): FrameScheduler {
  if (
    typeof globalThis.requestAnimationFrame !== 'function'
    || typeof globalThis.cancelAnimationFrame !== 'function'
  ) {
    throw new Error('Runtime telco requires requestAnimationFrame and cancelAnimationFrame.')
  }
  return {
    request: (callback) => globalThis.requestAnimationFrame(callback),
    cancel: (requestId) => globalThis.cancelAnimationFrame(requestId),
  }
}

/** Creates one transport facade around an already initialized V2 runtime target. */
export function createRuntimeTelco(options: RuntimeTelcoOptions): RuntimeTelco {
  if (!Number.isFinite(options.durationMs) || options.durationMs <= 0) {
    throw new Error('Runtime telco durationMs must be a finite positive number.')
  }

  const target = options.target
  const scheduler = options.scheduler ?? createDefaultScheduler()
  const changeListeners = new Set<(state: RuntimeTelcoState) => void>()
  const progressListeners = new Set<(state: RuntimeTelcoState) => void>()
  let commandInFlight = false
  let runtimeRevision = 0
  let progressRequestId: number | null = null
  let destroyed = false

  /** Reads one immutable transport snapshot from the target. */
  function getState(): RuntimeTelcoState {
    const status = target.getLifecycleState()
    const timelineMs = Math.max(0, target.getCurrentTimeMs())
    return {
      status,
      timelineMs,
      durationMs: options.durationMs,
      initialized: status !== PLAYER_LIFECYCLE_IDLE && status !== PLAYER_LIFECYCLE_DESTROYED,
      sequenceEnded: timelineMs >= options.durationMs,
      runtimeRevision,
    }
  }

  /** Notifies state listeners after one transport state transition. */
  function notifyChange(): void {
    runtimeRevision += 1
    const state = getState()
    for (const listener of changeListeners) listener(state)
  }

  /** Schedules one progress observation while the target is playing. */
  function scheduleProgress(): void {
    if (destroyed || progressRequestId !== null || progressListeners.size === 0) return
    if (target.getLifecycleState() !== PLAYER_LIFECYCLE_PLAYING) return
    progressRequestId = scheduler.request(() => {
      progressRequestId = null
      flushProgress()
    })
  }

  /** Stops the pending progress observation. */
  function stopProgress(): void {
    if (progressRequestId === null) return
    scheduler.cancel(progressRequestId)
    progressRequestId = null
  }

  /** Publishes one progress snapshot and clamps the optional sequence end. */
  function flushProgress(): void {
    if (destroyed) return
    let state = getState()
    if (state.status === PLAYER_LIFECYCLE_PLAYING && state.sequenceEnded) {
      target.pause()
      const seekResult = target.seek(options.durationMs)
      if (!seekResult.ok) {
        // Keep the transport usable even when a target rejects the final clamp.
        state = getState()
      } else {
        notifyChange()
        state = getState()
      }
    }

    for (const listener of progressListeners) listener(state)
    scheduleProgress()
  }

  /** Converts one thrown command error into the public telco result. */
  function commandFailure(error: unknown): RuntimeTelcoCommandResult {
    return {
      ok: false,
      error: {
        code: 'TELCO_COMMAND_FAILED',
        message: error instanceof Error ? error.message : 'Runtime telco command failed.',
      },
    }
  }

  /** Serializes one transport command and reports its resulting state. */
  async function runCommand(command: () => void): Promise<RuntimeTelcoCommandResult> {
    if (destroyed) {
      return {
        ok: false,
        error: { code: 'TELCO_DESTROYED', message: 'Runtime telco has been destroyed.' },
      }
    }
    if (commandInFlight) {
      return {
        ok: false,
        error: { code: 'TELCO_COMMAND_IN_FLIGHT', message: 'Another telco command is in flight.' },
      }
    }

    commandInFlight = true
    notifyChange()
    try {
      command()
      return { ok: true }
    } catch (error) {
      return commandFailure(error)
    } finally {
      commandInFlight = false
      notifyChange()
      scheduleProgress()
    }
  }

  /** Pauses the target only when it is currently playing. */
  function pauseTarget(): void {
    if (target.getLifecycleState() === PLAYER_LIFECYCLE_PLAYING) target.pause()
  }

  /** Seeks the target and turns a rejected seek into a command failure. */
  function seekTarget(timeMs: number): void {
    if (!Number.isFinite(timeMs) || timeMs < 0) {
      throw new Error('Runtime telco seek time must be a finite positive number.')
    }
    const result = target.seek(Math.min(timeMs, options.durationMs))
    if (!result.ok) throw new Error('Runtime telco seek was rejected.')
  }

  const telco: RuntimeTelco = {
    getState,

    get commandInFlight(): boolean {
      return commandInFlight
    },

    play: () => runCommand(() => {
      const state = getState()
      if (state.status === PLAYER_LIFECYCLE_PLAYING) return
      if (state.status === PLAYER_LIFECYCLE_DESTROYED || state.status === PLAYER_LIFECYCLE_IDLE) {
        throw new Error(`Runtime telco cannot play from ${state.status} state.`)
      }
      if (state.sequenceEnded) seekTarget(0)
      target.play()
    }),

    pause: () => runCommand(pauseTarget),

    togglePlay: () => runCommand(() => {
      if (target.getLifecycleState() === PLAYER_LIFECYCLE_PLAYING) pauseTarget()
      else {
        const state = getState()
        if (state.status === PLAYER_LIFECYCLE_DESTROYED || state.status === PLAYER_LIFECYCLE_IDLE) {
          throw new Error(`Runtime telco cannot play from ${state.status} state.`)
        }
        if (state.sequenceEnded) seekTarget(0)
        target.play()
      }
    }),

    seek: (timeMs) => runCommand(() => {
      pauseTarget()
      seekTarget(timeMs)
    }),

    rewind: () => runCommand(() => {
      pauseTarget()
      seekTarget(0)
    }),

    onChange(listener) {
      changeListeners.add(listener)
      return () => { changeListeners.delete(listener) }
    },

    onProgress(listener) {
      progressListeners.add(listener)
      scheduleProgress()
      return () => {
        progressListeners.delete(listener)
        if (progressListeners.size === 0) stopProgress()
      }
    },

    destroy() {
      destroyed = true
      stopProgress()
      changeListeners.clear()
      progressListeners.clear()
    },
  }

  return telco
}

/** Keeps the imported lifecycle type visible to API consumers of this module. */
export type { PlayerLifecycleState }
