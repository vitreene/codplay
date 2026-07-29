import { describe, expect, it } from 'vitest'
import { cubicBezier as animeCubicBezier, eases, linear as animeLinear, steps as animeSteps } from 'animejs'

import { cubicBezier, eases as aceEases, linear, parametricNames, parseEase, steps } from '../src/easings'

/** Le catalogue d'anime est typé nom par nom ; on l'indexe librement pour le balayer. */
const animeEases = eases as unknown as Record<string, ((t: number) => number) & ((...a: number[]) => (t: number) => number)>

/** 41 points, bornes comprises. */
const T = Array.from({ length: 41 }, (_, i) => i / 40)

const expectSameCurve = (mine: (t: number) => number, theirs: (t: number) => number) => {
  for (const t of T) expect(mine(t)).toBeCloseTo(theirs(t), 10)
}

describe('parité du catalogue avec anime.js 4.5.0', () => {
  const plainNames = Object.keys(animeEases).filter((name) => !parametricNames.has(name))

  it('couvre bien tout le catalogue sans paramètre', () => {
    expect(plainNames.length).toBeGreaterThan(30)
  })

  for (const name of plainNames) {
    it(name, () => {
      expectSameCurve(aceEases[name] as (t: number) => number, animeEases[name])
    })
  }
})

describe('parité des courbes paramétrables', () => {
  const cases: Array<[string, Array<number>]> = [
    ['in', [2.5]],
    ['out', [0.5]],
    ['inOut', [4]],
    ['outIn', [3]],
    ['inBack', [2.4]],
    ['outBack', [1]],
    ['inOutBack', [3]],
    ['outInBack', [0.5]],
    ['inElastic', [1.5, 0.4]],
    ['outElastic', [2, 0.8]],
    ['inOutElastic', [1, 0.3]],
    ['outInElastic', [3, 1.2]],
  ]

  for (const [name, args] of cases) {
    it(`${name}(${args.join(', ')})`, () => {
      const mine = (aceEases[name] as (...a: number[]) => (t: number) => number)(...args)
      const theirs = (animeEases[name] as (...a: number[]) => (t: number) => number)(...args)
      expectSameCurve(mine, theirs)
    })
  }
})

describe('parité des courbes autonomes', () => {
  it('cubicBezier', () => {
    for (const args of [
      [0.25, 0.1, 0.25, 1],
      [0.42, 0, 0.58, 1],
      [0.68, -0.55, 0.265, 1.55],
    ] as Array<[number, number, number, number]>) {
      expectSameCurve(cubicBezier(...args), animeCubicBezier(...args))
    }
  })

  it('steps', () => {
    expectSameCurve(steps(5), animeSteps(5))
    expectSameCurve(steps(7, true), animeSteps(7, true))
  })

  it('linear', () => {
    expectSameCurve(linear(0, 0.25, 1), animeLinear(0, 0.25, 1))
    expectSameCurve(linear(0, '0.5 30%', 1), animeLinear(0, '0.5 30%', 1))
  })
})

describe('résolution par nom', () => {
  it('résout un nom simple', () => {
    expectSameCurve(parseEase('inOutQuad'), animeEases.inOutQuad)
  })

  it('résout un nom avec arguments', () => {
    const theirs = (animeEases.outBack as (o: number) => (t: number) => number)(2)
    expectSameCurve(parseEase('outBack(2)'), theirs)
  })

  it('lève sur un nom inconnu, au lieu de retomber sur l’identité', () => {
    expect(() => parseEase('inOutQuadd')).toThrow(/inconnue/)
  })
})
