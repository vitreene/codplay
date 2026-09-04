import type { DecorPatch } from './types'

/** One user modification together with the value that was displayed before the edit. */
export interface DecorPropertyModification {
  baseValue: unknown
  value: unknown
}

/** Generic property registry for one Decor target at one author time. */
export type DecorModificationMap = Map<string, DecorPropertyModification>

/** Reads any dotted Decor property path without imposing a schema on future modules. */
export function readDecorPath(value: unknown, path: string): unknown {
  let current = value
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/** Creates a detached value so the modification registry cannot retain mutable editor state. */
export function cloneDecorValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => cloneDecorValue(item)) as T
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = cloneDecorValue(child)
    }
    return result as T
  }
  return value
}

/** Writes one dotted path into a detached value, creating missing records on the way. */
export function writeDecorPath<T>(value: T, path: string, nextValue: unknown): T {
  const result = cloneDecorValue(value) as unknown as Record<string, unknown>
  const segments = path.split('.').filter(Boolean)
  if (segments.length === 0) return result as T
  let current = result
  for (const segment of segments.slice(0, -1)) {
    const child = current[segment]
    current[segment] = child && typeof child === 'object' && !Array.isArray(child)
      ? child
      : {}
    current = current[segment] as Record<string, unknown>
  }
  current[segments[segments.length - 1]!] = cloneDecorValue(nextValue)
  return result as T
}

/** Compares two JSON-like values without relying on object identity. */
function decorValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => decorValuesEqual(value, right[index]))
  }
  if (left && typeof left === 'object' && right && typeof right === 'object') {
    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    const leftKeys = Object.keys(leftRecord)
    const rightKeys = Object.keys(rightRecord)
    if (leftKeys.length !== rightKeys.length) return false
    return leftKeys.every(key => Object.prototype.hasOwnProperty.call(rightRecord, key)
      && decorValuesEqual(leftRecord[key], rightRecord[key]))
  }
  return false
}

/** Collects changed leaf properties at the smallest useful path granularity. */
export function collectDecorModifications(base: unknown, current: unknown): DecorModificationMap {
  const modifications: DecorModificationMap = new Map()

  function visit(baseValue: unknown, currentValue: unknown, path: string): void {
    if (decorValuesEqual(baseValue, currentValue)) return
    const baseRecord = baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)
      ? baseValue as Record<string, unknown>
      : null
    const currentRecord = currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
      ? currentValue as Record<string, unknown>
      : null
    if (baseRecord !== null && currentRecord !== null) {
      const keys = new Set([...Object.keys(baseRecord), ...Object.keys(currentRecord)])
      for (const key of keys) {
        const childPath = path.length > 0 ? `${path}.${key}` : key
        visit(baseRecord[key], currentRecord[key], childPath)
      }
      return
    }
    if (path.length > 0) {
      modifications.set(path, {
        baseValue: cloneDecorValue(baseValue),
        value: cloneDecorValue(currentValue),
      })
    }
  }

  visit(base, current, '')
  return modifications
}

/** Applies a sparse property map over a complete resolved Decor value. */
export function applyDecorModifications(base: DecorPatch, modifications: DecorModificationMap): DecorPatch {
  let result = cloneDecorValue(base)
  for (const [path, modification] of modifications) {
    result = writeDecorPath(result, path, modification.value)
  }
  return result
}

/** Converts the modification registry to a sparse Decor patch for persistence or preview. */
export function modificationsToDecorPatch(modifications: DecorModificationMap): DecorPatch {
  let patch: DecorPatch = {}
  for (const [path, modification] of modifications) {
    patch = writeDecorPath(patch, path, modification.value)
  }
  return patch
}

/** Rebuilds a modification registry from a sparse candidate and its complete displayed base. */
export function modificationsFromDecorPatch(base: DecorPatch, patch: DecorPatch): DecorModificationMap {
  const current = applyDecorPatch(base, patch)
  return collectDecorModifications(base, current)
}

/** Applies a generic sparse patch while preserving untouched nested siblings. */
export function applyDecorPatch(base: DecorPatch, patch: DecorPatch): DecorPatch {
  let result = cloneDecorValue(base)
  for (const [path, value] of Object.entries(patch)) {
    result = mergeDecorPath(result, path, value)
  }
  return result
}

/** Merges one patch path, recursively for records and as a replacement for scalar values. */
function mergeDecorPath(base: DecorPatch, path: string, value: unknown): DecorPatch {
  const previous = readDecorPath(base, path)
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !previous || typeof previous !== 'object' || Array.isArray(previous)) {
    return writeDecorPath(base, path, value)
  }
  let result = cloneDecorValue(base)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result = mergeDecorPath(result, `${path}.${key}`, child)
  }
  return result
}
