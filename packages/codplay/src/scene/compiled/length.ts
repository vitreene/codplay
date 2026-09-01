import { isPlainRecord } from '../../shared'
import { SCENE_BUILD_CONFIG } from '../config/scene-build'
import type { CompiledLengthValue } from './types'
import type { CompiledRecord, CompiledValue } from './types'

const STRUCTURED_LENGTH_PROPERTIES = new Set(['x', 'y', 'width', 'height'])

/** Narrows one compiled value to the configured logical length contract. */
export function isCompiledLengthValue(value: unknown): value is CompiledLengthValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Partial<CompiledLengthValue>
  return candidate.kind === 'length'
    && candidate.unit === SCENE_BUILD_CONFIG.logicalLengthUnit
    && typeof candidate.value === 'number'
    && Number.isFinite(candidate.value)
}

/** Converts structured numeric geometry properties in one style record to logical lengths. */
export function qualifyStructuredLengthStyle(style: Readonly<Record<string, unknown>>): CompiledRecord {
  const qualified: Record<string, CompiledValue> = {}
  for (const [property, value] of Object.entries(style)) {
    qualified[property] = STRUCTURED_LENGTH_PROPERTIES.has(property)
      ? qualifyStructuredLengthValue(value)
      : value as CompiledValue
  }
  return qualified
}

/** Applies structured style qualification through an initial or action payload. */
export function qualifyStructuredLengthStyles(value: CompiledValue): CompiledValue {
  if (Array.isArray(value)) {
    return value.map((item) => qualifyStructuredLengthStyles(item))
  }
  if (!isPlainRecord(value)) return value

  const record = value as CompiledRecord
  const qualified: Record<string, CompiledValue> = { ...record }
  if (isPlainRecord(record.style)) {
    qualified.style = qualifyStructuredLengthStyle(record.style)
  }
  if (isPlainRecord(record.action) || Array.isArray(record.action)) {
    qualified.action = qualifyStructuredLengthStyles(record.action as CompiledValue)
  }
  return qualified
}

/** Converts one direct or tweened numeric geometry value to the configured logical unit. */
function qualifyStructuredLengthValue(value: unknown): CompiledValue {
  if (typeof value === 'number') return qualifyNumericLength(value)
  if (isCompiledLengthValue(value)) return value
  if (!isPlainRecord(value)) return value as CompiledValue
  if (!('from' in value) && !('to' in value)) return value as CompiledRecord

  const qualified: Record<string, CompiledValue> = {}
  for (const [key, child] of Object.entries(value)) {
    qualified[key] = key === 'from' || key === 'to'
      ? qualifyNumericLength(child)
      : child as CompiledValue
  }
  return qualified
}

/** Converts one finite numeric value while leaving non-numeric endpoints unchanged. */
function qualifyNumericLength(value: unknown): CompiledValue {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value as CompiledValue
  return {
    kind: 'length',
    unit: SCENE_BUILD_CONFIG.logicalLengthUnit,
    value,
  }
}
