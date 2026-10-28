export const CARD_BDC_TYPE = 'card' as const

export const CARD_PRESET_ID = {
  TEXT_IMAGE: 'text-image-basic',
  PHOTO: 'photo-basic',
  TEXT_SHORT: 'text-short-basic',
  IMAGE_CAPTION: 'image-caption',
  IMAGE_TITLE: 'image-title-basic',
} as const

export const CARD_IMAGE_FIT = {
  CONTAIN: 'contain',
  COVER: 'cover',
} as const

export const CARD_LAYOUT_IDS = [
  CARD_PRESET_ID.PHOTO,
  CARD_PRESET_ID.IMAGE_CAPTION,
  CARD_PRESET_ID.IMAGE_TITLE,
  CARD_PRESET_ID.TEXT_IMAGE,
  CARD_PRESET_ID.TEXT_SHORT,
] as const

export const CARD_IMAGE_FIT_OPTIONS = [
  { value: CARD_IMAGE_FIT.CONTAIN, label: 'Contenir' },
  { value: CARD_IMAGE_FIT.COVER, label: 'Couvrir' },
] as const

export const CARD_LAYOUT_OPTIONS = [
  { value: CARD_PRESET_ID.TEXT_SHORT, label: 'Texte court' },
  { value: CARD_PRESET_ID.TEXT_IMAGE, label: 'Texte avec image' },
  { value: CARD_PRESET_ID.IMAGE_TITLE, label: 'Titre sur image' },
  { value: CARD_PRESET_ID.PHOTO, label: 'Photo ou vidéo plein cadre' },
  { value: CARD_PRESET_ID.IMAGE_CAPTION, label: 'Image avec légende' },
] as const

export type CardLayoutId = typeof CARD_LAYOUT_IDS[number]
export type CardImageFit = typeof CARD_IMAGE_FIT[keyof typeof CARD_IMAGE_FIT]
