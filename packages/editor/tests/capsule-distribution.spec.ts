import { describe, it, expect } from 'vitest'
import { CapsuleDistribution } from '@codplay/scene-factory'

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
    const { children } = clip6([
      { trackId: 'a', lockedIntroMs: 2500 },
      { trackId: 'b' },
      { trackId: 'c' },
    ])
    const share = (6000 - 2500) / 3
    expect(children[0]!.introMs).toBeCloseTo(2500)
    expect(children[0]!.outroMs).toBeCloseTo(2500 + share)
    expect(children[1]!.introMs).toBeCloseTo(2500 + share)
    expect(children[2]!.outroMs).toBeCloseTo(6000)
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
    expect(children[2]!.introMs).toBeCloseTo(0)
    expect(children[2]!.outroMs).toBeCloseTo(2000)
    expect(children[1]!.introMs).toBeCloseTo(2000)
    expect(children[0]!.introMs).toBeCloseTo(4000)
    expect(children[0]!.outroMs).toBeCloseTo(6000)
  })

  it('locked intro on index-0 — others fill BEFORE it in time', () => {
    const { children } = clip6([
      { trackId: 'a', lockedIntroMs: 2500 },
      { trackId: 'b' },
      { trackId: 'c' },
    ], 'backward')
    expect(children[0]!.introMs).toBeCloseTo(2500)
    expect(children[0]!.outroMs).toBeCloseTo(6000)
    expect(children[1]!.outroMs).toBeCloseTo(2500)
    expect(children[2]!.introMs).toBeCloseTo(0)
    expect(children[1]!.introMs).toBeGreaterThanOrEqual(0)
    expect(children[2]!.outroMs).toBeLessThanOrEqual(children[1]!.introMs + 0.01)
  })
})

describe('CapsuleDistribution — stagger', () => {
  const stagger = (
    children: Parameters<typeof CapsuleDistribution.compute>[0]['children'],
    clipDurationMs: number,
    staggerInMs?: number,
    staggerOutMs?: number,
  ) => CapsuleDistribution.compute({ clipDurationMs, mode: 'stagger', staggerInMs, staggerOutMs, children })

  it('staggers intro by index * staggerInMs and outro by (N-1-index) * staggerOutMs', () => {
    const { children } = stagger(
      [{ trackId: 'a' }, { trackId: 'b' }, { trackId: 'c' }],
      6000, 500, 500,
    )
    expect(children[0]).toMatchObject({ introMs: 0, outroMs: 5000 })
    expect(children[1]).toMatchObject({ introMs: 500, outroMs: 5500 })
    expect(children[2]).toMatchObject({ introMs: 1000, outroMs: 6000 })
    expect(children.every((c) => c.visible)).toBe(true)
  })

  it('staggerOutMs defaults to 0 — every free child keeps the clip end as its outro', () => {
    const { children } = stagger(
      [{ trackId: 'a' }, { trackId: 'b' }, { trackId: 'c' }],
      4000, 1000,
    )
    expect(children.map((c) => c.outroMs)).toEqual([4000, 4000, 4000])
    expect(children.map((c) => c.introMs)).toEqual([0, 1000, 2000])
  })

  it('a fully locked child (both bounds) keeps its exact locked range — index-based stagger ignores it entirely', () => {
    const { children } = stagger(
      [
        { trackId: 'a' },
        { trackId: 'b', lockedIntroMs: 2000, lockedOutroMs: 4000 },
        { trackId: 'c' },
      ],
      6000, 500, 500,
    )
    // b keeps its own locked range, not the index-1 stagger formula (which would give 500/5500).
    expect(children[1]).toMatchObject({ introMs: 2000, outroMs: 4000 })
    // a and c are unaffected by b's lock — no redistribution around it, unlike sequential mode.
    expect(children[0]).toMatchObject({ introMs: 0, outroMs: 5000 })
    expect(children[2]).toMatchObject({ introMs: 1000, outroMs: 6000 })
  })

  it('locks apply independently per bound — a locked intro alone still lets outro follow the stagger formula', () => {
    const { children } = stagger(
      [{ trackId: 'a' }, { trackId: 'b', lockedIntroMs: 3000 }, { trackId: 'c' }],
      6000, 500, 500,
    )
    expect(children[1]).toMatchObject({ introMs: 3000, outroMs: 5500 })
  })

  it('marks a child not visible once its staggered intro reaches or exceeds the clip duration', () => {
    const { children } = stagger([{ trackId: 'a' }, { trackId: 'b' }], 1000, 1500)
    expect(children[1]).toMatchObject({ introMs: 1500, outroMs: 1000, visible: false })
  })

  it('minDurationMs (max locked outro) is still reported correctly in stagger mode', () => {
    const { minDurationMs } = stagger(
      [{ trackId: 'a', lockedOutroMs: 4500 }, { trackId: 'b' }],
      6000, 500, 500,
    )
    expect(minDurationMs).toBe(4500)
  })
})
