import type { PersoActionCommon, PersoInitialCommon } from '../perso-shared-types'
import type { PolygonShapeState } from './polygon-geometry'

export type PolygonMorphState = {
  from: PolygonShapeState
  to: PolygonShapeState
  progress: number
  sampleCount?: number
}

export type PolygonMorphOptions = boolean | {
  duration?: number
  delayMs?: number
  ease?: string
  easing?: string
  precision?: number
}

export type PolygonInitial = PersoInitialCommon & PolygonShapeState & {
  content?: unknown
}

export type PolygonAction = PersoActionCommon & PolygonShapeState & {
  content?: unknown
  morph?: PolygonMorphOptions
}
