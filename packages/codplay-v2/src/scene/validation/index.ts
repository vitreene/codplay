export { CompiledSceneValidationEngine, type CompiledSceneValidationInput } from './compiled-scene-validation-engine'
export { GuardPipeline, type GuardContext, type GuardPhase, type GuardRule } from './guard-pipeline'
export {
  GUARD_PHASE_CAPABILITY,
  GUARD_PHASE_ORDER,
  GUARD_PHASE_SEMANTIC,
  GUARD_PHASE_SHAPE,
} from '../config/guard-phases'
export { SceneGuardEngine } from './scene-guard-engine'
export { ValidationCatalog, validatePersoWithCatalog } from './validation-catalog'
export { reportMissingValidator } from './validation-warnings'
export type {
  ComponentValidationDefinition,
  PersoValidationInput,
  PropertyValidationDefinition,
  ServiceValidationDefinition,
  ValidationCatalogSnapshot,
  ValidationContext,
  ValidationFunction,
  ValidationTarget,
} from './validation-types'
