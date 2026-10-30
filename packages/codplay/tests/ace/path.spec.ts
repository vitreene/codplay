import { describe, expect, it } from 'vitest'

import { preparePath, prepareSegmentPath, resolvePath, resolvePathFrame } from '../../src/ace/path'
import { prepareTween, resolveTween } from '../../src/ace/tween'

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

describe('resolved path frames', () => {
  it('returns the same point as resolvePath and a forward quadratic tangent', () => {
    const path = preparePath({ control: [0.5, 1] }, { traversal: 'parameter' })
    const frame = resolvePathFrame(path, [10, 20], [110, 20], 0.5)

    expect(frame.point).toEqual(resolvePath(path, [10, 20], [110, 20], 0.5))
    expect(frame.tangent?.[0]).toBeCloseTo(1)
    expect(frame.tangent?.[1]).toBeCloseTo(0)
    expect(resolvePathFrame(path, [10, 20], [110, 20], 0).tangent?.[1]).toBeGreaterThan(0)
    expect(resolvePathFrame(path, [10, 20], [110, 20], 1).tangent?.[1]).toBeLessThan(0)
  })

  it('uses a one-sided direction when a quadratic endpoint derivative is zero', () => {
    const path = preparePath({ control: [0, 0] }, { traversal: 'parameter' })

    expect(resolvePathFrame(path, [0, 0], [100, 0], 0).tangent).toEqual([1, 0])
  })

  it('uses the same prepared arc and subsegment selection as point resolution', () => {
    const path = prepareSegmentPath({
      segments: [{ kind: 'arc', to: [1, 0], radius: [0.7, 0.7], rotation: 0, largeArc: false, sweep: true }],
    })
    const progress = 0.37
    const epsilon = 1e-5
    const frame = resolvePathFrame(path, [0, 0], [200, 30], progress)
    const before = resolvePath(path, [0, 0], [200, 30], progress - epsilon)
    const after = resolvePath(path, [0, 0], [200, 30], progress + epsilon)
    const length = Math.hypot(after[0] - before[0], after[1] - before[1])

    expect(frame.point).toEqual(resolvePath(path, [0, 0], [200, 30], progress))
    expect(frame.tangent?.[0]).toBeCloseTo((after[0] - before[0]) / length, 3)
    expect(frame.tangent?.[1]).toBeCloseTo((after[1] - before[1]) / length, 3)
  })

  it('chooses the next line at an exact parameter-traversed corner', () => {
    const path = prepareSegmentPath({
      segments: [
        { kind: 'line', to: [0.5, 0] },
        { kind: 'line', to: [0.5, 0.5] },
      ],
    }, { traversal: 'parameter' })

    expect(resolvePathFrame(path, [0, 0], [100, 0], 0.5)).toMatchObject({
      point: [50, 0],
      tangent: [0, 1],
    })
  })
})
