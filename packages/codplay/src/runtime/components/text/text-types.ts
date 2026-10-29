import type { BaseComponentData } from '../base-component'
import type { ReplaceDirection, ReplaceTextSplit } from '../../capabilities/replace-presets'
import type { ReplacePresetName } from '../../capabilities/replace-presets'

/** Initial and resolved data profile accepted by the rich HTML `text` component. */
export type TextInitial = BaseComponentData & Readonly<{
  tag?: string
}>

/** Resolved data projected onto one rich HTML text root. */
export type TextState = TextInitial

/** Numeric preset reference or its author-facing override object. */
export type TextReplace = ReplacePresetName | Readonly<{
  transition: ReplacePresetName
  duration?: number
  split?: ReplaceTextSplit
  stagger?: number
  direction?: ReplaceDirection
  skipUnchanged?: boolean
}>

/** Action patch accepted by one rich text perso. */
export type TextAction = Partial<TextInitial> & Readonly<{
  replace?: TextReplace
}>
