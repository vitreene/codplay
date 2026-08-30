import type { BaseComponentVisualData } from '../base-component'
import type { MediaTransition } from '../component-surface-types'

/** Native media element kinds supported by the unified media component. */
export type MediaTag = 'audio' | 'video'

/** Properties projected onto the persistent native audio or video element. */
export type MediaPartState = BaseComponentVisualData

/** Initial author profile accepted by the V2 HTML media component. */
export type MediaInitial = BaseComponentVisualData & Readonly<{
  src: string
  tag?: MediaTag
  controls?: boolean
  master?: boolean
  video?: MediaPartState
}>

/** Resolved state accepted by one media update. */
export type MediaState = BaseComponentVisualData & Readonly<{
  src: string
  video?: MediaPartState
}>

/** Action patch accepted by one media perso. */
export type MediaAction = Partial<Pick<MediaInitial, 'src' | 'className' | 'style' | 'attr' | 'video'>>

export type { MediaTransition }
