import { describe, expect, it } from 'vitest'
import { CapsuleBounds, type BoundsCapsuleInput, type BoundsNodeInput } from '../src'

const STAGGER_ZERO = { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 } as const

/** Root card capsule with fade defaults and a zero stagger, as an editor scene root. */
function rootOf(children: BoundsNodeInput[]): BoundsCapsuleInput {
  return { kind: 'card', distribution: STAGGER_ZERO, children }
}

/** Carousel capsule locked at 1000–4000 ms: window [700, 4300] with its 300 ms root fades. */
function carouselAt1000(children: BoundsNodeInput[], extra: Partial<BoundsCapsuleInput> = {}): BoundsNodeInput {
  return {
    id: 'cap',
    intro: { timeMs: 1000 },
    outro: { timeMs: 4000 },
    capsule: { kind: 'carousel', children, ...extra },
  }
}

describe('CapsuleBounds — root level', () => {
  const result = CapsuleBounds.resolve({
    durationMs: 6000,
    root: rootOf([
      { id: 'free' },
      { id: 'locked', intro: { timeMs: 2000 } },
    ]),
  })

  it('derives the scene pre-roll from locked first bounds and their effective entry', () => {
    expect(result.preRollMs).toBe(300)
    expect(result.root?.window).toEqual({ startMs: -300, endMs: 6000 })
  })

  it('keeps the root default transitions on its edges (no fusion at the root)', () => {
    expect(result.nodes.get('free')).toEqual({
      id: 'free',
      intro: { timeMs: 0, origin: 'implicit', transition: { source: 'default', ref: 'fade', durationMs: 300 } },
      outro: { timeMs: 6000, origin: 'implicit', transition: { source: 'default', ref: 'fade', durationMs: 300 } },
      window: { startMs: -300, endMs: 6300 },
      visible: true,
    })
  })

  it('keeps a locked intro at its authored instant, the entry playing before it', () => {
    const locked = result.nodes.get('locked')!
    expect(locked.intro).toEqual({ timeMs: 2000, origin: 'locked', transition: { source: 'default', ref: 'fade', durationMs: 300 } })
    expect(locked.window.startMs).toBe(1700)
    expect(locked.outro.origin).toBe('implicit')
  })

  it('extends the root window to the last authored root bound beyond the scene duration', () => {
    const late = CapsuleBounds.resolve({ durationMs: 1000, root: rootOf([{ id: 'a', intro: { timeMs: 0 }, outro: { timeMs: 2500 } }]) })
    expect(late.root?.window.endMs).toBe(2500)
  })
})

describe('CapsuleBounds — nested capsule window and edge fusion', () => {
  const result = CapsuleBounds.resolve({
    durationMs: 6000,
    root: rootOf([carouselAt1000([{ id: 'a' }, { id: 'b' }])]),
  })

  it('distributes the capsule presence window to its children, whatever their keyframes', () => {
    expect(result.nodes.get('cap')?.window).toEqual({ startMs: 700, endMs: 4300 })
    expect(result.capsules.get('cap')?.window).toEqual({ startMs: 700, endMs: 4300 })
    expect(result.nodes.get('a')?.window).toEqual({ startMs: 700, endMs: 2800 })
    expect(result.nodes.get('b')?.window).toEqual({ startMs: 2500, endMs: 4300 })
  })

  it('fuses a child bound on the capsule edge and keeps the default for an offset one', () => {
    const a = result.nodes.get('a')!
    const b = result.nodes.get('b')!
    expect(a.intro).toEqual({ timeMs: 700, origin: 'implicit', transition: { source: 'fused', ref: 'cut', durationMs: 0 } })
    expect(a.outro).toEqual({ timeMs: 2500, origin: 'implicit', transition: { source: 'default', ref: 'fade', durationMs: 300 } })
    expect(b.intro).toEqual({ timeMs: 2800, origin: 'implicit', transition: { source: 'default', ref: 'fade', durationMs: 300 } })
    expect(b.outro).toEqual({ timeMs: 4300, origin: 'implicit', transition: { source: 'fused', ref: 'cut', durationMs: 0 } })
  })

  it('keeps an explicit transition on an edge bound: an author choice wins over fusion', () => {
    const explicit = CapsuleBounds.resolve({
      durationMs: 6000,
      root: rootOf([carouselAt1000([{ id: 'a', intro: { linked: true, transition: { ref: 'zoom', durationMs: 300 } } }])]),
    })
    expect(explicit.nodes.get('a')?.intro).toEqual({
      timeMs: 1000,
      origin: 'linked',
      transition: { source: 'explicit', ref: 'zoom', durationMs: 300 },
    })
  })

  it('fuses a locked bound only when its authored instant is on the edge', () => {
    const locked = CapsuleBounds.resolve({
      durationMs: 6000,
      root: rootOf([carouselAt1000([
        { id: 'edge', intro: { timeMs: 700 }, outro: { timeMs: 1500 } },
        // Its entry slot starts exactly on the edge (1000 − 300 = 700), but its instant does not.
        { id: 'inner', intro: { timeMs: 1000 }, outro: { timeMs: 2000 } },
      ], { distribution: STAGGER_ZERO })]),
    })
    expect(locked.nodes.get('edge')?.intro).toEqual({ timeMs: 700, origin: 'locked', transition: { source: 'fused', ref: 'cut', durationMs: 0 } })
    expect(locked.nodes.get('inner')?.intro).toEqual({ timeMs: 1000, origin: 'locked', transition: { source: 'default', ref: 'fade', durationMs: 300 } })
  })

  it('keeps the inherited transition of a child offset by the stagger', () => {
    const staggered = CapsuleBounds.resolve({
      durationMs: 6000,
      root: rootOf([carouselAt1000([{ id: 'a' }, { id: 'b' }], { distribution: { mode: 'stagger', staggerInMs: 500, staggerOutMs: 0 } })]),
    })
    expect(staggered.nodes.get('a')?.intro.transition.source).toBe('fused')
    expect(staggered.nodes.get('b')?.intro).toEqual({ timeMs: 1500, origin: 'implicit', transition: { source: 'default', ref: 'fade', durationMs: 300 } })
  })

  it('resolves deeper levels inside the window of an inherited capsule', () => {
    const deep = CapsuleBounds.resolve({
      durationMs: 6000,
      root: rootOf([{ id: 'outer', capsule: { kind: 'grille', distribution: STAGGER_ZERO, children: [{ id: 'leaf' }] } }]),
    })
    expect(deep.nodes.get('outer')?.window).toEqual({ startMs: 0, endMs: 6300 })
    expect(deep.nodes.get('leaf')?.window).toEqual({ startMs: 0, endMs: 6300 })
  })
})

