import type { Matrix2D } from './types'

const IDENTITY_MATRIX: Matrix2D = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0
}

/**
 * Returns a fresh 2D identity matrix.
 */
export function createIdentityMatrix(): Matrix2D {
  return { ...IDENTITY_MATRIX }
}

/**
 * Multiplies two 2D affine matrices.
 */
export function multiplyMatrix(left: Matrix2D, right: Matrix2D): Matrix2D {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f
  }
}

/**
 * Inverts one 2D affine matrix when invertible.
 */
export function invertMatrix(matrix: Matrix2D): Matrix2D | null {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (Math.abs(determinant) < 1e-8) {
    return null
  }

  const invDet = 1 / determinant
  return {
    a: matrix.d * invDet,
    b: -matrix.b * invDet,
    c: -matrix.c * invDet,
    d: matrix.a * invDet,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) * invDet,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) * invDet
  }
}

/**
 * Builds one translation matrix.
 */
export function createTranslateMatrix(x: number, y: number): Matrix2D {
  return {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: x,
    f: y
  }
}

/**
 * Builds one scale matrix.
 */
export function createScaleMatrix(x: number, y: number): Matrix2D {
  return {
    a: x,
    b: 0,
    c: 0,
    d: y,
    e: 0,
    f: 0
  }
}

/**
 * Converts one 2D matrix to a CSS matrix string.
 */
export function toCssMatrix(matrix: Matrix2D): string {
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`
}

/**
 * Parses one CSS transform string into a 2D matrix.
 */
export function parseCssMatrix(transform: string): Matrix2D {
  if (transform === '' || transform === 'none') {
    return createIdentityMatrix()
  }

  const matrix2dMatch = transform.match(/^matrix\(([^)]+)\)$/)
  if (matrix2dMatch) {
    const values = matrix2dMatch[1].split(',').map((value) => Number(value.trim()))
    if (values.length === 6 && values.every((value) => Number.isFinite(value))) {
      return {
        a: values[0],
        b: values[1],
        c: values[2],
        d: values[3],
        e: values[4],
        f: values[5]
      }
    }
  }

  const matrix3dMatch = transform.match(/^matrix3d\(([^)]+)\)$/)
  if (matrix3dMatch) {
    const values = matrix3dMatch[1].split(',').map((value) => Number(value.trim()))
    if (values.length === 16 && values.every((value) => Number.isFinite(value))) {
      return {
        a: values[0],
        b: values[1],
        c: values[4],
        d: values[5],
        e: values[12],
        f: values[13]
      }
    }
  }

  return createIdentityMatrix()
}
