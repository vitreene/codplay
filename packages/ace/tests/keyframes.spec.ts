import { describe, expect, it } from 'vitest'
import { animate } from 'animejs'

import { prepareKeyframes, resolveKeyframes } from '../src/keyframes'

describe('prepareKeyframes', () => {
  it('places les frames par leurs delais et durees explicites', () => {
    const keyframes = prepareKeyframes([
      { from: 0, to: 10, duration: 100, delay: 10, ease: 'linear' },
      { from: 10, to: 20, duration: 200, delay: 20, ease: 'linear' },
    ])

    expect(keyframes.frames.map(({ start, end }) => [start, end])).toEqual([
      [10, 110],
      [130, 330],
    ])
    expect(keyframes.totalDuration).toBe(330)
  })

  it('rejects an empty sequence', () => {
    expect(() => prepareKeyframes([])).toThrow(/au moins une frame/)
  })
})

describe('resolveKeyframes', () => {
  it('holds the preceding endpoint during the following delay', () => {
    const keyframes = prepareKeyframes([
      { from: 0, to: 10, duration: 100, ease: 'linear' },
      { from: 10, to: 20, duration: 100, delay: 20, ease: 'linear' },
    ])

    expect(resolveKeyframes(keyframes, 100)).toBe(10)
    expect(resolveKeyframes(keyframes, 110)).toBe(10)
    expect(resolveKeyframes(keyframes, 120)).toBe(10)
    expect(resolveKeyframes(keyframes, 170)).toBe(15)
  })

  it('matches anime 4.5 explicit keyframes', () => {
    const inputs = [
      { from: 0, to: 10, duration: 100, delay: 10, ease: 'linear' },
      { from: 10, to: 30, duration: 120, delay: 20, ease: 'inOutQuad' },
      { from: 30, to: -10, duration: 80, delay: 0, ease: 'outBack(1.2)' },
    ]
    const target = { value: 0 }
    const animation = animate(target, { value: inputs, autoplay: false })
    const keyframes = prepareKeyframes(inputs)

    for (const instant of [-20, 0, 10, 50, 110, 120, 130, 160, 250, 260, 300, 330, 400]) {
      // anime.seek() is relative to the first keyframe delay, while ACE receives a scene instant.
      animation.seek(instant - (inputs[0].delay ?? 0))
      expect(resolveKeyframes(keyframes, instant)).toBeCloseTo(target.value, 10)
    }
  })
})
