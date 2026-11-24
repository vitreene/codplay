import { describe, expect, it } from 'vitest'
import {
  resolveMotionKeyframeAlignment,
  resolveMotionLifetime,
  sortMotionKeyframes,
} from '../../src/motion-editor/timing'

describe('motion-editor timing', () => {
  it('aligns an author playhead without mutating or depending on keyframe order', () => {
    const keyframes = [
      { id: 'kf-b', timeMs: 1_000 },
      { id: 'kf-a', timeMs: 0 },
    ] as const

    expect(sortMotionKeyframes(keyframes).map((keyframe) => keyframe.id)).toEqual(['kf-a', 'kf-b'])
    expect(keyframes.map((keyframe) => keyframe.id)).toEqual(['kf-b', 'kf-a'])
    expect(resolveMotionKeyframeAlignment(keyframes, -1)).toEqual({ kind: 'before-first' })
    expect(resolveMotionKeyframeAlignment(keyframes, 0)).toEqual({ kind: 'exact', keyframeId: 'kf-a' })
    expect(resolveMotionKeyframeAlignment(keyframes, 500)).toEqual({
      kind: 'between',
      prevKeyframeId: 'kf-a',
      nextKeyframeId: 'kf-b',
    })
    expect(resolveMotionKeyframeAlignment(keyframes, 1_000)).toEqual({ kind: 'exact', keyframeId: 'kf-b' })
    expect(resolveMotionKeyframeAlignment(keyframes, 2_000)).toEqual({ kind: 'after-last', keyframeId: 'kf-b' })
  })

  it('keeps invalid or empty temporal inputs out of the alignment resolver', () => {
    expect(resolveMotionKeyframeAlignment([], 0)).toEqual({ kind: 'no-keyframes' })
    expect(resolveMotionKeyframeAlignment([{ id: 'bad', timeMs: Number.NaN }], 0)).toEqual({ kind: 'no-keyframes' })
    expect(resolveMotionKeyframeAlignment([{ id: 'kf', timeMs: 0 }], Number.NaN)).toEqual({ kind: 'no-keyframes' })
  })

  it('distinguishes real item boundaries from inherited virtual bounds', () => {
    expect(resolveMotionLifetime([], { introTimeMs: 0, outroTimeMs: 5_000 })).toEqual({
      intro: { name: 'intro', timeMs: 0, kind: 'virtual' },
      outro: { name: 'outro', timeMs: 5_000, kind: 'virtual' },
    })
    expect(resolveMotionLifetime([{ id: 'kf-a', timeMs: 1_000 }], { introTimeMs: 0, outroTimeMs: 5_000 })).toEqual({
      intro: { name: 'intro', timeMs: 1_000, kind: 'real', keyframeId: 'kf-a' },
      outro: { name: 'outro', timeMs: 5_000, kind: 'virtual' },
    })
    expect(resolveMotionLifetime([
      { id: 'kf-b', timeMs: 3_000 },
      { id: 'kf-a', timeMs: 1_000 },
    ], { introTimeMs: 0, outroTimeMs: 5_000 })).toEqual({
      intro: { name: 'intro', timeMs: 1_000, kind: 'real', keyframeId: 'kf-a' },
      outro: { name: 'outro', timeMs: 3_000, kind: 'real', keyframeId: 'kf-b' },
    })
  })

  it('rejects an impossible inherited lifetime without changing the input', () => {
    const inherited = { introTimeMs: 4_000, outroTimeMs: 2_000 } as const
    expect(resolveMotionLifetime([], inherited)).toBeNull()
    expect(inherited).toEqual({ introTimeMs: 4_000, outroTimeMs: 2_000 })
  })
})
