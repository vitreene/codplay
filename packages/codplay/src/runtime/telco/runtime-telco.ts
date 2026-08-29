import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  PLAYER_LIFECYCLE_PLAYING,
  type PlayerLifecycleState,
} from '../config/player-lifecycle'
import type {
  RuntimeTelco,
  RuntimeTelcoCommandResult,
  RuntimeTelcoOptions,
  RuntimeTelcoProgress,
  RuntimeTelcoState,
} from './types'

/** Creates one transport facade around an already initialized V2 runtime target. */
export function createRuntimeTelco(options: RuntimeTelcoOptions): RuntimeTelco {
  if (options.durationMs !== undefined
    && (!Number.isFinite(options.durationMs) || options.durationMs <= 0)) {
    throw new Error('Runtime telco durationMs must be a finite positive number.')
  }

  const target = options.target
  const changeListeners = new Set<(state: RuntimeTelcoState) => void>()
  const progressListeners = new Set<(state: RuntimeTelcoState) => void>()
  let commandInFlight = false
  let runtimeRevision = 0
  let stopTargetSubscription: (() => void) | null = null
  let endClampScheduled = false
  let destroyed = false
  let observedTargetState: Readonly<{
    status: PlayerLifecycleState
    sequenceEnded: boolean
  }> | undefined

  /** Reads the fixed or currently discovered duration without clamping the head. */
  function resolveDurationMs(timelineMs: number): number {
    if (options.durationMs !== undefined) return options.durationMs
    const discovered = options.target.getDurationMs?.()
    if (discovered === undefined || !Number.isFinite(discovered) || discovered < 0) return timelineMs
    return Math.max(timelineMs, discovered)
  }

  /** Reads one immutable transport snapshot from the target. */
  function getState(): RuntimeTelcoState {
    const status = target.getLifecycleState()
    const timelineMs = Math.max(0, target.getCurrentTimeMs())
    const durationMs = resolveDurationMs(timelineMs)
    return {
      status,
      timelineMs,
      durationMs,
      rate: target.getRate(),
      initialized: status !== PLAYER_LIFECYCLE_IDLE && status !== PLAYER_LIFECYCLE_DESTROYED,
      sequenceEnded: target.getSequenceEnded?.() === true
        || (options.durationMs !== undefined && timelineMs >= options.durationMs),
      runtimeRevision,
    }
  }

  observedTargetState = (() => {
    const state = getState()
    return { status: state.status, sequenceEnded: state.sequenceEnded }
  })()

  /** Reads the current timeline position and duration without presentation data. */
  function getProgress(): RuntimeTelcoProgress {
    const state = getState()
    return { timelineMs: state.timelineMs, durationMs: state.durationMs }
  }

  /** Notifies state listeners after one transport state transition. */
  function notifyChange(): void {
    runtimeRevision += 1
    const state = getState()
    observedTargetState = { status: state.status, sequenceEnded: state.sequenceEnded }
    for (const listener of changeListeners) listener(state)
  }

  /** Publishes progress and relays target lifecycle changes from the existing update. */
  function publishProgress(): void {
    if (destroyed) return
    let state = getState()
    if (observedTargetState?.status !== state.status
      || observedTargetState.sequenceEnded !== state.sequenceEnded) {
      notifyChange()
      state = getState()
    }
    for (const listener of [...progressListeners]) {
      try {
        listener(state)
      } catch {
        // A remote observer must not interrupt the engine's update circuit.
      }
    }

    if (options.durationMs === undefined
      || state.status !== PLAYER_LIFECYCLE_PLAYING
      || !state.sequenceEnded
      || endClampScheduled) return
    const fixedDurationMs = options.durationMs
    endClampScheduled = true
    queueMicrotask(() => {
      endClampScheduled = false
      if (destroyed) return
      const current = getState()
      if (current.status !== PLAYER_LIFECYCLE_PLAYING || !current.sequenceEnded) return
      target.pause()
      const seekResult = target.seek(fixedDurationMs)
      if (seekResult.ok) notifyChange()
    })
  }

  /** Subscribes to the target while state or progress listeners exist. */
  function startTargetObservation(): void {
    if (destroyed || stopTargetSubscription !== null
      || (progressListeners.size === 0 && changeListeners.size === 0)) return
    stopTargetSubscription = target.subscribe(publishProgress)
  }

  /** Removes the target subscription when no state or progress listener remains. */
  function stopTargetObservation(): void {
    stopTargetSubscription?.()
    stopTargetSubscription = null
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
    }
  }

  /** Pauses the target only when it is currently playing. */
  function pauseTarget(): void {
    if (target.getLifecycleState() === PLAYER_LIFECYCLE_PLAYING) target.pause()
  }

  /** Seeks the target and turns a rejected seek into a command failure. */
  function seekTarget(timeMs: number): void {
    if (!Number.isFinite(timeMs) || timeMs < 0) {
      throw new Error('Runtime telco seek time must be finite and non-negative.')
    }
    const result = target.seek(
      options.durationMs === undefined ? timeMs : Math.min(timeMs, options.durationMs),
    )
    if (!result.ok) throw new Error('Runtime telco seek was rejected.')
  }

  const telco: RuntimeTelco = {
    getState,
    getProgress,

    get rate(): number {
      return target.getRate()
    },

    get commandInFlight(): boolean {
      return commandInFlight
    },

    play: () => runCommand(() => {
      const state = getState()
      if (state.status === PLAYER_LIFECYCLE_PLAYING) return
      if (state.status === PLAYER_LIFECYCLE_DESTROYED || state.status === PLAYER_LIFECYCLE_IDLE) {
        throw new Error(`Runtime telco cannot play from ${state.status} state.`)
      }
      if (state.sequenceEnded && target.getSequenceEnded?.() !== true) seekTarget(0)
      target.play()
    }),

    pause: () => runCommand(pauseTarget),

    setRate: (rate) => {
      if (destroyed) throw new Error('Runtime telco has been destroyed.')
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('Runtime telco rate must be a finite positive number.')
      }
      target.setRate(rate)
      notifyChange()
    },

    togglePlay: () => runCommand(() => {
      if (target.getLifecycleState() === PLAYER_LIFECYCLE_PLAYING) pauseTarget()
      else {
        const state = getState()
        if (state.status === PLAYER_LIFECYCLE_DESTROYED || state.status === PLAYER_LIFECYCLE_IDLE) {
          throw new Error(`Runtime telco cannot play from ${state.status} state.`)
        }
        if (state.sequenceEnded && target.getSequenceEnded?.() !== true) seekTarget(0)
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
      startTargetObservation()
      return () => {
        changeListeners.delete(listener)
        if (changeListeners.size === 0 && progressListeners.size === 0) stopTargetObservation()
      }
    },

    onProgress(listener) {
      progressListeners.add(listener)
      startTargetObservation()
      return () => {
        progressListeners.delete(listener)
        if (progressListeners.size === 0 && changeListeners.size === 0) stopTargetObservation()
      }
    },

    destroy() {
      destroyed = true
      stopTargetObservation()
      changeListeners.clear()
      progressListeners.clear()
    },
  }

  return telco
}

/** Keeps the imported lifecycle type visible to API consumers of this module. */
export type { PlayerLifecycleState }
