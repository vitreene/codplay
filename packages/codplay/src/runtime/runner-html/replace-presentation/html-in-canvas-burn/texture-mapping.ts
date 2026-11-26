import { getFittedMediaRect } from '../media'

/** Aligns the canvas support to device pixels while preserving the exact CSS view inside it. */
export function getCanvasViewGeometry(
  rect: Readonly<{ left: number; top: number; width: number; height: number }>,
  viewWidth: number,
  viewHeight: number,
  pixelRatio: number,
) {
  const scaleX = rect.width / viewWidth
  const scaleY = rect.height / viewHeight
  const pixelLeft = Math.floor(rect.left * pixelRatio)
  const pixelTop = Math.floor(rect.top * pixelRatio)
  const width = Math.max(1, Math.ceil((rect.left + rect.width) * pixelRatio) - pixelLeft)
  const height = Math.max(1, Math.ceil((rect.top + rect.height) * pixelRatio) - pixelTop)
  const left = (pixelLeft / pixelRatio - rect.left) / scaleX
  const top = (pixelTop / pixelRatio - rect.top) / scaleY
  const cssWidth = width / (pixelRatio * scaleX)
  const cssHeight = height / (pixelRatio * scaleY)
  return {
    left, top, width, height, cssWidth, cssHeight,
    mapping: [left / viewWidth, (viewHeight - top - cssHeight) / viewHeight, cssWidth / viewWidth, cssHeight / viewHeight] as const,
  }
}

/** Maps the shared fractional CSS view to its native media texture without integer viewport rounding. */
export function getNativeMediaTextureMapping(
  sourceWidth: number,
  sourceHeight: number,
  viewWidth: number,
  viewHeight: number,
  objectFit: string,
) {
  const rect = getFittedMediaRect(sourceWidth, sourceHeight, viewWidth, viewHeight, objectFit)
  return [
    -rect.left / rect.width,
    -(viewHeight - rect.top - rect.height) / rect.height,
    viewWidth / rect.width,
    viewHeight / rect.height,
  ] as const
}

/** Excludes texture allocation padding from the fractional drawable image uploaded by H-i-C. */
export function getDrawableTextureMapping(
  width: number,
  height: number,
  allocatedWidth: number,
  allocatedHeight: number,
) {
  return [0, (allocatedHeight - height) / allocatedHeight, width / allocatedWidth, height / allocatedHeight] as const
}
