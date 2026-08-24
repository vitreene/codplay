import type { BaseComponentData } from '../base-component'

/** Shape fields accepted in a Polygon SceneDoc profile. */
export type PolygonShapeInput = Readonly<{
  sides?: number
  inner?: number | null
  outer?: number
  rotationDeg?: number
  inflexion?: number | readonly number[]
}>

/** Morph declaration accepted on a polygon action. */
export type PolygonMorphInput = boolean | Readonly<{
  duration?: number
  delayMs?: number
  ease?: string
  easing?: string
  precision?: number
  sampleCount?: number
}>

/** Complete author-facing data profile accepted by a polygon perso. */
export type PolygonData = BaseComponentData & PolygonShapeInput & Readonly<{
  morph?: PolygonMorphInput
}>

/** Initial polygon data accepted by the SceneDoc validator. */
export type PolygonInitial = PolygonData

/** Action patch accepted by the SceneDoc validator. */
export type PolygonAction = Partial<PolygonData>

/** Shape state after the initial profile and action patches are compiled. */
export type PolygonShapeState = Readonly<{
  sides: number
  inner: number | null
  outer: number
  rotationDeg: number
  inflexion: number | readonly number[]
}>

/** Geometry state derived from one compiled shape before vertex generation. */
export type PolygonGeometryState = Readonly<{
  sides: number
  inner: number | null
  outer: number
  rotationDeg: number
  inflexion: readonly number[]
}>

/** One cartesian point used by the pure polygon geometry algorithms. */
export type PolygonPoint = Readonly<{ x: number; y: number }>

/** Morph timing after compile-time defaults have been made explicit. */
export type PolygonCompiledMorphOptions = Readonly<{
  duration: number
  delayMs: number
  ease: string
  sampleCount: number
}>

/** Resolved state delivered to PolygonComponent by the V2 player. */
export type PolygonState = BaseComponentData & PolygonShapeState & Readonly<{
  morph?: PolygonCompiledMorphOptions
}>

/** Resolved point-cloud morph state retained for geometry callers. */
export type PolygonMorphState = Readonly<{
  from: PolygonShapeState
  to: PolygonShapeState
  progress: number
  sampleCount: number
}>

/** Backward-compatible name for the author-facing morph declaration. */
export type PolygonMorphOptions = PolygonMorphInput

/** Reports whether one compiled action changes at least one polygon shape field. */
export function hasPolygonShapeChange(action: Readonly<Record<string, unknown>>): boolean {
  return action.sides !== undefined
    || action.inner !== undefined
    || action.outer !== undefined
    || action.rotationDeg !== undefined
    || action.inflexion !== undefined
}
