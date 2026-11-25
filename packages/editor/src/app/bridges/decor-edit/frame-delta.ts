import { invertMatrix } from 'ace'
import { rotateSelectionFrameAffine, selectionFrameLinearTransform, selectionFrameLocalToScene, updateSelectionFrameAffineOrigin } from '@codplay/selection-frame/v2'
import type { SelectionFrameDelta, SelectionFrameHandleId } from '@codplay/selection-frame/v2'
import type { DecorPatch, OffsetPatch, SelectionFrameValue } from '../../../decor-editor/types'
import { pxToCqw } from '../../../decor-editor/units'
import { frameVisualCenter, normalizeAngleDegrees } from '../../../motion-editor/geometry'

/** Selection Frame gesture geometry: resize, rotation and pivot deltas applied to a displayed frame. */

/** Smallest Selection Frame side a resize gesture may produce, in transient projection pixels. */
const MIN_FRAME_SIZE_PX = 4

/**
 * Applies one V2 selection-frame gesture to the current local-pixel frame.
 *
 * Move/resize deltas are local pixels, rotation is a gesture-relative degree value and pivot is an
 * absolute local-box fraction. Resize and pivot both rebuild the translation from a visual anchor
 * instead of mutating the untransformed top-left: this keeps the opposite resize point fixed under
 * rotation/scale and keeps the rendered item still while its rotation axis is moved.
 */
export function applyFrameDelta(base: SelectionFrameValue, delta: SelectionFrameDelta): SelectionFrameValue {
  if (delta.kind === 'move') return updateSelectionFrameAffineOrigin({ ...base, x: base.x + delta.dx, y: base.y + delta.dy })
  if (delta.kind === 'rotate') {
    return rotateSelectionFrameAffine(base, normalizeAngleDegrees(Math.round((base.rotate ?? 0) + delta.dr)))
  }
  if (delta.kind === 'pivot') return applyRotationOriginDelta(base, delta.fx, delta.fy)

  const inverse = invertMatrix({ ...selectionFrameLinearTransform(base), e: 0, f: 0 })
  if (inverse === null) return base
  const localDx = inverse.a * delta.dx + inverse.c * delta.dy
  const localDy = inverse.b * delta.dx + inverse.d * delta.dy

  const width = delta.handle.includes('e')
    ? Math.max(MIN_FRAME_SIZE_PX, base.width + localDx)
    : delta.handle.includes('w')
      ? Math.max(MIN_FRAME_SIZE_PX, base.width - localDx)
      : base.width
  const height = delta.handle.includes('s')
    ? Math.max(MIN_FRAME_SIZE_PX, base.height + localDy)
    : delta.handle.includes('n')
      ? Math.max(MIN_FRAME_SIZE_PX, base.height - localDy)
      : base.height
  const opposite = oppositePointForHandle(delta.handle)
  const oldAnchor = framePoint(base, opposite.fx * base.width, opposite.fy * base.height)
  const candidateWithoutTranslation = framePoint({ ...base, x: 0, y: 0, width, height }, opposite.fx * width, opposite.fy * height)

  return updateSelectionFrameAffineOrigin({
    ...base,
    x: oldAnchor.x - candidateWithoutTranslation.x,
    y: oldAnchor.y - candidateWithoutTranslation.y,
    width,
    height,
  })
}

/** Returns the effective axis fraction, with the V2 center default and a finite clamp. */
export function frameRotationOrigin(value: SelectionFrameValue): { fx: number; fy: number } {
  const origin = value.rotationOrigin
  const clamp = (input: number): number => Number.isFinite(input) ? Math.min(1, Math.max(0, input)) : 0.5
  return { fx: clamp(origin?.fx ?? 0.5), fy: clamp(origin?.fy ?? 0.5) }
}

/** Maps one local-box point into the frame's scene-local visual coordinates. */
export function framePoint(value: SelectionFrameValue, localX: number, localY: number): { x: number; y: number } {
  return selectionFrameLocalToScene(value, localX, localY)
}

