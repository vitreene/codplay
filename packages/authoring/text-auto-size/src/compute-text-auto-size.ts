import { DEFAULT_MIN_READABLE_SIZE_PX, FORCED_LINE_HEIGHT } from './config'
import { cqwToPx, pxToCqw } from './core/cqw'
import { createCanvasMeasureLine } from './core/canvas-measure'
import { searchFontSizePx } from './core/search-font-size'
import type { MeasureLine } from './core/measure'
import type { TextAutoSizeInput, TextAutoSizeResult } from './types'

/**
 * Composition testable : mesure injectée (§7, §8 de la spec). `computeTextAutoSize`
 * (export public) l'appelle avec l'environnement de mesure canvas réel — la mesure reste
 * un détail interne pour l'appelant final (dedit, builder), jamais un paramètre exposé.
 */
export function computeTextAutoSizeWithMeasurer(input: TextAutoSizeInput, measure: MeasureLine): TextAutoSizeResult {
  const blockWidthPx = cqwToPx(input.blockWidthCqw, input.referenceWidthPx)
  const blockHeightPx = cqwToPx(input.blockHeightCqw, input.referenceWidthPx)
  const minSizePx = input.minReadableSizePx ?? DEFAULT_MIN_READABLE_SIZE_PX

  const { mode, fontSizePx, fontStretch } = searchFontSizePx({
    text: input.text,
    font: input.font,
    blockWidthPx,
    blockHeightPx,
    minSizePx,
    measure,
    singleLineMaxChars: input.singleLineMaxChars,
    fitSafetyMargin: input.fitSafetyMargin,
  })

  return {
    mode,
    fontSizeCqw: pxToCqw(fontSizePx, input.referenceWidthPx),
    lineHeight: FORCED_LINE_HEIGHT,
    fontStretch,
  }
}

export function computeTextAutoSize(input: TextAutoSizeInput): TextAutoSizeResult {
  return computeTextAutoSizeWithMeasurer(input, createCanvasMeasureLine())
}
