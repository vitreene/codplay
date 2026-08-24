import type { ClassNameValue, AttrValue, StyleValue } from '../../../services'
import type { PolygonShapeState } from './polygon-geometry'

/** V1-compatible morph options evaluated by the V2 component clock. */
export type PolygonMorphOptions = boolean | Readonly<{
  duration?: number
  delayMs?: number
  ease?: string
  easing?: string
  precision?: number
  sampleCount?: number
}>

/** Resolved point-cloud morph state retained for callers using the V1 geometry API. */
export type PolygonMorphState = Readonly<{
  from: PolygonShapeState
  to: PolygonShapeState
  progress: number
  sampleCount?: number
}>

/** Initial polygon author state. */
export type PolygonInitial = PolygonShapeState & Readonly<{
  content?: string | number
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Resolved polygon state and optional morph declaration. */
export type PolygonState = PolygonInitial & Readonly<{
  morph?: PolygonMorphOptions
}>

/** Action payload accepted by one polygon perso. */
export type PolygonAction = PolygonState
