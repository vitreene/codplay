import type { QUESTION_TYPE } from '../../config/document-config'
import type { MediaId } from '../document/document-types'

export type QuestionType = typeof QUESTION_TYPE[keyof typeof QUESTION_TYPE]

export interface QuestionAnswer {
  readonly id: string
  readonly label: string
  readonly correct: boolean
}

export interface QuestionContent {
  readonly mediaId: MediaId | null
  readonly type: QuestionType
  readonly title: string
  readonly prompt: string
  readonly answers: readonly QuestionAnswer[]
}
