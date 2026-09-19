import type { PersoInitialCommon } from 'codplay'
import type { ThreeColorValue } from '../threejs-core-types'

/** Initial data accepted by one generic Three.js light perso. */
export type ThreeLightInitial = PersoInitialCommon & Readonly<{
  kind: 'ambient' | 'directional' | 'point'
  color?: ThreeColorValue
  intensity?: number
  distance?: number
  decay?: number
  position?: readonly [number, number, number]
  castShadow?: boolean
}>

/** Action data accepted by a Three.js light. */
export type ThreeLightAction = Readonly<Partial<Omit<ThreeLightInitial, 'rel'>>>
