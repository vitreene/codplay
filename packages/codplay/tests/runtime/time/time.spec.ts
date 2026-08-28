import { describe, expect, it, vi } from 'vitest'

import { TimeClock } from '../../../src/runtime/time/clock'
import { TimeTicker, type FrameScheduler, type TickPayload, type VisibilityController } from '../../../src/runtime/time/ticker'

/** Provides deterministic visibility changes for ticker tests. */
class VisibilityControllerStub implements VisibilityController {
  private hidden = true
  private onChange: (() => void) | null = null

  /** Returns the current synthetic visibility state. */
  isHidden(): boolean {
    return this.hidden
  }

  /** Registers one synthetic visibility listener. */
  subscribe(callback: () => void): () => void {
    this.onChange = callback
    return () => {
      this.onChange = null
    }
  }

  /** Changes visibility without accessing the browser document. */
  setHidden(nextHidden: boolean): void {
    this.hidden = nextHidden
  }

  /** Emits one synthetic visibility event. */
  triggerChange(): void {
    this.onChange?.()
  }
}

/** Queues scheduler callbacks so each test controls one frame explicitly. */
class ManualFrameScheduler implements FrameScheduler {
  private nextRequestId = 1
  private readonly callbacks = new Map<number, () => void>()
  private readonly queue: number[] = []

  /** Queues one callback and returns its request identifier. */
  request(callback: () => void): number {
    const requestId = this.nextRequestId
    this.nextRequestId += 1
    this.callbacks.set(requestId, callback)
    this.queue.push(requestId)
    return requestId
  }

  /** Cancels one queued callback. */
  cancel(requestId: number): void {
    this.callbacks.delete(requestId)
  }

  /** Runs the next live callback, if one exists. */
  flushNext(): boolean {
    while (this.queue.length > 0) {
      const requestId = this.queue.shift()
      if (requestId === undefined) return false
      const callback = this.callbacks.get(requestId)
      if (callback === undefined) continue
      this.callbacks.delete(requestId)
      callback()
      return true
    }
    return false
  }
}

/** Advances virtual wall time and flushes one scheduled frame per step. */
function runFrames(
  scheduler: ManualFrameScheduler,
  advanceNowMs: (deltaMs: number) => void,
  frameCount: number,
  stepMs: number,
): void {
  for (let index = 0; index < frameCount; index += 1) {
    advanceNowMs(stepMs)
    scheduler.flushNext()
  }
}

describe('TimeClock', () => {
  it('keeps relative time and resets its origin with a new base', () => {
    let nowMs = 100
    const clock = new TimeClock(() => nowMs)

    expect(clock.nowMs()).toBe(0)
    nowMs = 125
    expect(clock.nowMs()).toBe(25)
    clock.reset(50)
    expect(clock.nowMs()).toBe(50)
    nowMs = 150
    expect(clock.nowMs()).toBe(75)
  })
})

describe('TimeTicker', () => {
  it('keeps start and stop idempotent', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const ticker = new TimeTicker({ clock: new TimeClock(() => nowMs), scheduler, intervalMs: 10, pauseOnDocumentHidden: false })
    const onTick = vi.fn<(payload: TickPayload) => void>()

    ticker.start(onTick)
    ticker.start(onTick)
    runFrames(scheduler, (deltaMs) => { nowMs += deltaMs }, 3, 10)
    expect(onTick).toHaveBeenCalledTimes(3)

    ticker.stop()
    ticker.stop()
    runFrames(scheduler, (deltaMs) => { nowMs += deltaMs }, 3, 10)
    expect(onTick).toHaveBeenCalledTimes(3)
  })

  it('emits monotonic payloads with exact deltas and margin', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const ticker = new TimeTicker({
      clock: new TimeClock(() => nowMs),
      scheduler,
      intervalMs: 10,
      marginMs: 9,
      pauseOnDocumentHidden: false,
    })
    const ticks: TickPayload[] = []

    ticker.start((payload) => ticks.push(payload))
    runFrames(scheduler, (deltaMs) => { nowMs += deltaMs }, 4, 10)
    ticker.stop()

    expect(ticks).toHaveLength(4)
    for (const tick of ticks) {
      expect(tick.nowMs).toBeGreaterThanOrEqual(tick.prevMs)
      expect(tick.deltaMs).toBe(tick.nowMs - tick.prevMs)
      expect(tick.marginMs).toBe(9)
    }
  })

  it('pauses and resumes scheduling on visibility changes', () => {
    const visibilityController = new VisibilityControllerStub()
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const ticker = new TimeTicker({
      clock: new TimeClock(() => nowMs),
      scheduler,
      intervalMs: 10,
      pauseOnDocumentHidden: true,
      visibilityController,
    })
    const onTick = vi.fn<(payload: TickPayload) => void>()

    ticker.start(onTick)
    runFrames(scheduler, (deltaMs) => { nowMs += deltaMs }, 3, 10)
    expect(onTick).toHaveBeenCalledTimes(0)

    visibilityController.setHidden(false)
    visibilityController.triggerChange()
    runFrames(scheduler, (deltaMs) => { nowMs += deltaMs }, 3, 10)
    expect(onTick).toHaveBeenCalledTimes(3)

    visibilityController.setHidden(true)
    visibilityController.triggerChange()
    runFrames(scheduler, (deltaMs) => { nowMs += deltaMs }, 3, 10)
    expect(onTick).toHaveBeenCalledTimes(3)
    ticker.stop()
  })
})
