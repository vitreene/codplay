import { CARD_PRESET_ID } from '../card-config'
import { CATALOG_REFERENCE } from '../../../../core/catalog/catalog-config'
import { MEDIA_TYPE } from '../../../../core/media/media-config'
import type { CardLayoutId } from '../card-config'
import type { MediaType } from '../../../../core/media/media-config'
import type { ElceCatalogReference } from '../../../../core/catalog/catalog-types'

/** Chooses the compact toolbar layout for the fields visible in one Card preset. */
export function cardToolbarClassName(presetId: string): string {
  const baseClassName = 'elce-carousel-editor__view-toolbar'
  switch (presetId) {
    case CARD_PRESET_ID.TEXT_SHORT:
      return `${baseClassName} ${baseClassName}--text-only`
    case CARD_PRESET_ID.TEXT_IMAGE:
      return `${baseClassName} ${baseClassName}--image-position`
    default:
      return `${baseClassName} ${baseClassName}--image`
  }
}

/** Reads only a media reference from the shared catalogue drag payload. */
export function parseCardMediaReference(value: string): ElceCatalogReference | null {
  try {
    const reference = JSON.parse(value) as ElceCatalogReference
    switch (reference.kind) {
      case CATALOG_REFERENCE.MEDIA:
        return reference
      default:
        return null
    }
  } catch {
    return null
  }
}

/** Checks whether one media category is usable by the active Card preset. */
export function cardLayoutAcceptsMedia(layoutId: CardLayoutId, mediaType: MediaType | undefined): boolean {
  switch (layoutId) {
    case CARD_PRESET_ID.PHOTO:
      switch (mediaType) {
        case MEDIA_TYPE.IMAGE:
        case MEDIA_TYPE.VIDEO:
          return true
        default:
          return false
      }
    case CARD_PRESET_ID.IMAGE_CAPTION:
    case CARD_PRESET_ID.IMAGE_TITLE:
    case CARD_PRESET_ID.TEXT_IMAGE:
      return mediaType === MEDIA_TYPE.IMAGE
    case CARD_PRESET_ID.TEXT_SHORT:
      return false
  }
}

/** Checks an imported file against the media categories accepted by one preset. */
export function cardLayoutAcceptsFile(layoutId: CardLayoutId, file: File): boolean {
  switch (true) {
    case file.type.startsWith('image/'):
      return cardLayoutAcceptsMedia(layoutId, MEDIA_TYPE.IMAGE)
    case file.type.startsWith('video/'):
      return cardLayoutAcceptsMedia(layoutId, MEDIA_TYPE.VIDEO)
    default:
      return false
  }
}
