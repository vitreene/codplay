/** A two-dimensional affine matrix in column-vector form. */
export type Matrix2D = Readonly<{
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}>

/** A two-dimensional geometric point. */
export type MatrixPoint = readonly [number, number]

const IDENTITY: Matrix2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** Returns a new identity matrix. */
export const createIdentityMatrix = (): Matrix2D => ({ ...IDENTITY })

/** Multiplies two affine matrices in application order. */
export const multiplyMatrix = (left: Matrix2D, right: Matrix2D): Matrix2D => ({
  a: left.a * right.a + left.c * right.b,
  b: left.b * right.a + left.d * right.b,
  c: left.a * right.c + left.c * right.d,
  d: left.b * right.c + left.d * right.d,
  e: left.a * right.e + left.c * right.f + left.e,
  f: left.b * right.e + left.d * right.f + left.f,
})

/** Inverts an affine matrix, or returns null when it is singular. */
export const invertMatrix = (matrix: Matrix2D): Matrix2D | null => {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (Math.abs(determinant) < 1e-8) return null

  const inverseDeterminant = 1 / determinant
  return {
    a: matrix.d * inverseDeterminant,
    b: -matrix.b * inverseDeterminant,
    c: -matrix.c * inverseDeterminant,
    d: matrix.a * inverseDeterminant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) * inverseDeterminant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) * inverseDeterminant,
  }
}

/** Builds a translation matrix. */
export const createTranslateMatrix = (x: number, y: number): Matrix2D => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: x,
  f: y,
})

/** Builds a non-uniform scale matrix. */
export const createScaleMatrix = (x: number, y: number): Matrix2D => ({
  a: x,
  b: 0,
  c: 0,
  d: y,
  e: 0,
  f: 0,
})

/** Builds a counter-clockwise rotation matrix from radians. */
export const createRotateMatrix = (radians: number): Matrix2D => ({
  a: Math.cos(radians),
  b: Math.sin(radians),
  c: -Math.sin(radians),
  d: Math.cos(radians),
  e: 0,
  f: 0,
})

/** Applies an affine matrix to a point. */
export const transformPoint = (matrix: Matrix2D, [x, y]: MatrixPoint): MatrixPoint => [
  matrix.a * x + matrix.c * y + matrix.e,
  matrix.b * x + matrix.d * y + matrix.f,
]
