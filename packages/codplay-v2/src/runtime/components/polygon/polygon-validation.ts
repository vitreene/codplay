import { isPlainRecord } from '../../../shared'
import type { ValidationFunction } from '../../../services'
import { isComponentRecord, reportInvalidComponentValue } from '../component-validation'
import type { PolygonMorphInput } from './polygon-types'

const DEFAULT_SIDES = 3
const DEFAULT_OUTER = 40
const DEFAULT_ROTATION_DEG = -90
const DEFAULT_MORPH_DURATION_MS = 700
const DEFAULT_MORPH_DELAY_MS = 0
const DEFAULT_MORPH_SAMPLE_COUNT = 96

/** Validates the authored initial profile of one polygon perso. */
export const validatePolygonInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_POLYGON_INITIAL_INVALID', 'polygon initial state must be a plain object.')
    return
  }
  validatePolygonFields(value, context)
}

/** Validates one authored polygon action patch. */
export const validatePolygonAction: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) return
  validatePolygonFields(value, context)
}

/** Completes and normalizes the polygon initial profile before CompiledScene extraction. */
export function sanitizePolygonInitial(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const result = { ...value }
  const sides = normalizeSides(value.sides === undefined ? DEFAULT_SIDES : value.sides as number)
  const outer = normalizeOuter(value.outer === undefined ? DEFAULT_OUTER : value.outer as number)
  const inner = value.inner === undefined || value.inner === null
    ? null
    : normalizeInner(value.inner as number, outer)

  result.sides = sides
  result.outer = outer
  result.inner = inner
  result.rotationDeg = value.rotationDeg === undefined ? DEFAULT_ROTATION_DEG : value.rotationDeg
  result.inflexion = normalizeInflexions(value.inflexion, segmentCount(sides, inner, outer))
  if (value.morph !== undefined) result.morph = sanitizeMorph(value.morph as PolygonMorphInput)
  return result
}

/** Normalizes only the fields present in one polygon action patch. */
export function sanitizePolygonAction(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const result = { ...value }
  if (result.sides === undefined) delete result.sides
  else result.sides = normalizeSides(result.sides as number)
  if (result.outer === undefined) delete result.outer
  else result.outer = normalizeOuter(result.outer as number)
  if (result.inner === undefined) delete result.inner
  else if (result.inner === null) result.inner = null
  else result.inner = normalizeInner(result.inner as number, result.outer as number | undefined)
  if (result.rotationDeg === undefined) delete result.rotationDeg
  if (result.inflexion !== undefined) result.inflexion = normalizeInflexionInput(result.inflexion)
  if (result.morph !== undefined) result.morph = sanitizeMorph(result.morph as PolygonMorphInput)
  return result
}

/** Validates all polygon-owned fields without inspecting a materialized node. */
function validatePolygonFields(
  value: Record<string, unknown>,
  context: Parameters<ValidationFunction>[1],
): void {
  validateFiniteNumber(value.sides, 'sides', context)
  validateFiniteNumber(value.inner, 'inner', context, true)
  validateFiniteNumber(value.outer, 'outer', context)
  validateFiniteNumber(value.rotationDeg, 'rotationDeg', context)
  validateInflexion(value.inflexion, context)
  if (value.morph !== undefined) validateMorph(value.morph, context)
}

/** Validates one optional numeric polygon field. */
function validateFiniteNumber(
  value: unknown,
  field: string,
  context: Parameters<ValidationFunction>[1],
  allowNull = false,
): void {
  if (value === undefined || (allowNull && value === null)) return
  if (typeof value === 'number' && Number.isFinite(value)) return
  reportInvalidComponentValue(context, `AUTHOR_POLYGON_${field.toUpperCase()}_INVALID`, `polygon.${field} must be a finite number.`, field)
}

/** Validates the scalar or list form accepted by polygon edge inflexion. */
function validateInflexion(value: unknown, context: Parameters<ValidationFunction>[1]): void {
  if (value === undefined) return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateFiniteNumber(entry, `inflexion[${index}]`, context))
    return
  }
  validateFiniteNumber(value, 'inflexion', context)
}

/** Validates the morph timing profile before its defaults are compiled. */
function validateMorph(value: unknown, context: Parameters<ValidationFunction>[1]): void {
  if (typeof value === 'boolean') return
  if (!isPlainRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_POLYGON_MORPH_INVALID', 'polygon.morph must be a boolean or plain object.', 'morph')
    return
  }
  validateFiniteNumber(value.duration, 'morph.duration', context)
  validateFiniteNumber(value.delayMs, 'morph.delayMs', context)
  validateFiniteNumber(value.precision, 'morph.precision', context)
  validateFiniteNumber(value.sampleCount, 'morph.sampleCount', context)
  for (const field of ['ease', 'easing']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      reportInvalidComponentValue(context, 'AUTHOR_POLYGON_MORPH_INVALID', `polygon.morph.${field} must be a string.`, `morph.${field}`)
    }
  }
}

/** Applies the V1-compatible sides lower bound at compilation. */
function normalizeSides(value: number): number {
  return Math.max(3, Math.round(value))
}

/** Applies the V1-compatible outer-radius lower bound at compilation. */
function normalizeOuter(value: number): number {
  return Math.max(1, value)
}

/** Applies the V1-compatible inner-radius bounds at compilation. */
function normalizeInner(value: number, outer: number | undefined): number {
  return outer === undefined ? Math.max(0, value) : Math.max(0, Math.min(outer, value))
}

/** Returns the number of geometric segments represented by one compiled shape. */
function segmentCount(sides: number, inner: number | null, outer: number): number {
  return inner !== null && inner > 0 && inner < outer ? sides * 2 : sides
}

/** Expands an authored scalar or list into the exact initial segment count. */
function normalizeInflexions(value: unknown, count: number): readonly number[] {
  if (Array.isArray(value)) {
    return Array.from({ length: count }, (_, index) => value[index] as number | undefined ?? 0)
  }
  const scalar = value === undefined ? 0 : value as number
  return Array.from({ length: count }, () => scalar)
}

/** Sanitizes an action inflexion while preserving scalar-vs-list patch semantics. */
function normalizeInflexionInput(value: unknown): number | readonly number[] {
  return Array.isArray(value) ? value.map((entry) => entry as number) : value as number
}

/** Makes one morph declaration explicit for the runtime component. */
function sanitizeMorph(value: PolygonMorphInput): Readonly<Record<string, unknown>> {
  const source = typeof value === 'object' && value !== null ? value : {}
  const ease = typeof source.ease === 'string'
    ? source.ease
    : typeof source.easing === 'string' ? source.easing : 'linear'
  return {
    duration: source.duration === undefined ? DEFAULT_MORPH_DURATION_MS : Math.max(0, source.duration),
    delayMs: source.delayMs === undefined ? DEFAULT_MORPH_DELAY_MS : Math.max(0, source.delayMs),
    ease,
    sampleCount: source.sampleCount === undefined
      ? DEFAULT_MORPH_SAMPLE_COUNT
      : Math.max(8, Math.round(source.sampleCount)),
  }
}
