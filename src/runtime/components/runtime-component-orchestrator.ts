import type { AnimationResolvedAction } from '../../animation/types'
import type { RuntimeElementMap, StoryDoc } from '../types'
import type { MoveCommand } from '../types'
import { isDomNode } from './dom-component-adapter'
import { ImageRuntimeComponent } from './image-runtime-component'
import { ListRuntimeComponent } from './list-runtime-component'
import { TextRuntimeComponent } from './text-runtime-component'
import type {
  RuntimeComponent,
  RuntimeComponentClass,
  RuntimeComponentWarningReporter,
  RuntimeListComponent,
  RuntimeRegistryCommandResult,
  RuntimeRegistrySnapshot,
  RuntimeResolvedUpdate,
  RuntimeUpdateRoutingResult
} from './types'

const DEFAULT_COMPONENT_CLASSES: Record<string, RuntimeComponentClass> = {
  text: TextRuntimeComponent,
  img: ImageRuntimeComponent,
  list: ListRuntimeComponent
}

/**
 * Checks whether one move payload already matches the V1 move contract.
 */
function isMoveCommand(value: unknown): value is MoveCommand {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const move = value as { parentId?: unknown }
  return typeof move.parentId === 'string' && move.parentId.length > 0
}

/**
 * Builds one runtime map entry for a component root node.
 */
function toRuntimeElementMap(
  componentByPersoId: Map<string, RuntimeComponent>,
  nodeByPersoId: Map<string, unknown>
): RuntimeElementMap {
  const runtimeElements: RuntimeElementMap = new Map()

  for (const [persoId] of componentByPersoId) {
    runtimeElements.set(persoId, {
      runtimeItemId: persoId,
      nodeRef: nodeByPersoId.get(persoId),
      plugins: undefined
    })
  }

  return runtimeElements
}

/**
 * Implements component instantiation, registry management, and move routing.
 */
export class RuntimeComponentOrchestrator {
  private readonly warn: RuntimeComponentWarningReporter

  private readonly componentClassByType = new Map<string, RuntimeComponentClass>()
  private readonly componentByPersoId = new Map<string, RuntimeComponent>()
  private readonly nodeByPersoId = new Map<string, unknown>()
  private readonly listByPersoId = new Map<string, RuntimeListComponent>()
  private readonly parentListByPersoId = new Map<string, string | null>()
  private readonly mountedByPersoId = new Map<string, boolean>()

  private createElementOptions: import('../create-element').CreateElementOptions | undefined

  /**
   * Creates one component orchestrator with default built-in components.
   */
  constructor(input: {
    warn: RuntimeComponentWarningReporter
    createElementOptions?: import('../create-element').CreateElementOptions
  }) {
    this.warn = input.warn
    this.createElementOptions = input.createElementOptions

    for (const [persoType, componentClass] of Object.entries(DEFAULT_COMPONENT_CLASSES)) {
      this.componentClassByType.set(persoType, componentClass)
    }
  }

  /**
   * Updates runtime node factory options used for future component creation.
   */
  setCreateElementOptions(
    createElementOptions: import('../create-element').CreateElementOptions | undefined
  ): void {
    this.createElementOptions = createElementOptions
  }

  /**
   * Registers one component class for one perso type when not already present.
   */
  registerComponent(persoType: string, componentClass: RuntimeComponentClass): RuntimeRegistryCommandResult {
    if (this.componentClassByType.has(persoType)) {
      return {
        ok: true,
        status: 'ignored',
        code: 'RUNTIME_COMPONENT_TYPE_ALREADY_REGISTERED'
      }
    }

    this.componentClassByType.set(persoType, componentClass)
    return {
      ok: true,
      status: 'registered'
    }
  }

  /**
   * Overrides one component class for one perso type.
   */
  overrideComponent(persoType: string, componentClass: RuntimeComponentClass): RuntimeRegistryCommandResult {
    this.componentClassByType.set(persoType, componentClass)
    return {
      ok: true,
      status: 'overridden'
    }
  }

