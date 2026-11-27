import type { BaseComponentVisualData } from '../base-component'

/** Logical axis whose scroll offset feeds the progress source and the reset. */
export type ScrollProgressAxis = 'block' | 'inline'

/** Initial and resolved profile of one scrollport: its root tag and progress settings. */
export type ScrollContainerState = BaseComponentVisualData & Readonly<{
  tag?: string
  values?: Readonly<{
    progress?: Readonly<{
      axis?: ScrollProgressAxis
      range?: 'scrollport'
    }>
  }>
}>

/** Author-facing initial profile of the scroll-container component. */
export type ScrollContainerInitial = ScrollContainerState

/** Action patch accepted by one scroll-container perso. */
export type ScrollContainerAction = Partial<BaseComponentVisualData>

/** Reads the configured progress axis, `block` by default. */
export function resolveScrollProgressAxis(initial: Readonly<Record<string, unknown>>): ScrollProgressAxis {
  const values = initial.values as ScrollContainerState['values']
  return values?.progress?.axis ?? 'block'
}
