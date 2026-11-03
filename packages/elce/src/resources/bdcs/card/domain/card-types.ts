import type { CardImageFit } from '../card-config'
import type { CarouselImagePosition } from '../../carousel/carousel-config'
import type { MediaId } from '../../../../core/document/content-document-types'
import type { ElceTextValue } from '../../../document/rich-text-types'
import type { RevelationTransitionOverrides } from '../../../revelation/revelation-types'

/** Stores all authored Card data independently of the selected layout. */
export interface CardContent {
  readonly mediaId: MediaId | null
  readonly overline: ElceTextValue
  readonly title: ElceTextValue
  readonly description: ElceTextValue
  readonly message: ElceTextValue
  readonly note: ElceTextValue
  readonly caption: ElceTextValue
  readonly imagePosition: CarouselImagePosition
  readonly imageFit: CardImageFit
  readonly revelation: RevelationTransitionOverrides
}

export type CardTextField = Exclude<keyof CardContent, 'mediaId' | 'imagePosition' | 'imageFit' | 'revelation'>
export type CardPresentationOptions = Pick<CardContent, 'imagePosition' | 'imageFit'>
