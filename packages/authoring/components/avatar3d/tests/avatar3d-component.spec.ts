import { describe, expect, it } from 'vitest'
import { createBlinkScheduleFn, createBreathTriggerFn, createHeadDriftFn } from '../src/avatar3d-component'

describe('createHeadDriftFn — pure function of elapsed', () => {
  it('returns the identical pose for the same elapsed regardless of call history', () => {
    const fn = createHeadDriftFn()
    fn({ elapsed: 1000 })
    fn({ elapsed: 2000 })
    const afterHistory = fn({ elapsed: 5000 })

    const fresh = createHeadDriftFn()
    const direct = fresh({ elapsed: 5000 })

    expect(afterHistory).toEqual(direct)
  })

  it('produces the same pose for a forward jump as for the equivalent incremental walk', () => {
    const incremental = createHeadDriftFn()
    for (let elapsed = 0; elapsed < 5000; elapsed += 16) {
      incremental({ elapsed })
    }
    const viaWalk = incremental({ elapsed: 5000 })
    const direct = createHeadDriftFn()({ elapsed: 5000 })
    expect(direct).toEqual(viaWalk)
  })
})

describe('createBlinkScheduleFn — resync-safe (no in-progress state to misread)', () => {
  it('reaches a mid-blink frame (eyesClosed strictly between 0 and 1) within one period', () => {
    const fn = createBlinkScheduleFn()
    const samples: { elapsed: number; eyesClosed: number }[] = []
    for (let elapsed = 0; elapsed <= 4500; elapsed += 16) {
      const r = fn({ elapsed })
      samples.push({ elapsed, eyesClosed: r ? r.eyesClosed : 0 })
    }
    const midBlink = samples.find((s) => s.eyesClosed > 0 && s.eyesClosed < 1)
    expect(midBlink).toBeDefined()
  })

  it('gives the same eyesClosed value for a direct jump as for the incremental walk to the same elapsed', () => {
    const incremental = createBlinkScheduleFn()
    const samples: { elapsed: number; eyesClosed: number }[] = []
    for (let elapsed = 0; elapsed <= 4500; elapsed += 16) {
      const r = incremental({ elapsed })
      samples.push({ elapsed, eyesClosed: r ? r.eyesClosed : 0 })
    }
    const midBlink = samples.find((s) => s.eyesClosed > 0 && s.eyesClosed < 1)!

    // A fresh instance, called once directly at the mid-blink elapsed — this is
    // exactly what AvatarEngine.commitSeek() does after a seek: no incremental
    // history, just one direct call at the target position.
    const direct = createBlinkScheduleFn()
    const r = direct({ elapsed: midBlink.elapsed })

    expect(r?.eyesClosed ?? 0).toBeCloseTo(midBlink.eyesClosed, 5)
  })

  it('gives the correct (closed) value immediately after a backward jump (seek to an earlier position)', () => {
    const fn = createBlinkScheduleFn()
    const incremental = createBlinkScheduleFn()
    const samples: { elapsed: number; eyesClosed: number }[] = []
    for (let elapsed = 0; elapsed <= 4500; elapsed += 16) {
      const r = incremental({ elapsed })
      samples.push({ elapsed, eyesClosed: r ? r.eyesClosed : 0 })
    }
    const midBlink = samples.find((s) => s.eyesClosed > 0 && s.eyesClosed < 1)!

    fn({ elapsed: 4500 })
    const r = fn({ elapsed: midBlink.elapsed }) // jump backward, no crash, correct value
    expect(r?.eyesClosed ?? 0).toBeCloseTo(midBlink.eyesClosed, 5)
  })

  it('returns eyesClosed: 0 well outside any blink window', () => {
    const fn = createBlinkScheduleFn()
    const r = fn({ elapsed: 0 })
    expect(r?.eyesClosed).toBe(0)
  })
})

describe('createBreathTriggerFn — one-shot trigger, not resynced directly on seek', () => {
  it('fires triggerBreath at most once per period during continuous incremental ticking', () => {
    const fn = createBreathTriggerFn()
    let triggerCount = 0
    for (let elapsed = 0; elapsed <= 4000; elapsed += 16) {
      const r = fn({ elapsed })
      if (r?.triggerBreath) triggerCount++
    }
    expect(triggerCount).toBe(1)
  })

  it('recovers correctly after a backward jump (elapsed < previous elapsed resets epoch tracking)', () => {
    const fn = createBreathTriggerFn()
    for (let elapsed = 0; elapsed <= 4000; elapsed += 16) fn({ elapsed })

    let triggerCount = 0
    for (let elapsed = 0; elapsed <= 4000; elapsed += 16) {
      const r = fn({ elapsed })
      if (r?.triggerBreath) triggerCount++
    }
    expect(triggerCount).toBe(1)
  })
})
