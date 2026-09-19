import type { PersoInitialCommon } from 'codplay'
import type { ThreeColorValue } from '../core/threejs-core-types'

/** Initial data accepted by the specialized procedural instanced grid. */
export type ThreeInstancedGridInitial = PersoInitialCommon & Readonly<{
  gridSize?: number
  cellSize?: number
  expansion?: number
  delayMaxMs?: number
  durationMs?: number
  holdMs?: number
  rotationPeriodMs?: number
  rotationXPeriodMs?: number
  color?: ThreeColorValue
  opacity?: number
}>

/** Action data accepted by the procedural grid. */
export type ThreeInstancedGridAction = Readonly<{
  animate?: boolean
}>