describe('CapsuleBounds — capsule settings', () => {
  it('uses the capsule default transitions and plays no default exit for types that generate none', () => {
    const result = CapsuleBounds.resolve({
      durationMs: 6000,
      root: rootOf([carouselAt1000([], {})]),
    })
    expect(result.nodes.get('cap')?.outro.transition).toEqual({ source: 'default', ref: 'fade', durationMs: 300 })

    const rangee = CapsuleBounds.resolve({
      durationMs: 6000,
      root: rootOf([{
        id: 'row',
        intro: { timeMs: 1000 },
        outro: { timeMs: 4000 },
        capsule: { kind: 'rangee', distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 500 }, defaultTransitionIn: 'swipe-left', children: [{ id: 'a' }, { id: 'b' }] },
      }]),
    })
    expect(rangee.nodes.get('a')?.outro.transition).toEqual({ source: 'default', ref: null, durationMs: 0 })
    expect(rangee.nodes.get('b')?.outro.transition.source).toBe('fused')
  })

  it('applies the backward order to sequential capsules', () => {
    const result = CapsuleBounds.resolve({
      durationMs: 6000,
      order: 'backward',
      root: rootOf([carouselAt1000([{ id: 'a' }, { id: 'b' }])]),
    })
    expect(result.nodes.get('a')?.window).toEqual({ startMs: 2500, endMs: 4300 })
    expect(result.nodes.get('b')?.window).toEqual({ startMs: 700, endMs: 2800 })
  })

  it('reports the minimum capsule duration from its locked exits', () => {
    const result = CapsuleBounds.resolve({
      durationMs: 6000,
      root: rootOf([carouselAt1000([{ id: 'a', outro: { timeMs: 2000 } }, { id: 'b' }])]),
    })
    expect(result.capsules.get('cap')?.minDurationMs).toBe(1300)
  })

  it('reports a capsule without a resolvable distribution and leaves its subtree unresolved', () => {
    const result = CapsuleBounds.resolve({
      durationMs: 6000,
      root: rootOf([{ id: 'grid', capsule: { kind: 'grille', children: [{ id: 'a' }] } }]),
    })
    expect(result.nodes.has('grid')).toBe(true)
    expect(result.nodes.has('a')).toBe(false)
    expect(result.capsules.has('grid')).toBe(false)
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'distribution-unresolved', capsuleId: 'grid', kind: 'grille', childCount: 1 })])
  })

  it('leaves the whole tree unresolved when the root distribution cannot be resolved', () => {
    const result = CapsuleBounds.resolve({ durationMs: 1000, root: { kind: 'grille', children: [{ id: 'a' }] } })
    expect(result.root).toBeUndefined()
    expect(result.nodes.size).toBe(0)
    expect(result.diagnostics[0]?.capsuleId).toBeNull()
  })
})
