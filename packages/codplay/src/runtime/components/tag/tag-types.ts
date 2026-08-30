import type { BaseComponentData } from '../base-component'

/** Initial and resolved data profile accepted by one tag perso. */
export type TagState = BaseComponentData & Readonly<{
  tag?: string
  /** Native value used by semantic value-bearing tags such as output. */
  value?: string | number
}>

/** Author-facing initial profile for the tag component. */
export type TagInitial = TagState

/** Action patch accepted by one tag perso. */
export type TagAction = Partial<TagInitial>
