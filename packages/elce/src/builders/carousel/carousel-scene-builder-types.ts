import type { StoryDoc } from 'codplay/scene/types'
import type { CarouselContent } from '../../domain/carousel/carousel-types'
import type { MediaId, PageId, BdcId, Bdc } from '../../domain/document/document-types'
import type { MediaType } from '../../config/document-config-types'
import type { ElceResolvedPlayerSettings, ResolvedCarouselRevelationSettings } from '../../domain/editor-settings/editor-settings-types'
import type { AppearanceClassNamesByTarget } from '../scene-style/appearance-class-names.ts'

export interface CarouselSceneBuildInput {
  readonly pageId: PageId
  readonly bdcId: BdcId
  /** Supplies the final story identity when a parent scene embeds this Carousel. */
  readonly storyId?: string
  readonly content: CarouselContent
  /** Supplies Card and Statistical Graph BDCs referenced by the existing Carousel entries. */
  readonly cards: readonly Bdc[]
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly mediaTypes: Readonly<Record<MediaId, MediaType>>
  readonly revelationSettings: ResolvedCarouselRevelationSettings
  readonly playerSettings: ElceResolvedPlayerSettings
  readonly displayMode?: 'content' | 'scene'
  readonly completionEventRootId?: string
  readonly appearanceClassNamesByTarget?: AppearanceClassNamesByTarget
}

export interface CarouselSceneBuild {
  readonly markup: string
  readonly story: StoryDoc<string>
  readonly styleSheet: string
}
