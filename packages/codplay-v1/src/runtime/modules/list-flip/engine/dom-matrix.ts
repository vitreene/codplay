import { isDomElement } from '../../../components/lib/dom-component-adapter'
import { invertMatrix, multiplyMatrix, parseCssMatrix } from './matrix-2d'
import type { Matrix2D } from './types'

/**
 * Reads the effective CSS transform string from one DOM element.
 */
export function readElementTransformValue(nodeRef: Element): string {
  if (typeof globalThis.getComputedStyle === 'function') {
    const computedTransform = globalThis.getComputedStyle(nodeRef).transform
    return computedTransform && computedTransform.length > 0 ? computedTransform : 'none'
  }

  if (typeof globalThis.HTMLElement !== 'undefined' && nodeRef instanceof globalThis.HTMLElement) {
    const inlineTransform = nodeRef.style.transform
    return inlineTransform && inlineTransform.length > 0 ? inlineTransform : 'none'
  }

  return 'none'
}

/**
 * Accumulates the CSS transforms of all ancestors into one combined 2D matrix.
 */
export function captureCombinedMatrixForNode(nodeRef: Element): Matrix2D {
  let combinedMatrix = parseCssMatrix(readElementTransformValue(nodeRef))

  let parentNodeRef: Node | null = nodeRef.parentNode
  while (isDomElement(parentNodeRef)) {
    const parentMatrix = parseCssMatrix(readElementTransformValue(parentNodeRef))
    combinedMatrix = multiplyMatrix(parentMatrix, combinedMatrix)
    parentNodeRef = parentNodeRef.parentNode
  }

  return combinedMatrix
}

/**
 * Converts a viewport-space delta to the local space of an element
 * using the inverse of its combined matrix.
 */
export function worldDeltaToLocalDelta(
  matrix: Matrix2D,
  worldDeltaX: number,
  worldDeltaY: number,
): { x: number; y: number } {
  const inverseMatrix = invertMatrix(matrix)
  if (inverseMatrix === null) {
    return { x: worldDeltaX, y: worldDeltaY }
  }

  return {
    x: inverseMatrix.a * worldDeltaX + inverseMatrix.c * worldDeltaY,
    y: inverseMatrix.b * worldDeltaX + inverseMatrix.d * worldDeltaY,
  }
}

/**
 * Converts world (viewport) dimensions to local dimensions,
 * accounting for scale and rotation in the combined matrix.
 */
export function worldSizeToLocalSize(
  matrix: Matrix2D,
  worldWidth: number,
  worldHeight: number,
): { width: number; height: number } {
  const aa = Math.abs(matrix.a)
  const bb = Math.abs(matrix.b)
  const cc = Math.abs(matrix.c)
  const dd = Math.abs(matrix.d)
  const determinant = aa * dd - bb * cc

  if (Math.abs(determinant) < 1e-8) {
    return { width: worldWidth, height: worldHeight }
  }

  const localWidth = (worldWidth * dd - worldHeight * cc) / determinant
  const localHeight = (worldHeight * aa - worldWidth * bb) / determinant

  return {
    width: Math.max(0, localWidth),
    height: Math.max(0, localHeight),
  }
}

/**
 * Extracts the rotation-only component of a 2D matrix by normalising out the scale.
 * e and f are set to zero — translation is handled separately via left/top positioning.
 * Used to orient an overlay frame that must follow element rotation without inheriting its scale.
 */
export function extractRotationMatrix(matrix: Matrix2D): Matrix2D {
  const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b)
  const scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d)
  const safeScaleX = scaleX < 1e-8 ? 1 : scaleX
  const safeScaleY = scaleY < 1e-8 ? 1 : scaleY

  return {
    a: matrix.a / safeScaleX,
    b: matrix.b / safeScaleX,
    c: matrix.c / safeScaleY,
    d: matrix.d / safeScaleY,
    e: 0,
    f: 0,
  }
}
