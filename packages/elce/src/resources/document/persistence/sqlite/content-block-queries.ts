import type { ContentBdc } from '../../../../core/document/content-document-types'
import type { AppearanceSettings } from '../../../../config/appearance/appearance-types'
import type { SqliteQuery, SqliteRow } from './sqlite-query-types'
import { sqliteNullableText, sqliteQuery, sqliteStringValue } from './sqlite-query-types'

export interface SqliteContentBlockPlacement {
  readonly pageId: string | null
  readonly parentBdcId: string | null
  readonly position: number | null
  readonly durationMs: number | null
  readonly introTransitionRef: string | null
  readonly outroTransitionRef: string | null
}

export const CONTENT_BLOCKS_SQLITE_SELECT = 'SELECT * FROM content_blocks WHERE project_id = ?'
export const CONTENT_BLOCK_PLACEMENTS_SQLITE_SELECT = 'SELECT * FROM content_block_placements WHERE project_id = ?'

/** Prepares the common identity row shared by every placed BDC resource. */
export function prepareContentBlockInsert(projectId: string, bdc: ContentBdc): SqliteQuery {
  return sqliteQuery(`
    INSERT INTO content_blocks (
      project_id, content_block_id, content_block_type, preset_id, appearance_json
    ) VALUES (?, ?, ?, ?, ?)
  `, [projectId, bdc.id, bdc.type, bdc.presetId,
    bdc.appearance === undefined ? null : JSON.stringify(bdc.appearance)])
}

/** Prepares the common placement row independently of document organization. */
export function prepareContentBlockPlacementInsert(
  projectId: string,
  bdcId: string,
  placement: SqliteContentBlockPlacement,
): SqliteQuery {
  return sqliteQuery(`
    INSERT INTO content_block_placements (
      project_id, content_block_id, page_id, parent_content_block_id, position,
      duration_ms, intro_transition_ref, outro_transition_ref
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [projectId, bdcId, placement.pageId, placement.parentBdcId, placement.position,
    placement.durationMs, placement.introTransitionRef, placement.outroTransitionRef])
}

/** Reconstructs one BDC's common identity, parent, and optional appearance. */
export function contentBlockFromSqliteRows(row: SqliteRow, placement: SqliteRow | undefined): ContentBdc {
  const appearance = sqliteNullableText(row, 'appearance_json')
  return {
    id: sqliteStringValue(row, 'content_block_id'),
    type: sqliteStringValue(row, 'content_block_type'),
    presetId: sqliteStringValue(row, 'preset_id'),
    pageId: sqliteNullableText(placement ?? {}, 'page_id'),
    parentBdcId: sqliteNullableText(placement ?? {}, 'parent_content_block_id'),
    ...(appearance === null ? {} : { appearance: JSON.parse(appearance) as AppearanceSettings }),
  }
}
