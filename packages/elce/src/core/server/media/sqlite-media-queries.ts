import { rawSql, type DataManipulationResult, type Database } from 'remix/data-table'
import { sqliteNullableText, sqliteNumberValue, sqliteStringValue } from '../../persistence/sqlite/sqlite-query-types'
import type { StoredMediaResource } from './media-persistence'
import type { ProjectModKey } from '../projects/project-persistence'

type MediaDatabase = Pick<Database<'sqlite'>, 'exec'>

/** Reads one stored media record while filtering through its owning mod. */
export async function findSqliteMediaFile(
  database: MediaDatabase,
  modKey: ProjectModKey,
  projectId: string,
  mediaId: string,
): Promise<StoredMediaResource | null> {
  const result = await database.exec(rawSql(`
    SELECT media_resources.media_id, media_resources.name, media_resources.mime_type,
      media_resources.size_bytes, media_resources.storage_key, media_resources.content_sha256
    FROM media_resources JOIN projects USING (project_id)
    WHERE media_resources.project_id = ? AND media_resources.media_id = ? AND projects.mod_key = ?
  `, [projectId, mediaId, modKey])) as DataManipulationResult
  const row = result.rows?.[0]
  if (row === undefined) return null
  return {
    id: sqliteStringValue(row, 'media_id'),
    name: sqliteStringValue(row, 'name'),
    mimeType: sqliteStringValue(row, 'mime_type'),
    size: sqliteNumberValue(row, 'size_bytes'),
    storageKey: sqliteNullableText(row, 'storage_key'),
    contentSha256: sqliteNullableText(row, 'content_sha256'),
  }
}

/** Lists all stored media keys so shared cleanup preserves files from both mods. */
export async function listSqliteMediaStorageKeys(database: MediaDatabase): Promise<readonly string[]> {
  const result = await database.exec(rawSql(
    'SELECT storage_key FROM media_resources WHERE storage_key IS NOT NULL',
  )) as DataManipulationResult
  return (result.rows ?? []).map((row) => sqliteStringValue(row, 'storage_key'))
}
