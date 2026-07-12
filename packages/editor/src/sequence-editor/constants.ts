import type { Easing } from './types'

export const ZOOM_MIN_PX_PER_SEC = 10
export const ZOOM_MAX_PX_PER_SEC = 800
export const ZOOM_DEFAULT_PX_PER_SEC = 80

export const RULER_GRADUATION_LEVELS_MS = [100, 500, 1000, 5000, 10000, 30000, 60000]
export const MIN_GRADUATION_GAP_PX = 48

export const VIRTUAL_SCROLL_BUFFER_ROWS = 3

export const TIME_STEP_MS = 100

export const DEFAULT_TRANSITION_DURATION_MS = 400
export const DEFAULT_EASING: Easing = 'ease-in-out'

export const LABEL_COLUMN_WIDTH_PX = 200
export const RULER_HEIGHT_PX = 28
export const CORNER_HEIGHT_PX = RULER_HEIGHT_PX

export function formatTimeMs(ms: number, unit: 's' | 'ms'): string {
  if (unit === 'ms') return `${ms} ms`
  return `${(Math.round(ms / 100) / 10).toFixed(1)} s`
}
