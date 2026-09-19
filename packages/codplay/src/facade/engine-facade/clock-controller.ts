import type { RuntimeEngine } from '../../runtime/engine'
import type { Ticker } from '../../runtime/time'
import { DiagnosticChannel, publishFacadeError } from '../diagnostic-channel'

/** Coordinates the one shared runtime clock and instance playback demand. */
export class EngineClockController {
  private readonly playingInstanceIds = new Set<string>()
  private readonly runtimeEngine: RuntimeEngine
  private readonly defaultTicker: Ticker | undefined
  private readonly diagnostics: DiagnosticChannel
  private readonly isDestroyed: () => boolean
  private externalClockMode = false

  constructor(
    runtimeEngine: RuntimeEngine,
    defaultTicker: Ticker | undefined,
    diagnostics: DiagnosticChannel,
    isDestroyed: () => boolean,
  ) {
    this.runtimeEngine = runtimeEngine
    this.defaultTicker = defaultTicker
    this.diagnostics = diagnostics
    this.isDestroyed = isDestroyed
  }

  /** Starts the owned ticker or resumes the external clock mode. */
  start(): void {
    this.run('CODPLAY_ENGINE_START_FAILED', () => {
      this.runtimeEngine.start(this.externalClockMode ? undefined : this.defaultTicker)
    })
  }

  /** Suspends frame propagation without changing instance positions. */
  pause(): void {
    this.run('CODPLAY_ENGINE_PAUSE_FAILED', () => this.runtimeEngine.pause())
  }

  /** Stops frame propagation without destroying managed instances. */
  stop(): void {
    this.run('CODPLAY_ENGINE_STOP_FAILED', () => this.runtimeEngine.stop())
  }

  /** Accepts one host-supplied frame through the shared engine clock. */
  advance(nowMs: number, marginMs = 0): void {
    this.run('CODPLAY_ENGINE_ADVANCE_FAILED', () => {
      this.runtimeEngine.advance(nowMs, marginMs)
      this.externalClockMode = true
    })
  }

  /** Removes one instance from playback demand after its teardown. */
  removeInstance(instanceId: string): void {
    this.playingInstanceIds.delete(instanceId)
    this.pauseWhenIdle()
  }

  /** Wakes or suspends the shared clock from one instance state transition. */
  syncPlayback(instanceId: string, state: 'playing' | 'paused'): void {
    if (this.isDestroyed()) return
    if (state === 'playing') this.playingInstanceIds.add(instanceId)
    else this.playingInstanceIds.delete(instanceId)

    if (this.playingInstanceIds.size > 0) {
      this.run('CODPLAY_ENGINE_AUTO_START_FAILED', () => {
        this.runtimeEngine.start(this.externalClockMode ? undefined : this.defaultTicker)
      })
      return
    }
    this.pauseWhenIdle()
  }

  /** Stops the shared runtime engine after all instances have been destroyed. */
  destroy(): void {
    this.playingInstanceIds.clear()
    this.runtimeEngine.destroy()
  }

  /** Publishes one engine operation failure without throwing through the facade. */
  private run(code: string, operation: () => void): void {
    if (this.isDestroyed()) return
    try {
      operation()
    } catch (error) {
      publishFacadeError(this.diagnostics, code, error)
    }
  }

  /** Suspends the shared clock when no instance still requests playback. */
  private pauseWhenIdle(): void {
    if (this.playingInstanceIds.size > 0 || this.isDestroyed()) return
    this.run('CODPLAY_ENGINE_AUTO_PAUSE_FAILED', () => this.runtimeEngine.pause())
  }
}
