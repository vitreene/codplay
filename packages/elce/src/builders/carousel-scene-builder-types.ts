import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import type { CarouselContent } from '../domain/carousel-types'
import type { MediaId, PageId, BdcId } from '../domain/document-types'
import type { MediaType } from '../config/document-config-types'

export interface CarouselSceneBuildInput {
  readonly pageId: PageId
  readonly bdcId: BdcId
  readonly content: CarouselContent
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly mediaTypes: Readonly<Record<MediaId, MediaType>>
}

export interface CarouselSceneBuild {
  readonly markup: string
  readonly story: StoryDoc<string>
  readonly mediaPersos: readonly PersoDoc<string>[]
  readonly styleSheet: string
}
