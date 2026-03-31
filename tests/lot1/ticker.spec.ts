import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createClock } from '../../src/core/time/clock'
import { createTicker, type TickPayload, type VisibilityController } from '../../src/core/time/ticker'

class VisibilityControllerStub implements VisibilityController {
  private hidden = true
  private onChange: (() => void) | null = null

  /**
   * Returns the current document visibility state for tests.
   */
  isHidden(): boolean {
    return this.hidden
  }

  /**
   * Registers one visibility change callback and returns an unsubscribe function.
   */
  subscribe(callback: () => void): () => void {
    this.onChange = callback
    return () => {
      this.onChange = null
    }
  }

  /**
   * Updates hidden state in the test harness.
   */
  setHidden(nextHidden: boolean): void {
    this.hidden = nextHidden
  }

  /**
   * Emits one synthetic visibility change event.
   */
  triggerChange(): void {
    this.onChange?.()
  }
}

describe('Lot 01 - timer/ticker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('L1-T1 start/stop are idempotent', () => {
    const clock = createClock(() => Date.now())
    const ticker = createTicker({ clock, intervalMs: 10, marginMs: 5 })
    const onTick = vi.fn<(payload: TickPayload) => void>()

    ticker.start(onTick)
    ticker.start(onTick)

    vi.advanceTimersByTime(30)
    expect(onTick).toHaveBeenCalledTimes(3)

    ticker.stop()
    ticker.stop()

    vi.advanceTimersByTime(30)
    expect(onTick).toHaveBeenCalledTimes(3)
  })

  it('L1-T2 ticker payload remains monotonic', () => {
    const clock = createClock(() => Date.now())
    const ticker = createTicker({ clock, intervalMs: 10, marginMs: 2 })
    const ticks: TickPayload[] = []

    ticker.start((payload) => {
      ticks.push(payload)
    })

    vi.advanceTimersByTime(50)
    ticker.stop()

    expect(ticks.length).toBeGreaterThan(0)

    for (const tick of ticks) {
      expect(tick.nowMs).toBeGreaterThanOrEqual(tick.prevMs)
    }
  })

  it('L1-T3 deltaMs equals nowMs - prevMs', () => {
    const clock = createClock(() => Date.now())
    const ticker = createTicker({ clock, intervalMs: 10, marginMs: 0 })
    const ticks: TickPayload[] = []

    ticker.start((payload) => {
      ticks.push(payload)
    })

    vi.advanceTimersByTime(40)
    ticker.stop()

    expect(ticks.length).toBeGreaterThan(0)

    for (const tick of ticks) {
      expect(tick.deltaMs).toBe(tick.nowMs - tick.prevMs)
    }
  })

  it('L1-T4 ticker emits minimal payload including marginMs', () => {
    const clock = createClock(() => Date.now())
    const ticker = createTicker({ clock, intervalMs: 10, marginMs: 9 })
    const ticks: TickPayload[] = []

    ticker.start((payload) => {
      ticks.push(payload)
    })

    vi.advanceTimersByTime(10)
    ticker.stop()

    expect(ticks).toHaveLength(1)
    expect(ticks[0]).toEqual({
      prevMs: expect.any(Number),
      nowMs: expect.any(Number),
      deltaMs: expect.any(Number),
      marginMs: 9
    })
  })

  it('L1-T5 ticker pauses and resumes on visibility changes', () => {
    const visibilityController = new VisibilityControllerStub()

    const clock = createClock(() => Date.now())
    const ticker = createTicker({
      clock,
      intervalMs: 10,
      marginMs: 0,
      pauseOnDocumentHidden: true,
      visibilityController
    })
    const onTick = vi.fn<(payload: TickPayload) => void>()

    ticker.start(onTick)

    vi.advanceTimersByTime(30)
    expect(onTick).toHaveBeenCalledTimes(0)

    visibilityController.setHidden(false)
    visibilityController.triggerChange()

    vi.advanceTimersByTime(30)
    expect(onTick).toHaveBeenCalledTimes(3)

    visibilityController.setHidden(true)
    visibilityController.triggerChange()

    vi.advanceTimersByTime(30)
    expect(onTick).toHaveBeenCalledTimes(3)

    ticker.stop()
  })
})
