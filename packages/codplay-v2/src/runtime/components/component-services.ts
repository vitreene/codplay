import type { RuntimeModuleServiceInstance } from '../engine'
import type { ComponentServices } from './component-types'

/** Identity supplied when one component-owned service is created. */
export type RuntimeComponentServiceContext = Readonly<{
  componentId: string
  storyId: string
  componentType: string
}>

/** Stateless or component-scoped operation applied to one projected node. */
export type RuntimeComponentServiceInstance = Readonly<{
  apply: (node: unknown, value: unknown) => void
}>

/** Factory for one component-scoped service instance. */
export type RuntimeComponentServiceFactory = (
  context: RuntimeComponentServiceContext,
) => RuntimeComponentServiceInstance

/** Runtime definition for one injectable component service. */
export type RuntimeComponentServiceDefinition = Readonly<{
  id: string
  create: RuntimeComponentServiceFactory
}>

/** Catalog of service factories shared by one component runtime host. */
export class RuntimeComponentServiceCatalog {
  private readonly definitions = new Map<string, RuntimeComponentServiceDefinition>()

  /** Registers one service factory and rejects duplicate service IDs. */
  register(definition: RuntimeComponentServiceDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Runtime component service already registered: ${definition.id}`)
    }
    this.definitions.set(definition.id, definition)
  }

  /** Creates one independent service instance set for one component. */
  createInstances(context: RuntimeComponentServiceContext): ReadonlyMap<string, RuntimeComponentServiceInstance> {
    return new Map([...this.definitions.entries()].map(([id, definition]) => [id, definition.create(context)]))
  }
}

/** Creates one component facade from runtime services and player modules. */
export function createComponentServices(
  catalog: RuntimeComponentServiceCatalog,
  context: RuntimeComponentServiceContext,
  modules: ReadonlyMap<string, RuntimeModuleServiceInstance>,
): ComponentServices {
  const instances = catalog.createInstances(context)
  let declaredNames: readonly string[] = []
  const content = instances.get('content')

  const services: ComponentServices = {
    declare: (names) => {
      for (const name of names) {
        if (!instances.has(name) && !modules.has(name)) {
          throw new Error(`Runtime component dependency is unavailable: ${name}`)
        }
      }
      declaredNames = [...names]
    },
    apply: (node, patch) => {
      for (const name of declaredNames) {
        const value = patch[name]
        if (value !== undefined) instances.get(name)?.apply(node, value)
      }
    },
    ...(content === undefined
      ? {}
      : { content: { apply: (node: unknown, value: unknown) => content.apply(node, value) } }),
  }

  return services
}
