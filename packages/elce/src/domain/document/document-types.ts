import type { BdcType, ChapterType, EvaluationRetryScope, PageType, RevelationTransitionRef } from '../../config/document-config-types'
import type { ScenarioEntry } from '../scenario/scenario-entry-types'
import type { QuestionContent } from '../question/question-types'
import type { EvaluationResultContent } from '../evaluation/evaluation-result-types'
import type { CarouselContent } from '../carousel/carousel-types'
import type { CardContent } from '../card/card-types'

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

export interface RevelationTransitionDefaults {
  readonly intro: RevelationTransitionRef
  readonly outro: RevelationTransitionRef
}

export interface RevelationTransitionOverrides {
  readonly intro: RevelationTransitionRef | null
  readonly outro: RevelationTransitionRef | null
}

export interface SectionContent {
  readonly title: string
  readonly markup: string
  readonly content: RichTextDocument
  readonly revelation: RevelationTransitionOverrides
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
  readonly parentBdcId: BdcId | null
  readonly section: SectionContent | null
  readonly question: QuestionContent | null
  readonly evaluationResult?: EvaluationResultContent | null
  readonly carousel?: CarouselContent | null
  readonly card?: CardContent | null
}

export interface MediaMetadata {
  readonly id: MediaId
  readonly name: string
  readonly mimeType: string
  readonly size: number
  readonly caption: string
}

export interface ElceDocumentData {
  readonly id: string
  readonly version: 4
  readonly name: string
  readonly revelationDefaults: RevelationTransitionDefaults
  readonly chapters: readonly Chapter[]
  readonly pages: readonly Page[]
  readonly scenarioEntries: readonly ScenarioEntry[]
  readonly catalogPageIds: readonly PageId[]
  readonly bdcs: readonly Bdc[]
  readonly catalogBdcIds: readonly BdcId[]
  readonly medias: readonly MediaMetadata[]
}
