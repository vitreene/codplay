import type { PersoActionCommon, PersoInitialCommon } from 'codplay/runtime/perso-shared-types'
import type { PolygonShapeState } from './polygon-geometry.js'

export type PolygonMorphState = {
  from: PolygonShapeState
  to: PolygonShapeState
  progress: number
  sampleCount?: number
}

export type PolygonInitial = PersoInitialCommon & PolygonShapeState & {
  content?: unknown
}

export type PolygonAction = PersoActionCommon & PolygonShapeState & {
  content?: unknown
  morph?: PolygonMorphState
}
