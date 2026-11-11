import type { CardContent } from '../../domain/card-types'
import type { ListContent } from '../../../../list/domain/list-types'
import { ListService } from '../../../../list/domain/list-service'
import { decodeSqliteText, encodeNullableSqliteText } from '../../../../document/persistence/sqlite/sqlite-text-values'
import { sqliteNullableText, sqliteQuery, sqliteStringValue } from '../../../../../core/persistence/sqlite/sqlite-query-types'
import type { SqliteQuery, SqliteRow } from '../../../../../core/persistence/sqlite/sqlite-query-types'

export const CARD_SQLITE_SELECT = 'SELECT * FROM cards WHERE project_id = ?'

/** Prepares one Card's content fields for the shared relational table. */
export function prepareCardInsert(projectId: string, bdcId: string, card: CardContent): SqliteQuery {
  return sqliteQuery(`
    INSERT INTO cards (
      project_id, content_block_id, media_id, overline, title, description,
      message, note, caption, image_position, image_fit,
      intro_transition_ref, outro_transition_ref, list_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [projectId, bdcId, card.mediaId, encodeNullableSqliteText(card.overline), encodeNullableSqliteText(card.title),
    encodeNullableSqliteText(card.description), encodeNullableSqliteText(card.message), encodeNullableSqliteText(card.note),
    encodeNullableSqliteText(card.caption), card.imagePosition, card.imageFit, card.revelation.intro, card.revelation.outro,
    card.list === null ? null : JSON.stringify(card.list)])
}

/** Reconstructs the shared Card payload from its relational row. */
export function cardContentFromSqliteRow(row: SqliteRow): CardContent {
  return {
    mediaId: sqliteNullableText(row, 'media_id'),
    overline: decodeSqliteText(sqliteNullableText(row, 'overline') ?? ''),
    title: decodeSqliteText(sqliteNullableText(row, 'title') ?? ''),
    description: decodeSqliteText(sqliteNullableText(row, 'description') ?? ''),
    message: decodeSqliteText(sqliteNullableText(row, 'message') ?? ''),
    note: decodeSqliteText(sqliteNullableText(row, 'note') ?? ''),
    caption: decodeSqliteText(sqliteNullableText(row, 'caption') ?? ''),
    list: parseList(sqliteNullableText(row, 'list_json')),
    imagePosition: sqliteStringValue(row, 'image_position') as CardContent['imagePosition'],
    imageFit: sqliteStringValue(row, 'image_fit') as CardContent['imageFit'],
    revelation: {
      intro: sqliteNullableText(row, 'intro_transition_ref') as CardContent['revelation']['intro'],
      outro: sqliteNullableText(row, 'outro_transition_ref') as CardContent['revelation']['outro'],
    },
  }
}

/** Decodes the optional generic List payload stored by the Card host. */
function parseList(value: string | null): ListContent | null {
  if (value === null) return null
  const list = JSON.parse(value) as unknown
  const listService: ListService = new ListService()
  listService.assertValid(list)
  return list
}
