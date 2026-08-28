import type { Camera, Scene, WebGLRenderer } from 'three'
import type { PersoActionCommon, PersoInitialCommon } from 'codplay-v1/runtime/perso-shared-types'

export type ThreejsRendererInitial = {
  alpha?: boolean
  antialias?: boolean
  preserveDrawingBuffer?: boolean
  pixelRatio?: number
}

export type ThreejsBuildContext = {
  canvas: HTMLCanvasElement
  renderer: WebGLRenderer
  width: number
  height: number
}

export type ThreejsBuildResult = {
  scene: Scene
  camera: Camera
  refs?: Record<string, unknown>
  dispose?: () => void
}

export type ThreejsSetDescriptor = {
  ref: string
  values: Record<string, unknown>
}

export type ThreejsSimulationInput = {
  timelineMs: number
  timelineDeltaMs: number
  phase: 'tick' | 'seek'
  refs: ReadonlyMap<string, unknown>
}

export type ThreejsSimulationFn = (input: ThreejsSimulationInput) => void

export type ThreejsInitial = PersoInitialCommon & {
  width?: number
  height?: number
  renderer?: ThreejsRendererInitial
  build: (context: ThreejsBuildContext) => ThreejsBuildResult
}

export type ThreejsAction = PersoActionCommon & {
  set?: ThreejsSetDescriptor[]
  simulate?: ThreejsSimulationFn | null
}
