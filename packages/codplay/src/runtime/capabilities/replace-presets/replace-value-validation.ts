/** Supported V1-compatible propagation origins shared across replace profiles. */
export const REPLACE_DIRECTIONS = [
  'left', 'right', 'top', 'bottom',
  'left-top', 'right-top', 'left-bottom', 'right-bottom',
  'center', 'edges',
] as const

export type ReplaceDirection = (typeof REPLACE_DIRECTIONS)[number]

/** Narrows untrusted replace input to a non-array object record. */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
