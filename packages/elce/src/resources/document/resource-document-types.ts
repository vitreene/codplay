import type { AppearanceSettings } from '../../config/appearance/appearance-types'
import type { ContentBdc, ContentPage, MediaMetadata, PageId, BdcId } from '../../core/document/content-document-types'
import type { QuestionContent } from '../bdcs/question/domain/question-types'
import type { CarouselContent } from '../bdcs/carousel/domain/carousel-types'
import type { CardContent } from '../bdcs/card/domain/card-types'
import type { StatisticalGraphContent } from '../bdcs/statistical-graph/domain/statistical-graph-types'
import type { SectionContent } from '../bdcs/section/domain/section-types'

export interface ResourceBdc extends ContentBdc {
  readonly section: SectionContent | null
  readonly question: QuestionContent | null
  readonly carousel?: CarouselContent | null
  readonly card?: CardContent | null
  readonly statisticalGraph?: StatisticalGraphContent | null
}

export interface ResourceDocumentData {
  readonly id: string
  readonly pages: readonly ContentPage[]
  readonly catalogPageIds: readonly PageId[]
  readonly bdcs: readonly ResourceBdc[]
  readonly catalogBdcIds: readonly BdcId[]
  readonly medias: readonly MediaMetadata[]
  readonly appearance?: AppearanceSettings
}
