import type { Camera, Scene, WebGLRenderer } from 'three'

/** Runtime namespace prepared once by the CodPlay engine. */
export type ThreeRuntime = typeof import('three')

/** Serializable color form shared by the generic Three.js components. */
export type ThreeColorValue = string | number

/** Opaque scene target published by the generic Three.js host. */
export type ThreeSceneTarget = Readonly<{
  scene: Scene
  renderer: WebGLRenderer
  /** Returns the camera currently selected by the host, if one exists. */
  getCamera: () => Camera | null
  setCamera: (camera: Camera | null) => void
  resize: (width: number, height: number) => void
  render: () => void
}>
