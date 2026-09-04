import type { SelectionFrameValue } from '../decor-editor/types'

/** Pixel insets between an element's layout border-box origin and its content-box origin. */
export type ContentBoxInsetsPx = Readonly<{
  top: number
  right: number
  bottom: number
  left: number
}>

/** Empty insets used when a Decor has no visible border. */
export const ZERO_CONTENT_BOX_INSETS_PX: ContentBoxInsetsPx = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

/**
 * Projects the CSS layout origin to the top-left origin of the content box.
 *
 * `SelectionFrameValue.x/y` are assigned to CSS `left/top`; they are not the origin of the
 * rotated/scaled affine matrix. CSS resolves `transform-origin` against the border box while the
 * overlay resolves the same fraction against the content box. The correction below translates
 * the whole content box so both renderings describe the same transformed points. For the normal
 * centred, symmetric border this reduces to the physical `left/top` inset, without rotating it.
 */
export function poseFrameToContentBoxFrame(
  frame: SelectionFrameValue,
  insets: ContentBoxInsetsPx,
): SelectionFrameValue {
  const displacement = contentBoxLayoutDisplacement(frame, insets)
  return {
    ...frame,
    x: frame.x + displacement.x,
    y: frame.y + displacement.y,
  }
}

/** Converts a content-box layout frame back to the border-box origin used by document offsets. */
export function contentBoxFrameToPoseFrame(
  frame: SelectionFrameValue,
  insets: ContentBoxInsetsPx,
): SelectionFrameValue {
  const displacement = contentBoxLayoutDisplacement(frame, insets)
  return {
    ...frame,
    x: frame.x - displacement.x,
    y: frame.y - displacement.y,
  }
}

/**
 * Returns the layout translation needed to render the same content points as the CSS element.
 *
 * The border-box pivot and content-box pivot differ when a border is present. Expressing that
 * difference explicitly keeps the inverse exact for non-centred transform origins as well as for
 * the centred case used by the current presets.
 */
export function contentBoxLayoutDisplacement(
  frame: SelectionFrameValue,
  insets: ContentBoxInsetsPx,
): { x: number; y: number } {
  const angle = ((frame.rotate ?? 0) * Math.PI) / 180
  const scaleX = finiteScale(frame.scaleX)
  const scaleY = finiteScale(frame.scaleY)
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const fx = finiteOriginFraction(frame.rotationOrigin?.fx)
  const fy = finiteOriginFraction(frame.rotationOrigin?.fy)
  const contentPivotX = fx * frame.width
  const contentPivotY = fy * frame.height
  const borderBoxPivotX = fx * (frame.width + insets.left + insets.right)
  const borderBoxPivotY = fy * (frame.height + insets.top + insets.bottom)
  const pivotDeltaX = borderBoxPivotX - contentPivotX
  const pivotDeltaY = borderBoxPivotY - contentPivotY
  const localInsetX = insets.left - pivotDeltaX
  const localInsetY = insets.top - pivotDeltaY
  const transformedInsetX = cosine * scaleX * localInsetX - sine * scaleY * localInsetY
  const transformedInsetY = sine * scaleX * localInsetX + cosine * scaleY * localInsetY
  return {
    x: pivotDeltaX + transformedInsetX,
    y: pivotDeltaY + transformedInsetY,
  }
}

/** Returns a finite transform-origin fraction, matching the overlay's centred fallback. */
function finiteOriginFraction(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5
}

/** Returns a finite non-zero scale so origin projection remains defined. */
function finiteScale(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && Math.abs(value) > 1e-8 ? value : 1
}
