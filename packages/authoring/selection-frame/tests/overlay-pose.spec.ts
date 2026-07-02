// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { captureCombinedMatrixWithIndividualTransforms } from '../src/overlay-pose'

describe('captureCombinedMatrixWithIndividualTransforms', () => {
  it('composes the individual rotate property into the matrix', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    node.style.rotate = '90deg'

    const matrix = captureCombinedMatrixWithIndividualTransforms(node)
    expect(matrix.a).toBeCloseTo(0, 6)
    expect(matrix.b).toBeCloseTo(1, 6)
    expect(matrix.c).toBeCloseTo(-1, 6)
    expect(matrix.d).toBeCloseTo(0, 6)

    node.remove()
  })

  it('composes the individual scale property into the matrix', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    node.style.scale = '2 3'

    const matrix = captureCombinedMatrixWithIndividualTransforms(node)
    expect(matrix.a).toBeCloseTo(2, 6)
    expect(matrix.d).toBeCloseTo(3, 6)

    node.remove()
  })

  it('composes rotate and scale with the transform property in spec order', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    node.style.rotate = '90deg'
    node.style.scale = '2'

    // rotate(90°) · scale(2) → x axis maps to (0, 2)
    const matrix = captureCombinedMatrixWithIndividualTransforms(node)
    expect(matrix.a).toBeCloseTo(0, 6)
    expect(matrix.b).toBeCloseTo(2, 6)

    node.remove()
  })

  it('accumulates ancestor individual transforms', () => {
    const parent = document.createElement('div')
    const child = document.createElement('div')
    parent.appendChild(child)
    document.body.appendChild(parent)
    parent.style.scale = '2'
    child.style.scale = '3'

    const matrix = captureCombinedMatrixWithIndividualTransforms(child)
    expect(matrix.a).toBeCloseTo(6, 6)
    expect(matrix.d).toBeCloseTo(6, 6)

    parent.remove()
  })

  it('returns identity when no transform is set', () => {
    const node = document.createElement('div')
    document.body.appendChild(node)

    const matrix = captureCombinedMatrixWithIndividualTransforms(node)
    expect(matrix).toMatchObject({ a: 1, b: 0, c: 0, d: 1 })

    node.remove()
  })
})
