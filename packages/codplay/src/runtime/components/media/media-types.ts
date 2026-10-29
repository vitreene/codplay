import type { BaseComponentVisualData } from '../base-component'
import type { MediaTransition } from '../component-surface-types'
import type { ReplacePresetName, ReplaceMediaOptions } from '../../capabilities/replace-presets'
import type { SlotReplaceTransition } from '../component-surface-types'

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
export type MediaReplace = ReplacePresetName | SlotReplaceTransition | ReplaceMediaOptions

export type MediaAction = Partial<Pick<MediaInitial, 'src' | 'className' | 'style' | 'attr' | 'video'>> & Readonly<{
  replace?: MediaReplace
}>

export type { MediaTransition }
