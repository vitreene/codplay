import type { AnimationResolvedAction } from '../../animation/types'
import type { TransitionRequest } from '../../animation/types'
import { createListFlipModule } from '../modules/list-flip'
import { RUNTIME_CONFIG } from '../config'
import type { ItemDoc, RuntimeElementMap, RuntimePersos } from '../types'
import type { MoveCommand, MoveFlipMode } from '../types'
import type { RenderMutationResolver } from '../render-mutation-resolver'
import { isDomNode } from './lib/dom-component-adapter'
import { LayoutComponent } from './layout-component'
import { ImageComponent } from './image-component'
import { ListComponent } from './list-component'
import { MediaComponent } from './media-component'
import { TextComponent } from './text-component'
import type {
  RuntimeComponent,
  RuntimeComponentClass,
  RuntimeComponentWarningReporter,
  RuntimeLayoutComponent,
  RuntimeListComponent,
  RuntimeRegistryCommandResult,
  RuntimeRegistrySnapshot,
  RuntimeResolvedUpdate,
  RuntimeUpdateRoutingResult
} from './types'

const DEFAULT_COMPONENT_CLASSES: Record<string, RuntimeComponentClass> = {
  text: TextComponent,
  img: ImageComponent,
  media: MediaComponent,
  list: ListComponent,
  layout: LayoutComponent
}

const INITIAL_LOAD_EVENT = {
  id: 'init',
  seq: 0
} as const

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
 * Resolves one strict move FLIP mode from authored payload.
 */
function normalizeMoveFlipMode(rawFlipMode: unknown): MoveFlipMode {
  return rawFlipMode === 'overlay-world' ? 'overlay-world' : 'local'
}

/**
 * Checks whether one raw move payload targets the story host alias.
 */
