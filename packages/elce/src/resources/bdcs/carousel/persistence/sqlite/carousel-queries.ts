import type { CarouselContent } from '../../domain/carousel-types'
import { sqliteNullableNumber, sqliteNullableText, sqliteNumberValue, sqliteQuery, sqliteStringValue } from '../../../../document/persistence/sqlite/sqlite-query-types'
import type { SqliteQuery, SqliteRow } from '../../../../document/persistence/sqlite/sqlite-query-types'

export const CAROUSEL_SQLITE_SELECT = 'SELECT * FROM carousels WHERE project_id = ?'

/** Prepares one Carousel's settings for the shared relational table. */
export function prepareCarouselInsert(projectId: string, bdcId: string, carousel: CarouselContent): SqliteQuery {
  return sqliteQuery(`
    INSERT INTO carousels (
      project_id, content_block_id, default_view_duration_ms, playback_mode,
      repeat_count, aspect_ratio_width, aspect_ratio_height,
      default_intro_transition_ref, default_outro_transition_ref
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [projectId, bdcId, carousel.defaultViewDurationMs, carousel.playbackMode, carousel.repeatCount ?? null,
    carousel.aspectRatio.width, carousel.aspectRatio.height, carousel.revelation.intro, carousel.revelation.outro])
}

/** Reconstructs Carousel settings and their ordered child placements. */
export function carouselContentFromSqliteRows(row: SqliteRow, placementRows: readonly SqliteRow[]): CarouselContent {
  const bdcId = sqliteStringValue(row, 'content_block_id')
  const repeatCount = sqliteNullableNumber(row, 'repeat_count')
  return {
    defaultViewDurationMs: sqliteNumberValue(row, 'default_view_duration_ms'),
    playbackMode: sqliteStringValue(row, 'playback_mode') as CarouselContent['playbackMode'],
    ...(repeatCount === null ? {} : { repeatCount }),
    aspectRatio: {
      width: sqliteNumberValue(row, 'aspect_ratio_width'),
      height: sqliteNumberValue(row, 'aspect_ratio_height'),
    },
    revelation: {
      intro: sqliteNullableText(row, 'default_intro_transition_ref') as CarouselContent['revelation']['intro'],
      outro: sqliteNullableText(row, 'default_outro_transition_ref') as CarouselContent['revelation']['outro'],
    },
    cards: placementRows
      .filter((entry) => entry.parent_content_block_id === bdcId)
      .toSorted((left, right) => sqliteNumberValue(left, 'position') - sqliteNumberValue(right, 'position'))
      .map((entry) => ({
        bdcId: sqliteStringValue(entry, 'content_block_id'),
        durationMs: sqliteNullableNumber(entry, 'duration_ms'),
        ...(sqliteNullableText(entry, 'cue_json') === null
          ? {}
          : { cue: JSON.parse(sqliteStringValue(entry, 'cue_json')) as NonNullable<CarouselContent['cards'][number]['cue']> }),
        introTransitionRef: sqliteNullableText(entry, 'intro_transition_ref') as CarouselContent['cards'][number]['introTransitionRef'],
        outroTransitionRef: sqliteNullableText(entry, 'outro_transition_ref') as CarouselContent['cards'][number]['outroTransitionRef'],
      })),
  }
}
