import type { RuntimeComponentDefinition } from 'codplay'
import { ThreeLightComponent } from './three-light-component'
import { validateThreeLight } from '../threejs-validation'

/** Engine declaration for the generic Three.js light class. */
export const THREE_LIGHT_DEFINITION: RuntimeComponentDefinition = {
  type: 'three-light',
  component: ThreeLightComponent,
  modules: [],
  runtimeProfile: 'attached',
  libraries: ['three'],
  validateInitial: validateThreeLight,
  validateAction: validateThreeLight,
}
