import { isPlainRecord } from '../../shared'
import type { AuthorFunction } from '../types'
import type { CompiledFunctionReference, CompiledRecord, CompiledValue } from './types'

/** Functions extracted from one compiled scene and kept outside its serializable payload. */
export type CompiledFunctionCollection = Readonly<Record<string, AuthorFunction>>

type MutableFunctionCollection = Record<string, AuthorFunction>

type ExtractionState = {
  functions: MutableFunctionCollection
  nextId: number
}

/** Extracts functions and recursively converts one author value to a JSON-compatible value. */
export function extractCompiledValue(
  value: unknown,
  scope: string,
  state: ExtractionState = createExtractionState(),
): CompiledValue {
  if (value === undefined) {
    return null
  }

  if (typeof value === 'function') {
    return extractFunction(value as AuthorFunction, scope, state)
  }

  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => extractCompiledValue(item, `${scope}[${index}]`, state))
  }

  if (isPlainRecord(value)) {
    const record: Record<string, CompiledValue> = {}
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) {
        continue
      }
      record[key] = extractCompiledValue(item, `${scope}.${key}`, state)
    }
    return record
  }

  throw new Error(`Unsupported compiled value at ${scope}.`)
}

/** Extracts one lifecycle or transform function into a stable reference. */
export function extractFunction(
  fn: AuthorFunction,
  scope: string,
  state: ExtractionState,
): CompiledFunctionReference {
  const ref = `fn:${state.nextId}:${sanitizeScope(scope)}`
  state.nextId += 1
  state.functions[ref] = fn
  return { ref }
}

/** Creates one mutable extraction state for a compilation pass. */
export function createExtractionState(): ExtractionState {
  return { functions: {}, nextId: 0 }
}

/** Converts the mutable extraction boundary to a detached immutable collection. */
export function finalizeFunctionCollection(state: ExtractionState): CompiledFunctionCollection {
  return Object.freeze({ ...state.functions })
}

/** Compiles one record while preserving the record boundary used by scene contracts. */
export function extractCompiledRecord(
  value: Record<string, unknown> | undefined,
  scope: string,
  state: ExtractionState,
): CompiledRecord | undefined {
  if (value === undefined) {
    return undefined
  }
  return extractCompiledValue(value, scope, state) as CompiledRecord
}

/** Makes function reference names stable and safe to use as collection keys. */
function sanitizeScope(scope: string): string {
  return scope.replace(/[^a-zA-Z0-9_.:[\]-]/g, '_')
}
