import type { BaseComponentVisualData } from '../base-component'

/** Initial layout profile accepted by the SceneDoc validator. */
export type LayoutInitial = BaseComponentVisualData & Readonly<{
  markup: string
}>

/** Resolved root data applied to one layout component. */
export type LayoutState = BaseComponentVisualData

/** Action patch accepted by one layout perso. */
export type LayoutAction = Partial<LayoutState>
