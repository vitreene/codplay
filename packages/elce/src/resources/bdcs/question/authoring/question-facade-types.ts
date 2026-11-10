import type { QuestionEditCommand } from './question-command-types'
import type { ElceMediaImport } from '../../../../domain/media/media-resource-types'
import type { BdcId } from '../../../../core/document/content-document-types'
import type { QuestionContent, QuestionType } from '../domain/question-types'
import type { ElceTextValue } from '../../../document/rich-text-types'

export interface ElceQuestionFacadeOptions {
  readonly dispatch: (command: QuestionEditCommand) => void
  readonly getQuestion: (bdcId: BdcId) => QuestionContent | null
  readonly importMedia: (bdcId: BdcId, mediaImport: ElceMediaImport) => void
}

export interface ElceQuestionEditorActions {
  readonly setType: (type: QuestionType) => void
  readonly setTitle: (title: ElceTextValue) => void
  readonly setPrompt: (prompt: ElceTextValue) => void
  readonly setValidationLabel: (label: ElceTextValue) => void
  readonly setAnswerLabel: (answerId: string, label: string) => void
  readonly setAnswerCorrect: (answerId: string, correct: boolean) => void
  readonly addAnswer: () => void
  readonly removeAnswer: (answerId: string) => void
  readonly canRemoveAnswer: (answerId: string) => boolean
  readonly moveAnswer: (answerId: string, index: number) => void
  readonly importMedia: (file: File) => void
  readonly clearMedia: () => void
  readonly deleteQuestion: () => void
}

export interface ElceQuestionChange {
  readonly bdcId: BdcId
  readonly question: QuestionContent
}
