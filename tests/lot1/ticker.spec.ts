import { describe, expect, it, vi } from 'vitest'

import { TimeClock } from '../../src/core/time/clock'
import { TimeTicker, type FrameScheduler, type TickPayload, type VisibilityController } from '../../src/core/time/ticker'

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

class ManualFrameScheduler implements FrameScheduler {
  private nextRequestId = 1
  private readonly callbacks = new Map<number, () => void>()
  private readonly queue: number[] = []

  /**
   * Queues one frame callback and returns its scheduler request id.
   */
  request(callback: () => void): number {
    const requestId = this.nextRequestId
    this.nextRequestId += 1
    this.callbacks.set(requestId, callback)
    this.queue.push(requestId)
    return requestId
  }

  /**
   * Cancels one queued frame callback.
   */
  cancel(requestId: number): void {
    this.callbacks.delete(requestId)
  }

  /**
   * Executes the next queued callback, if any.
   */
  flushNext(): boolean {
    while (this.queue.length > 0) {
      const requestId = this.queue.shift()
      if (requestId === undefined) {
        return false
      }

      const callback = this.callbacks.get(requestId)
      if (callback === undefined) {
        continue
      }

      this.callbacks.delete(requestId)
      callback()
      return true
    }

    return false
  }
}

/**
 * Advances virtual time and flushes exactly one frame callback per step.
 */
function temp__runFrames(
  scheduler: ManualFrameScheduler,
  advanceNowMs: (deltaMs: number) => void,
  frameCount: number,
  stepMs: number
): void {
  for (let index = 0; index < frameCount; index += 1) {
    advanceNowMs(stepMs)
    scheduler.flushNext()
  }
}

describe('Lot 01 - timer/ticker', () => {
  it('L1-T1 start/stop are idempotent', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const clock = new TimeClock(() => nowMs)
    const ticker = new TimeTicker({ clock, scheduler, intervalMs: 10, marginMs: 5, pauseOnDocumentHidden: false })
    const onTick = vi.fn<(payload: TickPayload) => void>()

    ticker.start(onTick)
    ticker.start(onTick)

    temp__runFrames(scheduler, (deltaMs) => {
      nowMs += deltaMs
    }, 3, 10)
    expect(onTick).toHaveBeenCalledTimes(3)

    ticker.stop()
    ticker.stop()

    temp__runFrames(scheduler, (deltaMs) => {
      nowMs += deltaMs
    }, 3, 10)
    expect(onTick).toHaveBeenCalledTimes(3)
  })

  it('L1-T2 ticker payload remains monotonic', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const clock = new TimeClock(() => nowMs)
    const ticker = new TimeTicker({ clock, scheduler, intervalMs: 10, marginMs: 2, pauseOnDocumentHidden: false })
    const ticks: TickPayload[] = []

    ticker.start((payload) => {
      ticks.push(payload)
    })

    temp__runFrames(scheduler, (deltaMs) => {
      nowMs += deltaMs
    }, 5, 10)
    ticker.stop()

    expect(ticks.length).toBeGreaterThan(0)

    for (const tick of ticks) {
      expect(tick.nowMs).toBeGreaterThanOrEqual(tick.prevMs)
    }
  })

  it('L1-T3 deltaMs equals nowMs - prevMs', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const clock = new TimeClock(() => nowMs)
    const ticker = new TimeTicker({ clock, scheduler, intervalMs: 10, marginMs: 0, pauseOnDocumentHidden: false })
    const ticks: TickPayload[] = []

    ticker.start((payload) => {
      ticks.push(payload)
    })

    temp__runFrames(scheduler, (deltaMs) => {
      nowMs += deltaMs
    }, 4, 10)
    ticker.stop()

    expect(ticks.length).toBeGreaterThan(0)

    for (const tick of ticks) {
      expect(tick.deltaMs).toBe(tick.nowMs - tick.prevMs)
    }
  })

  it('L1-T4 ticker emits minimal payload including marginMs', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const clock = new TimeClock(() => nowMs)
    const ticker = new TimeTicker({ clock, scheduler, intervalMs: 10, marginMs: 9, pauseOnDocumentHidden: false })
    const ticks: TickPayload[] = []

    ticker.start((payload) => {
      ticks.push(payload)
    })

    temp__runFrames(scheduler, (deltaMs) => {
      nowMs += deltaMs
    }, 1, 10)
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
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()

    const clock = new TimeClock(() => nowMs)
    const ticker = new TimeTicker({
      clock,
      scheduler,
      intervalMs: 10,
      marginMs: 0,
      pauseOnDocumentHidden: true,
      visibilityController
    })
    const onTick = vi.fn<(payload: TickPayload) => void>()

    ticker.start(onTick)

    temp__runFrames(scheduler, (deltaMs) => {
      nowMs += deltaMs
    }, 3, 10)
    expect(onTick).toHaveBeenCalledTimes(0)

    visibilityController.setHidden(false)
    visibilityController.triggerChange()

    temp__runFrames(scheduler, (deltaMs) => {
      nowMs += deltaMs
    }, 3, 10)
    expect(onTick).toHaveBeenCalledTimes(3)

    visibilityController.setHidden(true)
    visibilityController.triggerChange()

    temp__runFrames(scheduler, (deltaMs) => {
      nowMs += deltaMs
    }, 3, 10)
    expect(onTick).toHaveBeenCalledTimes(3)

    ticker.stop()
  })
})