  /**
   * Loads one story by instantiating one component for each declared item.
   */
  loadStory(story: StoryDoc): RuntimeElementMap {
    this.componentByPersoId.clear()
    this.nodeByPersoId.clear()
    this.listByPersoId.clear()
    this.parentListByPersoId.clear()
    this.mountedByPersoId.clear()

    for (const item of Object.values(story.items)) {
      const componentClass = this.componentClassByType.get(item.type)
      if (!componentClass) {
        this.warn({
          code: 'AUTHOR_COMPONENT_TYPE_UNKNOWN',
          message: 'Unknown component type',
          details: {
            itemId: item.id,
            itemType: item.type
          }
        })
        continue
      }

      const component = new componentClass({
        item,
        createElementOptions: this.createElementOptions,
        warn: this.warn
      })

      component.init(item.initial)
      const rootNode = component.render()

      this.componentByPersoId.set(item.id, component)
      this.nodeByPersoId.set(item.id, rootNode)
      this.parentListByPersoId.set(item.id, null)
      this.mountedByPersoId.set(item.id, false)

      if (item.type === 'list' && this.isRuntimeListComponent(component)) {
        this.listByPersoId.set(item.id, component)
      }
    }

    for (const item of Object.values(story.items)) {
      const initialMove = this.normalizeMoveCommand(item.initial.move, true)
      if (initialMove === null) {
        continue
      }

      this.applyMoveForPerso({
        persoId: item.id,
        move: initialMove,
        eventId: 'init',
        eventSeq: 0
      })
    }

    return toRuntimeElementMap(this.componentByPersoId, this.nodeByPersoId)
  }

  /**
   * Destroys current runtime maps and returns empty runtime elements.
   */
  destroy(): RuntimeElementMap {
    this.componentByPersoId.clear()
    this.nodeByPersoId.clear()
    this.listByPersoId.clear()
    this.parentListByPersoId.clear()
    this.mountedByPersoId.clear()
    return new Map()
  }

  /**
   * Routes resolved updates to component instances and move router.
   */
  routeUpdates(updates: RuntimeResolvedUpdate[]): RuntimeUpdateRoutingResult {
    const animatableActions: AnimationResolvedAction[] = []
    let appliedActionsCount = 0

    for (const update of updates) {
      const targetPersoId = this.resolveTargetPersoId(update.resolvedAction)
      const component = this.componentByPersoId.get(targetPersoId)
      if (!component) {
        this.warn({
          code: 'RUNTIME_COMPONENT_NODE_NOT_FOUND',
          message: 'Cannot route update to missing component instance',
          details: {
            targetPersoId,
            eventId: update.resolvedAction.eventId,
            eventSeq: update.eventSeq
          }
        })
        continue
      }

      const moveCommand = this.normalizeMoveCommand(update.resolvedAction.action.move, false)
      if (moveCommand !== null) {
        this.applyMoveForPerso({
          persoId: targetPersoId,
          move: moveCommand,
          eventId: update.resolvedAction.eventId,
          eventSeq: update.eventSeq
        })
      }

      component.update({
        persoId: targetPersoId,
        eventId: update.resolvedAction.eventId,
        eventSeq: update.eventSeq,
        action: update.resolvedAction.action as Record<string, unknown>
      })

      const targetNode = this.nodeByPersoId.get(targetPersoId)
      if (targetNode !== undefined) {
        animatableActions.push({
          ...update.resolvedAction,
          action: {
            ...update.resolvedAction.action,
            target: targetNode
          }
        })
      }

      appliedActionsCount += 1
    }

    return {
      appliedActionsCount,
      animatableActions
    }
  }

  /**
   * Exposes one stable runtime registry used by renderer/player integration.
   */
  getRuntimeRegistrySnapshot(): RuntimeRegistrySnapshot {
    return {
      getNodeById: (persoId) => this.nodeByPersoId.get(persoId) ?? null,
      getComponentById: (persoId) => this.componentByPersoId.get(persoId) ?? null,
      getListById: (persoId) => this.listByPersoId.get(persoId) ?? null,
      getParentListId: (persoId) => this.parentListByPersoId.get(persoId) ?? null,
      setParentListId: (persoId, parentListId) => {
        this.parentListByPersoId.set(persoId, parentListId)
      },
      isMounted: (persoId) => this.mountedByPersoId.get(persoId) ?? false,
      setMounted: (persoId, mounted) => {
        this.mountedByPersoId.set(persoId, mounted)
      }
    }
  }

