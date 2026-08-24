import type { BaseComponentVisualData } from '../base-component'

/** Reorder options accepted by the list author profile. */
export type ListConfig = Readonly<{
  reorderOnMove?: boolean
  reorderOnAdd?: boolean
  reorderOnRemove?: boolean
}>

/** Initial list profile accepted by the SceneDoc validator. */
export type ListInitial = BaseComponentVisualData & Readonly<{
  tag?: string
  config?: ListConfig
}>

/** Resolved root data applied to one list host. */
export type ListState = BaseComponentVisualData
