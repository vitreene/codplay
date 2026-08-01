import type { CompiledScene } from '../../scene/compiled'
import type { MoveStateDelta } from '../move'
import type { SolvedScene } from '../player/pipeline/types'

/** Context supplied when one module instance is created for a player. */
export type RuntimeModuleServiceContext = Readonly<{
  playerId: string
  compiledScene: CompiledScene
}>

/** Runtime hooks available to a stateful module instance. */
export type RuntimeModuleServiceSeekHandle = Readonly<{
  commit: () => void
  abort?: () => void
}>

/** Runtime hooks available to a stateful module instance. */
export type RuntimeModuleServiceInstance = Readonly<{
  initializeScene?: (scene: SolvedScene) => void
  prepareSeek?: (scene: SolvedScene) => RuntimeModuleServiceSeekHandle
  onMoveDelta?: (delta: MoveStateDelta) => void
  destroy?: () => void
}>

/** Engine-level module definition that creates one instance per player. */
export type RuntimeModuleServiceDefinition = Readonly<{
  id: string
  create: (context: RuntimeModuleServiceContext) => RuntimeModuleServiceInstance
}>

/** Registry of runtime module-service definitions shared by one engine. */
export class RuntimeModuleServiceCatalog {
  private readonly definitions = new Map<string, RuntimeModuleServiceDefinition>()

  /** Registers one module definition and rejects duplicate IDs. */
  register(definition: RuntimeModuleServiceDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Runtime module service already registered: ${definition.id}`)
    }
    this.definitions.set(definition.id, definition)
  }

  /** Indicates whether a module definition is available to the engine. */
  has(id: string): boolean {
    return this.definitions.has(id)
  }

  /** Creates one player-scoped module instance. */
  create(id: string, context: RuntimeModuleServiceContext): RuntimeModuleServiceInstance {
    const definition = this.definitions.get(id)
    if (definition === undefined) throw new Error(`Runtime module service is not registered: ${id}`)
    return definition.create(context)
  }

  /** Returns registered definitions in registration order. */
  getAll(): readonly RuntimeModuleServiceDefinition[] {
    return [...this.definitions.values()]
  }
}
