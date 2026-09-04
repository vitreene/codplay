import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MOTION_TRANSITION_WINDOW_MS,
  resolveMotionKeyframeAlignment,
  resolveMotionLifetime,
  resolveMotionTransitionWindow,
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

  it('uses the provisional 500 ms window from the source by default', () => {
    expect(resolveMotionTransitionWindow(1_000, 3_000)).toEqual({
      sourceTimeMs: 1_000,
      targetTimeMs: 3_000,
      startTimeMs: 1_000,
      endTimeMs: 1_500,
      durationMs: DEFAULT_MOTION_TRANSITION_WINDOW_MS,
      direction: 'after',
    })
  })

  it('clamps the default window to a short KF interval', () => {
    expect(resolveMotionTransitionWindow(100, 350)).toMatchObject({
      startTimeMs: 100,
      endTimeMs: 350,
      durationMs: 250,
      direction: 'after',
    })
  })

  it("places an explicit 'before' window immediately before the target KF", () => {
    expect(resolveMotionTransitionWindow(1_000, 2_000, { durationMs: 300, direction: 'before' })).toMatchObject({
      startTimeMs: 1_700,
      endTimeMs: 2_000,
      durationMs: 300,
      direction: 'before',
    })
  })

  it('clamps an explicit window and rejects an invalid KF interval', () => {
    expect(resolveMotionTransitionWindow(1_000, 1_200, { durationMs: 500, direction: 'before' })).toMatchObject({
      startTimeMs: 1_000,
      endTimeMs: 1_200,
      durationMs: 200,
    })
    expect(resolveMotionTransitionWindow(2_000, 2_000)).toBeNull()
    expect(resolveMotionTransitionWindow(Number.NaN, 2_000)).toBeNull()
  })
})
