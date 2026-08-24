import type { BaseComponentData } from '../base-component'

/** Initial and resolved data profile accepted by one tag perso. */
export type TagState = BaseComponentData & Readonly<{
  tag?: string
}>

/** Author-facing initial profile for the tag component. */
export type TagInitial = TagState
