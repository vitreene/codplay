/** Bounds an optional insertion index to the current collection. */
export function indexAtEndOrRequested(length: number, index: number | undefined): number {
  return Math.max(0, Math.min(index ?? length, length))
}

/** Returns a collection with one item inserted at its bounded index. */
export function insertAt<T>(values: readonly T[], value: T, index: number | undefined): readonly T[] {
  const result = [...values]
  result.splice(indexAtEndOrRequested(result.length, index), 0, value)
  return result
}

/** Returns a collection without entries equal to the supplied value. */
export function removeValue<T>(values: readonly T[], value: T): readonly T[] {
  return values.filter((candidate) => candidate !== value)
}

/** Replaces matching values without mutating the original collection. */
export function replaceAt<T>(values: readonly T[], value: T, predicate: (candidate: T) => boolean): readonly T[] {
  return values.map((candidate) => (predicate(candidate) ? value : candidate))
}
