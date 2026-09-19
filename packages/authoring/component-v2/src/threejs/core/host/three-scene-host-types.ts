import type { PersoInitialCommon } from 'codplay'
import type { ThreeColorValue } from '../threejs-core-types'

/** Renderer options accepted by the generic Three.js scene host. */
export type ThreeRendererInitial = Readonly<{
  alpha?: boolean
  antialias?: boolean
  preserveDrawingBuffer?: boolean
  pixelRatio?: number
}>

/** Initial data accepted by the HTML host of one Three.js projection. */
export type ThreeSceneHostInitial = PersoInitialCommon & Readonly<{
  width?: number
  height?: number
  background?: ThreeColorValue
  renderer?: ThreeRendererInitial
}>
