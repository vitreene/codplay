import type { ContentChapter, ContentPage } from '../../../core/document/content-document-types'
import type { ResourceDocumentData } from '../../../resources/document/resource-document-types'

export type QuizHuntMenuPresentation = 'grid' | 'diapo'

export type QuizHuntBankRole = 'questions' | 'finals'

export interface QuizHuntChapter extends ContentChapter {
  readonly name: string
  readonly type: QuizHuntBankRole
}

export interface QuizHuntPage extends ContentPage {
  readonly name: string
  readonly type: 'summary' | 'flux' | 'diapo'
  readonly colorId: string | null
  readonly mandatory: boolean
}

export interface QuizHuntGroup {
  readonly id: string
  readonly name: string
  readonly color: string
}

export type QuizHuntRootEntry =
  | Readonly<{ kind: 'page'; pageId: string }>
  | Readonly<{ kind: 'chapter'; chapterId: string }>

export interface QuizHuntSettings {
  readonly groups: readonly QuizHuntGroup[]
  readonly menuPresentation: QuizHuntMenuPresentation
  readonly successCardBdcId: string
  readonly failureCardBdcId: string
  readonly seed: number
  readonly random: boolean
  readonly timeBudgetMs: number
  readonly clueDelayMs: number
  readonly feedbackDelayMs: number
  readonly extraEnabled: boolean
}

export interface QuizHuntDocument extends ResourceDocumentData {
  readonly name: string
  readonly chapters: readonly QuizHuntChapter[]
  readonly pages: readonly QuizHuntPage[]
  readonly scenarioEntries: readonly QuizHuntRootEntry[]
  readonly settings: QuizHuntSettings
}
