import { CAROUSEL_CONFIG } from '../../config/document-config'
import type { CardImageFit, CarouselImagePosition } from '../../config/document-config-types'
import type { CardContent, CardTextField } from './card-types'

/** Owns the shared data fields used by every Card layout. */
export class ElceCardService {
  /** Creates a Card with every layout's fields initialized. */
  public createDefault(
    imagePosition: CarouselImagePosition = CAROUSEL_CONFIG.defaultImagePosition,
    imageFit: CardImageFit = CAROUSEL_CONFIG.defaultImageFit,
  ): CardContent {
    return {
      mediaId: null,
      overline: '',
      title: '',
      description: '',
      message: '',
      note: '',
      caption: '',
      imagePosition,
      imageFit,
    }
  }

  /** Changes one text field without consulting or changing the selected layout. */
  public setTextField(content: CardContent, field: CardTextField, value: string): CardContent {
    return { ...content, [field]: value }
  }

  /** Changes the image position without changing any Card content fields. */
  public setImagePosition(content: CardContent, position: CarouselImagePosition): CardContent {
    return { ...content, imagePosition: position }
  }

  /** Changes the image fit without changing any Card content fields. */
  public setImageFit(content: CardContent, imageFit: CardImageFit): CardContent {
    return { ...content, imageFit }
  }

  /** Validates Card fields even when their current layout does not project them. */
  public assertValid(content: CardContent): void {
    if (content.message.length > CAROUSEL_CONFIG.textShortMessageMaxLength) {
      throw new Error(`Le message d’une carte est limité à ${CAROUSEL_CONFIG.textShortMessageMaxLength} caractères.`)
    }
  }
}
