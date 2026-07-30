import { describe, expect, it } from 'vitest'

import { preparePath, resolvePath } from '../src/path'
import { prepareTween, resolveTween } from '../src/tween'

const expectPointCloseTo = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual[0]).toBeCloseTo(expected[0], 10)
  expect(actual[1]).toBeCloseTo(expected[1], 10)
}

describe('normalized quadratic paths', () => {
  const control = [0.5, 0.5] as const

  it('preserves the exact segment endpoints', () => {
    const path = preparePath({ control })

    expect(resolvePath(path, [0, 0], [100, 0], 0)).toEqual([0, 0])
    expect(resolvePath(path, [0, 0], [100, 0], 1)).toEqual([100, 0])
  })

  it('scales and rotates the normalized curve uniformly on its segment', () => {
    const path = preparePath({ control })

    expectPointCloseTo(resolvePath(path, [0, 0], [100, 0], 0.5), [50, 25])
    expectPointCloseTo(resolvePath(path, [0, 0], [0, 100], 0.5), [-25, 50])
  })

  it('offers arc-length traversal separately from parameter traversal', () => {
    const parameterPath = preparePath({ control: [0.1, 0.9] }, { traversal: 'parameter' })
    const arcLengthPath = preparePath({ control: [0.1, 0.9] }, { traversal: 'arc-length' })

    expect(resolvePath(parameterPath, [0, 0], [100, 100], 0.25)).not.toEqual(
      resolvePath(arcLengthPath, [0, 0], [100, 100], 0.25),
    )
  })

  it('resolves a path through a prepared tween', () => {
    const tween = prepareTween({
      from: [0, 0],
      to: [100, 0],
      duration: 100,
      ease: 'linear',
      path: preparePath({ control }),
    })

    expectPointCloseTo(resolveTween(tween, 50) as readonly number[], [50, 25])
  })

  it('rejects a path tween that does not carry two numeric points', () => {
    expect(() => prepareTween({
      from: 0,
      to: 100,
      duration: 100,
      path: preparePath({ control }),
    })).toThrow(/deux points numeriques/)
  })
})
