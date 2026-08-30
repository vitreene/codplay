import type { CompiledLengthValue } from './types'

/** Narrows one compiled value to the explicit logical cqw length contract. */
export function isCompiledLengthValue(value: unknown): value is CompiledLengthValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Partial<CompiledLengthValue>
  return candidate.kind === 'length'
    && candidate.unit === 'cqw'
    && typeof candidate.value === 'number'
    && Number.isFinite(candidate.value)
}
