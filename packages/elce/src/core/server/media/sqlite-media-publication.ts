import { rawSql, type DataManipulationResult, type Database } from 'remix/data-table'
import { sqliteNullableText, sqliteNumberValue, sqliteStringValue } from '../../persistence/sqlite/sqlite-query-types'
import { PROJECT_EDIT_LEASE_MS } from '../../persistence/project-api/project-api-config'
import type { ProjectEditGrant, ProjectModKey } from '../projects/project-persistence'
import { getSqliteProjectEditGrantState } from '../projects/sqlite-project-edit-access'
import type { StoreMediaFileResult } from './media-persistence'

type MediaDatabase = Pick<Database<'sqlite'>, 'exec'>
type SqlRow = Record<string, unknown>

/** Publishes the completed file reference and renews its current grant in the caller's transaction. */
export async function publishSqliteMediaFile(
  database: MediaDatabase,
  modKey: ProjectModKey,
  projectId: string,
  mediaId: string,
  expectedSize: number,
  storageKey: string,
  contentSha256: string,
  grant: ProjectEditGrant,
): Promise<StoreMediaFileResult> {
  if (await getSqliteProjectEditGrantState(database, modKey, projectId, grant) !== 'held') {
    return { kind: 'edit-access-lost' }
  }

  const rows = await queryRows(database, `
    SELECT media_resources.size_bytes, media_resources.storage_key, media_resources.content_sha256
    FROM media_resources JOIN projects USING (project_id)
    WHERE media_resources.project_id = ? AND media_resources.media_id = ? AND projects.mod_key = ?
  `, [projectId, mediaId, modKey])
  const row = rows[0]
  if (row === undefined) return { kind: 'media-not-found' }
  if (sqliteNumberValue(row, 'size_bytes') !== expectedSize) return { kind: 'media-changed' }

  const existingKey = sqliteNullableText(row, 'storage_key')
  const existingHash = sqliteNullableText(row, 'content_sha256')
  if (existingKey !== null) {
    return existingHash === contentSha256
      ? { kind: 'already-stored' }
      : { kind: 'media-already-has-file' }
  }

  const duplicates = await queryRows(database, `
    SELECT media_resources.media_id FROM media_resources JOIN projects USING (project_id)
    WHERE media_resources.project_id = ? AND media_resources.size_bytes = ?
      AND media_resources.content_sha256 = ? AND media_resources.media_id <> ? AND projects.mod_key = ?
  `, [projectId, expectedSize, contentSha256, mediaId, modKey])
  if (duplicates[0] !== undefined) {
    return { kind: 'duplicate-content', existingMediaId: sqliteStringValue(duplicates[0], 'media_id') }
  }

  const updated = await queryRows(database, `
    UPDATE media_resources SET storage_key = ?, content_sha256 = ?
    WHERE project_id = ? AND media_id = ? AND storage_key IS NULL
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.project_id = media_resources.project_id AND projects.mod_key = ?
      )
    RETURNING media_id
  `, [storageKey, contentSha256, projectId, mediaId, modKey])
  if (updated.length === 0) return { kind: 'media-changed' }

  await queryRows(database, `
    UPDATE projects SET edit_lease_expires_at = ?
    WHERE project_id = ? AND edit_page_id = ? AND edit_grant_id = ? AND mod_key = ?
  `, [Date.now() + PROJECT_EDIT_LEASE_MS, projectId, grant.pageId, grant.grantId, modKey])
  return { kind: 'stored' }
}

/** Runs a parameterized query and returns its rows. */
async function queryRows(database: MediaDatabase, text: string, values: readonly unknown[] = []): Promise<SqlRow[]> {
  const result = await database.exec(rawSql(text, [...values])) as DataManipulationResult
  return result.rows ?? []
}
