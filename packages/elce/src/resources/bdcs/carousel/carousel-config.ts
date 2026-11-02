import { CAROUSEL_TRANSITION } from '../../revelation/revelation-config'
import { CARD_IMAGE_FIT, CARD_PRESET_ID } from '../card/card-config'

export const CAROUSEL_BDC_TYPE = 'carousel' as const

export const CAROUSEL_PRESET_ID = 'carousel-basic' as const

export const CAROUSEL_PLAYBACK_MODE = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
} as const

export const CAROUSEL_ASPECT_RATIO = {
  WIDE: '16:9',
  STANDARD: '4:3',
  SQUARE: '1:1',
} as const

export const CAROUSEL_IMAGE_POSITION = {
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
} as const

export const CAROUSEL_PLAYBACK_MODE_OPTIONS = [
  { value: CAROUSEL_PLAYBACK_MODE.AUTOMATIC, label: 'Automatique' },
  { value: CAROUSEL_PLAYBACK_MODE.MANUAL, label: 'Manuel' },
] as const

export const CAROUSEL_ASPECT_RATIO_OPTIONS = [
  { value: CAROUSEL_ASPECT_RATIO.WIDE, label: '16:9', ratio: { width: 16, height: 9 } },
  { value: CAROUSEL_ASPECT_RATIO.STANDARD, label: '4:3', ratio: { width: 4, height: 3 } },
  { value: CAROUSEL_ASPECT_RATIO.SQUARE, label: '1:1', ratio: { width: 1, height: 1 } },
] as const

export const CAROUSEL_IMAGE_POSITION_OPTIONS = [
  { value: CAROUSEL_IMAGE_POSITION.LEFT, label: 'Image à gauche' },
  { value: CAROUSEL_IMAGE_POSITION.CENTER, label: 'Image centrée' },
  { value: CAROUSEL_IMAGE_POSITION.RIGHT, label: 'Image à droite' },
] as const

export const CAROUSEL_CONFIG = {
  bdcPresetId: CAROUSEL_PRESET_ID,
  cardDragMimeType: 'application/x-elce-bdc-card+json',
  initialCardLayoutId: CARD_PRESET_ID.TEXT_SHORT,
  defaultAspectRatio: { width: 16, height: 9 },
  defaultPlaybackMode: CAROUSEL_PLAYBACK_MODE.MANUAL,
  defaultViewDurationMs: 5000,
  minimumViewDurationSeconds: 1,
  maximumViewDurationSeconds: 10,
  defaultRepeatCount: 10,
  minimumRepeatCount: 0,
  maximumRepeatCount: 10,
  defaultImagePosition: CAROUSEL_IMAGE_POSITION.LEFT,
  defaultImageFit: CARD_IMAGE_FIT.COVER,
  textShortMessageMaxLength: 250,
  defaultTransition: CAROUSEL_TRANSITION.FADE,
} as const

export type CarouselAspectRatioId = typeof CAROUSEL_ASPECT_RATIO[keyof typeof CAROUSEL_ASPECT_RATIO]
export type CarouselImagePosition = typeof CAROUSEL_IMAGE_POSITION[keyof typeof CAROUSEL_IMAGE_POSITION]
export type CarouselPlaybackMode = typeof CAROUSEL_PLAYBACK_MODE[keyof typeof CAROUSEL_PLAYBACK_MODE]
