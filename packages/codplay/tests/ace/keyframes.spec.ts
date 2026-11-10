import { describe, expect, it } from 'vitest'

import { prepareKeyframes, resolveKeyframes } from '../../src/ace/keyframes'

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
})
