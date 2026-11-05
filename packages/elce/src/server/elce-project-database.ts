import { fileURLToPath } from 'node:url'
import { createSqliteDatabase } from 'remix/data-table/sqlite'
import type { SqliteDatabase } from 'remix/data-table/sqlite'
import { loadMigrations } from 'remix/data-table/migrations/node'

const MIGRATION_DIRECTORIES = [
  fileURLToPath(new URL('../mods/learning/persistence/server/sqlite/migrations/', import.meta.url)),
  fileURLToPath(new URL('../mods/quiz-hunt/persistence/server/sqlite/migrations/', import.meta.url)),
]

/** Opens the shared Elcé SQLite database and applies migrations from both mods. */
export async function openElceProjectDatabase(filename: string): Promise<SqliteDatabase> {
  const database = createSqliteDatabase({ filename, foreignKeys: true })
  try {
    const migrations = (await Promise.all(MIGRATION_DIRECTORIES.map(loadMigrations)))
      .flat()
      .toSorted((left, right) => left.id.localeCompare(right.id))
    await database.migrate(migrations)
    return database
  } catch (error) {
    await database.close()
    throw error
  }
}
