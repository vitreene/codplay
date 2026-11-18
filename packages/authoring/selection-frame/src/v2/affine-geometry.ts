import type { SelectionFrameValue } from './types'

/** A two-dimensional linear transform in CSS matrix order. */
export type SelectionFrameLinearMatrix = Readonly<{ a: number; b: number; c: number; d: number }>

/** A point in the selection frame's scene-local coordinate system. */
export type SelectionFramePoint = Readonly<{ x: number; y: number }>

/** Resolves the complete linear transform, including host-provided affine contributions. */
export function selectionFrameLinearTransform(value: SelectionFrameValue): SelectionFrameLinearMatrix {
  if (value.affineProjection !== undefined) return value.affineProjection.matrix
  const angle = ((value.rotate ?? 0) * Math.PI) / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const scaleX = finiteNonZeroScale(value.scaleX)
  const scaleY = finiteNonZeroScale(value.scaleY)
  return { a: cosine * scaleX, b: sine * scaleX, c: -sine * scaleY, d: cosine * scaleY }
}

/** Maps one local-box point through the frame's complete scene-local transform. */
export function selectionFrameLocalToScene(
  value: SelectionFrameValue,
  localX: number,
  localY: number,
): SelectionFramePoint {
  const matrix = selectionFrameLinearTransform(value)
  const pivotX = (value.rotationOrigin?.fx ?? 0.5) * value.width
  const pivotY = (value.rotationOrigin?.fy ?? 0.5) * value.height
  return {
    x: value.x + pivotX - matrix.a * pivotX - matrix.c * pivotY + matrix.a * localX + matrix.c * localY,
    y: value.y + pivotY - matrix.b * pivotX - matrix.d * pivotY + matrix.b * localX + matrix.d * localY,
  }
}

/** Keeps the affine projection origin consistent with the frame's layout values. */
export function updateSelectionFrameAffineOrigin(value: SelectionFrameValue): SelectionFrameValue {
  const projection = value.affineProjection
  if (projection === undefined) return value
  const matrix = selectionFrameLinearTransform(value)
  const pivotX = (value.rotationOrigin?.fx ?? 0.5) * value.width
  const pivotY = (value.rotationOrigin?.fy ?? 0.5) * value.height
  return {
    ...value,
    affineProjection: {
      ...projection,
      origin: {
        x: value.x + pivotX - matrix.a * pivotX - matrix.c * pivotY,
        y: value.y + pivotY - matrix.b * pivotX - matrix.d * pivotY,
      },
    },
  }
}

/** Rotates the complete affine contribution around its local axis and keeps other components. */
export function rotateSelectionFrameAffine(
  value: SelectionFrameValue,
  rotate: number,
  candidate: SelectionFrameValue = value,
): SelectionFrameValue {
  if (value.affineProjection === undefined) return { ...candidate, rotate }
  const angle = ((rotate - (value.rotate ?? 0)) * Math.PI) / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const source = value.affineProjection.matrix
  return updateSelectionFrameAffineOrigin({
    ...candidate,
    rotate,
    affineProjection: {
      ...value.affineProjection,
      matrix: {
        a: cosine * source.a - sine * source.b,
        b: sine * source.a + cosine * source.b,
        c: cosine * source.c - sine * source.d,
        d: sine * source.c + cosine * source.d,
      },
    },
  })
}

/** Resolves a finite non-zero scale for a frame without an explicit affine projection. */
function finiteNonZeroScale(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && Math.abs(value) > 1e-8 ? value : 1
}
