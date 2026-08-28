import { describe, expect, it, vi } from 'vitest'
import { RenderSync } from '../../src/player/render-sync'
import type { RenderAdapter, RenderTickInfo, RenderSeekInfo } from '../../src/player/render-adapter-types'

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
  it('tick — first call has deltaMs=0', () => {
    const a = makeAdapter()
    const sync = new RenderSync([a])
    sync.tick(1000, 500, 1)
    expect(a.ticks).toHaveLength(1)
    expect(a.ticks[0]).toMatchObject({ nowMs: 1000, deltaMs: 0, timelineMs: 500, timelineDeltaMs: 0, rate: 1 })
  })

  it('tick — subsequent calls compute deltaMs from wall-clock', () => {
    const a = makeAdapter()
    const sync = new RenderSync([a])
    sync.tick(1000, 0, 1)
    sync.tick(1016, 16, 1)
    expect(a.ticks[1]).toMatchObject({ nowMs: 1016, deltaMs: 16, timelineDeltaMs: 16, rate: 1 })
  })

  it('tick — timelineDeltaMs scales with rate', () => {
    const a = makeAdapter()
    const sync = new RenderSync([a])
    sync.tick(1000, 0, 2)
    sync.tick(1016, 16, 2)
    expect(a.ticks[1]).toMatchObject({ deltaMs: 16, timelineDeltaMs: 32, rate: 2 })
  })

  it('seek — dispatches correct info and resets delta baseline', () => {
    const a = makeAdapter()
    const sync = new RenderSync([a])
    sync.tick(1000, 0, 1)
    sync.seek(1050, 3000)
    sync.tick(1066, 3016, 1)

    expect(a.seeks).toHaveLength(1)
    expect(a.seeks[0]).toEqual({ nowMs: 1050, timelineMs: 3000 })
    // delta after seek = 1066 - 1050 = 16 (not 1066 - 1000 = 66)
    expect(a.ticks[1]).toMatchObject({ deltaMs: 16 })
  })

  it('resume — resets delta so first post-resume tick has deltaMs=0', () => {
    const a = makeAdapter()
    const sync = new RenderSync([a])
    sync.tick(1000, 0, 1)
    sync.pause()
    sync.resume()
    sync.tick(3000, 500, 1) // 2 seconds later
    expect(a.ticks[1]).toMatchObject({ deltaMs: 0 })
  })

  it('dispatches to all adapters in order', () => {
    const order: string[] = []
    const a: RenderAdapter = { tick() { order.push('a') }, seek() { order.push('a-seek') } }
    const b: RenderAdapter = { tick() { order.push('b') }, seek() { order.push('b-seek') } }
    const sync = new RenderSync([a, b])
    sync.tick(1000, 0, 1)
    sync.seek(1010, 0)
    expect(order).toEqual(['a', 'b', 'a-seek', 'b-seek'])
  })

  it('adapter error does not interrupt other adapters', () => {
    const failing: RenderAdapter = {
      tick() { throw new Error('boom') },
      seek() { throw new Error('boom') },
    }
    const ok = makeAdapter()
    const sync = new RenderSync([failing, ok])
    expect(() => sync.tick(1000, 0, 1)).not.toThrow()
    expect(() => sync.seek(1010, 0)).not.toThrow()
    expect(ok.ticks).toHaveLength(1)
    expect(ok.seeks).toHaveLength(1)
  })

  it('pause/resume/rateChange/stop are optional and dispatched when defined', () => {
    const pauses: number[] = []
    const resumes: number[] = []
    const rates: number[] = []
    const stops: number[] = []
    const a: RenderAdapter = {
      tick() {},
      seek() {},
      pause() { pauses.push(1) },
      resume() { resumes.push(1) },
      rateChange(r) { rates.push(r) },
      stop() { stops.push(1) },
    }
    const minimal: RenderAdapter = { tick() {}, seek() {} }
    const sync = new RenderSync([a, minimal])

    sync.pause()
    sync.resume()
    sync.rateChange(2)
    sync.stop()

    expect(pauses).toEqual([1])
    expect(resumes).toEqual([1])
    expect(rates).toEqual([2])
    expect(stops).toEqual([1])
  })

  it('stop resets delta baseline', () => {
    const a = makeAdapter()
    const sync = new RenderSync([a])
    sync.tick(1000, 0, 1)
    sync.stop()
    sync.tick(5000, 0, 1) // simulated restart
    expect(a.ticks[1]).toMatchObject({ deltaMs: 0 })
  })

  it('empty adapter list is valid', () => {
    const sync = new RenderSync([])
    expect(() => {
      sync.tick(1000, 0, 1)
      sync.seek(1010, 500)
      sync.pause()
      sync.resume()
      sync.rateChange(2)
      sync.stop()
    }).not.toThrow()
  })
})
