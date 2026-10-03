import type { BaseComponentVisualData } from '../base-component'
import type { LayoutFlowReservation } from './layout-flow-reservation-types'

/** Initial layout profile accepted by the SceneDoc validator. */
export type LayoutInitial = BaseComponentVisualData & Readonly<{
  markup: string
  flowReservations?: readonly LayoutFlowReservation[]
}>

/** Resolved root data applied to one layout component. */
export type LayoutState = BaseComponentVisualData

/** Action patch accepted by one layout perso. */
export type LayoutAction = Partial<LayoutState>
