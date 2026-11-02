export const MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
} as const

export type MediaType = typeof MEDIA_TYPE[keyof typeof MEDIA_TYPE]

export const MEDIA_MIME_PREFIX = {
  IMAGE: 'image/',
  VIDEO: 'video/',
} as const

export const MEDIA_FILE_EXTENSIONS = {
  IMAGE: '.avif,.bmp,.gif,.jpeg,.jpg,.png,.svg,.webp',
  VIDEO: '.m4v,.mov,.mp4,.ogv,.webm',
} as const

export const MEDIA_FILE_ACCEPT = {
  IMAGE: `${MEDIA_FILE_EXTENSIONS.IMAGE},image/*`,
  IMAGE_AND_VIDEO: `${MEDIA_FILE_EXTENSIONS.IMAGE},${MEDIA_FILE_EXTENSIONS.VIDEO},image/*,video/*`,
} as const
