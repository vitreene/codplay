import { getFittedMediaRect } from '../media'

/**
 * Aligns the canvas support to device pixels while preserving the exact CSS
 * view inside it. `mapping` turns a canvas coordinate (0..1, top-left origin)
 * into a view coordinate: `view = mapping.xy + canvas * mapping.zw`.
 */
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
    mapping: [left / viewWidth, top / viewHeight, cssWidth / viewWidth, cssHeight / viewHeight] as const,
  }
}

/**
 * Maps the view onto a drawable DOM state: the fractional element image inside
 * its whole-texel texture allocation (row 0 is the element's top).
 */
export function getDrawableTextureMap(
  width: number,
  height: number,
  allocatedWidth: number,
  allocatedHeight: number,
) {
  return [0, 0, width / allocatedWidth, height / allocatedHeight] as const
}

/**
 * Maps the view onto a native media frame framed by its CSS `object-fit`,
 * used to draw the outgoing media before the first HTML-in-Canvas paint.
 */
export function getNativeMediaTextureMap(
  sourceWidth: number,
  sourceHeight: number,
  viewWidth: number,
  viewHeight: number,
  objectFit: string,
) {
  const rect = getFittedMediaRect(sourceWidth, sourceHeight, viewWidth, viewHeight, objectFit)
  return [
    -rect.left / rect.width,
    -rect.top / rect.height,
    viewWidth / rect.width,
    viewHeight / rect.height,
  ] as const
}
