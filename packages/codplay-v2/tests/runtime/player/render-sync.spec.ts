import { describe, expect, it } from 'vitest'

import { RenderSync, type RenderAdapter, type RenderSeekInfo, type RenderTickInfo } from '../../../src/runtime/player'

/** Creates an adapter probe that records all temporal notifications. */
function makeAdapter(overrides: Partial<RenderAdapter> = {}): RenderAdapter & {
  ticks: RenderTickInfo[]
  seeks: RenderSeekInfo[]
} {
  const ticks: RenderTickInfo[] = []
  const seeks: RenderSeekInfo[] = []
  return {
    tick(info) { ticks.push({ ...info }) },
    seek(info) { seeks.push({ ...info }) },
    ...overrides,
    ticks,
    seeks,
  }
}

describe('RenderSync', () => {
  it('sets deltaMs and timelineDeltaMs to zero on the first tick', () => {
    const adapter = makeAdapter()
    const sync = new RenderSync([adapter])

    sync.tick(1000, 500, 1)

    expect(adapter.ticks[0]).toMatchObject({
      nowMs: 1000,
      deltaMs: 0,
      timelineMs: 500,
      timelineDeltaMs: 0,
      rate: 1,
    })
  })

  it('computes wall and timeline deltas from subsequent ticks', () => {
    const adapter = makeAdapter()
    const sync = new RenderSync([adapter])

    sync.tick(1000, 0, 2)
    sync.tick(1016, 16, 2)

    expect(adapter.ticks[1]).toMatchObject({ deltaMs: 16, timelineDeltaMs: 32, rate: 2 })
  })

  it('resets its baseline at seek', () => {
    const adapter = makeAdapter()
    const sync = new RenderSync([adapter])

    sync.tick(1000, 0, 1)
    sync.prepareSeek()
    sync.seek(1050, 3000)
    sync.tick(1066, 3016, 1)

    expect(adapter.seeks).toEqual([{ nowMs: 1050, timelineMs: 3000 }])
    expect(adapter.ticks[1]).toMatchObject({ deltaMs: 16 })
  })

  it('resets its baseline at resume', () => {
    const adapter = makeAdapter()
    const sync = new RenderSync([adapter])

    sync.tick(1000, 0, 1)
    sync.pause()
    sync.resume()
    sync.tick(3000, 500, 1)

    expect(adapter.ticks[1]).toMatchObject({ deltaMs: 0, timelineDeltaMs: 0 })
  })

  it('dispatches all lifecycle calls in adapter order', () => {
    const order: string[] = []
    const first: RenderAdapter = {
      tick() { order.push('first:tick') },
      prepareSeek() { order.push('first:prepare') },
      seek() { order.push('first:seek') },
      pause() { order.push('first:pause') },
      resume() { order.push('first:resume') },
      rateChange() { order.push('first:rate') },
      stop() { order.push('first:stop') },
    }
    const second: RenderAdapter = {
      tick() { order.push('second:tick') },
      seek() { order.push('second:seek') },
    }
    const sync = new RenderSync([first, second])

    sync.tick(1000, 0, 1)
    sync.prepareSeek()
    sync.seek(1010, 500)
    sync.pause()
    sync.resume()
    sync.rateChange(2)
    sync.stop()

    expect(order).toEqual([
      'first:tick', 'second:tick',
      'first:prepare',
      'first:seek', 'second:seek',
      'first:pause',
      'first:resume',
      'first:rate',
      'first:stop',
    ])
  })

  it('isolates adapter errors', () => {
    const failing: RenderAdapter = {
      tick() { throw new Error('tick') },
      seek() { throw new Error('seek') },
    }
    const working = makeAdapter()
    const sync = new RenderSync([failing, working])

    expect(() => sync.tick(1000, 0, 1)).not.toThrow()
    expect(() => sync.seek(1010, 0)).not.toThrow()
    expect(working.ticks).toHaveLength(1)
    expect(working.seeks).toHaveLength(1)
  })

  it('supports an empty adapter list and clears on stop', () => {
    const sync = new RenderSync([])

    expect(() => {
      sync.tick(1000, 0, 1)
      sync.stop()
      sync.tick(5000, 0, 1)
      sync.seek(5010, 500)
    }).not.toThrow()
  })
})
