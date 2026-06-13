import type { RenderAdapter, RenderSeekInfo, RenderTickInfo } from './render-adapter-types'

/**
 * Orchestrates a list of RenderAdapters, computing deltaMs from wall-clock timestamps
 * and dispatching tick/seek/lifecycle signals to each adapter in registration order.
 *
 * - deltaMs is always 0 on the first tick after play or resume.
 * - seek() resets the delta baseline so the next tick starts fresh.
 * - Errors in one adapter are caught and do not interrupt the others.
 */
export class RenderSync {
  private readonly adapters: readonly RenderAdapter[]
  private lastNowMs: number | null = null

  constructor(adapters: readonly RenderAdapter[]) {
    this.adapters = adapters
  }

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
        // adapter errors are author warnings — do not propagate
      }
    }
  }

  seek(nowMs: number, timelineMs: number): void {
    this.lastNowMs = nowMs
    const info: RenderSeekInfo = { nowMs, timelineMs }
    for (const adapter of this.adapters) {
      try {
        adapter.seek(info)
      } catch {
        // adapter errors are author warnings — do not propagate
      }
    }
  }

  pause(): void {
    for (const adapter of this.adapters) {
      try { adapter.pause?.() } catch {}
    }
  }

  resume(): void {
    this.lastNowMs = null
    for (const adapter of this.adapters) {
      try { adapter.resume?.() } catch {}
    }
  }

  rateChange(rate: number): void {
    for (const adapter of this.adapters) {
      try { adapter.rateChange?.(rate) } catch {}
    }
  }

  stop(): void {
    this.lastNowMs = null
    for (const adapter of this.adapters) {
      try { adapter.stop?.() } catch {}
    }
  }
}
