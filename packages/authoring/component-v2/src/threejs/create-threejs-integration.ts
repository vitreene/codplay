import type {
  CodPlayEngineOptions,
  RuntimeComponentDefinition,
  RuntimeLibraryDefinition,
} from 'codplay'
import { createThreeCameraComponent } from './camera/three-camera-component'
import { createThreeInstancedGridComponent } from './instanced-grid/three-instanced-grid-component'
import { createThreeLightComponent } from './light/three-light-component'
import { createThreeSceneHostComponent } from './host/three-scene-host-component'
import { createThreeRuntimeAccess } from './threejs-runtime'
import {
  sanitizeThreeInstancedGridInitial,
  sanitizeThreeSceneHostInitial,
  validateThreeCamera,
  validateThreeInstancedGrid,
  validateThreeLight,
  validateThreeSceneHostInitial,
} from './threejs-validation'

/** Complete engine registrations produced by one Three.js integration factory. */
export type ThreejsIntegration = Readonly<{
  library: RuntimeLibraryDefinition
  components: readonly RuntimeComponentDefinition[]
  engine: Pick<CodPlayEngineOptions, 'libraries' | 'components'>
}>

/** Creates the complete first Three.js V2 unit without importing the V1 runtime. */
export function createThreejsIntegration(): ThreejsIntegration {
  const runtimeAccess = createThreeRuntimeAccess()
  const sceneHostComponent = createThreeSceneHostComponent(runtimeAccess)
  const cameraComponent = createThreeCameraComponent(runtimeAccess)
  const lightComponent = createThreeLightComponent(runtimeAccess)
  const instancedGridComponent = createThreeInstancedGridComponent(runtimeAccess)

  const library: RuntimeLibraryDefinition = {
    id: 'three',
    load: runtimeAccess.load,
    release: runtimeAccess.release,
    origin: 'foreign',
  }
  const components: readonly RuntimeComponentDefinition[] = [
    {
      type: 'three-scene-host',
      component: sceneHostComponent,
      modules: [],
      libraries: ['three'],
      validateInitial: validateThreeSceneHostInitial,
      sanitizeInitial: sanitizeThreeSceneHostInitial,
      targetProvider: (component) => {
        if (!(component instanceof sceneHostComponent)) return undefined
        const target = component.getSceneTarget()
        return target === undefined ? undefined : { value: target, scope: 'scene' }
      },
    },
    {
      type: 'three-camera',
      component: cameraComponent,
      modules: [],
      libraries: ['three'],
      validateInitial: validateThreeCamera,
      validateAction: validateThreeCamera,
    },
    {
      type: 'three-light',
      component: lightComponent,
      modules: [],
      libraries: ['three'],
      validateInitial: validateThreeLight,
      validateAction: validateThreeLight,
    },
    {
      type: 'three-instanced-grid',
      component: instancedGridComponent,
      modules: [],
      libraries: ['three'],
      validateInitial: validateThreeInstancedGrid,
      validateAction: validateThreeInstancedGrid,
      sanitizeInitial: sanitizeThreeInstancedGridInitial,
    },
  ]

  return {
    library,
    components,
    engine: {
      libraries: { register: [library] },
      components: { register: components },
    },
  }
}
