import type { CardImageFit, CarouselImagePosition } from '../../config/document-config-types'
import type { ElceTextValue, MediaId } from '../document/document-types'

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
}

export type CardTextField = Exclude<keyof CardContent, 'mediaId' | 'imagePosition' | 'imageFit'>
export type CardPresentationOptions = Pick<CardContent, 'imagePosition' | 'imageFit'>
