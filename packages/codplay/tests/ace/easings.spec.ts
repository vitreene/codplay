import { describe, expect, it } from 'vitest'

import { parseEase } from '../../src/ace/easings'

describe('parseEase', () => {
  it('lève sur un nom inconnu, au lieu de retomber sur l’identité', () => {
    expect(() => parseEase('inOutQuadd')).toThrow(/inconnue/)
  })
})

describe('anime.js easing catalogue', () => {
  const types = ['in', 'out', 'inOut', 'outIn']
  const bases = ['', 'Quad', 'Cubic', 'Quart', 'Quint', 'Sine', 'Circ', 'Expo', 'Bounce', 'Back', 'Elastic']

  it('resolves every named curve of anime.js, plus linear and none', () => {
    const names = ['linear', 'none', ...types.flatMap((type) => bases.map((base) => type + base))]
    for (const name of names) {
      const ease = parseEase(name)
      expect(ease(0)).toBeCloseTo(0, 6)
      expect(ease(1)).toBeCloseTo(1, 6)
    }
  })

  it('resolves steps, at the end or the start of each interval', () => {
    expect(parseEase('steps(4)')(0.3)).toBe(0.25)
    expect(parseEase('steps(4, start)')(0.3)).toBe(0.5)
  })

  it('resolves a CSS-like cubic Bézier curve', () => {
    const ease = parseEase('cubicBezier(0.42, 0, 0.58, 1)')
    expect(ease(0.5)).toBeCloseTo(0.5, 4)
    expect(ease(0.25)).toBeLessThan(0.25)
  })

  it('resolves a piecewise linear curve with explicit stops', () => {
    expect(parseEase('linear(0, 0.25 75%, 1)')(0.75)).toBeCloseTo(0.25, 6)
    expect(parseEase('linear')(0.4)).toBe(0.4)
  })

  it('resolves irregular steps reproducibly from the same declaration', () => {
    const first = parseEase('irregular(8, 1)')
    const samples = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => first(t))
    expect(first(0)).toBe(0)
    expect(first(1)).toBe(1)
    expect([...samples].sort((left, right) => left - right)).toEqual(samples)
    expect(parseEase('irregular(8,1)')(0.5)).toBe(first(0.5))
  })
})
