import type {
  ServiceValidationDefinition,
  ValidationFunction,
  ValidationContext,
} from '../../services/service-validation-types'

export type {
  PropertyValidationDefinition,
  ServiceValidationDefinition,
  ValidationContext,
  ValidationFunction,
  ValidationTarget,
} from '../../services/service-validation-types'

/** Pure component-data transformation executed while building CompiledScene. */
export type ComponentSanitizer = (
  value: Readonly<Record<string, unknown>>,
) => Readonly<Record<string, unknown>>

/** Pure validation declaration attached to one registered component type. */
export type ComponentValidationDefinition = Readonly<{
  type: string
  services: readonly string[]
  modules?: readonly string[]
  validateInitial: ValidationFunction
  validateAction?: ValidationFunction
  validatePerso?: PersoValidationFunction
  sanitizeInitial?: ComponentSanitizer
  sanitizeAction?: ComponentSanitizer
}>

/** Minimal author payload consumed by the validation catalog. */
export type PersoValidationInput = Readonly<{
  id: string
  name?: string
  type: string
  initial?: unknown
  actions?: Readonly<Record<string, unknown>>
  /** Story identity and declaration path are supplied by SceneBuilder for diagnostics. */
  storyId?: string
  validationPath?: string
}>

/** Validates structural author fields that belong to the perso root. */
export type PersoValidationFunction = (
  perso: PersoValidationInput,
  context: ValidationContext,
) => void

/** Immutable validation view passed from CodPlay construction to compilation. */
export type CapabilityValidationSnapshot = Readonly<{
  components: ReadonlyMap<string, ComponentValidationDefinition>
  services: ReadonlyMap<string, ServiceValidationDefinition>
}>
