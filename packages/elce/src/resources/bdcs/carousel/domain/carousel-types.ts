import type { CarouselPlaybackMode } from '../carousel-config'
import type { RevelationTransitionRef } from '../../../revelation/revelation-types'
import type { RevelationTransitionOverrides } from '../../../revelation/revelation-types'
import type { BdcId } from '../../../../core/document/content-document-types'

export interface CarouselAspectRatio {
  readonly width: number
  readonly height: number
}

export interface CarouselBdcEntry {
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
  /** Ordered Card and Statistical Graph views, retained under the v4 field name. */
  readonly cards: readonly CarouselBdcEntry[]
}
