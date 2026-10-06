import type { CarouselPlaybackMode, CarouselTransition } from '../config/document-config-types'
import type { BdcId } from './document-types'

export interface CarouselAspectRatio {
  readonly width: number
  readonly height: number
}

export interface CarouselCardEntry {
  readonly bdcId: BdcId
  readonly durationMs: number | null
}

export interface CarouselContent {
  readonly defaultViewDurationMs: number
  readonly playbackMode: CarouselPlaybackMode
  /** Additional complete automatic passes after the first; absent values use the configured default. */
  readonly repeatCount?: number
  readonly aspectRatio: CarouselAspectRatio
  readonly transition: CarouselTransition
  readonly cards: readonly CarouselCardEntry[]
}
