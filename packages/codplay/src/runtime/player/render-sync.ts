import type { RenderAdapter, RenderSeekInfo, RenderTickInfo } from './render-adapter-types'

/** Coordinates render adapters and owns their wall-clock baselines. */
export class RenderSync {
  private readonly adapters: readonly RenderAdapter[]
  private lastNowMs: number | null = null

  /** Creates a render synchronization boundary in adapter registration order. */
  constructor(adapters: readonly RenderAdapter[]) {
    this.adapters = adapters
  }

  /** Sends one frame while computing wall and timeline deltas. */
  tick(nowMs: number, timelineMs: number, rate: number): void {
    const deltaMs = this.lastNowMs !== null ? nowMs - this.lastNowMs : 0
    this.lastNowMs = nowMs
    const info: RenderTickInfo = {
      nowMs,
      deltaMs,
      timelineMs,
      timelineDeltaMs: deltaMs * rate,
      rate,
    }
    for (const adapter of this.adapters) {
      try {
        adapter.tick(info)
      } catch {
        // One adapter must not prevent the remaining adapters from rendering.
      }
    }
  }

  /** Resets adapter-local state before the player reconstructs a seek. */
  prepareSeek(): void {
    for (const adapter of this.adapters) {
      try {
        adapter.prepareSeek?.()
      } catch {
        // Adapter warnings do not interrupt seek reconstruction.
      }
    }
  }

  /** Sends one reconstructed seek position and establishes its baseline. */
  seek(nowMs: number, timelineMs: number): void {
    this.lastNowMs = nowMs
    const info: RenderSeekInfo = { nowMs, timelineMs }
    for (const adapter of this.adapters) {
      try {
        adapter.seek(info)
      } catch {
        // One adapter must not prevent the remaining adapters from seeking.
      }
    }
  }

  /** Notifies adapters that the player paused. */
  pause(): void {
    for (const adapter of this.adapters) {
      try {
        adapter.pause?.()
      } catch {
        // Adapter warnings do not interrupt player lifecycle changes.
      }
    }
  }

  /** Clears the wall-clock baseline before the first frame after resume. */
  resume(): void {
    this.lastNowMs = null
    for (const adapter of this.adapters) {
      try {
        adapter.resume?.()
      } catch {
        // Adapter warnings do not interrupt player lifecycle changes.
      }
    }
  }

  /** Notifies adapters of a playback-rate change. */
  rateChange(rate: number): void {
    for (const adapter of this.adapters) {
      try {
        adapter.rateChange?.(rate)
      } catch {
        // Adapter warnings do not interrupt player lifecycle changes.
      }
    }
  }

  /** Clears the baseline and releases adapters when playback stops. */
  stop(): void {
    this.lastNowMs = null
    for (const adapter of this.adapters) {
      try {
        adapter.stop?.()
      } catch {
        // Adapter warnings do not interrupt player destruction.
      }
    }
  }
}
