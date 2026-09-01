import type { OffsetPatch, SelectionFrameValue } from './types'

/** Partial value used when projecting an existing structured offset to the frame. */
export type OffsetValuesPx = Partial<SelectionFrameValue>

/** cqw = 1% de la largeur du conteneur de référence, en px. */
export function pxToCqw(px: number, containerWidthPx: number): number {
  return (px / containerWidthPx) * 100
}

export function cqwToPx(cqw: number, containerWidthPx: number): number {
  return (cqw / 100) * containerWidthPx
}

/**
 * geste → champs (spec §6) : `OffsetValuesPx` (px, contrats actuels du cadre de sélection) →
 * `OffsetPatch` (cqw, stocké dans l'écart). `rotate`/`scale`/`anchor` ne sont pas des grandeurs
 * de longueur — ils traversent sans conversion.
 */
export function offsetValuesPxToPatch(values: OffsetValuesPx, containerWidthPx: number): OffsetPatch {
  const patch: OffsetPatch = {}
  if (values.x !== undefined) patch.x = pxToCqw(values.x, containerWidthPx)
  if (values.y !== undefined) patch.y = pxToCqw(values.y, containerWidthPx)
  if (values.width !== undefined) patch.width = pxToCqw(values.width, containerWidthPx)
  if (values.height !== undefined) patch.height = pxToCqw(values.height, containerWidthPx)
  if (values.translate !== undefined) {
    patch.translate = { x: pxToCqw(values.translate.x, containerWidthPx), y: pxToCqw(values.translate.y, containerWidthPx) }
  }
  if (values.rotate !== undefined) patch.rotate = values.rotate
  if (values.scale !== undefined) patch.scale = values.scale
  if (values.anchor !== undefined) patch.anchor = values.anchor
  return patch
}

/** champs → geste (spec §6) : sens inverse, `OffsetPatch` (cqw) → `OffsetValuesPx` (px). */
export function offsetPatchToValuesPx(patch: OffsetPatch, containerWidthPx: number): OffsetValuesPx {
  const values: OffsetValuesPx = {}
  if (patch.x !== undefined) values.x = cqwToPx(patch.x, containerWidthPx)
  if (patch.y !== undefined) values.y = cqwToPx(patch.y, containerWidthPx)
  if (patch.width !== undefined) values.width = cqwToPx(patch.width, containerWidthPx)
  if (patch.height !== undefined) values.height = cqwToPx(patch.height, containerWidthPx)
  if (patch.translate !== undefined) {
    values.translate = { x: cqwToPx(patch.translate.x, containerWidthPx), y: cqwToPx(patch.translate.y, containerWidthPx) }
  }
  if (patch.rotate !== undefined) values.rotate = patch.rotate
  if (patch.scale !== undefined) values.scale = patch.scale
  if (patch.anchor !== undefined) values.anchor = patch.anchor
  return values
}
