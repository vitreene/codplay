import { fileURLToPath } from 'node:url'
import { createSqliteDatabase } from 'remix/data-table/sqlite'
import type { SqliteDatabase } from 'remix/data-table/sqlite'
import { loadMigrations } from 'remix/data-table/migrations/node'

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('./migrations/', import.meta.url))

/** Opens Editeur's local SQLite database and applies its pending Remix migrations. */
export async function openEditorDatabase(filename: string): Promise<SqliteDatabase> {
  const database = createSqliteDatabase({ filename, foreignKeys: true })
  try {
    await database.migrate(await loadMigrations(MIGRATIONS_DIRECTORY))
    return database
  } catch (error) {
    await database.close()
    throw error
  }
}
