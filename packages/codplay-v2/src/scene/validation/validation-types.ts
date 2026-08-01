import type {
  ServiceValidationDefinition,
  ValidationFunction,
} from '../../services/service-validation-types'

export type {
  PropertyValidationDefinition,
  ServiceValidationDefinition,
  ValidationContext,
  ValidationFunction,
  ValidationTarget,
} from '../../services/service-validation-types'

/** Pure validation declaration attached to one registered component type. */
export type ComponentValidationDefinition = Readonly<{
  type: string
  services: readonly string[]
  modules?: readonly string[]
  validateInitial?: ValidationFunction
  validateAction?: ValidationFunction
}>

/** Minimal author payload consumed by the validation catalog. */
export type PersoValidationInput = Readonly<{
  id: string
  type: string
  initial?: unknown
  actions?: Readonly<Record<string, unknown>>
}>

/** Immutable catalog view passed from CodPlay construction to compilation. */
export type ValidationCatalogSnapshot = Readonly<{
  components: ReadonlyMap<string, ComponentValidationDefinition>
  services: ReadonlyMap<string, ServiceValidationDefinition>
}>
