import type { DocumentCommand } from '../app/commands/document-command-types'
import type { ElceMediaImport } from './media-resource-types'
import type { BdcId, PageId } from './document-types'
import type { QuestionContent, QuestionType } from './question-types'

export interface ElceQuestionFacadeOptions {
  readonly dispatch: (command: DocumentCommand) => void
  readonly importMedia: (bdcId: BdcId, mediaImport: ElceMediaImport) => void
}

export interface ElceQuestionCreateOptions {
  readonly pageId: PageId
  readonly index: number
}

export interface ElceQuestionEditorActions {
  readonly setType: (type: QuestionType) => void
  readonly setTitle: (title: string) => void
  readonly setPrompt: (prompt: string) => void
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
