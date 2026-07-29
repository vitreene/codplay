import { describe, expect, it } from 'vitest'

import { spring } from '../src/spring'

describe('spring', () => {
  it('démarre à 0 et finit à 1', () => {
    const { ease } = spring()
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
  })

  it('porte sa propre durée de stabilisation', () => {
    const { settlingDuration } = spring({ bounce: 0.5, duration: 628 })
    expect(settlingDuration).toBeGreaterThan(0)
    expect(Number.isFinite(settlingDuration)).toBe(true)
  })

  it("est une fonction pure de t — deux évaluations du même t donnent la même valeur", () => {
    const { ease } = spring({ bounce: 0.8 })
    const samples = [0.1, 0.37, 0.5, 0.62, 0.9]
    const first = samples.map(ease)
    const second = samples.map(ease)
    // Rejoué dans l'autre sens, comme le ferait une lecture arrière.
    const reversed = [...samples].reverse().map(ease).reverse()
    expect(second).toEqual(first)
    expect(reversed).toEqual(first)
  })

  it('dépasse 1 quand il rebondit, jamais quand il est suramorti', () => {
    const bouncy = spring({ bounce: 0.9 })
    const overdamped = spring({ bounce: -1 })
    const samples = Array.from({ length: 99 }, (_, i) => (i + 1) / 100)
    expect(Math.max(...samples.map(bouncy.ease))).toBeGreaterThan(1)
    expect(Math.max(...samples.map(overdamped.ease))).toBeLessThanOrEqual(1)
  })

  it('accepte la description physique et en dérive la description perceptuelle', () => {
    const s = spring({ stiffness: 100, damping: 10 })
    expect(s.stiffness).toBe(100)
    expect(s.damping).toBe(10)
    expect(s.bounce).toBeGreaterThan(-1)
    expect(s.bounce).toBeLessThanOrEqual(1)
    expect(s.perceivedDuration).toBeGreaterThan(0)
  })

  it('accepte la description perceptuelle et en dérive la description physique', () => {
    const s = spring({ bounce: 0.2, duration: 400 })
    expect(s.bounce).toBe(0.2)
    expect(s.perceivedDuration).toBe(400)
    expect(s.stiffness).toBeGreaterThan(0)
    expect(s.damping).toBeGreaterThan(0)
  })

  it('un ressort plus raide se stabilise plus vite', () => {
    const souple = spring({ stiffness: 20, damping: 10 })
    const raide = spring({ stiffness: 400, damping: 10 })
    expect(raide.settlingDuration).toBeLessThan(souple.settlingDuration)
  })
})
