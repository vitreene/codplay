import type { BaseComponentVisualData } from '../base-component'
import type { MediaTransition } from '../component-surface-types'

/** Native media element kinds supported by the unified media component. */
export type MediaTag = 'audio' | 'video'

/** Initial author profile accepted by the V2 HTML media component. */
export type MediaInitial = BaseComponentVisualData & Readonly<{
  src: string
  tag?: MediaTag
  controls?: boolean
  master?: boolean
}>

/** Resolved state accepted by one media update. */
export type MediaState = BaseComponentVisualData & Readonly<{
  src: string
}>

export type { MediaTransition }
