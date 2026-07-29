import { describe, expect, it } from 'vitest'
import { spring as aceSpring } from '../src/spring'
// @ts-ignore
import { spring as animeSpring } from 'animejs'

const CASES = [
  { bounce: 0.5, duration: 628 },
  { bounce: 0, duration: 300 },
  { bounce: 0.9, duration: 1000 },
  { bounce: -0.5, duration: 500 },
  { stiffness: 100, damping: 10 },
  { stiffness: 400, damping: 25, mass: 2 },
  { stiffness: 50, damping: 5, velocity: 3 },
]
const T = Array.from({ length: 21 }, (_, i) => i / 20)

describe('parité avec anime.js 4.5.0', () => {
  for (const params of CASES) {
    it(JSON.stringify(params), () => {
      const a = animeSpring(params)
      const b = aceSpring(params)
      expect(b.settlingDuration).toBeCloseTo(a.settlingDuration, 6)
      for (const t of T) expect(b.ease(t)).toBeCloseTo(a.ease(t), 10)
    })
  }
})
