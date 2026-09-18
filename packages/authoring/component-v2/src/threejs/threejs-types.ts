import type {
  Camera,
  Object3D,
  Scene,
  WebGLRenderer,
} from 'three'
import type { PersoInitialCommon } from 'codplay'

/** One engine-owned target published by a Three.js scene host. */
export type ThreeSceneTarget = Readonly<{
  scene: Scene
  renderer: WebGLRenderer
  setCamera: (camera: Camera | null) => void
  resize: (width: number, height: number) => void
  render: () => void
}>

/** Serializable color form accepted by authored Three.js profiles. */
export type ThreeColorValue = string | number

/** Renderer options accepted by the first Three.js host. */
export type ThreeRendererInitial = Readonly<{
  alpha?: boolean
  antialias?: boolean
  preserveDrawingBuffer?: boolean
  pixelRatio?: number
}>

/** Initial profile for the HTML host that owns one Three.js projection. */
export type ThreeSceneHostInitial = PersoInitialCommon & Readonly<{
  width?: number
  height?: number
  background?: ThreeColorValue
  renderer?: ThreeRendererInitial
}>

/** Initial profile for one authored camera perso. */
export type ThreeCameraInitial = PersoInitialCommon & Readonly<{
  kind?: 'perspective' | 'orthographic'
  fov?: number
  near?: number
  far?: number
  left?: number
  right?: number
  top?: number
  bottom?: number
  position?: readonly [number, number, number]
  lookAt?: readonly [number, number, number]
}>

/** Initial profile for one authored light perso. */
export type ThreeLightInitial = PersoInitialCommon & Readonly<{
  kind: 'ambient' | 'directional' | 'point'
  color?: ThreeColorValue
  intensity?: number
  distance?: number
  decay?: number
  position?: readonly [number, number, number]
  castShadow?: boolean
}>

/** Initial profile for the first procedural instanced-grid feature. */
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

/** Action profile for a camera update. */
export type ThreeCameraAction = Readonly<Partial<Omit<ThreeCameraInitial, 'rel'>>>

/** Action profile for a light update. */
export type ThreeLightAction = Readonly<Partial<Omit<ThreeLightInitial, 'rel'>>>

/** Action profile for the procedural grid. */
export type ThreeInstancedGridAction = Readonly<{
  animate?: boolean
}>

/** One Three.js object created by a feature component. */
export type ThreeObjectHandle = Readonly<{
  object: Object3D
  dispose: () => void
}>