function isStoryHostMove(rawMove: unknown): boolean {
  if (rawMove === RUNTIME_CONFIG.move.rootToken) {
    return true
  }

  if (typeof rawMove !== 'object' || rawMove === null) {
    return false
  }

  const move = rawMove as { parentId?: unknown }
  return move.parentId === RUNTIME_CONFIG.move.rootToken
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
  private readonly warningKeys = new Set<string>()
  private readonly listFlipModule = createListFlipModule({
    warnOnce: (eventSeq, code, details, persoId) => {
      this.warnOnce(eventSeq, code, details, persoId)
    },
    getNodeById: (persoId) => this.nodeByPersoId.get(persoId) ?? null,
    getListById: (persoId) => this.listByPersoId.get(persoId) ?? null,
    getParentListId: (persoId) => this.parentListByPersoId.get(persoId) ?? null,
    isMounted: (persoId) => this.mountedByPersoId.get(persoId) ?? false
  })

  private readonly componentClassByType = new Map<string, RuntimeComponentClass>()
  private readonly renderMutationResolverByType = new Map<string, RenderMutationResolver>()
  private readonly componentByPersoId = new Map<string, RuntimeComponent>()
  private readonly nodeByPersoId = new Map<string, unknown>()
  private readonly listByPersoId = new Map<string, RuntimeListComponent>()
  private readonly parentListByPersoId = new Map<string, string | null>()
  private readonly mountedByPersoId = new Map<string, boolean>()
  private readonly renderMutationResolverByPersoId = new Map<string, RenderMutationResolver>()
  private readonly layoutOutletIdsByLayoutId = new Map<string, string[]>()
  private readonly storyIdByPersoId = new Map<string, string>()
  private readonly storyEntriesByStoryId = new Map<string, string[]>()
  private readonly storyMoveByStoryId = new Map<string, unknown>()
  private readonly storyHostNodeByStoryId = new Map<string, unknown>()

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
      this.setComponentClass(persoType, componentClass)
    }
  }

  /**
   * Registers one component class and its optional mutation resolver.
   */
  private setComponentClass(persoType: string, componentClass: RuntimeComponentClass): void {
    this.componentClassByType.set(persoType, componentClass)

    if (componentClass.renderMutationResolver) {
      this.renderMutationResolverByType.set(persoType, componentClass.renderMutationResolver)
      return
    }

    this.renderMutationResolverByType.delete(persoType)
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

    this.setComponentClass(persoType, componentClass)
    return {
      ok: true,
      status: 'registered'
    }
  }

  /**
   * Overrides one component class for one perso type.
   */
  overrideComponent(persoType: string, componentClass: RuntimeComponentClass): RuntimeRegistryCommandResult {
    this.setComponentClass(persoType, componentClass)
    return {
      ok: true,
      status: 'overridden'
    }
  }

  /**
   * Synchronizes one runtime perso graph without purging the existing registry.
   */
  loadPersos(runtimePersos: RuntimePersos): RuntimeElementMap {
    this.listFlipModule.cleanup()
    this.storyEntriesByStoryId.clear()
    this.storyMoveByStoryId.clear()

    for (const [storyId, entryIds] of Object.entries(runtimePersos.entriesByStoryId ?? {})) {
      this.storyEntriesByStoryId.set(storyId, [...entryIds])
    }

    for (const [storyId, rawMove] of Object.entries(runtimePersos.storyMovesByStoryId ?? {})) {
      this.storyMoveByStoryId.set(storyId, rawMove)
    }

    for (const item of Object.values(runtimePersos.persos)) {
      const existingComponent = this.componentByPersoId.get(item.id)
      if (existingComponent) {
        this.refreshLoadedRuntimeComponent(item, existingComponent)
        continue
      }

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

      this.mountLoadedRuntimeComponent(item, componentClass)
    }

    this.mountStoryHosts(runtimePersos)

    for (const item of Object.values(runtimePersos.persos)) {
      const storyEntries = this.storyEntriesByStoryId.get(item.storyId) ?? []
      const isStoryEntry = storyEntries.includes(item.id)
      const rawInitialMove = item.initial.move

      if (isStoryEntry && (rawInitialMove === undefined || isStoryHostMove(rawInitialMove))) {
        continue
      }

      const initialMove = this.normalizeMoveCommand(item.initial.move, true)
      if (initialMove === null) {
        continue
      }

      this.applyMoveForPerso({
        persoId: item.id,
        move: initialMove,
        eventId: INITIAL_LOAD_EVENT.id,
        eventSeq: INITIAL_LOAD_EVENT.seq
      })
    }

    this.mountStoryEntriesToStoryHosts(runtimePersos)

    return toRuntimeElementMap(this.componentByPersoId, this.nodeByPersoId)
  }

  /**
   * Refreshes one already-mounted runtime component in place.
   */
  private refreshLoadedRuntimeComponent(item: ItemDoc, component: RuntimeComponent): void {
    const previousRootNode = this.nodeByPersoId.get(item.id) ?? null
    const nextRootNode = this.tryInitComponent(item, component, 'refresh')
    if (nextRootNode === null) {
      return
    }

    if (previousRootNode !== null) {
      this.detachNodeFromParent(previousRootNode)
    }

    const isListComponent = this.isRuntimeListComponent(component)
    const listComponent = isListComponent ? (component as RuntimeListComponent) : null

    if (!isListComponent) {
      this.detachNodeFromParent(nextRootNode)
    }

    this.storeLoadedRuntimeComponent(item, component, nextRootNode, listComponent)
  }

  /**
   * Instantiates one new runtime component and stores its runtime maps.
   */
  private mountLoadedRuntimeComponent(item: ItemDoc, componentClass: RuntimeComponentClass): void {
    const component = new componentClass({
      item,
      createElementOptions: this.createElementOptions,
      warn: this.warn
    })

    const rootNode = this.tryInitComponent(item, component, 'mount')
    if (rootNode === null) {
      return
    }

    const listComponent = item.type === 'list' && this.isRuntimeListComponent(component) ? component : null

    if (listComponent === null) {
      this.detachNodeFromParent(rootNode)
    }

    this.storeLoadedRuntimeComponent(item, component, rootNode, listComponent)
  }

  /**
   * Writes one runtime component snapshot into registry maps.
   */
  private storeLoadedRuntimeComponent(
    item: ItemDoc,
    component: RuntimeComponent,
    rootNode: unknown,
    listComponent: RuntimeListComponent | null
  ): void {
    this.clearLayoutOutlets(item.id)
    this.componentByPersoId.set(item.id, component)
    this.nodeByPersoId.set(item.id, rootNode)
    this.parentListByPersoId.set(item.id, null)
    this.mountedByPersoId.set(item.id, listComponent !== null)
    this.storyIdByPersoId.set(item.id, item.storyId)

    if (listComponent !== null) {
      this.listByPersoId.set(item.id, listComponent)
    } else {
      this.listByPersoId.delete(item.id)
    }

    const resolver = this.renderMutationResolverByType.get(item.type)
    if (resolver) {
      this.renderMutationResolverByPersoId.set(item.id, resolver)
    } else if (this.renderMutationResolverByPersoId.has(item.id)) {
      this.renderMutationResolverByPersoId.delete(item.id)
    }

    if (this.isRuntimeLayoutComponent(component)) {
      this.registerLayoutOutlets(item.id, component)
    }
  }

  /**
   * Destroys current runtime maps and returns empty runtime elements.
   */
  destroy(): RuntimeElementMap {
    this.listFlipModule.cleanup()
    this.componentByPersoId.clear()
    this.nodeByPersoId.clear()
    this.listByPersoId.clear()
    this.parentListByPersoId.clear()
    this.mountedByPersoId.clear()
    this.renderMutationResolverByPersoId.clear()
    this.layoutOutletIdsByLayoutId.clear()
    this.storyIdByPersoId.clear()
    this.storyEntriesByStoryId.clear()
    this.storyMoveByStoryId.clear()
    this.storyHostNodeByStoryId.clear()
    return new Map()
  }

  /**
   * Routes resolved updates to component instances and move router.
   */
  routeUpdates(updates: RuntimeResolvedUpdate[]): RuntimeUpdateRoutingResult {
    this.warningKeys.clear()
    const animatableActions: AnimationResolvedAction[] = []
    const directTransitions: TransitionRequest[] = []
    let appliedActionsCount = 0
    const moveDecisionsByUpdateIndex = this.resolveMoveDecisions(updates)

    for (const [updateIndex, update] of updates.entries()) {
      if (
        this.routeResolvedUpdate({
          update,
          moveDecision: moveDecisionsByUpdateIndex.get(updateIndex),
          animatableActions,
          directTransitions
        })
      ) {
        appliedActionsCount += 1
      }
    }

    return {
      appliedActionsCount,
      animatableActions,
      directTransitions
    }
  }

  /**
   * Routes one resolved update to a runtime component and collect outputs.
   */
  private routeResolvedUpdate(input: {
    update: RuntimeResolvedUpdate
    moveDecision: MoveCommand | null | undefined
    animatableActions: AnimationResolvedAction[]
    directTransitions: TransitionRequest[]
  }): boolean {
    const targetPersoId = this.resolveTargetPersoId(input.update.resolvedAction)
    const component = this.componentByPersoId.get(targetPersoId)
    if (!component) {
      this.warnOnce(
        input.update.eventSeq,
        'RUNTIME_COMPONENT_NODE_NOT_FOUND',
        {
          targetPersoId,
          eventId: input.update.resolvedAction.eventId,
          eventSeq: input.update.eventSeq
        },
        targetPersoId
      )
      return false
    }

    const moveDecision = input.moveDecision ?? null
    const flipSession =
      moveDecision !== null
        ? this.listFlipModule.prepareMove({
            persoId: targetPersoId,
            move: moveDecision,
            eventId: input.update.resolvedAction.eventId,
            eventName: input.update.resolvedAction.eventName,
            eventSeq: input.update.eventSeq
          })
        : null

    if (moveDecision !== null) {
      this.applyMoveForPerso({
        persoId: targetPersoId,
        move: moveDecision,
        eventId: input.update.resolvedAction.eventId,
        eventSeq: input.update.eventSeq
      })
    }

    if (!this.tryUpdateComponent(component, {
      persoId: targetPersoId,
      eventId: input.update.resolvedAction.eventId,
      eventSeq: input.update.eventSeq,
      action: input.update.resolvedAction.action as Record<string, unknown>
    })) {
      return false
    }

    if (flipSession !== null) {
      input.directTransitions.push(...flipSession.commit())
    }

    const targetNode = this.nodeByPersoId.get(targetPersoId)
    if (targetNode !== undefined) {
      input.animatableActions.push({
        ...input.update.resolvedAction,
        action: {
          ...input.update.resolvedAction.action,
          target: targetNode
        }
      })
    }

    return true
  }

  /**
   * Initializes one component behind one global runtime warning boundary.
   */
  private tryInitComponent(item: ItemDoc, component: RuntimeComponent, phase: 'mount' | 'refresh'): unknown | null {
    try {
      component.init(item.initial)
      return component.render()
    } catch (error) {
      this.warn({
        code: 'RUNTIME_COMPONENT_INIT_FAILED',
        message: 'Component init failed',
        details: {
          itemId: item.id,
          itemType: item.type,
          phase,
          error: error instanceof Error ? error.message : 'unknown_error'
        }
      })
      return null
    }
  }

  /**
   * Updates one component behind one global runtime warning boundary.
   */
  private tryUpdateComponent(component: RuntimeComponent, input: {
    persoId: string
    eventId: string
    eventSeq: number
    action: Record<string, unknown>
  }): boolean {
    try {
      component.update(input)
      return true
    } catch (error) {
      this.warnOnce(
        input.eventSeq,
        'RUNTIME_COMPONENT_UPDATE_FAILED',
        {
          persoId: input.persoId,
          eventId: input.eventId,
          eventSeq: input.eventSeq,
          error: error instanceof Error ? error.message : 'unknown_error'
        },
        input.persoId
      )
      return false
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
      getRenderMutationResolverById: (persoId) => this.renderMutationResolverByPersoId.get(persoId) ?? null,
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
   * Returns one registered mutation resolver for one runtime item when available.
   */
  getRenderMutationResolverById(persoId: string): RenderMutationResolver | null {
    return this.renderMutationResolverByPersoId.get(persoId) ?? null
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
   * Checks whether one runtime component exposes the layout outlet bridge contract.
   */
  private isRuntimeLayoutComponent(component: RuntimeComponent): component is RuntimeLayoutComponent {
    return 'getOutletsSnapshot' in component && typeof component.getOutletsSnapshot === 'function'
  }

  /**
   * Clears layout outlet registrations for one layout component id.
   */
  private clearLayoutOutlets(layoutId: string): void {
    const outletIds = this.layoutOutletIdsByLayoutId.get(layoutId)
    if (!outletIds) {
      return
    }

    for (const outletId of outletIds) {
      if (this.nodeByPersoId.get(outletId) !== undefined) {
        this.nodeByPersoId.delete(outletId)
      }
    }

    this.layoutOutletIdsByLayoutId.delete(layoutId)
  }

  /**
   * Registers all outlet containers exposed by one layout component.
   */
  private registerLayoutOutlets(layoutId: string, layoutComponent: RuntimeLayoutComponent): void {
    const registeredOutletIds: string[] = []

    for (const outlet of layoutComponent.getOutletsSnapshot()) {
      const outletId = outlet.outletId
      if (
        this.componentByPersoId.has(outletId) ||
        this.nodeByPersoId.has(outletId) ||
        this.listByPersoId.has(outletId)
      ) {
        this.warn({
          code: 'AUTHOR_LAYOUT_OUTLET_ID_COLLISION',
          message: 'Layout outlet id collides with an existing runtime id',
          details: {
            layoutId,
            outletId
          }
        })
        continue
      }

      this.nodeByPersoId.set(outletId, outlet.nodeRef)
      registeredOutletIds.push(outletId)
    }

    this.layoutOutletIdsByLayoutId.set(layoutId, registeredOutletIds)
  }

  /**
   * Checks whether one runtime node is inside one SVG context.
   */
  private isSvgNode(nodeRef: unknown): boolean {
    if (typeof globalThis.Element !== 'undefined' && isDomNode(nodeRef) && nodeRef instanceof globalThis.Element) {
      return nodeRef.namespaceURI === 'http://www.w3.org/2000/svg' || nodeRef.tagName.toLowerCase() === 'svg'
    }

    if (typeof nodeRef !== 'object' || nodeRef === null) {
      return false
    }

    const node = nodeRef as { namespaceURI?: unknown; tagName?: unknown }
    return node.namespaceURI === 'http://www.w3.org/2000/svg' || node.tagName === 'svg'
  }

  /**
   * Checks whether one child node can be attached to one target node.
   */
  private canAttachChildToNode(targetNode: unknown, childNode: unknown): boolean {
    if (!this.isSvgNode(targetNode)) {
      return true
    }

    return this.isSvgNode(childNode)
  }

  /**
   * Creates one synthetic host node used to mount one story instance.
   */
  private createStoryHostNode(storyId: string, useDomNode: boolean): unknown {
    if (useDomNode && typeof globalThis.document !== 'undefined') {
      const hostNode = globalThis.document.createElement('div')
      hostNode.id = storyId
      return hostNode
    }

    return {
      tagName: 'DIV',
      id: storyId,
      style: {},
      attributes: {},
      children: []
    }
  }

  /**
   * Resolves one synthetic host node for one story instance.
   */
  private resolveStoryHostNode(storyId: string, childNode?: unknown): unknown {
    const existingHostNode = this.storyHostNodeByStoryId.get(storyId)
    if (existingHostNode !== undefined) {
      return existingHostNode
    }

    const hostNode = this.createStoryHostNode(storyId, isDomNode(childNode))
    this.storyHostNodeByStoryId.set(storyId, hostNode)
    return hostNode
  }

  /**
   * Resolves one explicit parent node for one story host mount.
   */
  private resolveStoryMountTargetNode(parentId: string): unknown | null {
    if (parentId === RUNTIME_CONFIG.move.rootToken) {
      return null
    }

    return this.nodeByPersoId.get(parentId) ?? null
  }

  /**
   * Mounts story hosts into declared parent outlets before child entries.
   */
  private mountStoryHosts(runtimePersos: RuntimePersos): void {
    for (const [storyId, rawMove] of Object.entries(runtimePersos.storyMovesByStoryId ?? {})) {
      const move = this.normalizeMoveCommand(rawMove, true)
      if (move === null) {
        continue
      }

      const targetNode = this.resolveStoryMountTargetNode(move.parentId)
      if (targetNode === null) {
        continue
      }

      const hostNode = this.resolveStoryHostNode(storyId, targetNode)
      this.appendNodeToParent(targetNode, hostNode)
    }
  }

  /**
   * Resolves one parent node target from one move parent identifier.
   */
  private resolveMoveTargetNode(parentId: string, storyId: string | null, childNode?: unknown): unknown | null {
    if (parentId === RUNTIME_CONFIG.move.rootToken) {
      return storyId === null ? null : this.resolveStoryHostNode(storyId, childNode)
    }

    return this.nodeByPersoId.get(parentId) ?? null
  }

  /**
   * Mounts the root entries of each story into their synthetic hosts.
   */
  private mountStoryEntriesToStoryHosts(runtimePersos: RuntimePersos): void {
    for (const [storyId, entryIds] of Object.entries(runtimePersos.entriesByStoryId ?? {})) {
      if (entryIds.length === 0) {
        continue
      }

      const hostNode = this.resolveStoryHostNode(storyId, this.nodeByPersoId.get(entryIds[0]))

      for (const entryId of entryIds) {
        const item = runtimePersos.persos[entryId]
        if (item === undefined) {
          continue
        }

        const rawInitialMove = item.initial.move
        if (rawInitialMove !== undefined && !isStoryHostMove(rawInitialMove)) {
          continue
        }

        const entryNode = this.nodeByPersoId.get(entryId)
        if (entryNode === undefined) {
          continue
        }

        this.appendNodeToParent(hostNode, entryNode)
        this.parentListByPersoId.set(entryId, null)
        this.mountedByPersoId.set(entryId, true)
      }
    }
  }

  /**
   * Detaches one node from its current DOM or object parent.
   */
  private detachNodeFromParent(nodeRef: unknown): void {
    if (isDomNode(nodeRef)) {
      const parentNode = nodeRef.parentNode
      if (parentNode !== null && parentNode !== undefined) {
        parentNode.removeChild(nodeRef)
      }

      return
    }

    if (typeof nodeRef !== 'object' || nodeRef === null) {
      return
    }

    const childNode = nodeRef as Record<string, unknown>
    const parentNode = childNode.parentNode
    if (typeof parentNode !== 'object' || parentNode === null) {
      return
    }

    const mutableParent = parentNode as Record<string, unknown>
    const currentChildren = Array.isArray(mutableParent.children) ? mutableParent.children : []
    mutableParent.children = currentChildren.filter((candidate) => candidate !== nodeRef)
    childNode.parentNode = null
  }

  /**
   * Appends one node to one DOM or object parent.
   */
  private appendNodeToParent(parentNode: unknown, childNode: unknown): void {
    if (isDomNode(parentNode) && isDomNode(childNode)) {
      parentNode.appendChild(childNode)
      return
    }

    if (typeof parentNode !== 'object' || parentNode === null || typeof childNode !== 'object' || childNode === null) {
      return
    }

    if (isDomNode(parentNode) || isDomNode(childNode)) {
      return
    }

    const mutableParent = parentNode as Record<string, unknown>
    const mutableChild = childNode as Record<string, unknown>
    const currentChildren = Array.isArray(mutableParent.children) ? mutableParent.children : []
    if (typeof mutableChild.parentNode === 'object' && mutableChild.parentNode !== null) {
      this.detachNodeFromParent(mutableChild)
    }

    mutableParent.children = currentChildren.filter((candidate) => candidate !== childNode).concat([childNode])
    mutableChild.parentNode = parentNode
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
    if (typeof rawMove === 'string') {
      return rawMove.length === 0
        ? null
        : {
            parentId: rawMove,
            mode: isInitialMove ? 'append' : 'append',
            flipMode: 'local'
          }
    }

    if (!isMoveCommand(rawMove)) {
      return null
    }

    return {
      parentId: rawMove.parentId,
      mode: isInitialMove ? 'append' : rawMove.mode ?? 'append',
      flip: rawMove.flip,
      flipMode: normalizeMoveFlipMode((rawMove as { flipMode?: unknown }).flipMode),
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
    const childNode = this.nodeByPersoId.get(request.persoId) ?? null
    const storyId = this.storyIdByPersoId.get(request.persoId) ?? null
    const sourceListId = this.parentListByPersoId.get(request.persoId) ?? null
    const sourceList = sourceListId ? this.listByPersoId.get(sourceListId) ?? null : null

    const targetList = this.listByPersoId.get(request.move.parentId) ?? null
    const targetNode = targetList === null ? this.resolveMoveTargetNode(request.move.parentId, storyId, childNode) : null

    if (targetList === null && targetNode === null) {
      if (sourceList !== null) {
        sourceList.detachChild({
          childId: request.persoId,
          mode: request.move.mode,
          reorder: request.move.reorder,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        })
      }

      this.parentListByPersoId.set(request.persoId, null)
      this.mountedByPersoId.set(request.persoId, false)
      this.warnOnce(
        request.eventSeq,
        'AUTHOR_LAYOUT_OUTLET_NOT_FOUND',
        {
          persoId: request.persoId,
          parentId: request.move.parentId,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        },
        request.persoId
      )
      return
    }

    if (targetList !== null && sourceList !== null && sourceList.getPersoId() === targetList.getPersoId()) {
      targetList.repositionChild({
        childId: request.persoId,
        mode: request.move.mode,
        reorder: request.move.reorder,
        eventId: request.eventId,
        eventSeq: request.eventSeq
      })

      this.parentListByPersoId.set(request.persoId, targetList.getPersoId())
      this.mountedByPersoId.set(request.persoId, true)
      return
    }

    if (targetNode !== null) {
      const movedChildNode = sourceList !== null
        ? sourceList.detachChild({
            childId: request.persoId,
            mode: request.move.mode,
            reorder: request.move.reorder,
            eventId: request.eventId,
            eventSeq: request.eventSeq
          }) ?? childNode
        : childNode

      if (movedChildNode === null) {
        this.parentListByPersoId.set(request.persoId, null)
        this.mountedByPersoId.set(request.persoId, false)
        this.warnOnce(
          request.eventSeq,
          'RUNTIME_COMPONENT_NODE_NOT_FOUND',
          {
            persoId: request.persoId,
            eventId: request.eventId,
            eventSeq: request.eventSeq
          },
          request.persoId
        )
        return
      }

      if (!this.canAttachChildToNode(targetNode, movedChildNode)) {
        this.warnOnce(
          request.eventSeq,
          'AUTHOR_LAYOUT_OUTLET_CHILD_INCOMPATIBLE',
          {
            persoId: request.persoId,
            parentId: request.move.parentId,
            eventId: request.eventId,
            eventSeq: request.eventSeq
          },
          request.persoId
        )
        return
      }

      this.detachNodeFromParent(movedChildNode)
      this.appendNodeToParent(targetNode, movedChildNode)
      this.parentListByPersoId.set(request.persoId, null)
      this.mountedByPersoId.set(request.persoId, true)
      return
    }

    if (targetList !== null) {
      let movedChildNode: unknown | null = null
      if (sourceList !== null) {
        movedChildNode = sourceList.detachChild({
          childId: request.persoId,
          mode: request.move.mode,
          reorder: request.move.reorder,
          eventId: request.eventId,
          eventSeq: request.eventSeq
        })
      }

      if (movedChildNode === null) {
        movedChildNode = childNode
      }

      if (movedChildNode === null) {
        this.parentListByPersoId.set(request.persoId, null)
        this.mountedByPersoId.set(request.persoId, false)
        this.warnOnce(
          request.eventSeq,
          'RUNTIME_COMPONENT_NODE_NOT_FOUND',
          {
            persoId: request.persoId,
            eventId: request.eventId,
            eventSeq: request.eventSeq
          },
          request.persoId
        )
        return
      }

      targetList.attachChild({
        childId: request.persoId,
        childNode: movedChildNode,
        mode: request.move.mode,
        reorder: request.move.reorder,
        eventId: request.eventId,
        eventSeq: request.eventSeq
      })

      this.parentListByPersoId.set(request.persoId, targetList.getPersoId())
      this.mountedByPersoId.set(request.persoId, true)
    }
  }

  /**
   * Emits one warning once per {eventSeq, code, persoId} key.
   */
  private warnOnce(
    eventSeq: number,
    code: string,
    details: Record<string, unknown>,
    persoId?: string
  ): void {
    const key = `${eventSeq}:${code}:${persoId ?? ''}`
    if (this.warningKeys.has(key)) {
      return
    }

    this.warningKeys.add(key)
    this.warn({
      code,
      message: code,
      details
    })
  }

  /**
   * Resolves one move command decision map with same-tick conflict policy.
   */
  private resolveMoveDecisions(updates: RuntimeResolvedUpdate[]): Map<number, MoveCommand | null> {
    const decisions = new Map<number, MoveCommand | null>()
    const candidatesByKey = new Map<
      string,
      Array<{
        updateIndex: number
        eventSeq: number
        eventId: string
        persoId: string
        moveCommand: MoveCommand | null
      }>
    >()

    for (const [updateIndex, update] of updates.entries()) {
      const action = update.resolvedAction.action as Record<string, unknown>
      if (!Object.prototype.hasOwnProperty.call(action, 'move')) {
        continue
      }

      const persoId = this.resolveTargetPersoId(update.resolvedAction)
      const moveCommand = this.normalizeMoveCommand(action.move, false)
      const key = `${update.eventSeq}:${persoId}`
      const candidates = candidatesByKey.get(key) ?? []
      candidates.push({
        updateIndex,
        eventSeq: update.eventSeq,
        eventId: update.resolvedAction.eventId,
        persoId,
        moveCommand
      })
      candidatesByKey.set(key, candidates)
    }

    for (const candidates of candidatesByKey.values()) {
      if (candidates.length === 0) {
        continue
      }

      const first = candidates[0]
      if (first === undefined) {
        continue
      }

      if (candidates.length === 1) {
        decisions.set(first.updateIndex, first.moveCommand)
        if (first.moveCommand === null) {
          this.warnOnce(
            first.eventSeq,
            'AUTHOR_MOVE_COMMAND_INVALID',
            {
              persoId: first.persoId,
              eventId: first.eventId
            },
            first.persoId
          )
        }

        continue
      }

      const last = candidates[candidates.length - 1]
      if (last === undefined) {
        continue
      }

      this.warnOnce(
        last.eventSeq,
        'AUTHOR_MOVE_CONFLICT_SAME_TICK',
        {
          persoId: last.persoId,
          eventId: last.eventId,
          conflictCount: candidates.length
        },
        last.persoId
      )

      if (last.moveCommand === null) {
        for (const candidate of candidates) {
          decisions.set(candidate.updateIndex, null)
        }

        this.warnOnce(
          last.eventSeq,
          'AUTHOR_MOVE_LAST_INVALID_SAME_TICK',
          {
            persoId: last.persoId,
            eventId: last.eventId
          },
          last.persoId
        )
        continue
      }

      for (const candidate of candidates) {
        decisions.set(candidate.updateIndex, candidate.updateIndex === last.updateIndex ? last.moveCommand : null)
      }
    }

    return decisions
  }
}