  /**
   * Returns one runtime elements map view for renderer state snapshots.
   */
  getRuntimeElements(): RuntimeElementMap {
    return toRuntimeElementMap(this.componentByPersoId, this.nodeByPersoId)
  }

  /**
   * Checks whether one component supports list attach/detach routing.
   */
  private isRuntimeListComponent(component: RuntimeComponent): component is RuntimeListComponent {
    return (
      'attachChild' in component &&
      typeof component.attachChild === 'function' &&
      'detachChild' in component &&
      typeof component.detachChild === 'function' &&
      'repositionChild' in component &&
      typeof component.repositionChild === 'function'
    )
  }

  /**
   * Resolves action target id from action targetId override or listener id.
   */
  private resolveTargetPersoId(action: AnimationResolvedAction): string {
    return action.action.targetId ?? action.listenerId
  }

  /**
   * Normalizes move payload into one strict move command.
   */
  private normalizeMoveCommand(rawMove: unknown, isInitialMove: boolean): MoveCommand | null {
    if (!isMoveCommand(rawMove)) {
      return null
    }

    return {
      parentId: rawMove.parentId,
      mode: isInitialMove ? 'append' : rawMove.mode ?? 'append',
      flip: rawMove.flip,
      reorder: rawMove.reorder
    }
  }

  /**
   * Applies one global move command from child component to parent list.
   */
  private applyMoveForPerso(request: {
    persoId: string
    move: MoveCommand
    eventId: string
    eventSeq: number
  }): void {
    const sourceListId = this.parentListByPersoId.get(request.persoId) ?? null
    const sourceList = sourceListId ? this.listByPersoId.get(sourceListId) ?? null : null

    const targetList = this.listByPersoId.get(request.move.parentId) ?? null
    if (targetList === null) {
      if (sourceList !== null) {
        sourceList.detachChild({
          childId: request.persoId,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        })
      }

      this.parentListByPersoId.set(request.persoId, null)
      this.mountedByPersoId.set(request.persoId, false)
      this.warn({
        code: 'RUNTIME_LIST_MOVE_TARGET_NOT_FOUND',
        message: 'Move target list was not found',
        details: {
          persoId: request.persoId,
          parentId: request.move.parentId,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        }
      })
      return
    }

    if (sourceList !== null && sourceList.getPersoId() === targetList.getPersoId()) {
      targetList.repositionChild({
        childId: request.persoId,
        mode: request.move.mode,
        eventId: request.eventId,
        eventSeq: request.eventSeq
      })

      this.parentListByPersoId.set(request.persoId, targetList.getPersoId())
      this.mountedByPersoId.set(request.persoId, true)
      return
    }

    let childNode: unknown | null = null
    if (sourceList !== null) {
      childNode = sourceList.detachChild({
        childId: request.persoId,
        eventId: request.eventId,
        eventSeq: request.eventSeq
      })
    }

    if (childNode === null) {
      childNode = this.nodeByPersoId.get(request.persoId) ?? null
    }

    if (childNode === null) {
      this.parentListByPersoId.set(request.persoId, null)
      this.mountedByPersoId.set(request.persoId, false)
      this.warn({
        code: 'RUNTIME_COMPONENT_NODE_NOT_FOUND',
        message: 'Move source node was not found',
        details: {
          persoId: request.persoId,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        }
      })
      return
    }

    targetList.attachChild({
      childId: request.persoId,
      childNode,
      mode: request.move.mode,
      eventId: request.eventId,
      eventSeq: request.eventSeq
    })

    this.parentListByPersoId.set(request.persoId, targetList.getPersoId())
    this.mountedByPersoId.set(request.persoId, true)
    this.syncDomParentFallback(request.persoId, childNode, targetList)
  }

  /**
   * Applies one non-list fallback parent reference for object runtime nodes.
   */
  private syncDomParentFallback(persoId: string, childNode: unknown, targetList: RuntimeListComponent): void {
    if (isDomNode(childNode)) {
      return
    }

    if (typeof childNode === 'object' && childNode !== null) {
      ;(childNode as Record<string, unknown>).parentId = targetList.getPersoId()
      this.nodeByPersoId.set(persoId, childNode)
    }
  }
}
