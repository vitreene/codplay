import { describe, expect, it } from 'vitest'

import { TimeClock } from '../../src/core/time/clock'
import { type FrameScheduler } from '../../src/core/time/ticker'
import { PlayerScheduleFacade } from '../../src/player/player-schedule'

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

describe('V1 - player schedule', () => {
  it('runs delay, repeat, and stagger helpers in order', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const clock = new TimeClock(() => nowMs)
    const emitted: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
        return { ok: true, data: undefined }
      },
      tickerOptions: {
        clock,
        scheduler,
        intervalMs: 10,
        marginMs: 0,
        pauseOnDocumentHidden: false
      }
    })

    const cancelled = schedule.delay(40, { name: 'cancelled' })
    schedule.delay(30, { name: 'delay' })
    schedule.repeat({ everyMs: 20, times: 2 }, (index) => [{ name: `repeat-${index}` }])
    const staggerHandles = schedule.stagger({ stepMs: 15 }, [{ name: 'stagger-0' }, { name: 'stagger-1' }])

    cancelled.cancel()
    staggerHandles[0].cancel()
    schedule.resume()

    expect(emitted).toEqual(['repeat-0'])

    nowMs += 15
    scheduler.flushNext()
    expect(emitted).toEqual(['repeat-0', 'stagger-1'])

    nowMs += 5
    scheduler.flushNext()
    expect(emitted).toEqual(['repeat-0', 'stagger-1', 'repeat-1'])

    nowMs += 10
    scheduler.flushNext()
    expect(emitted).toEqual(['repeat-0', 'stagger-1', 'repeat-1', 'delay'])

    schedule.destroy()
  })
})
