import type { QUESTION_TYPE } from '../../config/document-config'
import type { ElceTextValue, MediaId } from '../document/document-types'

export type QuestionType = typeof QUESTION_TYPE[keyof typeof QUESTION_TYPE]

export interface QuestionAnswer {
  readonly id: string
  readonly label: ElceTextValue
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
