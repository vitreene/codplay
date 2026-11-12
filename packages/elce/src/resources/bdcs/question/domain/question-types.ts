import type { QUESTION_TYPE } from '../question-config'
import type { MediaId } from '../../../../core/document/content-document-types'
import type { ElceTextValue } from '../../../document/rich-text-types'

export type QuestionType = typeof QUESTION_TYPE[keyof typeof QUESTION_TYPE]

export interface QuestionAnswer {
  readonly id: string
  readonly label: string
  readonly correct: boolean
}

export interface QuestionContent {
  readonly mediaId: MediaId | null
  readonly type: QuestionType
  readonly title: ElceTextValue
  readonly prompt: ElceTextValue
  /** Absent only in Question values saved before the label became editable. */
  readonly validationLabel?: ElceTextValue
  readonly answers: readonly QuestionAnswer[]
}

export interface QuestionAnswerState {
  readonly answerIds: readonly string[]
  readonly selectedAnswerIds: readonly string[]
  readonly expectedAnswerIds: readonly string[]
  readonly isCorrect: boolean
}
