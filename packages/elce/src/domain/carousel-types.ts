import type { CarouselImagePosition, CarouselPlaybackMode, CarouselTransition } from '../config/document-config-types'
import type { MediaId } from './document-types'
import { DEFAULT_PRESET_ID } from '../config/document-config'

export interface CarouselAspectRatio {
  readonly width: number
  readonly height: number
}

export interface CarouselShortText {
  readonly overline: string
  readonly title: string
  readonly description: string
  readonly message: string
  readonly note: string
}

export type CarouselViewContent =
  | Readonly<{
      presetId: typeof DEFAULT_PRESET_ID.TEXT_SHORT
      text: CarouselShortText
      mediaId: MediaId | null
    }>
  | Readonly<{
      presetId: typeof DEFAULT_PRESET_ID.PHOTO
      text: null
      mediaId: MediaId | null
    }>
  | Readonly<{
      presetId: typeof DEFAULT_PRESET_ID.IMAGE_CAPTION
      text: Readonly<{ caption: string }>
      mediaId: MediaId | null
    }>
  | Readonly<{
      presetId: typeof DEFAULT_PRESET_ID.TEXT_IMAGE
      text: CarouselShortText
      mediaId: MediaId | null
      imagePosition: CarouselImagePosition
    }>

export type CarouselView = CarouselViewContent & Readonly<{
  id: string
  durationMs: number | null
}>

export interface CarouselContent {
  readonly defaultViewDurationMs: number
  readonly playbackMode: CarouselPlaybackMode
  /** Additional complete automatic passes after the first; absent values use the configured default. */
  readonly repeatCount?: number
  readonly aspectRatio: CarouselAspectRatio
  readonly transition: CarouselTransition
  readonly views: readonly CarouselView[]
}
