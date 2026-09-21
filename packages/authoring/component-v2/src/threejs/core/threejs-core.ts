import type {
  CodPlayEngineOptions,
  RuntimeComponentDefinition,
  RuntimeLibraryDefinition,
} from 'codplay'
import { THREE_CAMERA_DEFINITION } from './camera'
import { THREE_LIGHT_DEFINITION } from './light'
import { THREE_SCENE_HOST_DEFINITION } from './host'
import type { ThreeRuntime } from './threejs-core-types'

let runtimePromise: Promise<ThreeRuntime> | undefined

/** Loads the Three.js namespace shared by the engine and its resource loaders. */
export function getThreeRuntime(): Promise<ThreeRuntime> {
  runtimePromise ??= import('three')
  return runtimePromise
}

/** Engine-owned Three.js library declaration. */
export const THREE_LIBRARY: RuntimeLibraryDefinition = {
  id: 'three',
  load: getThreeRuntime,
  origin: 'foreign',
}

/** Generic component declarations shared by Three.js scenes. */
export const THREEJS_CORE_COMPONENTS: readonly RuntimeComponentDefinition[] = [
  THREE_SCENE_HOST_DEFINITION,
  THREE_CAMERA_DEFINITION,
  THREE_LIGHT_DEFINITION,
]

/** Engine capabilities needed by the generic Three.js projection. */
export const THREEJS_CORE_ENGINE: Pick<CodPlayEngineOptions, 'libraries' | 'components'> = {
  libraries: { register: [THREE_LIBRARY] },
  components: { register: THREEJS_CORE_COMPONENTS },
}
