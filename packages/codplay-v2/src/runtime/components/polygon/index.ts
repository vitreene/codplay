export {
  PolygonComponent,
  validatePolygonAction,
  validatePolygonInitial,
} from './polygon-component'
export type {
  PolygonAction,
  PolygonInitial,
  PolygonMorphOptions,
  PolygonMorphState,
  PolygonState,
} from './polygon-types'
export {
  clampProgress,
  createPolygonVertices,
  interpolatePointSets,
  normalizePolygonShapeState,
  resolveMorphPathString,
  resolveMorphPointsString,
  resolvePolygonPathString,
  resolvePolygonPointsString,
  resampleClosedPolyline,
  toPolygonPathString,
  toPolygonPointsString,
  type NormalizedPolygonShapeState,
  type PolygonPoint,
  type PolygonShapeState,
} from './polygon-geometry'
