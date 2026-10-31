import { invertMatrix } from 'ace'
import type { CodPlayPresentationPose } from 'codplay'

export const ITEM_PREVIEW_INVERSE_PROPERTY = '--editor-item-preview-inverse'

/** Expresses a snapshot preview in the unchanged native motion frame, using its published pose. */
export function itemPreviewInverse(pose: CodPlayPresentationPose): string | undefined {
  const inverse = invertMatrix({ ...pose.matrix, e: pose.origin.x, f: pose.origin.y })
  return inverse === null ? undefined
    : `matrix(${inverse.a}, ${inverse.b}, ${inverse.c}, ${inverse.d}, ${inverse.e}, ${inverse.f})`
}
