import { describe, expect, it } from 'vitest'
import { normalizeMotionEasing, resolveMotionEaseProgress } from '../../src/motion-editor/easing'

describe('motion-editor easing', () => {
  it('shares the builder spelling for the editor transition aliases', () => {
    expect(normalizeMotionEasing('ease-in-out')).toBe('inOut')
    expect(normalizeMotionEasing('ease-in')).toBe('in')
    expect(normalizeMotionEasing('ease-out')).toBe('out')
    expect(normalizeMotionEasing('linear')).toBe('linear')
  })

  it('evaluates string and cubic-bezier easing for a temporary pose offset', () => {
    expect(resolveMotionEaseProgress('ease-in-out', 0.5)).toBeCloseTo(0.5, 8)
    expect(resolveMotionEaseProgress({
      kind: 'cubic-bezier',
      p1x: 0.25,
      p1y: 0.1,
      p2x: 0.25,
      p2y: 1,
    }, 0.5)).toBeGreaterThan(0.5)
  })
})
