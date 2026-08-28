import type { PlayerApi } from '../player'
import type { TelcoApi, TelcoCommandResult, TelcoStateListener } from './types'
import type { ApiResult } from '../builder/types'

export type TickSubscriber = (callback: () => void) => () => void

export type CreateTelcoOptions = {
  subscribeOnTick?: TickSubscriber
}

/**
 * Creates one telco facade that serializes playback commands and drives the progress loop
 * via an injected tick subscriber rather than a direct requestAnimationFrame call.
 */
export function createTelco(player: PlayerApi, options?: CreateTelcoOptions): TelcoApi {
  const subscribeOnTick = options?.subscribeOnTick
  let _commandInFlight = false
  const changeListeners = new Set<TelcoStateListener>()
  const progressListeners = new Set<TelcoStateListener>()
  let cancelCurrentFrame: (() => void) | null = null

  function scheduleNextFrame(): void {
    if (subscribeOnTick === undefined || progressListeners.size === 0) return
    cancelCurrentFrame = subscribeOnTick(tick)
  }

  function tick(): void {
    cancelCurrentFrame = null
    const state = player.getState()
    for (const listener of progressListeners) {
      listener(state)
    }
    if (state.status === 'playing') {
      scheduleNextFrame()
    }
  }

  function stopProgressLoop(): void {
    cancelCurrentFrame?.()
    cancelCurrentFrame = null
  }

  player.onChange((state) => {
    for (const listener of changeListeners) {
      listener(state)
    }
    if (state.status === 'playing') {
      scheduleNextFrame()
    } else {
      stopProgressLoop()
    }
  })

  function toTelcoResult(result: ApiResult<void>): TelcoCommandResult {
    return result.ok ? { ok: true } : { ok: false, error: result.error }
  }

  async function runCommand(fn: () => Promise<ApiResult<void>>): Promise<TelcoCommandResult> {
    if (_commandInFlight) {
      return { ok: false, error: { code: 'TELCO_COMMAND_IN_FLIGHT' } }
    }
    _commandInFlight = true
    try {
      return toTelcoResult(await fn())
    } finally {
      _commandInFlight = false
    }
  }

  const api: TelcoApi = {
    getState() {
      return player.getState()
    },

    get commandInFlight(): boolean {
      return _commandInFlight
    },

    get rate(): number {
      return player.getRate()
    },

    setRate(rate: number): void {
      player.setRate(rate)
    },

    play() {
      return runCommand(() => player.play())
    },

    pause() {
      return runCommand(() => player.pause())
    },

    togglePlay() {
      const state = player.getState()
      if (state.status === 'playing') {
        return runCommand(() => player.pause())
      }
      return runCommand(() => player.play())
    },

    seek(targetMs: number) {
      return runCommand(() => player.seek({ timelineMs: targetMs }))
    },

    rewind() {
      return runCommand(() => player.rewind())
    },

    onChange(listener: TelcoStateListener): () => void {
      changeListeners.add(listener)
      return () => { changeListeners.delete(listener) }
    },

    onProgress(listener: TelcoStateListener): () => void {
      progressListeners.add(listener)
      return () => { progressListeners.delete(listener) }
    }
  }

  return api
}
