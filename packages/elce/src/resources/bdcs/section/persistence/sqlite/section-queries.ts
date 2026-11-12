import type { SectionContent } from '../../domain/section-types'
import { decodeSqliteText, encodeNullableSqliteText } from '../../../../document/persistence/sqlite/sqlite-text-values'
import { sqliteNullableText, sqliteStringValue, sqliteQuery } from '../../../../../core/persistence/sqlite/sqlite-query-types'
import type { SqliteQuery, SqliteRow } from '../../../../../core/persistence/sqlite/sqlite-query-types'

export const SECTION_SQLITE_SELECT = 'SELECT * FROM sections WHERE project_id = ?'

/** Prepares the Section detail row using the shared relational columns. */
export function prepareSectionInsert(projectId: string, bdcId: string, section: SectionContent): SqliteQuery {
  return sqliteQuery(`
    INSERT INTO sections (
      project_id, content_block_id, title, content_json, markup_html,
      default_intro_transition_ref, default_outro_transition_ref
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [projectId, bdcId, encodeNullableSqliteText(section.title), JSON.stringify(section.content), section.markup,
    section.revelation.intro, section.revelation.outro])
}

/** Reconstructs the shared Section payload from its relational detail row. */
export function sectionContentFromSqliteRow(row: SqliteRow): SectionContent {
  const title = sqliteNullableText(row, 'title')
  return {
    title: decodeSqliteText(title ?? ''),
    markup: sqliteStringValue(row, 'markup_html'),
    content: JSON.parse(sqliteStringValue(row, 'content_json')) as SectionContent['content'],
    revelation: {
      intro: sqliteNullableText(row, 'default_intro_transition_ref') as SectionContent['revelation']['intro'],
      outro: sqliteNullableText(row, 'default_outro_transition_ref') as SectionContent['revelation']['outro'],
    },
  }
}
