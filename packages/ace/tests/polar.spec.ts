import { describe, expect, it } from 'vitest'

import { preparePolarTween, resolvePolarTween } from '../src/polar'
import { resolve } from '../src/resolve'

const expectCoordinatesCloseTo = (actual: readonly unknown[], expected: readonly number[]) => {
  expect(actual[0]).toBeCloseTo(expected[0], 10)
  expect(actual[1]).toBeCloseTo(expected[1], 10)
}

describe('polar tween', () => {
  it('resolves numeric angle and distance into screen coordinates', () => {
    const tween = preparePolarTween({
      from: { a: 0, d: 10 },
      to: { a: 90, d: 20 },
      duration: 100,
      ease: 'linear',
    })

    expectCoordinatesCloseTo(resolvePolarTween(tween, 50), [10.606601717798213, 10.606601717798211])
  })

  it('converts CSS angle units before interpolation', () => {
    const tween = preparePolarTween({
      from: { a: '0deg', d: 10 },
      to: { a: '0.5turn', d: 10 },
      duration: 100,
      ease: 'linear',
    })

    expectCoordinatesCloseTo(resolvePolarTween(tween, 50), [0, 10])
  })

  it('carries the translate unit through both coordinates', () => {
    const tween = preparePolarTween({
      from: { a: 0, d: '10px' },
      to: { a: 0, d: '20px' },
      origin: ['5px', '7px'],
      duration: 100,
      ease: 'linear',
    })

    expect(resolvePolarTween(tween, 50)).toEqual(['20px', '7px'])
  })

  it('lets zero origins adopt the distance unit', () => {
    const tween = preparePolarTween({
      from: { a: 0, d: '10cqw' },
      to: { a: 0, d: '10cqw' },
      duration: 100,
      ease: 'linear',
    })

    expect(resolvePolarTween(tween, 0)).toEqual(['10cqw', '0cqw'])
  })

  it('rejects an origin with an incompatible unit', () => {
    expect(() => preparePolarTween({
      from: { a: 0, d: '10px' },
      to: { a: 0, d: '20px' },
      origin: ['1cqw', '0px'],
      duration: 100,
    })).toThrow(/meme unite/)
  })

  it('resolves through the generic ACE batch resolver', () => {
    const polar = preparePolarTween({
      from: { a: 0, d: 10 },
      to: { a: 90, d: 10 },
      duration: 100,
      ease: 'linear',
    })

    expectCoordinatesCloseTo(resolve([polar], 50)[0] as readonly unknown[], [7.0710678118654755, 7.071067811865475])
  })
})
