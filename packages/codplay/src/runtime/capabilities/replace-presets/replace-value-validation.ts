import { isPlainRecord } from '../../../shared'

/** Supported V1-compatible propagation origins shared across replace profiles. */
export const REPLACE_DIRECTIONS = [
  'left', 'right', 'top', 'bottom',
  'left-top', 'right-top', 'left-bottom', 'right-bottom',
  'center', 'edges',
] as const

export type ReplaceDirection = (typeof REPLACE_DIRECTIONS)[number]

/** Plain-object check shared by the whole runtime. */
export { isPlainRecord }

/** Checks a finite, non-negative duration or stagger value. */
export function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Checks a finite, positive responsive size. */
export function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Checks a positive integer grid dimension. */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** Checks one supported propagation origin. */
export function isReplaceDirection(value: unknown): value is ReplaceDirection {
  return typeof value === 'string' && (REPLACE_DIRECTIONS as readonly string[]).includes(value)
}

/** Options that only shape a mask: its repeated grid (`split: 'cells'`) and its form. */
const REPLACE_MASK_FIELDS = ['split', 'shape', 'stagger', 'staggerPattern', 'direction', 'cellSize', 'cellX', 'cellY'] as const

/**
 * A fade has no mask to repeat or shape: like the legacy text splits of the
 * slot, its mask options are accepted and ignored.
 */
export function ignoreFadeMaskOptions<Value>(value: Value): Value {
  if (!isPlainRecord(value) || value.transition !== 'fade') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !(REPLACE_MASK_FIELDS as readonly string[]).includes(key))) as Value
}
