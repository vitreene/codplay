import type { CardImageFit, CarouselImagePosition } from '../../config/document-config-types'

/** Stores all authored Card data independently of the selected layout. */
export interface CardContent {
  readonly overline: string
  readonly title: string
  readonly description: string
  readonly message: string
  readonly note: string
  readonly caption: string
  readonly imagePosition: CarouselImagePosition
  readonly imageFit: CardImageFit
}

export type CardTextField = Exclude<keyof CardContent, 'imagePosition' | 'imageFit'>
export type CardPresentationOptions = Pick<CardContent, 'imagePosition' | 'imageFit'>
