import { isPlainRecord } from '../../../shared'
import type { CompiledRecord } from '../../../scene/compiled'

/** Clones and deeply freezes one logical snapshot record before exposing it. */
export function freezeSnapshotRecord(record: CompiledRecord): CompiledRecord {
  for (const value of Object.values(record)) freezeSnapshotValue(value)
  return Object.freeze({ ...record })
}

/** Checks the JSON-compatible values allowed inside a snapshot style patch. */
export function isSnapshotValueRecord(value: unknown): value is CompiledRecord {
  if (!isPlainRecord(value)) return false
  return Object.values(value).every(isSnapshotValue)
}

/** Freezes nested snapshot values without retaining caller-owned references. */
function freezeSnapshotValue(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) freezeSnapshotValue(item)
    Object.freeze(value)
    return
  }
  if (!isPlainRecord(value)) return
  for (const item of Object.values(value)) freezeSnapshotValue(item)
  Object.freeze(value)
}

/** Checks one recursively serializable snapshot value. */
function isSnapshotValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true
  }
  if (Array.isArray(value)) return value.every(isSnapshotValue)
  if (isPlainRecord(value)) return Object.values(value).every(isSnapshotValue)
  return false
}
