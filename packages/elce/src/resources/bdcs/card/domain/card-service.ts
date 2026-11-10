import { CAROUSEL_CONFIG } from '../../carousel/carousel-config'
import type { CardImageFit } from '../card-config'
import type { CarouselImagePosition } from '../../carousel/carousel-config'
import type { CardContent, CardTextField } from './card-types'
import type { ElceTextValue } from '../../../document/rich-text-types'
import { countAuthoredTextCharacters } from '../../../../core/document/rich-text-utils'
import { CAROUSEL_TRANSITION_OPTIONS } from '../../../revelation/revelation-config'
import type { RevelationTransitionOverrides } from '../../../revelation/revelation-types'
import type { ListContent } from '../../../list/domain/list-types'
import { ListService } from '../../../list/domain/list-service'

/** Owns the shared data fields used by every Card layout. */
export class ElceCardService {
  private readonly listService = new ListService()
  /** Creates a Card with every layout's fields initialized. */
  public createDefault(
    imagePosition: CarouselImagePosition = CAROUSEL_CONFIG.defaultImagePosition,
    imageFit: CardImageFit = CAROUSEL_CONFIG.defaultImageFit,
    list: ListContent | null = null,
  ): CardContent {
    return {
      mediaId: null,
      overline: '',
      title: '',
      description: '',
      message: '',
      note: '',
      caption: '',
      list,
      imagePosition,
      imageFit,
      revelation: { intro: null, outro: null },
    }
  }

  /** Changes one text field without consulting or changing the selected layout. */
  public setTextField(content: CardContent, field: CardTextField, value: ElceTextValue): CardContent {
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

  /** Changes the Card's local enter and exit transition pair. */
  public setRevelation(content: CardContent, revelation: RevelationTransitionOverrides): CardContent {
    return { ...content, revelation }
  }

  /** Attaches or updates the shared List submodule without changing Card fields. */
  public setList(content: CardContent, list: ListContent): CardContent {
    return { ...content, list }
  }

  /** Validates Card fields even when their current layout does not project them. */
  public assertValid(content: CardContent): void {
    if (content.list !== null) this.listService.assertValid(content.list)
    if (countAuthoredTextCharacters(content.message) > CAROUSEL_CONFIG.textShortMessageMaxLength) {
      throw new Error(`Le message d’une carte est limité à ${CAROUSEL_CONFIG.textShortMessageMaxLength} caractères.`)
    }
    for (const transition of [content.revelation.intro, content.revelation.outro]) {
      if (transition !== null && !CAROUSEL_TRANSITION_OPTIONS.some((option) => option.value === transition)) {
        throw new Error(`Transition de Carte inconnue : ${transition}`)
      }
    }
  }
}
