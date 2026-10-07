import { ANCHOR } from '../../config/document-config'

/** Calculates one image ratio shared by the anchor reserve and media frame. */
export class ElceAnchorRatioService {
  /** Converts decoded image dimensions to the anchor's height-as-width percentage. */
  public imagePaddingBottom(width: number, height: number): string {
    return `${Number(((height / width) * 100).toFixed(8))}%`
  }

  /** Derives the frame's CSS width-to-height ratio from the saved anchor padding. */
  public imageAspectRatio(paddingBottom: string): string {
    if (!paddingBottom.endsWith('%')) return ANCHOR.DEFAULT_IMAGE_ASPECT_RATIO
    const percentage = Number.parseFloat(paddingBottom)
    if (!Number.isFinite(percentage) || percentage <= 0) return ANCHOR.DEFAULT_IMAGE_ASPECT_RATIO

    switch (paddingBottom) {
      case '75%':
        return '4 / 3'
      case '133.33333333%':
        return '3 / 4'
      default:
        const ratio = 100 / percentage
        return String(Number(ratio.toFixed(8)))
    }
  }
}
