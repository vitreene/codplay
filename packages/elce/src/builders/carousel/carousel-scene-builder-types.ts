import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import type { CarouselContent } from '../../domain/carousel/carousel-types'
import type { MediaId, PageId, BdcId, Bdc, RevelationTransitionDefaults } from '../../domain/document/document-types'
import type { MediaType } from '../../config/document-config-types'

export interface CarouselSceneBuildInput {
  readonly pageId: PageId
  readonly bdcId: BdcId
  readonly content: CarouselContent
  readonly cards: readonly Bdc[]
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly mediaTypes: Readonly<Record<MediaId, MediaType>>
  readonly revelationDefaults?: RevelationTransitionDefaults
  readonly displayMode?: 'content' | 'scene'
  readonly completionEventRootId?: string
}

export interface CarouselSceneBuild {
  readonly markup: string
  readonly story: StoryDoc<string>
  readonly mediaPersos: readonly PersoDoc<string>[]
  readonly styleSheet: string
}
