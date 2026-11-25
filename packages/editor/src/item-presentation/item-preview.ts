import { invertMatrix } from 'ace'
import { selectionFrameLinearTransform, selectionFrameLocalToScene } from '@codplay/selection-frame/v2'
import type { CodPlayPresentationItem } from 'codplay'
import type { SelectionFrameValue } from '../decor-editor/types'

export const ITEM_PREVIEW_TRANSFORM_PROPERTY = '--editor-item-preview-transform'
export const ITEM_PREVIEW_WIDTH_PROPERTY = '--editor-item-preview-width'
export const ITEM_PREVIEW_HEIGHT_PROPERTY = '--editor-item-preview-height'

/**
 * Local matrix that makes the item's private anchor show the displayed candidate frame:
 * `inverse(runtimePose) × displayedFrame`, composed under the frame's runtime pose.
 *
 * Only a materialized presentation (`local`, `reparent`) keeps its runtime pose while the preview
 * changes the snapshot geometry. An item presented in its own source node (`source`, e.g. at the
 * end of a timed `move`) is placed by that geometry itself: the snapshot already moves its frame,
 * so a matrix computed against the previous pose would apply the gesture a second time. No matrix
 * is produced then. jsdom does not recompute the runtime pose, so only a browser shows that double
 * application; this rule is the contract that prevents it.
 */
export function itemPreviewTransform(
  presented: Pick<CodPlayPresentationItem, 'pose' | 'representation'>,
  frame: SelectionFrameValue,
): string | undefined {
  if (presented.representation === 'source') return undefined
  const { pose } = presented
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
