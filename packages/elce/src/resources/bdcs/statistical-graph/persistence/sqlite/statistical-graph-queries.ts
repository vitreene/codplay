import type { StatisticalGraphContent } from '../../domain/statistical-graph-types'
import { sqliteQuery, sqliteStringValue } from '../../../../document/persistence/sqlite/sqlite-query-types'
import type { SqliteQuery, SqliteRow } from '../../../../document/persistence/sqlite/sqlite-query-types'

export const STATISTICAL_GRAPH_SQLITE_SELECT = 'SELECT * FROM statistical_graphs WHERE project_id = ?'

/** Prepares the full Graph payload in the shared opaque JSON detail column. */
export function prepareStatisticalGraphInsert(projectId: string, bdcId: string, graph: StatisticalGraphContent): SqliteQuery {
  return sqliteQuery(`
    INSERT INTO statistical_graphs (project_id, content_block_id, content_json)
    VALUES (?, ?, ?)
  `, [projectId, bdcId, JSON.stringify(graph)])
}

/** Reconstructs a Graph from the shared JSON detail column. */
export function statisticalGraphContentFromSqliteRow(row: SqliteRow): StatisticalGraphContent {
  return JSON.parse(sqliteStringValue(row, 'content_json')) as StatisticalGraphContent
}
