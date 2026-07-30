import { describe, expect, it } from 'vitest'

import {
  createIdentityMatrix,
  createRotateMatrix,
  createScaleMatrix,
  createTranslateMatrix,
  invertMatrix,
  multiplyMatrix,
  transformPoint,
} from '../src/matrix-2d'

const expectPointCloseTo = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual[0]).toBeCloseTo(expected[0], 10)
  expect(actual[1]).toBeCloseTo(expected[1], 10)
}

describe('matrix-2d', () => {
  it('creates an identity matrix without sharing it', () => {
    expect(createIdentityMatrix()).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
    expect(createIdentityMatrix()).not.toBe(createIdentityMatrix())
  })

  it('applies translation, scale and rotation to points', () => {
    expect(transformPoint(createTranslateMatrix(10, 20), [1, 2])).toEqual([11, 22])
    expect(transformPoint(createScaleMatrix(2, 3), [1, 2])).toEqual([2, 6])
    expectPointCloseTo(transformPoint(createRotateMatrix(Math.PI / 2), [1, 0]), [0, 1])
  })

  it('composes matrices in application order', () => {
    const matrix = multiplyMatrix(createTranslateMatrix(10, 20), createScaleMatrix(2, 3))

    expect(transformPoint(matrix, [1, 1])).toEqual([12, 23])
  })

  it('inverts an invertible matrix', () => {
    const matrix = multiplyMatrix(createTranslateMatrix(10, 20), createRotateMatrix(Math.PI / 4))
    const inverse = invertMatrix(matrix)!
    const point = [12, -3] as const

    expectPointCloseTo(transformPoint(inverse, transformPoint(matrix, point)), point)
  })

  it('does not invert a singular matrix', () => {
    expect(invertMatrix(createScaleMatrix(0, 1))).toBeNull()
  })
})
