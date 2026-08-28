import { isPlainRecord } from '../is-plain-record'

/** Clones arrays and plain records while preserving primitives and non-plain values. */
export function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as T
  if (!isPlainRecord(value)) return value

  const clone: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) clone[key] = cloneValue(child)
  return clone as T
}

/** Clones one optional record and returns an empty record when no source exists. */
export function cloneRecord<T extends Record<string, unknown>>(record: T | undefined): T {
  return record === undefined ? {} as T : cloneValue(record)
}
