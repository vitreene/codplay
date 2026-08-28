import { describe, expect, it } from 'vitest'

import { PlayerScheduleFacade } from '../../src/player/player-schedule'

describe('V1 - player schedule', () => {
  it('runs delay, repeat, and stagger helpers in order', () => {
    const emitted: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
        return { ok: true, data: undefined }
      },
    })

    const cancelled = schedule.delay(40, { name: 'cancelled' })
    schedule.delay(30, { name: 'delay' })
    schedule.repeat({ everyMs: 20, times: 2 }, ({ index }) => [{ name: `repeat-${index}` }])
    const staggerHandles = schedule.stagger({ stepMs: 15 }, [{ name: 'stagger-0' }, { name: 'stagger-1' }])

    cancelled.cancel()
    staggerHandles[0].cancel()
    schedule.tick(0)

    expect(emitted).toEqual(['repeat-0'])

    schedule.tick(15)
    expect(emitted).toEqual(['repeat-0', 'stagger-1'])

    schedule.tick(5)
    expect(emitted).toEqual(['repeat-0', 'stagger-1', 'repeat-1'])

    schedule.tick(10)
    expect(emitted).toEqual(['repeat-0', 'stagger-1', 'repeat-1', 'delay'])

    schedule.destroy()
  })

  it('supports wait alias and direct repeat inputs', () => {
    const emitted: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
        return { ok: true, data: undefined }
      },
    })

    schedule.wait(10, ({ elapsedMs }) => ({ name: `wait-${elapsedMs}` }))
    schedule.repeat({ everyMs: 20, times: 2 }, { name: 'repeat-direct' })
    schedule.tick(0)

    expect(emitted).toEqual(['repeat-direct'])

    schedule.tick(10)
    expect(emitted).toEqual(['repeat-direct', 'wait-10'])

    schedule.tick(10)
    expect(emitted).toEqual(['repeat-direct', 'wait-10', 'repeat-direct'])

    schedule.destroy()
  })

  it('applies stagger offsets to the list returned by one factory resolution', () => {
    const emitted: string[] = []
    const resolvedIndexes: number[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
        return { ok: true, data: undefined }
      },
    })

    schedule.stagger({ stepMs: 15 }, ({ index }) => {
      resolvedIndexes.push(index)
      return [{ name: 'stagger-a' }, { name: 'stagger-b' }, { name: 'stagger-c' }]
    })
    schedule.tick(0)

    expect(resolvedIndexes).toEqual([0])
    expect(emitted).toEqual(['stagger-a'])

    schedule.tick(15)
    expect(emitted).toEqual(['stagger-a', 'stagger-b'])

    schedule.tick(15)
    expect(emitted).toEqual(['stagger-a', 'stagger-b', 'stagger-c'])

    schedule.destroy()
  })

  it('stops one loop after the requested number of occurrences', () => {
    const emitted: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
        return { ok: true, data: undefined }
      },
    })

    schedule.loop({ eachMs: 20, until: { type: 'times', max: 2 } }, ({ index }) => [{ name: `loop-${index}` }])
    schedule.tick(0)

    expect(emitted).toEqual(['loop-0'])

    schedule.tick(20)
    expect(emitted).toEqual(['loop-0', 'loop-1'])

    schedule.tick(20)
    expect(emitted).toEqual(['loop-0', 'loop-1'])

    schedule.destroy()
  })

  it('keeps duration.maxMs inclusive for loop occurrences', () => {
    const emitted: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
        return { ok: true, data: undefined }
      },
    })

    schedule.loop({ eachMs: 20, until: { type: 'duration', maxMs: 40 } }, ({ elapsedMs }) => [{ name: `loop-${elapsedMs}` }])
    schedule.tick(0)

    expect(emitted).toEqual(['loop-0'])

    schedule.tick(20)
    expect(emitted).toEqual(['loop-0', 'loop-20'])

    schedule.tick(20)
    expect(emitted).toEqual(['loop-0', 'loop-20', 'loop-40'])

    schedule.tick(20)
    expect(emitted).toEqual(['loop-0', 'loop-20', 'loop-40'])

    schedule.destroy()
  })

  it('stops one loop when its stop event is notified', () => {
    const emitted: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
        return { ok: true, data: undefined }
      },
    })

    schedule.loop({ eachMs: 20, until: { type: 'event', name: 'quiz:stop' } }, ({ index }) => [{ name: `loop-${index}` }])
    schedule.tick(0)

    expect(emitted).toEqual(['loop-0'])

    schedule.notifyEvent('quiz:stop')

    schedule.tick(20)
    expect(emitted).toEqual(['loop-0'])

    schedule.destroy()
  })

  it('realigns a live loop after seeking backward without re-emitting its past occurrences', () => {
    const emitted: string[] = []

    const schedule = new PlayerScheduleFacade({
      emitEvent: async (event) => {
        emitted.push(event.name)
        return { ok: true, data: undefined }
      },
    })

    schedule.loop(
      { eachMs: 1000, until: { type: 'times', max: 11 } },
      ({ index }) => [{ name: `count-${10 - index}` }]
    )
    schedule.tick(0)
    schedule.tick(5000)

    expect(emitted).toEqual(['count-10', 'count-9', 'count-8', 'count-7', 'count-6', 'count-5'])

    schedule.seek(0)
    expect(emitted).toEqual(['count-10', 'count-9', 'count-8', 'count-7', 'count-6', 'count-5'])

    schedule.tick(1000)
    expect(emitted).toEqual(['count-10', 'count-9', 'count-8', 'count-7', 'count-6', 'count-5', 'count-9'])

    schedule.destroy()
  })

  it('warns and falls back to jit when loop planned mode depends on one event stop', () => {
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
    })

    schedule.loop(
      { eachMs: 20, until: { type: 'event', name: 'quiz:stop' }, mode: 'planned' },
      ({ index }) => [{ name: `loop-${index}` }]
    )
    schedule.tick(0)

    expect(warnings).toEqual(['helper loop mode planned falls back to jit (until.event requires jit)'])
    expect(emitted).toEqual(['loop-0'])

    schedule.notifyEvent('quiz:stop')
    schedule.tick(20)

    expect(emitted).toEqual(['loop-0'])

    schedule.destroy()
  })

  it('passes a fresh readonly state snapshot to helper callbacks', () => {
    const observed: Array<{ currentTimeMs: number; elapsedMs: number; armed: boolean }> = []
    const state = { armed: false }

    const schedule = new PlayerScheduleFacade({
      emitEvent: async () => {
        return { ok: true, data: undefined }
      },
      resolveState: () => state,
    })

    schedule.repeat({ everyMs: 20, times: 2 }, ({ currentTimeMs, elapsedMs, state: helperState }) => {
      observed.push({
        currentTimeMs,
        elapsedMs,
        armed: helperState.armed === true
      })

      return [{ name: `armed-${helperState.armed === true ? 'yes' : 'no'}` }]
    })

    schedule.tick(0)
    state.armed = true

    schedule.tick(20)

    expect(observed).toEqual([
      { currentTimeMs: 0, elapsedMs: 0, armed: false },
      { currentTimeMs: 20, elapsedMs: 20, armed: true }
    ])

    schedule.destroy()
  })
})
