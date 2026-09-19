import type { PersoInitialCommon } from 'codplay'

/** Initial data accepted by one generic Three.js camera perso. */
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

/** Action data accepted by a Three.js camera. */
export type ThreeCameraAction = Readonly<Partial<Omit<ThreeCameraInitial, 'rel'>>>
