import { randomUUID } from 'node:crypto'
import { rawSql, type DataManipulationResult, type Database } from 'remix/data-table'
import { PROJECT_EDIT_LEASE_MS } from '../../persistence/project-api/project-api-config'
import { sqliteNullableNumber, sqliteNullableText } from '../../persistence/sqlite/sqlite-query-types'
import type { AcquireProjectEditResult, ProjectEditGrant, ProjectModKey } from './project-persistence'

type ProjectDatabase = Pick<Database<'sqlite'>, 'exec'>
type SqlRow = Record<string, unknown>

export type SqliteEditGrantState = 'held' | 'lost' | 'not-found'

/** Reserves one project in the caller's transaction, preserving its grant until takeover. */
export async function acquireSqliteProjectEditAccess(
  database: ProjectDatabase,
  modKey: ProjectModKey,
  projectId: string,
  pageId: string,
  force = false,
): Promise<AcquireProjectEditResult> {
  const rows = await queryRows(database, `
    SELECT edit_page_id, edit_grant_id, edit_lease_expires_at
    FROM projects WHERE project_id = ? AND mod_key = ?
  `, [projectId, modKey])
  const row = rows[0]
  if (row === undefined) return { kind: 'not-found' }

  const owner = sqliteNullableText(row, 'edit_page_id')
  const grantId = sqliteNullableText(row, 'edit_grant_id')
  const expiresAt = sqliteNullableNumber(row, 'edit_lease_expires_at')
  const now = Date.now()
  const live = owner !== null && grantId !== null && expiresAt !== null && expiresAt > now
  if (!force && live && owner === pageId) {
    await queryRows(database, `
      UPDATE projects SET edit_lease_expires_at = ?
      WHERE project_id = ? AND mod_key = ?
    `, [now + PROJECT_EDIT_LEASE_MS, projectId, modKey])
    return { kind: 'granted', grantId, recovered: false }
  }
  if (!force && live) return { kind: 'occupied' }

  const nextGrantId = randomUUID()
  await queryRows(database, `
    UPDATE projects SET edit_page_id = ?, edit_grant_id = ?, edit_lease_expires_at = ?
    WHERE project_id = ? AND mod_key = ?
  `, [pageId, nextGrantId, now + PROJECT_EDIT_LEASE_MS, projectId, modKey])
  return { kind: 'granted', grantId: nextGrantId, recovered: force || owner !== null }
}

/** Checks the exact current grant even after expiry, until another grant replaces it. */
export async function hasSqliteProjectEditAccess(
  database: ProjectDatabase,
  modKey: ProjectModKey,
  projectId: string,
  grant: ProjectEditGrant,
): Promise<boolean> {
  return (await getSqliteProjectEditGrantState(database, modKey, projectId, grant)) === 'held'
}

/** Renews the exact current grant in the caller's transaction, including a late renewal before takeover. */
export async function renewSqliteProjectEditAccess(
  database: ProjectDatabase,
  modKey: ProjectModKey,
  projectId: string,
  grant: ProjectEditGrant,
): Promise<boolean> {
  const rows = await queryRows(database, `
    UPDATE projects SET edit_lease_expires_at = ?
    WHERE project_id = ? AND edit_page_id = ? AND edit_grant_id = ? AND mod_key = ?
    RETURNING project_id
  `, [Date.now() + PROJECT_EDIT_LEASE_MS, projectId, grant.pageId, grant.grantId, modKey])
  return rows.length > 0
}

/** Releases editing in the caller's transaction only when the exact page grant still owns the project. */
export async function releaseSqliteProjectEditAccess(
  database: ProjectDatabase,
  modKey: ProjectModKey,
  projectId: string,
  grant: ProjectEditGrant,
): Promise<boolean> {
  const rows = await queryRows(database, `
    UPDATE projects SET edit_page_id = NULL, edit_grant_id = NULL, edit_lease_expires_at = NULL
    WHERE project_id = ? AND edit_page_id = ? AND edit_grant_id = ? AND mod_key = ?
    RETURNING project_id
  `, [projectId, grant.pageId, grant.grantId, modKey])
  return rows.length > 0
}

/** Reports whether a grant remains current without treating expiry alone as revocation. */
export async function getSqliteProjectEditGrantState(
  database: ProjectDatabase,
  modKey: ProjectModKey,
  projectId: string,
  grant: ProjectEditGrant,
): Promise<SqliteEditGrantState> {
  const rows = await queryRows(database, `
    SELECT edit_page_id, edit_grant_id FROM projects
    WHERE project_id = ? AND mod_key = ?
  `, [projectId, modKey])
  const row = rows[0]
  if (row === undefined) return 'not-found'
  return sqliteNullableText(row, 'edit_page_id') === grant.pageId
    && sqliteNullableText(row, 'edit_grant_id') === grant.grantId ? 'held' : 'lost'
}

/** Runs a parameterized query and returns its rows. */
async function queryRows(database: ProjectDatabase, text: string, values: readonly unknown[] = []): Promise<SqlRow[]> {
  const result = await database.exec(rawSql(text, [...values])) as DataManipulationResult
  return result.rows ?? []
}
