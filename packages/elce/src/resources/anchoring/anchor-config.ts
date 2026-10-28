import { MEDIA_TYPE } from '../../core/media/media-config'
import { CARD_PRESET_ID } from '../bdcs/card/card-config'

export const ANCHOR_RETURN = {
  MIME_TYPE: 'application/x-elce-anchor-return+json',
} as const

export const ANCHOR = {
  NODE_NAME: 'elceAnchor',
  DATA_ATTRIBUTE: 'data-elce-anchor',
  CLASS_NAME: 'elce-anchor',
  PADDING_VARIABLE: '--elce-anchor-padding',
  FLOW_BREAK_MARGIN: '100%',
  EDITOR_LINE_BLOCK_SIZE: '1lh',
  DEFAULT_PADDING_BOTTOM: '75%',
  IMAGE_BLOCK_SIZE: '75%',
  DEFAULT_IMAGE_ASPECT_RATIO: '4 / 3',
  VIDEO_BLOCK_SIZE: '56.25%',
  TEXT_CARD_BLOCK_SIZE: '12rem',
  DEFAULT_BDC_MARGIN_TOP: '2rem',
  DEFAULT_BDC_MARGIN_BOTTOM: '2rem',
} as const

export const ANCHOR_MEDIA_PRESETS = {
  [MEDIA_TYPE.IMAGE]: {
    presetId: CARD_PRESET_ID.PHOTO,
    blockSize: ANCHOR.IMAGE_BLOCK_SIZE,
  },
  [MEDIA_TYPE.VIDEO]: {
    presetId: CARD_PRESET_ID.PHOTO,
    blockSize: ANCHOR.VIDEO_BLOCK_SIZE,
  },
} as const
