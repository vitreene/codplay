import type { BaseComponentVisualData } from '../base-component'

/** JSON-compatible reference accepted as opaque foreign content. */
export type ForeignContentValue =
  | string
  | number
  | boolean
  | null
  | readonly ForeignContentValue[]
  | { readonly [key: string]: ForeignContentValue }

/** Initial and resolved data profile accepted by one slot host perso. */
export type SlotState = BaseComponentVisualData & Readonly<{
  tag?: string
  /** Opaque serialized reference resolved by the owning foreign-content provider. */
  content?: ForeignContentValue
  replace?: SlotReplace
}>

/** Author-facing initial profile for the slot host component. */
export type SlotInitial = SlotState

/** Action patch accepted by one slot host perso. */
export type SlotAction = Partial<SlotState>

/** Replacement request supported by the first slot profile. */
export type SlotReplace = 'fade' | Readonly<{
  transition: 'fade'
  duration?: number
  /** Shared replace compatibility field; the opaque slot deliberately ignores it. */
  split?: 'letter' | 'word' | 'line' | 'cells'
}>
