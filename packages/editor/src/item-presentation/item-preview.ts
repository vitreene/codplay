import { invertMatrix } from 'ace'
import { selectionFrameLinearTransform, selectionFrameLocalToScene } from '@codplay/selection-frame/v2'
import type { CodPlayPresentationPose } from 'codplay'
import type { SelectionFrameValue } from '../decor-editor/types'

export const ITEM_PREVIEW_TRANSFORM_PROPERTY = '--editor-item-preview-transform'
export const ITEM_PREVIEW_WIDTH_PROPERTY = '--editor-item-preview-width'
export const ITEM_PREVIEW_HEIGHT_PROPERTY = '--editor-item-preview-height'

/** Projects a displayed frame through the inverse published pose into the item's local preview. */
export function itemPreviewTransform(
  pose: CodPlayPresentationPose,
  frame: SelectionFrameValue,
): string | undefined {
  const inverse = invertMatrix({ ...pose.matrix, e: pose.origin.x, f: pose.origin.y })
  if (inverse === null) return undefined

  const linear = selectionFrameLinearTransform(frame)
  const origin = selectionFrameLocalToScene(frame, 0, 0)
  const local = {
    a: inverse.a * linear.a + inverse.c * linear.b,
    b: inverse.b * linear.a + inverse.d * linear.b,
    c: inverse.a * linear.c + inverse.c * linear.d,
    d: inverse.b * linear.c + inverse.d * linear.d,
    e: inverse.a * origin.x + inverse.c * origin.y + inverse.e,
    f: inverse.b * origin.x + inverse.d * origin.y + inverse.f,
  }
  return `matrix(${local.a}, ${local.b}, ${local.c}, ${local.d}, ${local.e}, ${local.f})`
}
