import type { ServiceValidationDefinition } from './service-validation-types'

/** Context supplied when one service adapter is created for one component. */
export type ServiceRuntimeContext = Readonly<{
  componentId: string
  storyId: string
  componentType: string
  materializerId: string
  materializerContext: unknown
}>

/** Runtime operation exposed by one component-scoped service adapter. */
export type ServiceRuntimeInstance = Readonly<{
  apply: (node: unknown, value: unknown) => void
}>

/** Factory for one component-scoped service adapter. */
export type ServiceRuntimeFactory = (
  context: ServiceRuntimeContext,
) => ServiceRuntimeInstance

/** Validation declaration plus the materializer bindings for one service. */
export type ServiceRuntimeDefinition = ServiceValidationDefinition & Readonly<{
  materializers: readonly string[]
  create: ServiceRuntimeFactory
}>
