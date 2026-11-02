import { fileURLToPath } from 'node:url'
import { createSqliteDatabase } from 'remix/data-table/sqlite'
import type { SqliteDatabase } from 'remix/data-table/sqlite'
import { loadMigrations } from 'remix/data-table/migrations/node'

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('./migrations/', import.meta.url))

/** Opens the local SQLite database and applies pending Remix SQL migrations. */
export async function openProjectDatabase(filename: string): Promise<SqliteDatabase> {
  const database = createSqliteDatabase({ filename, foreignKeys: true })

  try {
    const migrations = await loadMigrations(MIGRATIONS_DIRECTORY)
    await database.migrate(migrations)
    return database
  } catch (error) {
    await database.close()
    throw error
  }
}
