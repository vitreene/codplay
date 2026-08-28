import { describe, expect, it } from 'vitest'

import { createPlannedStrapHelpers } from '../../../src/runtime/player'

describe('planned strap helpers', () => {
  it('creates finite wait and repeat occurrences', () => {
    const planned = createPlannedStrapHelpers()

    expect(planned.wait(25, { event: { name: 'wait:event' } })).toEqual([
      { offsetMs: 25, step: { event: { name: 'wait:event' } } },
    ])
    expect(planned.repeat({ eachMs: 10, times: 3 }, { event: { name: 'repeat:event' } })
      .map((occurrence) => occurrence.offsetMs)).toEqual([0, 10, 20])
  })

  it('creates staggered and sequenced occurrences', () => {
    const planned = createPlannedStrapHelpers()

    const staggered = planned.stagger(
      { stepMs: 5 },
      [{ event: { name: 'first' } }, { event: { name: 'second' } }],
    )
    expect(staggered.map((occurrence) => [occurrence.offsetMs, occurrence.step.event?.name])).toEqual([
      [0, 'first'],
      [5, 'second'],
    ])
    expect(planned.sequence([
      { step: { event: { name: 'a' } }, durationMs: 10 },
      { step: { event: { name: 'b' } }, durationMs: 5 },
      { step: { event: { name: 'c' } }, startAt: 30 },
    ]).map((occurrence) => occurrence.offsetMs)).toEqual([0, 10, 30])
  })

  it('rejects invalid finite helper parameters', () => {
    const planned = createPlannedStrapHelpers()

    expect(() => planned.wait(-1, { event: { name: 'invalid' } })).toThrow(/non-negative/)
    expect(() => planned.repeat({ eachMs: 1, times: 1.5 }, { event: { name: 'invalid' } })).toThrow(/integer/)
  })

  it('creates only bounded loops compatible with f(t)', () => {
    const planned = createPlannedStrapHelpers()

    expect(planned.loop({ eachMs: 10, times: 3 }, { event: { name: 'loop:event' } })
      .map((occurrence) => occurrence.offsetMs)).toEqual([0, 10, 20])
    expect(planned.loop({ eachMs: 10, durationMs: 25 }, { event: { name: 'duration:event' } })
      .map((occurrence) => occurrence.offsetMs)).toEqual([0, 10, 20])
    expect(() => planned.loop({ eachMs: 10 }, { event: { name: 'invalid' } })).toThrow(/exactly one/)
    expect(() => planned.loop({ eachMs: 10, times: 2, durationMs: 20 }, { event: { name: 'invalid' } })).toThrow(/exactly one/)
  })
})
