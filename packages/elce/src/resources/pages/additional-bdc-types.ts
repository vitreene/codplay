import type { StoryDoc } from 'codplay/scene/types'
import type { ContentPage } from '../../core/document/content-document-types'
import type { ResourceBdc } from '../document/resource-document-types'

export interface AdditionalBdcBuild {
  readonly mountPartId: string
  readonly mountMarkup: string
  readonly stories: readonly StoryDoc<string>[]
}

export type BuildAdditionalBdc = (page: ContentPage, bdc: ResourceBdc) => AdditionalBdcBuild | null
