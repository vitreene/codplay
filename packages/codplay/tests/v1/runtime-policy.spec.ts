import { describe, expect, it } from 'vitest'

import { PlayerScheduleFacade } from '../../src/player/player-schedule'
import { createRuntimeEventPolicy } from '../../src/player/runtime-policy'

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
    const emitted: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
      },
      policy: { maxEventsPerTick: 2 },
    })

    schedule.delay(0, { name: 'one' })
    schedule.delay(0, { name: 'two' })
    schedule.delay(0, { name: 'three' })
    schedule.tick(0)

    expect(emitted).toEqual(['one', 'two'])

    schedule.tick(1)

    expect(emitted).toEqual(['one', 'two', 'three'])

    schedule.destroy()
  })

  it('coalesces same-tick helper events when configured', () => {
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
    })

    schedule.delay(0, { name: 'pulse', data: { version: 1 } })
    schedule.delay(0, { name: 'pulse', data: { version: 2 } })
    schedule.delay(0, { name: 'other' })
    schedule.tick(0)

    expect(emitted).toEqual(['pulse', 'other'])

    schedule.destroy()
  })
})
