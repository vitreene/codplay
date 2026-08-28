import type { ModuleCommandDoc } from '../types'
import type {
  ModuleActionRouteMode,
  ModuleActionTargetMap,
  ModuleBaseConstructorInput,
  ModuleEmit,
  ModuleInitInput,
  ModuleLifecycleStatus,
  ModuleRenderInput,
  ModuleTechnicalEvent,
  ModuleUpdateInput,
  RuntimeModule
} from './types'

/**
 * Provides one shared lifecycle skeleton for custom runtime modules.
 */
export abstract class ModuleBase<TModuleConfig = Record<string, unknown>, TNodeRef = unknown>
implements RuntimeModule {
  protected readonly runtimeItemId: string
  protected readonly itemType: string
  protected readonly moduleConfig?: TModuleConfig
  protected rootNode: TNodeRef | undefined

  private readonly emitFn: ModuleEmit
  private status: ModuleLifecycleStatus

  /**
   * Creates one base module instance bound to one runtime item.
   */
  protected constructor(input: ModuleBaseConstructorInput<TModuleConfig, TNodeRef>) {
    this.runtimeItemId = input.runtimeItemId
    this.itemType = input.itemType
    this.rootNode = input.initialRootNode
    this.moduleConfig = input.moduleConfig
    this.emitFn = input.emit
    this.status = 'created'
  }

  /**
   * Initializes module state before start.
   */
  init(input: ModuleInitInput = {}): void {
    void input
    this.ensureNotDestroyed('init')
    this.status = 'initialized'
  }

  /**
   * Starts module runtime behavior.
   */
  start(): void {
    this.ensureNotDestroyed('start')
    this.status = 'started'
  }

  /**
   * Applies one module command from item actions.
   */
  update(input: ModuleUpdateInput): void {
    this.ensureNotDestroyed('update')
    this.onCommand(input.command, input.nowMs)
  }

  /**
   * Renders one frame-level update when needed.
   */
  render(input: ModuleRenderInput = {}): unknown {
    void input
    this.ensureNotDestroyed('render')
    return this.rootNode
  }

  /**
   * Receives one targeted technical event routed by player.
   */
  onTechnicalEvent(event: ModuleTechnicalEvent): void {
    this.ensureNotDestroyed('onTechnicalEvent')
    void event
    return
  }

  /**
   * Exposes how player should route standard actions for this module.
   */
  getActionRouteMode(): ModuleActionRouteMode {
    return 'root-only'
  }

  /**
   * Exposes optional internal target nodes addressable by player actions.
   */
  getActionTargets(): ModuleActionTargetMap {
    return {}
  }

  /**
   * Resolves one action target id to one concrete node when supported.
   */
  resolveActionTarget(targetId: string): unknown | null {
    void targetId
    return null
  }

  /**
   * Destroys module resources and stops lifecycle usage.
   */
  destroy(): void {
    if (this.status === 'destroyed') {
      return
    }

    this.status = 'destroyed'
  }

  /**
   * Handles one command in subclasses.
   */
  protected abstract onCommand(cmd: ModuleCommandDoc, nowMs?: number): void

  /**
   * Sets one root node reference managed by the module.
   */
  protected setRootNode(node: TNodeRef): void {
    this.rootNode = node
  }

  /**
   * Returns one root node reference when available.
   */
  protected getRootNode(): TNodeRef | undefined {
    return this.rootNode
  }

  /**
   * Emits one global runtime event from the module.
   */
  protected emit(eventName: string, data?: Record<string, unknown>): void {
    this.ensureNotDestroyed('emit')
    this.emitFn({
      name: eventName,
      data
    })
  }

  /**
   * Returns current lifecycle status for diagnostics.
   */
  protected getStatus(): ModuleLifecycleStatus {
    return this.status
  }

  /**
   * Rejects calls when module was already destroyed.
   */
  private ensureNotDestroyed(methodName: string): void {
    if (this.status === 'destroyed') {
      throw new Error(`Module ${this.itemType}/${this.runtimeItemId} is destroyed. Method=${methodName}`)
    }
  }
}
