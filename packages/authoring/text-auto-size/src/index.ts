export { computeTextAutoSize, computeTextAutoSizeWithMeasurer } from './compute-text-auto-size'
export {
  DEFAULT_MIN_READABLE_SIZE_PX, FORCED_LINE_HEIGHT, DEFAULT_SINGLE_LINE_MAX_CHARS, DEFAULT_FIT_SAFETY_MARGIN,
  FONT_STRETCH_STEPS,
} from './config'
export { createCanvasMeasureLine } from './core/canvas-measure'
export { pxToCqw, cqwToPx } from './core/cqw'
export type { FontSpec, FontStretchKeyword, MeasureLine, MeasureLineInput, MeasuredLine } from './core/measure'
export type { TextAutoSizeInput, TextAutoSizeResult, TextAutoSizeMode } from './types'
