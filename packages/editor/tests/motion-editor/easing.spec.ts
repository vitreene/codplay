import { describe, expect, it } from 'vitest'
import { parseEase } from 'ace'
import { normalizeMotionEasing, resolveMotionEaseProgress } from '../../src/motion-editor/easing'

describe('motion-editor easing', () => {
  it('shares the builder spelling for the editor transition aliases', () => {
    expect(normalizeMotionEasing('ease-in-out')).toBe('inOut')
    expect(normalizeMotionEasing('ease-in')).toBe('in')
    expect(normalizeMotionEasing('ease-out')).toBe('out')
    expect(normalizeMotionEasing('linear')).toBe('linear')
  })

  it('uses the runtime ACE evaluator at every sampled progress', () => {
    for (const ease of ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'outBack(2)']) {
      const reference = parseEase(normalizeMotionEasing(ease))
      for (const progress of [0, 0.1, 0.37, 0.5, 0.9, 1]) {
        expect(resolveMotionEaseProgress(ease, progress)).toBe(reference(progress))
      }
    }
  })

  it('rejects a custom easing that the runtime cannot consume', () => {
    expect(() => resolveMotionEaseProgress({
      kind: 'cubic-bezier',
      p1x: 0.25,
      p1y: 0.1,
      p2x: 0.25,
      p2y: 1,
    }, 0.5)).toThrow(/inconnue/)
  })
})