/** Resolves the opposite characteristic point that must remain fixed during a resize. */
export function oppositePointForHandle(handle: SelectionFrameHandleId): { fx: number; fy: number } {
  return {
    fx: handle.includes('e') ? 0 : handle.includes('w') ? 1 : 0.5,
    fy: handle.includes('s') ? 0 : handle.includes('n') ? 1 : 0.5,
  }
}

/** Changes the pivot while compensating translation so the current visual pose does not jump. */
export function applyRotationOriginDelta(base: SelectionFrameValue, fx: number, fy: number): SelectionFrameValue {
  const clamp = (input: number): number => Number.isFinite(input) ? Math.min(1, Math.max(0, input)) : 0.5
  const nextOrigin = { fx: clamp(fx), fy: clamp(fy) }
  const currentOrigin = frameRotationOrigin(base)
  const previousPivot = { x: currentOrigin.fx * base.width, y: currentOrigin.fy * base.height }
  const nextPivot = { x: nextOrigin.fx * base.width, y: nextOrigin.fy * base.height }
  const matrix = selectionFrameLinearTransform(base)
  const deltaX = (previousPivot.x - nextPivot.x) - (matrix.a * (previousPivot.x - nextPivot.x) + matrix.c * (previousPivot.y - nextPivot.y))
  const deltaY = (previousPivot.y - nextPivot.y) - (matrix.b * (previousPivot.x - nextPivot.x) + matrix.d * (previousPivot.y - nextPivot.y))
  return updateSelectionFrameAffineOrigin({
    ...base,
    x: base.x + deltaX,
    y: base.y + deltaY,
    rotationOrigin: nextOrigin,
  })
}

/**
 * Maps one Selection Frame gesture on a zone-placed item to zone-relative transforms, measured from
 * the edit's base decor: the zone stays the reference geometry and is never overridden.
 */
export function zoneOffsetGesturePatch(
  delta: SelectionFrameDelta,
  base: SelectionFrameValue,
  candidate: SelectionFrameValue,
  rootWidth: number,
  basePatch: DecorPatch,
): DecorPatch | null {
  const original = basePatch.offset ?? {}
  const translate = original.translate ?? {}
  const offset: OffsetPatch = {}

  if (delta.kind === 'move') {
    offset.translate = {
      x: (translate.x ?? 0) + pxToCqw(candidate.x - base.x, rootWidth),
      y: (translate.y ?? 0) + pxToCqw(candidate.y - base.y, rootWidth),
    }
  }
  if (delta.kind === 'rotate') offset.rotate = candidate.rotate ?? 0
  if (delta.kind === 'pivot') offset.rotationOrigin = candidate.rotationOrigin ?? { fx: 0.5, fy: 0.5 }
  if (delta.kind === 'resize') {
    if (base.width <= 0 || base.height <= 0) return null
    const resizeX = delta.handle.includes('e') || delta.handle.includes('w')
    const resizeY = delta.handle.includes('n') || delta.handle.includes('s')
    const scaleX = (original.scale?.x ?? base.scaleX ?? 1) * (resizeX ? candidate.width / base.width : 1)
    const scaleY = (original.scale?.y ?? base.scaleY ?? 1) * (resizeY ? candidate.height / base.height : 1)
    const scaledBase = { ...base, scaleX, scaleY }
    const targetCenter = frameVisualCenter(candidate)
    const scaledCenter = frameVisualCenter(scaledBase)
    offset.scale = { x: scaleX, y: scaleY }
    offset.translate = {
      x: (translate.x ?? 0) + pxToCqw(targetCenter.x - scaledCenter.x, rootWidth),
      y: (translate.y ?? 0) + pxToCqw(targetCenter.y - scaledCenter.y, rootWidth),
    }
  }
  return { offset }
}
