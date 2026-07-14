import { describe, expect, it } from 'vitest'
import { TransitionTiming } from '@codplay/scene-factory'

describe('TransitionTiming.computeScenePreRollMs', () => {
  it('empty scene resolves to 0', () => {
    expect(TransitionTiming.computeScenePreRollMs([])).toBe(0)
  })

  it('items with no transitionIn resolve to 0', () => {
    expect(TransitionTiming.computeScenePreRollMs([{ firstKeyframe: { timeMs: 0 } }, { firstKeyframe: undefined }])).toBe(0)
  })

  it('takes the max across items, not the sum', () => {
    const preRollMs = TransitionTiming.computeScenePreRollMs([
      { firstKeyframe: { timeMs: 0, transitionInDurationMs: 800 } },
      { firstKeyframe: { timeMs: 0, transitionInDurationMs: 200 } },
    ])
    expect(preRollMs).toBe(800)
  })
})

describe('TransitionTiming.lockedIntroMs', () => {
  it('undefined firstKf resolves to undefined', () => {
    expect(TransitionTiming.lockedIntroMs(undefined)).toBeUndefined()
  })

  it('no transitionIn, no preRoll — trigger stays at timeMs', () => {
    expect(TransitionTiming.lockedIntroMs({ timeMs: 500 })).toBe(500)
  })

  it('subtracts the transitionIn duration — it ends AT the keyframe', () => {
    expect(TransitionTiming.lockedIntroMs({ timeMs: 500, transitionInDurationMs: 200 })).toBe(300)
  })

  it('preRollMs shifts the whole reference frame before the subtraction', () => {
    expect(TransitionTiming.lockedIntroMs({ timeMs: 0, transitionInDurationMs: 400 }, 400)).toBe(0)
  })
})

describe('TransitionTiming.lockedOutroMs', () => {
  it('undefined lastKf resolves to undefined', () => {
    expect(TransitionTiming.lockedOutroMs(undefined)).toBeUndefined()
  })

  it('never subtracts anything — transitionOut starts AT the keyframe', () => {
    expect(TransitionTiming.lockedOutroMs({ timeMs: 3000 })).toBe(3000)
  })

  it('preRollMs shifts it forward', () => {
    expect(TransitionTiming.lockedOutroMs({ timeMs: 3000 }, 400)).toBe(3400)
  })
})

describe('TransitionTiming.interpolatedTransitionTriggerMs', () => {
  it("direction:'before' ends the transition AT the destination keyframe", () => {
    const triggerMs = TransitionTiming.interpolatedTransitionTriggerMs({
      sourceKfTimeMs: 1000,
      destKfTimeMs: 2000,
      durationMs: 300,
      direction: 'before',
    })
    expect(triggerMs).toBe(1700)
  })

  it("direction:'after' starts the transition AT the source keyframe, unchanged", () => {
    const triggerMs = TransitionTiming.interpolatedTransitionTriggerMs({
      sourceKfTimeMs: 1000,
      destKfTimeMs: 2000,
      durationMs: 300,
      direction: 'after',
    })
    expect(triggerMs).toBe(1000)
  })
})
