import type { CarouselPlaybackMode, RevelationTransitionRef } from '../../config/document-config-types'
import type { RevelationTransitionOverrides } from '../document/document-types'
import type { BdcId } from '../document/document-types'

export interface CarouselAspectRatio {
  readonly width: number
  readonly height: number
}

export interface CarouselCardEntry {
  readonly bdcId: BdcId
  readonly durationMs: number | null
  readonly introTransitionRef: RevelationTransitionRef | null
  readonly outroTransitionRef: RevelationTransitionRef | null
}

export interface CarouselContent {
  readonly defaultViewDurationMs: number
  readonly playbackMode: CarouselPlaybackMode
  /** Additional complete automatic passes after the first; absent values use the configured default. */
  readonly repeatCount?: number
  readonly aspectRatio: CarouselAspectRatio
  readonly revelation: RevelationTransitionOverrides
  readonly cards: readonly CarouselCardEntry[]
}
