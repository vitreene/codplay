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
    schedule.repeat({ everyMs: 20, times: 2 }, ({ index }) => [{ name: `repeat-${index}` }])
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

  it('supports wait alias and direct repeat inputs', () => {
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

    schedule.wait(10, ({ elapsedMs }) => ({ name: `wait-${elapsedMs}` }))
    schedule.repeat({ everyMs: 20, times: 2 }, { name: 'repeat-direct' })
    schedule.resume()

    expect(emitted).toEqual(['repeat-direct'])

    nowMs += 10
    scheduler.flushNext()
    expect(emitted).toEqual(['repeat-direct', 'wait-10'])

    nowMs += 10
    scheduler.flushNext()
    expect(emitted).toEqual(['repeat-direct', 'wait-10', 'repeat-direct'])

    schedule.destroy()
  })

  it('applies stagger offsets to the list returned by one factory resolution', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const clock = new TimeClock(() => nowMs)
    const emitted: string[] = []
    const resolvedIndexes: number[] = []

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

    schedule.stagger({ stepMs: 15 }, ({ index }) => {
      resolvedIndexes.push(index)
      return [{ name: 'stagger-a' }, { name: 'stagger-b' }, { name: 'stagger-c' }]
    })
    schedule.resume()

    expect(resolvedIndexes).toEqual([0])
    expect(emitted).toEqual(['stagger-a'])

    nowMs += 15
    scheduler.flushNext()
    expect(emitted).toEqual(['stagger-a', 'stagger-b'])

    nowMs += 15
    scheduler.flushNext()
    expect(emitted).toEqual(['stagger-a', 'stagger-b', 'stagger-c'])

    schedule.destroy()
  })

  it('stops one loop after the requested number of occurrences', () => {
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

    schedule.loop({ eachMs: 20, until: { type: 'times', max: 2 } }, ({ index }) => [{ name: `loop-${index}` }])
    schedule.resume()

    expect(emitted).toEqual(['loop-0'])

    nowMs += 20
    scheduler.flushNext()
    expect(emitted).toEqual(['loop-0', 'loop-1'])

    nowMs += 20
    scheduler.flushNext()
    expect(emitted).toEqual(['loop-0', 'loop-1'])

    schedule.destroy()
  })

  it('keeps duration.maxMs inclusive for loop occurrences', () => {
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

    schedule.loop({ eachMs: 20, until: { type: 'duration', maxMs: 40 } }, ({ elapsedMs }) => [{ name: `loop-${elapsedMs}` }])
    schedule.resume()

    expect(emitted).toEqual(['loop-0'])

    nowMs += 20
    scheduler.flushNext()
    expect(emitted).toEqual(['loop-0', 'loop-20'])

    nowMs += 20
    scheduler.flushNext()
    expect(emitted).toEqual(['loop-0', 'loop-20', 'loop-40'])

    nowMs += 20
    scheduler.flushNext()
    expect(emitted).toEqual(['loop-0', 'loop-20', 'loop-40'])

    schedule.destroy()
  })

  it('stops one loop when its stop event is notified', () => {
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

    schedule.loop({ eachMs: 20, until: { type: 'event', name: 'quiz:stop' } }, ({ index }) => [{ name: `loop-${index}` }])
    schedule.resume()

    expect(emitted).toEqual(['loop-0'])

    schedule.notifyEvent('quiz:stop')

    nowMs += 20
    scheduler.flushNext()
    expect(emitted).toEqual(['loop-0'])

    schedule.destroy()
  })

  it('warns and falls back to jit when loop planned mode depends on one event stop', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const clock = new TimeClock(() => nowMs)
    const emitted: string[] = []
    const warnings: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
        return { ok: true, data: undefined }
      },
      emitWarning: (warning) => {
        warnings.push(warning)
      },
      tickerOptions: {
        clock,
        scheduler,
        intervalMs: 10,
        marginMs: 0,
        pauseOnDocumentHidden: false
      }
    })

    schedule.loop(
      { eachMs: 20, until: { type: 'event', name: 'quiz:stop' }, mode: 'planned' },
      ({ index }) => [{ name: `loop-${index}` }]
    )
    schedule.resume()

    expect(warnings).toEqual(['helper loop mode planned falls back to jit (until.event requires jit)'])
    expect(emitted).toEqual(['loop-0'])

    schedule.notifyEvent('quiz:stop')
    nowMs += 20
    scheduler.flushNext()

    expect(emitted).toEqual(['loop-0'])

    schedule.destroy()
  })

  it('passes a fresh readonly state snapshot to helper callbacks', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const clock = new TimeClock(() => nowMs)
    const observed: Array<{ currentTimeMs: number; elapsedMs: number; armed: boolean }> = []
    const state = { armed: false }

    const schedule = new PlayerScheduleFacade({
      emitEvent: async () => {
        return { ok: true, data: undefined }
      },
      resolveState: () => state,
      tickerOptions: {
        clock,
        scheduler,
        intervalMs: 10,
        marginMs: 0,
        pauseOnDocumentHidden: false
      }
    })

    schedule.repeat({ everyMs: 20, times: 2 }, ({ currentTimeMs, elapsedMs, state: helperState }) => {
      observed.push({
        currentTimeMs,
        elapsedMs,
        armed: helperState.armed === true
      })

      return [{ name: `armed-${helperState.armed === true ? 'yes' : 'no'}` }]
    })

    schedule.resume()
    state.armed = true

    nowMs += 20
    scheduler.flushNext()

    expect(observed).toEqual([
      { currentTimeMs: 0, elapsedMs: 0, armed: false },
      { currentTimeMs: 20, elapsedMs: 20, armed: true }
    ])

    schedule.destroy()
  })
})
