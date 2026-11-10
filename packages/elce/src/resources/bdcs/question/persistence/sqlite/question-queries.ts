import { authoredTextToPlainText } from '../../../../../core/document/rich-text-utils'
import { QUESTION_DEFAULTS } from '../../question-config'
import type { QuestionContent } from '../../domain/question-types'
import { decodeSqliteText, encodeNullableSqliteText, encodeSqliteText } from '../../../../document/persistence/sqlite/sqlite-text-values'
import { sqliteNullableText, sqliteNumberValue, sqliteQuery, sqliteStringValue } from '../../../../../core/persistence/sqlite/sqlite-query-types'
import type { SqliteQuery, SqliteRow } from '../../../../../core/persistence/sqlite/sqlite-query-types'

export const QUESTION_SQLITE_SELECT = 'SELECT * FROM questions WHERE project_id = ?'
export const QUESTION_ANSWERS_SQLITE_SELECT = 'SELECT * FROM question_answers WHERE project_id = ?'

/** Prepares the Question row and its ordered answers in the shared schema. */
export function prepareQuestionInsert(projectId: string, bdcId: string, question: QuestionContent): readonly SqliteQuery[] {
  return [
    sqliteQuery(`
      INSERT INTO questions (
        project_id, content_block_id, media_id, question_type, title, prompt, validation_label
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [projectId, bdcId, question.mediaId, question.type, encodeNullableSqliteText(question.title),
      encodeSqliteText(question.prompt), encodeSqliteText(question.validationLabel ?? QUESTION_DEFAULTS.VALIDATE_LABEL)]),
    ...question.answers.map((answer, position) => sqliteQuery(`
      INSERT INTO question_answers (
        project_id, question_content_block_id, answer_id, position, label, is_correct
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [projectId, bdcId, answer.id, position, encodeSqliteText(answer.label), answer.correct ? 1 : 0])),
  ]
}

/** Reconstructs Question content using its row and ordered answer rows. */
export function questionContentFromSqliteRows(row: SqliteRow, answerRows: readonly SqliteRow[]): QuestionContent {
  const bdcId = sqliteStringValue(row, 'content_block_id')
  return {
    mediaId: sqliteNullableText(row, 'media_id'),
    type: sqliteStringValue(row, 'question_type') as QuestionContent['type'],
    title: decodeSqliteText(sqliteNullableText(row, 'title') ?? ''),
    prompt: decodeSqliteText(sqliteStringValue(row, 'prompt')),
    validationLabel: decodeSqliteText(sqliteNullableText(row, 'validation_label') ?? QUESTION_DEFAULTS.VALIDATE_LABEL),
    answers: answerRows
      .filter((answer) => answer.question_content_block_id === bdcId)
      .toSorted((left, right) => sqliteNumberValue(left, 'position') - sqliteNumberValue(right, 'position'))
      .map((answer) => ({
        id: sqliteStringValue(answer, 'answer_id'),
        label: authoredTextToPlainText(decodeSqliteText(sqliteStringValue(answer, 'label'))),
        correct: sqliteNumberValue(answer, 'is_correct') !== 0,
      })),
  }
}
