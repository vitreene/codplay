import type { CapabilityValidationSnapshot } from '../../scene/validation/validation-types'
import type {
  PropertyValidationDefinition,
  ServiceValidationDefinition,
  ValidationFunction,
} from '../../services'
import type { BaseComponent } from '../components/base-component'
import type { ComponentInput, ComponentServices } from '../components/component-types'
import type { RuntimeMaterializer } from '../materializer'
import type {
  RuntimeModuleServiceContext,
  RuntimeModuleServiceInstance,
} from '../engine/module-service-types'
export { HTML_MATERIALIZER_ID } from '../materializer/materializer-ids'

/** Origin of one capability definition in a CodPlay instance. */
export type RuntimeCapabilityOrigin = 'core' | 'foreign'

/** Stable identity shared by a component, its materializer and its services. */
export type RuntimeComponentIdentity = Readonly<{
  componentId: string
  storyId: string
  componentType: string
}>

/** Context passed to one component-owned service factory. */
export type RuntimeComponentServiceContext = RuntimeComponentIdentity & Readonly<{
  materializerId: string
  materializerContext: unknown
}>

/** One component-owned service instance applied by the component facade. */
export type RuntimeComponentServiceInstance = Readonly<{
  apply: (node: unknown, value: unknown) => void
}>

/** Factory for one component-owned service instance. */
export type RuntimeComponentServiceFactory = (
  context: RuntimeComponentServiceContext,
) => RuntimeComponentServiceInstance

/** Factory that creates one V2 component from compiled author data. */
export type RuntimeComponentFactory = (
  input: ComponentInput<Record<string, unknown>>,
) => BaseComponent<Record<string, unknown>>

/** Unified declaration of one service, including validation and materializers. */
export type RuntimeComponentServiceDefinition = ServiceValidationDefinition & Readonly<{
  materializers: readonly string[]
  create: RuntimeComponentServiceFactory
  origin?: RuntimeCapabilityOrigin
}>

/** Unified declaration of one runtime component type. */
export type RuntimeComponentDefinition = Readonly<{
  type: string
  services: readonly string[]
  modules: readonly string[]
  validateInitial?: ValidationFunction
  validateAction?: ValidationFunction
  create: RuntimeComponentFactory
  mountableParts?: readonly string[]
  origin?: RuntimeCapabilityOrigin
}>

/** Unified declaration of one player-scoped module service. */
export type RuntimeModuleServiceDefinition = Readonly<{
  id: string
  create: (context: RuntimeModuleServiceContext) => RuntimeModuleServiceInstance
  origin?: RuntimeCapabilityOrigin
}>

/** One mutable capability registry owned by the CodPlay instance. */
export class RuntimeCapabilityCatalog {
  private readonly components = new Map<string, RuntimeComponentDefinition>()
  private readonly services = new Map<string, RuntimeComponentServiceDefinition>()
  private readonly modules = new Map<string, RuntimeModuleServiceDefinition>()
  private locked = false

  /** Registers one component definition before the instance is locked. */
  registerComponent(definition: RuntimeComponentDefinition, origin: RuntimeCapabilityOrigin = 'foreign'): void {
    this.assertOpen()
    if (this.components.has(definition.type)) {
      throw new Error(`Runtime component already registered: ${definition.type}`)
    }
    this.components.set(definition.type, { ...definition, origin })
  }

  /** Replaces one existing component definition before the instance is locked. */
  overrideComponent(definition: RuntimeComponentDefinition, origin: RuntimeCapabilityOrigin = 'foreign'): void {
    this.assertOpen()
    if (!this.components.has(definition.type)) {
      throw new Error(`Runtime component is not registered: ${definition.type}`)
    }
    this.components.set(definition.type, { ...definition, origin })
  }

  /** Registers one service definition before the instance is locked. */
  registerService(definition: RuntimeComponentServiceDefinition, origin: RuntimeCapabilityOrigin = 'foreign'): void {
    this.assertOpen()
    if (this.services.has(definition.name)) {
      throw new Error(`Runtime service already registered: ${definition.name}`)
    }
    this.services.set(definition.name, { ...definition, origin })
  }

  /** Replaces one existing service definition before the instance is locked. */
  overrideService(definition: RuntimeComponentServiceDefinition, origin: RuntimeCapabilityOrigin = 'foreign'): void {
    this.assertOpen()
    if (!this.services.has(definition.name)) {
      throw new Error(`Runtime service is not registered: ${definition.name}`)
    }
    this.services.set(definition.name, { ...definition, origin })
  }

  /** Registers one module definition before the instance is locked. */
  registerModule(definition: RuntimeModuleServiceDefinition, origin: RuntimeCapabilityOrigin = 'foreign'): void {
    this.assertOpen()
    if (this.modules.has(definition.id)) {
      throw new Error(`Runtime module already registered: ${definition.id}`)
    }
    this.modules.set(definition.id, { ...definition, origin })
  }

