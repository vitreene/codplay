import type { RuntimeComponentDefinition } from 'codplay'
import { ThreeSceneHostComponent } from './three-scene-host-component'
import {
  sanitizeThreeSceneHostInitial,
  validateThreeSceneHostInitial,
} from '../threejs-validation'

/** Engine declaration for the generic Three.js scene host class. */
export const THREE_SCENE_HOST_DEFINITION: RuntimeComponentDefinition = {
  type: 'three-scene-host',
  component: ThreeSceneHostComponent,
  modules: [],
  libraries: ['three'],
  validateInitial: validateThreeSceneHostInitial,
  sanitizeInitial: sanitizeThreeSceneHostInitial,
  targetProvider: (component) => {
    if (!(component instanceof ThreeSceneHostComponent)) return undefined
    const target = component.getSceneTarget()
    return target === undefined ? undefined : { value: target, scope: 'host' }
  },
}
