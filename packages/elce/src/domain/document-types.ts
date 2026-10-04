import type { BdcType, ChapterType, EvaluationRetryScope, MediaType, PageType } from '../config/document-config-types'
import type { ScenarioEntry } from './scenario-entry-types'
import type { QuestionContent } from './question-types'
import type { EvaluationResultContent } from './evaluation/evaluation-result-types'
import type { CarouselContent } from './carousel-types'

export type ChapterId = string
export type PageId = string
export type BdcId = string
export type MediaId = string

export type RichTextAttributeValue = string | number | boolean | null

export interface RichTextMark {
  readonly type: string
  readonly attrs?: Readonly<Record<string, RichTextAttributeValue>>
}

export interface RichTextNode {
  readonly type: string
  readonly attrs?: Readonly<Record<string, RichTextAttributeValue>>
  readonly text?: string
  readonly marks?: readonly RichTextMark[]
  readonly content?: readonly RichTextNode[]
}

export interface RichTextDocument {
  readonly type: 'doc'
  readonly content: readonly RichTextNode[]
}

export interface Chapter {
  readonly id: ChapterId
  readonly name: string
  readonly type: ChapterType
  readonly pageIds: readonly PageId[]
  readonly evaluationThreshold?: number
  readonly evaluationAttemptLimit?: number | null
  readonly evaluationRetryScope?: EvaluationRetryScope
}

export interface Page {
  readonly id: PageId
  readonly name: string
  readonly type: PageType
  readonly chapterId: ChapterId | null
  readonly bdcIds: readonly BdcId[]
}

export interface Bdc {
  readonly id: BdcId
  readonly type: BdcType
  readonly presetId: string
  readonly pageId: PageId | null
  readonly mediaId: MediaId | null
  readonly section: {
    readonly title: string
    readonly markup: string
    readonly content: RichTextDocument
  } | null
  readonly question: QuestionContent | null
  readonly evaluationResult?: EvaluationResultContent | null
  readonly carousel?: CarouselContent | null
}

export interface MediaMetadata {
  readonly id: MediaId
  readonly type: MediaType
  readonly name: string
  readonly mimeType: string
  readonly size: number
  readonly caption: string
}

export interface ElceDocumentData {
  readonly id: string
  readonly version: 2
  readonly name: string
  readonly chapters: readonly Chapter[]
  readonly pages: readonly Page[]
  readonly scenarioEntries: readonly ScenarioEntry[]
  readonly catalogPageIds: readonly PageId[]
  readonly bdcs: readonly Bdc[]
  readonly catalogBdcIds: readonly BdcId[]
  readonly medias: readonly MediaMetadata[]
}
