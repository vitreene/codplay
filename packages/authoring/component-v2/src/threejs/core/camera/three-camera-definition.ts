import type { RuntimeComponentDefinition } from 'codplay'
import { ThreeCameraComponent } from './three-camera-component'
import { validateThreeCamera } from '../threejs-validation'

/** Engine declaration for the generic Three.js camera class. */
export const THREE_CAMERA_DEFINITION: RuntimeComponentDefinition = {
  type: 'three-camera',
  component: ThreeCameraComponent,
  modules: [],
  libraries: ['three'],
  validateInitial: validateThreeCamera,
  validateAction: validateThreeCamera,
}