  /** Replaces one existing module definition before the instance is locked. */
  overrideModule(definition: RuntimeModuleServiceDefinition, origin: RuntimeCapabilityOrigin = 'foreign'): void {
    this.assertOpen()
    if (!this.modules.has(definition.id)) {
      throw new Error(`Runtime module is not registered: ${definition.id}`)
    }
    this.modules.set(definition.id, { ...definition, origin })
  }

  /** Prevents capability changes after the CodPlay instance starts using the catalog. */
  lock(): void {
    this.locked = true
  }

  /** Reports whether the registration boundary is closed. */
  isLocked(): boolean {
    return this.locked
  }

  /** Returns one component definition by its compiled type. */
  getComponent(type: string): RuntimeComponentDefinition | undefined {
    return this.components.get(type)
  }

  /** Returns one service definition by its data namespace. */
  getService(name: string): RuntimeComponentServiceDefinition | undefined {
    return this.services.get(name)
  }

  /** Returns one module definition by its capability ID. */
  getModule(id: string): RuntimeModuleServiceDefinition | undefined {
    return this.modules.get(id)
  }

  /** Reports whether one component type is available. */
  hasComponent(type: string): boolean {
    return this.components.has(type)
  }

  /** Returns the parts a component type is allowed to publish as mount targets. */
  getMountablePartIds(type: string): readonly string[] {
    return this.components.get(type)?.mountableParts ?? []
  }

  /** Reports whether one service namespace is available. */
  hasService(name: string): boolean {
    return this.services.has(name)
  }

  /** Reports whether one module capability is available. */
  hasModule(id: string): boolean {
    return this.modules.has(id)
  }

  /** Returns definitions in deterministic registration order for diagnostics and setup. */
  getComponents(): readonly RuntimeComponentDefinition[] {
    return [...this.components.values()]
  }

  /** Returns service definitions in deterministic registration order. */
  getServices(): readonly RuntimeComponentServiceDefinition[] {
    return [...this.services.values()]
  }

  /** Returns module definitions in deterministic registration order. */
  getModules(): readonly RuntimeModuleServiceDefinition[] {
    return [...this.modules.values()]
  }

  /** Creates the pure validation view consumed by SceneBuilder. */
  validationSnapshot(): CapabilityValidationSnapshot {
    return {
      components: new Map([...this.components.entries()].map(([type, definition]) => [type, {
        type: definition.type,
        services: [...definition.services],
        modules: [...definition.modules],
        validateInitial: definition.validateInitial,
        validateAction: definition.validateAction,
      }])),
      services: new Map([...this.services.entries()].map(([name, definition]) => [name, toValidationDefinition(definition)])),
    }
  }

  /** Creates one component with only the services declared by its type. */
  createComponent(
    type: string,
    input: Omit<ComponentInput<Record<string, unknown>>, 'services'>,
    identity: RuntimeComponentIdentity,
    materializer: RuntimeMaterializer,
    modules: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  ): BaseComponent<Record<string, unknown>> {
    const definition = this.requireComponent(type)
    const services = this.bindDeclaredServices(definition, identity, materializer, modules)
    return definition.create({ ...input, services })
  }

  /** Creates a facade that routes one complete component patch to its declared services. */
  private bindDeclaredServices(
    definition: RuntimeComponentDefinition,
    identity: RuntimeComponentIdentity,
    materializer: RuntimeMaterializer,
    modules: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  ): ComponentServices {
    const services = new Map<string, RuntimeComponentServiceInstance>()
    for (const name of definition.services) {
      const service = this.services.get(name)
      if (service === undefined) throw new Error(`Runtime component service is not registered: ${name}`)
      if (!service.materializers.includes(materializer.id)) {
        throw new Error(`Runtime service "${name}" is not available for materializer "${materializer.id}"`)
      }
      services.set(name, service.create({
        ...identity,
        materializerId: materializer.id,
        materializerContext: materializer.context,
      }))
    }
    for (const moduleId of definition.modules) {
      if (!modules.has(moduleId)) throw new Error(`Runtime component module is not available: ${moduleId}`)
    }

    return {
      apply: (node, patch) => {
        for (const name of definition.services) {
          const value = patch[name]
          if (value !== undefined) services.get(name)?.apply(node, value)
        }
      },
    }
  }

  /** Returns a registered component or raises a capability error. */
  private requireComponent(type: string): RuntimeComponentDefinition {
    const definition = this.components.get(type)
    if (definition === undefined) throw new Error(`Runtime component factory is not registered: ${type}`)
    return definition
  }

  /** Prevents registration after the CodPlay instance has been consumed. */
  private assertOpen(): void {
    if (this.locked) throw new Error('Runtime capability catalog is locked.')
  }
}

/** Removes runtime factories and materializer destinations from validation snapshots. */
function toValidationDefinition(definition: RuntimeComponentServiceDefinition): ServiceValidationDefinition {
  const { name, validate, properties, allowUnknownProperties, sanitizeMarkupAttribute } = definition
  return { name, validate, properties, allowUnknownProperties, sanitizeMarkupAttribute }
}

export type { PropertyValidationDefinition, ServiceValidationDefinition, ValidationFunction }
