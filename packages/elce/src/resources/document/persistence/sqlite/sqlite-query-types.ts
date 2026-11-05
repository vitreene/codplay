export type SqliteRow = Record<string, unknown>

export interface SqliteQuery {
  readonly text: string
  readonly values: readonly unknown[]
}

/** Prepares one parameterized SQLite statement for execution by a mod repository. */
export function sqliteQuery(text: string, values: readonly unknown[] = []): SqliteQuery {
  return { text, values }
}

/** Reads a required text value from one SQLite row. */
export function sqliteStringValue(row: SqliteRow, key: string): string {
  const value = row[key]
  if (typeof value !== 'string') throw new Error(`Valeur texte invalide en base : ${key}`)
  return value
}

/** Reads an optional text value and maps SQLite NULL to null. */
export function sqliteNullableText(row: SqliteRow, key: string): string | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error(`Valeur texte invalide en base : ${key}`)
  return value
}

/** Reads an optional number and maps SQLite NULL to null. */
export function sqliteNullableNumber(row: SqliteRow, key: string): number | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' && typeof value !== 'bigint') throw new Error(`Valeur numérique invalide en base : ${key}`)
  return Number(value)
}

/** Reads a required number from one SQLite row. */
export function sqliteNumberValue(row: SqliteRow, key: string): number {
  const value = sqliteNullableNumber(row, key)
  if (value === null) throw new Error(`Valeur numérique absente en base : ${key}`)
  return value
}
