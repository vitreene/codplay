import { describe, expect, it } from 'vitest'

import { TimeClock } from '../../src/core/time/clock'
import { type FrameScheduler } from '../../src/core/time/ticker'
import { PlayerScheduleFacade } from '../../src/player/player-schedule'
import { createRuntimeEventPolicy } from '../../src/player/runtime-policy'

class ManualFrameScheduler implements FrameScheduler {
  private nextRequestId = 1
  private readonly callbacks = new Map<number, () => void>()
  private readonly queue: number[] = []

  request(callback: () => void): number {
    const requestId = this.nextRequestId
    this.nextRequestId += 1
    this.callbacks.set(requestId, callback)
    this.queue.push(requestId)
    return requestId
  }

  cancel(requestId: number): void {
    this.callbacks.delete(requestId)
  }

  flushNext(): boolean {
    while (this.queue.length > 0) {
      const requestId = this.queue.shift()
      if (requestId === undefined) {
        return false
      }

      const callback = this.callbacks.get(requestId)
      if (!callback) {
        continue
      }

      this.callbacks.delete(requestId)
      callback()
      return true
    }

    return false
  }
}

describe('Runtime policy', () => {
  it('merges the default guardrails', () => {
    expect(createRuntimeEventPolicy()).toMatchObject({
      maxEventsPerTick: 1000,
      maxCascadeDepth: 16,
      sameTickHandling: { mode: 'keep-all' },
      strapErrorHandling: { mode: 'continue-with-warning' },
      masterClock: {
        unique: true,
        previousMasterAction: 'pause',
        fallbackToTicker: true
      },
      rejectUnknownPersoTarget: false,
      rejectInvalidPayload: false
    })
  })

  it('limits helper emissions per tick when configured', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const clock = new TimeClock(() => nowMs)
    const emitted: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
      },
      policy: { maxEventsPerTick: 2 },
      tickerOptions: {
        clock,
        scheduler,
        intervalMs: 10,
        marginMs: 0,
        pauseOnDocumentHidden: false
      }
    })

    schedule.delay(0, { name: 'one' })
    schedule.delay(0, { name: 'two' })
    schedule.delay(0, { name: 'three' })
    schedule.resume()

    expect(emitted).toEqual(['one', 'two'])

    nowMs += 10
    scheduler.flushNext()

    expect(emitted).toEqual(['one', 'two', 'three'])

    schedule.destroy()
  })

  it('coalesces same-tick helper events when configured', () => {
    let nowMs = 0
    const scheduler = new ManualFrameScheduler()
    const clock = new TimeClock(() => nowMs)
    const emitted: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
      },
      policy: {
        sameTickHandling: {
          mode: 'coalesce-last',
          eventNames: ['pulse']
        }
      },
      tickerOptions: {
        clock,
        scheduler,
        intervalMs: 10,
        marginMs: 0,
        pauseOnDocumentHidden: false
      }
    })

    schedule.delay(0, { name: 'pulse', data: { version: 1 } })
    schedule.delay(0, { name: 'pulse', data: { version: 2 } })
    schedule.delay(0, { name: 'other' })
    schedule.resume()

    expect(emitted).toEqual(['pulse', 'other'])

    schedule.destroy()
  })
})
