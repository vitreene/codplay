import type {
  CodPlayEngineOptions,
  RuntimeComponentDefinition,
  RuntimeLibraryDefinition,
} from 'codplay'

import { RiveDocumentComponent } from './rive-document-component'
import { getRiveRuntime } from './rive-preload'
import { RiveStateMachineComponent } from './rive-state-machine-component'
import {
  validateRiveAction,
  validateRiveInitial,
  validateRiveStateMachineAction,
  validateRiveStateMachineInitial,
} from './rive-validation'

/** Engine-owned Rive runtime declaration. */
export const RIVE_LIBRARY: RuntimeLibraryDefinition = {
  id: 'rive',
  load: getRiveRuntime,
  origin: 'foreign',
}

/** Rive components registered by the module. */
export const RIVE_COMPONENTS: readonly RuntimeComponentDefinition[] = [
  {
    type: 'rive',
    component: RiveDocumentComponent,
    modules: [],
    libraries: ['rive'],
    validateInitial: validateRiveInitial,
    validateAction: validateRiveAction,
    targetProvider: (component) => {
      if (!(component instanceof RiveDocumentComponent)) return undefined
      return { value: component.getTarget(), scope: 'perso' }
    },
  },
  {
    type: 'rive-state-machine',
    component: RiveStateMachineComponent,
    modules: [],
    libraries: ['rive'],
    validateInitial: validateRiveStateMachineInitial,
    validateAction: validateRiveStateMachineAction,
  },
]

/** Engine capabilities needed by the Rive document host. */
export const RIVE_ENGINE: Pick<CodPlayEngineOptions, 'libraries' | 'components'> = {
  libraries: { register: [RIVE_LIBRARY] },
  components: { register: RIVE_COMPONENTS },
}
