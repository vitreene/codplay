import type {
  CapabilityValidationSnapshot,
  ComponentSanitizer,
} from '../../scene/validation/validation-types'
import type {
  PropertyValidationDefinition,
  ServiceValidationDefinition,
  ValidationFunction,
} from '../../services'
import type {
  ServiceRuntimeContext,
  ServiceRuntimeDefinition,
  ServiceRuntimeFactory,
  ServiceRuntimeInstance,
} from '../../services/service-runtime-types'
import type { BaseComponent } from '../components/base-component'
import type {
  ComponentInput,
  ComponentService,
  ComponentServices,
} from '../components/component-types'
import type {
  RuntimeComponentSurfaceMap,
  RuntimeComponentSurfaceProvider,
} from '../components/component-surface-types'
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

/** Service context aliases retained at the runtime catalog boundary. */
export type RuntimeComponentServiceContext = ServiceRuntimeContext
export type RuntimeComponentServiceInstance = ServiceRuntimeInstance
export type RuntimeComponentServiceFactory = ServiceRuntimeFactory
export type RuntimeComponentServiceDefinition = ServiceRuntimeDefinition & Readonly<{
  origin?: RuntimeCapabilityOrigin
}>

/** Constructor that creates one V2 component and exposes its own service declaration. */
export type RuntimeComponentFactory = {
  new (input: never): BaseComponent<Record<string, unknown>>
  readonly declaredServices: readonly string[]
}

/** Input retained as a named alias for code that describes component construction. */
export type RuntimeComponentFactoryInput = ComponentInput<Record<string, unknown>>

/** Unified declaration of one runtime component type. */
export type RuntimeComponentDefinition = Readonly<{
  type: string
  component: RuntimeComponentFactory
  modules: readonly string[]
  /** Validates the complete author-facing initial profile before compilation. */
  validateInitial: ValidationFunction
  validateAction?: ValidationFunction
  /** Sanitizes the initial profile once before it enters CompiledScene. */
  sanitizeInitial?: ComponentSanitizer
  /** Sanitizes one action patch once before it enters CompiledScene. */
  sanitizeAction?: ComponentSanitizer
  /** Publishes typed substrate-neutral operations for a mounted instance. */
  surfaces?: RuntimeComponentSurfaceProvider
  /** Lists the template zones usable as targets; `all` means every data-part. */
  mountableParts?: readonly string[] | 'all'
  /** Resolves the template zones for an instance when their IDs are dynamic. */
  mountablePartResolver?: (identity: RuntimeComponentIdentity) => readonly string[] | 'all'
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
    assertComponentValidator(definition)
    if (this.components.has(definition.type)) {
      throw new Error(`Runtime component already registered: ${definition.type}`)
    }
    this.components.set(definition.type, { ...definition, origin })
  }

  /** Replaces one existing component definition before the instance is locked. */
  overrideComponent(definition: RuntimeComponentDefinition, origin: RuntimeCapabilityOrigin = 'foreign'): void {
    this.assertOpen()
    assertComponentValidator(definition)
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

  /** Resolves the typed surfaces published by one component declaration. */
  getComponentSurfaces(
    type: string,
    component: BaseComponent<Record<string, unknown>>,
  ): Partial<RuntimeComponentSurfaceMap> {
    return this.components.get(type)?.surfaces?.(component) ?? {}
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

  /** Returns which template zones one component type makes available. */
  getMountablePartIds(type: string, identity?: RuntimeComponentIdentity): readonly string[] | 'all' {
    const definition = this.components.get(type)
    if (definition === undefined) return []
    return identity === undefined
      ? definition.mountableParts ?? []
      : definition.mountablePartResolver?.(identity) ?? definition.mountableParts ?? []
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
        services: [...definition.component.declaredServices],
        modules: [...definition.modules],
        validateInitial: definition.validateInitial,
        validateAction: definition.validateAction,
        sanitizeInitial: definition.sanitizeInitial,
        sanitizeAction: definition.sanitizeAction,
      }])),
      services: new Map([...this.services.entries()].map(([name, definition]) => [name, toValidationDefinition(definition)])),
    }
  }

  /** Creates one component whose own declaration resolves services for the selected materializer. */
  createComponent(
    type: string,
    input: Omit<ComponentInput<Record<string, unknown>>, 'services'>,
    identity: RuntimeComponentIdentity,
    materializer: RuntimeMaterializer,
    modules: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  ): BaseComponent<Record<string, unknown>> {
    const definition = this.requireComponent(type)
    const services = this.createComponentServices(identity, materializer)
    for (const moduleId of definition.modules) {
      if (!modules.has(moduleId)) throw new Error(`Runtime component module is not available: ${moduleId}`)
    }
    const component = new definition.component({ ...input, services } as never)
    assertRuntimeServiceDeclaration(type, services.declaredNames(), definition.component.declaredServices)
    return component
  }

  /** Creates the component-local facade that resolves names through this single catalog. */
  private createComponentServices(
    identity: RuntimeComponentIdentity,
    materializer: RuntimeMaterializer,
  ): ComponentServices & Readonly<{ declaredNames: () => readonly string[] }> {
    const services = new Map<string, RuntimeComponentServiceInstance>()
    const declaredNames: string[] = []

    const declare = (names: readonly string[]): void => {
      for (const name of names) {
        if (declaredNames.includes(name)) {
          throw new Error(`Runtime component service is declared more than once: ${name}`)
        }
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
        declaredNames.push(name)
      }
    }

    return {
      declare,
      get: (name): ComponentService => {
        const service = services.get(name)
        if (service === undefined) throw new Error(`Runtime component service was not declared: ${name}`)
        return service
      },
      apply: (node, patch) => {
        for (const name of declaredNames) {
          const value = patch[name]
          if (value !== undefined) services.get(name)?.apply(node, value)
        }
      },
      declaredNames: () => [...declaredNames],
    }
  }

  /** Returns a registered component or raises a capability error. */
  private requireComponent(type: string): RuntimeComponentDefinition {
    const definition = this.components.get(type)
    if (definition === undefined) throw new Error(`Runtime component class is not registered: ${type}`)
    return definition
  }

  /** Prevents registration after the CodPlay instance has been consumed. */
  private assertOpen(): void {
    if (this.locked) throw new Error('Runtime capability catalog is locked.')
  }
}

/** Rejects a component declaration that cannot validate its initial profile. */
function assertComponentValidator(definition: RuntimeComponentDefinition): void {
  if (typeof definition.validateInitial !== 'function') {
    throw new Error(`Runtime component "${definition.type}" must declare validateInitial.`)
  }
  if (!Array.isArray(definition.component.declaredServices)) {
    throw new Error(`Runtime component "${definition.type}" must declare its services.`)
  }
  if (new Set(definition.component.declaredServices).size !== definition.component.declaredServices.length) {
    throw new Error(`Runtime component "${definition.type}" declares a service more than once.`)
  }
}

/** Verifies that construction used the component's declared services in order. */
function assertRuntimeServiceDeclaration(
  componentType: string,
  actual: readonly string[],
  expected: readonly string[],
): void {
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    throw new Error(`Runtime component "${componentType}" did not declare its services in the expected order.`)
  }
}

/** Removes runtime factories and materializer destinations from validation snapshots. */
function toValidationDefinition(definition: RuntimeComponentServiceDefinition): ServiceValidationDefinition {
  const { name, validate, sanitize, properties, allowUnknownProperties } = definition
  return { name, validate, sanitize, properties, allowUnknownProperties }
}

export type { ComponentSanitizer, PropertyValidationDefinition, ServiceValidationDefinition, ValidationFunction }
