import type { ComponentInput } from './component-types'
import type { BaseComponent } from './base-component'
import type { ValidationFunction } from '../../services'

/** Factory that creates one V2 component instance from compiled author data. */
export type RuntimeComponentFactory = (
  input: ComponentInput<Record<string, unknown>>,
) => BaseComponent<Record<string, unknown>>

/** Runtime definition for one component type. */
export type RuntimeComponentDefinition = Readonly<{
  type: string
  services: readonly string[]
  modules: readonly string[]
  validateInitial?: ValidationFunction
  validateAction?: ValidationFunction
  create: RuntimeComponentFactory
  mountableParts?: readonly string[]
}>

/** Player-local catalog that resolves compiled component types to factories. */
export class RuntimeComponentCatalog {
  private readonly definitions = new Map<string, RuntimeComponentDefinition>()

  /** Registers one component factory and rejects duplicate types. */
  register(definition: RuntimeComponentDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Runtime component already registered: ${definition.type}`)
    }
    this.definitions.set(definition.type, definition)
  }

  /** Creates one component instance by its compiled type. */
  create(
    type: string,
    input: ComponentInput<Record<string, unknown>>,
  ): BaseComponent<Record<string, unknown>> {
    const definition = this.definitions.get(type)
    if (definition === undefined) throw new Error(`Runtime component factory is not registered: ${type}`)
    return definition.create(input)
  }

  /** Returns the part IDs that one component type may publish as mount targets. */
  getMountablePartIds(type: string): readonly string[] {
    return this.definitions.get(type)?.mountableParts ?? []
  }

  /** Reports whether one component factory is available. */
  has(type: string): boolean {
    return this.definitions.has(type)
  }

  /** Returns one immutable runtime definition for validation or diagnostics. */
  getDefinition(type: string): RuntimeComponentDefinition | undefined {
    return this.definitions.get(type)
  }

  /** Returns all component capability declarations in registration order. */
  getAll(): readonly RuntimeComponentDefinition[] {
    return [...this.definitions.values()]
  }
}
