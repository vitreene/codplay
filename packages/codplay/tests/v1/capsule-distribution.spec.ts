import { describe, it, expect } from 'vitest'
import { CapsuleDistribution } from '../../src/capsule-distribution/capsule-distribution'

const clip6 = (children: Parameters<typeof CapsuleDistribution.compute>[0]['children'], order?: 'forward' | 'backward') =>
  CapsuleDistribution.compute({ clipDurationMs: 6000, mode: 'sequential', order, children })

describe('CapsuleDistribution — sequential forward (default)', () => {
  it('distributes 3 free children evenly', () => {
    const { children } = clip6([
      { trackId: 'a' },
      { trackId: 'b' },
      { trackId: 'c' },
    ])
    expect(children[0]).toMatchObject({ introMs: 0, outroMs: 2000 })
    expect(children[1]).toMatchObject({ introMs: 2000, outroMs: 4000 })
    expect(children[2]).toMatchObject({ introMs: 4000, outroMs: 6000 })
  })

  it('respects locked outro — followers shift right', () => {
    const { children } = clip6([
      { trackId: 'a', lockedOutroMs: 1500 },
      { trackId: 'b' },
      { trackId: 'c' },
    ])
    expect(children[0]).toMatchObject({ introMs: 0, outroMs: 1500 })
    expect(children[1]).toMatchObject({ introMs: 1500, outroMs: 3750 })
    expect(children[2]).toMatchObject({ introMs: 3750, outroMs: 6000 })
  })

  it('respects locked intro — creates gap, followers come after', () => {
    // img1 intro locked at 2500ms — gap [0,2500] empty; img2, img3 follow after img1
    const { children } = clip6([
      { trackId: 'a', lockedIntroMs: 2500 },
      { trackId: 'b' },
      { trackId: 'c' },
    ])
    // gap = 2500, share = (6000-2500)/3 ≈ 1166.67
    const share = (6000 - 2500) / 3
    expect(children[0]!.introMs).toBeCloseTo(2500)
    expect(children[0]!.outroMs).toBeCloseTo(2500 + share)
    expect(children[1]!.introMs).toBeCloseTo(2500 + share)
    expect(children[2]!.outroMs).toBeCloseTo(6000)
    // all children come AFTER img1's locked intro
    expect(children[1]!.introMs).toBeGreaterThanOrEqual(children[0]!.outroMs - 0.01)
    expect(children[2]!.introMs).toBeGreaterThanOrEqual(children[1]!.outroMs - 0.01)
  })

  it('fully locked child pins both bounds, others adapt', () => {
    const { children } = clip6([
      { trackId: 'a', lockedIntroMs: 1000, lockedOutroMs: 3000 },
      { trackId: 'b' },
      { trackId: 'c' },
    ])
    expect(children[0]).toMatchObject({ introMs: 1000, outroMs: 3000 })
    expect(children[1]!.introMs).toBeCloseTo(3000)
    expect(children[2]!.outroMs).toBeCloseTo(6000)
  })

  it('all children visible by default', () => {
    const { children } = clip6([{ trackId: 'a' }, { trackId: 'b' }])
    expect(children.every(c => c.visible)).toBe(true)
  })
})

describe('CapsuleDistribution — sequential backward (dernier devant)', () => {
  it('reverses temporal order — img3 comes first in time', () => {
    const { children } = clip6([
      { trackId: 'a' },
      { trackId: 'b' },
      { trackId: 'c' },
    ], 'backward')
    // backward: index 0 (a) is last in time, index 2 (c) is first
    expect(children[2]!.introMs).toBeCloseTo(0)
    expect(children[2]!.outroMs).toBeCloseTo(2000)
    expect(children[1]!.introMs).toBeCloseTo(2000)
    expect(children[0]!.introMs).toBeCloseTo(4000)
    expect(children[0]!.outroMs).toBeCloseTo(6000)
  })

  it('locked intro on index-0 — others fill BEFORE it in time', () => {
    // img1 (index 0) intro locked at 2500 → in backward mode it occupies [2500, 6000]
    // img2 and img3 fill [0, 2500]
    const { children } = clip6([
      { trackId: 'a', lockedIntroMs: 2500 },
      { trackId: 'b' },
      { trackId: 'c' },
    ], 'backward')
    expect(children[0]!.introMs).toBeCloseTo(2500)
    expect(children[0]!.outroMs).toBeCloseTo(6000)
    expect(children[1]!.outroMs).toBeCloseTo(2500)
    expect(children[2]!.introMs).toBeCloseTo(0)
    // all precede img1
    expect(children[1]!.introMs).toBeGreaterThanOrEqual(0)
    expect(children[2]!.outroMs).toBeLessThanOrEqual(children[1]!.introMs + 0.01)
  })
})
