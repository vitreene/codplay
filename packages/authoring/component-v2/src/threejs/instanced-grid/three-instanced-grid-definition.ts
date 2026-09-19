import type { RuntimeComponentDefinition } from 'codplay'
import { ThreeInstancedGridComponent } from './three-instanced-grid-component'
import {
  sanitizeThreeInstancedGridInitial,
  validateThreeInstancedGrid,
} from './three-instanced-grid-validation'

/** Engine declaration for the specialized procedural grid class. */
export const THREE_INSTANCED_GRID_DEFINITION: RuntimeComponentDefinition = {
  type: 'three-instanced-grid',
  component: ThreeInstancedGridComponent,
  modules: [],
  libraries: ['three'],
  validateInitial: validateThreeInstancedGrid,
  validateAction: validateThreeInstancedGrid,
  sanitizeInitial: sanitizeThreeInstancedGridInitial,
}
