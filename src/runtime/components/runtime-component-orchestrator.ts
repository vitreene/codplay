import type { AnimationResolvedAction } from '../../animation/types'
import type { TransitionRequest } from '../../animation/types'
import type { ItemDoc, RuntimeElementMap, RuntimePersos } from '../types'
import type { MoveCommand, MoveFlipMode } from '../types'
import { createFlipEngine, type FlipEntry, type FlipSnapshot, type FlipTransitionRequest, type Matrix2D } from '../flip-engine'
import { createTranslateMatrix, invertMatrix, multiplyMatrix, parseCssMatrix } from '../flip-engine/matrix-2d'
import type { RenderMutationResolver } from '../render-mutation-resolver'
import { isDomElement, isDomNode } from './dom-component-adapter'
import { ImageRuntimeComponent } from './image-runtime-component'
import { ListRuntimeComponent } from './list-runtime-component'
import { TextComponent } from './text-component'
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
  text: TextComponent,
  img: ImageRuntimeComponent,
  list: ListRuntimeComponent
}

const INITIAL_LOAD_EVENT = {
  id: 'init',
  seq: 0
} as const

const OVERLAY_LAYER_Z_INDEX = 2147483647

type WorldRectSnapshot = {
  left: number
  top: number
  width: number
  height: number
}

type OverlayWorldPhoto = {
  rect: WorldRectSnapshot
  matrix: Matrix2D
  localWidth?: number
  localHeight?: number
}

type NodeBoxSnapshot = {
  offsetWidth: number | null
  offsetHeight: number | null
  clientWidth: number | null
  clientHeight: number | null
  computedWidthPx: number | null
  computedHeightPx: number | null
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
 * Resolves one strict move FLIP mode from authored payload.
 */
function normalizeMoveFlipMode(rawFlipMode: unknown): MoveFlipMode {
  return rawFlipMode === 'overlay-world' ? 'overlay-world' : 'local'
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
  private readonly flipEngine = createFlipEngine()

  private readonly componentClassByType = new Map<string, RuntimeComponentClass>()
  private readonly renderMutationResolverByType = new Map<string, RenderMutationResolver>()
  private readonly componentByPersoId = new Map<string, RuntimeComponent>()
  private readonly nodeByPersoId = new Map<string, unknown>()
  private readonly listByPersoId = new Map<string, RuntimeListComponent>()
  private readonly parentListByPersoId = new Map<string, string | null>()
  private readonly mountedByPersoId = new Map<string, boolean>()
  private readonly renderMutationResolverByPersoId = new Map<string, RenderMutationResolver>()
  private overlayLayerNode: HTMLElement | null = null
  private readonly overlayFinalizers = new Set<() => void>()

  private createElementOptions: import('../create-element').CreateElementOptions | undefined

  private readonly flipZeroTolerance = 1e-3
  private readonly flipCalibrationTolerancePx = 0.5
  private readonly flipCalibrationMaxIterations = 5
  private readonly overlayGhostCalibrationTolerancePx = 0.2
  private readonly overlayGhostCalibrationMaxIterations = 5

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
    this.cleanupOverlayRuntime()

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

    for (const item of Object.values(runtimePersos.persos)) {
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
    this.componentByPersoId.set(item.id, component)
    this.nodeByPersoId.set(item.id, rootNode)
    this.parentListByPersoId.set(item.id, null)
    this.mountedByPersoId.set(item.id, listComponent !== null)

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
  }

  /**
   * Destroys current runtime maps and returns empty runtime elements.
   */
  destroy(): RuntimeElementMap {
    this.cleanupOverlayRuntime()
    this.componentByPersoId.clear()
    this.nodeByPersoId.clear()
    this.listByPersoId.clear()
    this.parentListByPersoId.clear()
    this.mountedByPersoId.clear()
    this.renderMutationResolverByPersoId.clear()
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
    const movedNodeBeforeMove = this.nodeByPersoId.get(targetPersoId)
    const movedNodeBoxBeforeMove =
      moveDecision !== null && isDomElement(movedNodeBeforeMove)
        ? this.captureElementBoxSnapshot(movedNodeBeforeMove)
        : null
    const sourceListIdBeforeMove = moveDecision !== null
      ? this.parentListByPersoId.get(targetPersoId) ?? null
      : null
    const flipEntries = moveDecision !== null
      ? this.collectFlipEntriesForMove(targetPersoId, moveDecision)
      : []
    const firstFlipSnapshots = flipEntries.length > 0 ? this.flipEngine.capture(flipEntries) : []

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

    if (firstFlipSnapshots.length > 0) {
      const lastFlipSnapshots = this.flipEngine.capture(flipEntries)
      const flipPlan = this.flipEngine.plan(firstFlipSnapshots, lastFlipSnapshots)

      const isOverlayWorldMove = input.moveDecision?.flipMode === 'overlay-world'
      const movedTransitionId = `flip-${targetPersoId}`
      const localFlipPlanTransitions =
        isOverlayWorldMove
          ? flipPlan.transitions.filter((transition) => transition.transitionId !== movedTransitionId)
          : flipPlan.transitions

      this.flipEngine.applyInvert(localFlipPlanTransitions)
      this.flipEngine.flushLayout(flipEntries)
      let firstFlipAppliedSnapshots = this.flipEngine.capture(flipEntries)

      if (!isOverlayWorldMove) {
        for (let calibrationStep = 0; calibrationStep < this.flipCalibrationMaxIterations; calibrationStep += 1) {
          const residual = this.computeFlipResidual(
            firstFlipSnapshots,
            firstFlipAppliedSnapshots,
            targetPersoId
          )

          if (residual <= this.flipCalibrationTolerancePx) {
            break
          }

          this.calibrateFlipTransitions(firstFlipSnapshots, firstFlipAppliedSnapshots, localFlipPlanTransitions)
          this.flipEngine.applyInvert(localFlipPlanTransitions)
          this.flipEngine.flushLayout(flipEntries)
          firstFlipAppliedSnapshots = this.flipEngine.capture(flipEntries)
        }
      }

      const flipTransitions = this.flipEngine.toAnimationTransitions(localFlipPlanTransitions)
      const overlayWorldTransitions =
        moveDecision !== null
          ? this.tryBuildOverlayWorldTransitions({
              eventId: input.update.resolvedAction.eventId,
              eventName: input.update.resolvedAction.eventName,
              eventSeq: input.update.eventSeq,
              movedPersoId: targetPersoId,
              sourceListId: sourceListIdBeforeMove,
              oldNodeBoxBeforeMove: movedNodeBoxBeforeMove,
              move: moveDecision,
              flipPlanTransitions: flipPlan.transitions,
              firstSnapshots: firstFlipSnapshots,
              lastSnapshots: lastFlipSnapshots
            })
          : null

      const movedTransitionPrefix = `flip-${targetPersoId}-`
      const localFlipTransitions =
        overlayWorldTransitions === null
          ? flipTransitions
          : flipTransitions.filter((transition) => !transition.transitionId.startsWith(movedTransitionPrefix))

      for (const transition of localFlipTransitions) {
        input.directTransitions.push({
          ...transition,
          eventId: input.update.resolvedAction.eventId,
          eventName: input.update.resolvedAction.eventName,
          listenerId: targetPersoId,
          transitionId: `${transition.transitionId}-${input.update.resolvedAction.eventId}`
        })
      }

      for (const transition of overlayWorldTransitions ?? []) {
        input.directTransitions.push(transition)
      }
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
    const sourceListId = this.parentListByPersoId.get(request.persoId) ?? null
    const sourceList = sourceListId ? this.listByPersoId.get(sourceListId) ?? null : null

    const targetList = this.listByPersoId.get(request.move.parentId) ?? null
    if (targetList === null) {
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
        'AUTHOR_LIST_MOVE_TARGET_NOT_FOUND',
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

    if (sourceList !== null && sourceList.getPersoId() === targetList.getPersoId()) {
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

    let childNode: unknown | null = null
    if (sourceList !== null) {
      childNode = sourceList.detachChild({
        childId: request.persoId,
        mode: request.move.mode,
        reorder: request.move.reorder,
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
      childNode,
      mode: request.move.mode,
      reorder: request.move.reorder,
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

  /**
   * Detaches one DOM node from its current parent when present.
   */
  private detachNodeFromParent(nodeRef: unknown): void {
    if (!isDomNode(nodeRef)) {
      return
    }

    const parentNode = nodeRef.parentNode
    if (parentNode !== null && parentNode !== undefined) {
      parentNode.removeChild(nodeRef)
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

  /**
   * Collects touched runtime nodes used as FLIP entries for one move command.
   */
  private collectFlipEntriesForMove(persoId: string, move: MoveCommand): FlipEntry[] {
    if (move.flip === false) {
      return []
    }

    const sourceListId = this.parentListByPersoId.get(persoId) ?? null
    const targetListId = move.parentId
    if (sourceListId === null && !this.mountedByPersoId.get(targetListId)) {
      return []
    }

    const sourceList = sourceListId ? this.listByPersoId.get(sourceListId) ?? null : null
    const targetList = this.listByPersoId.get(targetListId) ?? null
    if (targetList === null) {
      return []
    }

    if (this.mountedByPersoId.get(targetListId) === false) {
      return []
    }

    const touchedIds = new Set<string>()
    touchedIds.add(persoId)

    for (const childId of sourceList?.getChildrenSnapshot() ?? []) {
      touchedIds.add(childId)
    }

    for (const childId of targetList.getChildrenSnapshot()) {
      touchedIds.add(childId)
    }

    const entries: FlipEntry[] = []
    for (const touchedId of touchedIds) {
      const nodeRef = this.nodeByPersoId.get(touchedId)
      if (nodeRef === undefined || nodeRef === null) {
        continue
      }

      entries.push({
        id: touchedId,
        nodeRef
      })
    }

    return entries
  }

  /**
   * Attempts to build overlay-world transitions for one moved item.
   */
  private tryBuildOverlayWorldTransitions(input: {
    eventId: string
    eventName: string
    eventSeq: number
    movedPersoId: string
    sourceListId: string | null
    oldNodeBoxBeforeMove: NodeBoxSnapshot | null
    move: MoveCommand
    flipPlanTransitions: FlipTransitionRequest[]
    firstSnapshots: FlipSnapshot[]
    lastSnapshots: FlipSnapshot[]
  }): TransitionRequest[] | null {
    if (input.move.flipMode !== 'overlay-world') {
      return null
    }

    const nodeRef = this.nodeByPersoId.get(input.movedPersoId)
    if (!isDomElement(nodeRef)) {
      this.warnOnce(
        input.eventSeq,
        'RUNTIME_FLIP_OVERLAY_MODE_UNAVAILABLE_FALLBACK_LOCAL',
        {
          persoId: input.movedPersoId,
          eventId: input.eventId,
          reason: 'NODE_NOT_DOM_ELEMENT'
        },
        input.movedPersoId
      )
      return null
    }

    if (typeof globalThis.HTMLElement === 'undefined' || !(nodeRef instanceof globalThis.HTMLElement)) {
      return null
    }

    const movedNodeElement = nodeRef

    const firstSnapshot = input.firstSnapshots.find((snapshot) => snapshot.id === input.movedPersoId)
    const lastSnapshot = input.lastSnapshots.find((snapshot) => snapshot.id === input.movedPersoId)
    const flipTransition = input.flipPlanTransitions.find((transition) => transition.transitionId === `flip-${input.movedPersoId}`)
    if (firstSnapshot === undefined || lastSnapshot === undefined || flipTransition === undefined) {
      return null
    }

    this.cleanupOverlayRuntime()

    const authoritativeOldLocalSize = this.toPreferredLocalSize(input.oldNodeBoxBeforeMove)

    const worldPhotos = this.computeOverlayWorldPhotosFromLocalFlip({
      movedPersoId: input.movedPersoId,
      movedNode: movedNodeElement,
      flipTransition,
      fallbackOldRect: this.toWorldRectSnapshot(firstSnapshot),
      fallbackNextRect: this.toWorldRectSnapshot(lastSnapshot),
      fallbackOldMatrix: multiplyMatrix(firstSnapshot.parentMatrix, firstSnapshot.matrix),
      fallbackNextMatrix: multiplyMatrix(lastSnapshot.parentMatrix, lastSnapshot.matrix),
      authoritativeOldLocalWidth: authoritativeOldLocalSize.width,
      authoritativeOldLocalHeight: authoritativeOldLocalSize.height
    })

    const worldPhotoClones = this.createOverlayWorldPhotoClones({
      movedNode: movedNodeElement,
      oldPhoto: worldPhotos.old,
      nextPhoto: worldPhotos.next
    })
    if (worldPhotoClones === null) {
      this.warnOnce(
        input.eventSeq,
        'RUNTIME_FLIP_OVERLAY_MODE_UNAVAILABLE_FALLBACK_LOCAL',
        {
          persoId: input.movedPersoId,
          eventId: input.eventId,
          reason: 'OVERLAY_WORLD_PHOTO_CLONE_SETUP_FAILED'
        },
        input.movedPersoId
      )
      return null
    }

    worldPhotoClones.nextCloneNode.style.visibility = 'hidden'
    const movedNodeVisibilityBeforeOverlay = movedNodeElement.style.visibility
    movedNodeElement.style.visibility = 'hidden'

    const overlayTransitions = this.buildOverlayWorldTransitions({
      eventId: input.eventId,
      eventName: input.eventName,
      movedPersoId: input.movedPersoId,
      animatedCloneNode: worldPhotoClones.oldCloneNode,
      targetCloneNode: worldPhotoClones.nextCloneNode,
      flipTransition,
      onFinalize: () => {
        movedNodeElement.style.visibility = movedNodeVisibilityBeforeOverlay
        worldPhotoClones.finalize()
      }
    })

    if (overlayTransitions.length === 0) {
      movedNodeElement.style.visibility = movedNodeVisibilityBeforeOverlay
      worldPhotoClones.finalize()
      return []
    }

    return overlayTransitions
  }

  /**
   * Builds one world-space transition set from old clone to next clone state.
   */
  private buildOverlayWorldTransitions(input: {
    eventId: string
    eventName: string
    movedPersoId: string
    animatedCloneNode: HTMLElement
    targetCloneNode: HTMLElement
    flipTransition: FlipTransitionRequest
    onFinalize: (reason: 'completed' | 'stopped') => void
  }): TransitionRequest[] {
    const transitions: TransitionRequest[] = []
    const transitionIdPrefix = `flip-overlay-${input.movedPersoId}-${input.eventId}`

    const fromLeft = this.readInlinePxValue(input.animatedCloneNode, 'left')
    const toLeft = this.readInlinePxValue(input.targetCloneNode, 'left')
    const fromTop = this.readInlinePxValue(input.animatedCloneNode, 'top')
    const toTop = this.readInlinePxValue(input.targetCloneNode, 'top')
    const fromWidth = this.readInlinePxValue(input.animatedCloneNode, 'width')
    const toWidth = this.readInlinePxValue(input.targetCloneNode, 'width')
    const fromHeight = this.readInlinePxValue(input.animatedCloneNode, 'height')
    const toHeight = this.readInlinePxValue(input.targetCloneNode, 'height')

    const fromTransformValue = this.readElementTransformValue(input.animatedCloneNode)
    const toTransformValue = this.readElementTransformValue(input.targetCloneNode)

    let finalized = false
    const finalize = (reason: 'completed' | 'stopped') => {
      if (finalized) {
        return
      }

      finalized = true
      input.onFinalize(reason)
    }

    const pushTransition = (property: string, from: number | string, to: number | string) => {
      transitions.push({
        transitionId: `${transitionIdPrefix}-${property}`,
        eventId: input.eventId,
        eventName: input.eventName,
        listenerId: input.movedPersoId,
        property,
        target: input.animatedCloneNode,
        from,
        to,
        duration: input.flipTransition.duration,
        easing: input.flipTransition.easing,
        delayMs: input.flipTransition.delayMs,
        composition: 'merge',
        onFinalize: finalize
      })
    }

    if (Math.abs(toLeft - fromLeft) > this.flipZeroTolerance) {
      pushTransition('left', `${fromLeft}px`, `${toLeft}px`)
    }

    if (Math.abs(toTop - fromTop) > this.flipZeroTolerance) {
      pushTransition('top', `${fromTop}px`, `${toTop}px`)
    }

    if (Math.abs(toWidth - fromWidth) > this.flipZeroTolerance) {
      pushTransition('width', `${fromWidth}px`, `${toWidth}px`)
    }

    if (Math.abs(toHeight - fromHeight) > this.flipZeroTolerance) {
      pushTransition('height', `${fromHeight}px`, `${toHeight}px`)
    }

    if (fromTransformValue !== toTransformValue) {
      pushTransition('transform', fromTransformValue, toTransformValue)
    }

    return transitions
  }

  /**
   * Converts one snapshot-like input into a plain world rectangle payload.
   */
  private toWorldRectSnapshot(input: { left: number; top: number; width: number; height: number }): WorldRectSnapshot {
    return {
      left: input.left,
      top: input.top,
      width: input.width,
      height: input.height
    }
  }

  /**
   * Reads one computed transform value from one element.
   */
  private readElementTransformValue(nodeRef: Element): string {
    if (typeof globalThis.getComputedStyle === 'function') {
      const computedTransform = globalThis.getComputedStyle(nodeRef).transform
      return computedTransform && computedTransform.length > 0 ? computedTransform : 'none'
    }

    if (typeof globalThis.HTMLElement !== 'undefined' && nodeRef instanceof globalThis.HTMLElement) {
      const inlineTransform = nodeRef.style.transform
      return inlineTransform && inlineTransform.length > 0 ? inlineTransform : 'none'
    }

    return 'none'
  }

  /**
   * Reads one numeric inline px value from one HTMLElement style property.
   */
  private readInlinePxValue(nodeRef: HTMLElement, key: 'left' | 'top' | 'width' | 'height'): number {
    const rawValue = nodeRef.style[key]
    const parsed = Number.parseFloat(rawValue)
    return Number.isFinite(parsed) ? parsed : 0
  }

  /**
   * Captures one box model snapshot for one element.
   */
  private captureElementBoxSnapshot(nodeRef: Element): NodeBoxSnapshot {
    let computedWidthPx: number | null = null
    let computedHeightPx: number | null = null

    if (typeof globalThis.getComputedStyle === 'function') {
      const computedStyle = globalThis.getComputedStyle(nodeRef)
      const parsedWidth = Number.parseFloat(computedStyle.width)
      const parsedHeight = Number.parseFloat(computedStyle.height)
      computedWidthPx = Number.isFinite(parsedWidth) ? parsedWidth : null
      computedHeightPx = Number.isFinite(parsedHeight) ? parsedHeight : null
    }

    if (typeof globalThis.HTMLElement !== 'undefined' && nodeRef instanceof globalThis.HTMLElement) {
      return {
        offsetWidth: nodeRef.offsetWidth,
        offsetHeight: nodeRef.offsetHeight,
        clientWidth: nodeRef.clientWidth,
        clientHeight: nodeRef.clientHeight,
        computedWidthPx,
        computedHeightPx
      }
    }

    return {
      offsetWidth: null,
      offsetHeight: null,
      clientWidth: null,
      clientHeight: null,
      computedWidthPx,
      computedHeightPx
    }
  }

  /**
   * Resolves one preferred local width/height pair from one captured box snapshot.
   */
  private toPreferredLocalSize(box: NodeBoxSnapshot | null): { width?: number; height?: number } {
    if (box === null) {
      return {}
    }

    const width = box.computedWidthPx ?? box.offsetWidth ?? box.clientWidth ?? undefined
    const height = box.computedHeightPx ?? box.offsetHeight ?? box.clientHeight ?? undefined

    return {
      width,
      height
    }
  }

  /**
   * Tunes one world matrix so fixed local width/height projects close to target world size.
   */
  private tuneMatrixToWorldSize(
    matrix: Matrix2D,
    localWidth: number,
    localHeight: number,
    targetWorldWidth: number,
    targetWorldHeight: number
  ): Matrix2D {
    const safeLocalWidth = Math.max(1e-3, localWidth)
    const safeLocalHeight = Math.max(1e-3, localHeight)
    const aa = Math.abs(matrix.a) * safeLocalWidth
    const bb = Math.abs(matrix.b) * safeLocalWidth
    const cc = Math.abs(matrix.c) * safeLocalHeight
    const dd = Math.abs(matrix.d) * safeLocalHeight
    const determinant = aa * dd - bb * cc

    let factorX = 1
    let factorY = 1

    if (Math.abs(determinant) > 1e-8) {
      factorX = (targetWorldWidth * dd - targetWorldHeight * cc) / determinant
      factorY = (targetWorldHeight * aa - targetWorldWidth * bb) / determinant
    }

    if (!Number.isFinite(factorX) || factorX <= 1e-6 || !Number.isFinite(factorY) || factorY <= 1e-6) {
      const worldWidthFromMatrix = aa + cc
      const worldHeightFromMatrix = bb + dd
      const fallbackFactorX = worldWidthFromMatrix > 1e-8 ? targetWorldWidth / worldWidthFromMatrix : 1
      const fallbackFactorY = worldHeightFromMatrix > 1e-8 ? targetWorldHeight / worldHeightFromMatrix : 1
      const fallbackFactor = Math.max(1e-6, (fallbackFactorX + fallbackFactorY) / 2)

      factorX = fallbackFactor
      factorY = fallbackFactor
    }

    return {
      a: matrix.a * factorX,
      b: matrix.b * factorX,
      c: matrix.c * factorY,
      d: matrix.d * factorY,
      e: matrix.e,
      f: matrix.f
    }
  }

  /**
   * Applies one local FLIP state to the moved node and captures its world rectangle.
   */
  private captureWorldPhotoFromLocalFlipState(input: {
    movedPersoId: string
    movedNode: Element
    flipTransition: FlipTransitionRequest
    state: 'from' | 'to'
  }): OverlayWorldPhoto {
    const localState = input.state === 'from' ? input.flipTransition.from : input.flipTransition.to
    const photoTransition: FlipTransitionRequest = {
      ...input.flipTransition,
      transitionId: `${input.flipTransition.transitionId}-photo-${input.state}`,
      from: {
        ...localState
      },
      to: {
        ...localState
      }
    }

    this.flipEngine.applyInvert([photoTransition])
    this.flipEngine.flushLayout([
      {
        id: input.movedPersoId,
        nodeRef: input.movedNode
      }
    ])

    const rect = input.movedNode.getBoundingClientRect()
    const boxSnapshot = this.captureElementBoxSnapshot(input.movedNode)
    const localWidth =
      boxSnapshot.computedWidthPx ??
      boxSnapshot.offsetWidth ??
      boxSnapshot.clientWidth ??
      undefined
    const localHeight =
      boxSnapshot.computedHeightPx ??
      boxSnapshot.offsetHeight ??
      boxSnapshot.clientHeight ??
      undefined

    return {
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      },
      matrix: this.captureCombinedMatrixForNode(input.movedNode),
      localWidth,
      localHeight
    }
  }

  /**
   * Calibrates one overlay photo transition so local `from` reproduces the expected old world rect.
   */
  private calibrateOverlayWorldPhotoFromState(input: {
    movedPersoId: string
    movedNode: Element
    transition: FlipTransitionRequest
    targetOldRect: WorldRectSnapshot
  }): void {
    const flipEntry: FlipEntry = {
      id: input.movedPersoId,
      nodeRef: input.movedNode
    }

    for (let calibrationStep = 0; calibrationStep < this.flipCalibrationMaxIterations; calibrationStep += 1) {
      const measuredPhoto = this.captureWorldPhotoFromLocalFlipState({
        movedPersoId: input.movedPersoId,
        movedNode: input.movedNode,
        flipTransition: input.transition,
        state: 'from'
      })

      const residual = Math.max(
        Math.abs(input.targetOldRect.left - measuredPhoto.rect.left),
        Math.abs(input.targetOldRect.top - measuredPhoto.rect.top),
        Math.abs(input.targetOldRect.width - measuredPhoto.rect.width),
        Math.abs(input.targetOldRect.height - measuredPhoto.rect.height)
      )

      if (residual <= this.flipCalibrationTolerancePx) {
        break
      }

      const measuredSnapshot = this.flipEngine.capture([flipEntry])[0]
      if (measuredSnapshot === undefined) {
        break
      }

      this.calibrateFlipTransitions(
        [
          {
            id: input.movedPersoId,
            left: input.targetOldRect.left,
            top: input.targetOldRect.top,
            width: input.targetOldRect.width,
            height: input.targetOldRect.height,
            parentMatrix: measuredSnapshot.parentMatrix,
            matrix: measuredSnapshot.matrix,
            translateX: measuredSnapshot.translateX,
            translateY: measuredSnapshot.translateY
          }
        ],
        [measuredSnapshot],
        [input.transition]
      )
    }
  }

  /**
   * Captures one combined world matrix for one node from root to target.
   */
  private captureCombinedMatrixForNode(nodeRef: Element): Matrix2D {
    let combinedMatrix = parseCssMatrix(this.readElementTransformValue(nodeRef))

    let parentNodeRef: Node | null = nodeRef.parentNode
    while (isDomElement(parentNodeRef)) {
      const parentMatrix = parseCssMatrix(this.readElementTransformValue(parentNodeRef))
      combinedMatrix = multiplyMatrix(parentMatrix, combinedMatrix)
      parentNodeRef = parentNodeRef.parentNode
    }

    return combinedMatrix
  }

  /**
   * Computes old/next world photos by transposing local FLIP states to world-space.
   */
  private computeOverlayWorldPhotosFromLocalFlip(input: {
    movedPersoId: string
    movedNode: Element
    flipTransition: FlipTransitionRequest
    fallbackOldRect: WorldRectSnapshot
    fallbackNextRect: WorldRectSnapshot
    fallbackOldMatrix: Matrix2D
    fallbackNextMatrix: Matrix2D
    authoritativeOldLocalWidth?: number
    authoritativeOldLocalHeight?: number
  }): {
    old: OverlayWorldPhoto
    next: OverlayWorldPhoto
    source: 'local-transposed' | 'snapshot-fallback'
  } {
    if (!isDomElement(input.movedNode)) {
      return {
        old: {
          rect: input.fallbackOldRect,
          matrix: input.fallbackOldMatrix
        },
        next: {
          rect: input.fallbackNextRect,
          matrix: input.fallbackNextMatrix
        },
        source: 'snapshot-fallback'
      }
    }

    const liveNextSize = this.toPreferredLocalSize(this.captureElementBoxSnapshot(input.movedNode))

    const inlineStyleBefore = input.movedNode.getAttribute('style')

    try {
      const calibratedTransition: FlipTransitionRequest = {
        ...input.flipTransition,
        from: {
          ...input.flipTransition.from
        },
        to: {
          ...input.flipTransition.to
        }
      }

      this.calibrateOverlayWorldPhotoFromState({
        movedPersoId: input.movedPersoId,
        movedNode: input.movedNode,
        transition: calibratedTransition,
        targetOldRect: input.fallbackOldRect
      })

      const oldRect = this.captureWorldPhotoFromLocalFlipState({
        movedPersoId: input.movedPersoId,
        movedNode: input.movedNode,
        flipTransition: calibratedTransition,
        state: 'from'
      })

      if (
        typeof input.authoritativeOldLocalWidth === 'number' &&
        Number.isFinite(input.authoritativeOldLocalWidth) &&
        input.authoritativeOldLocalWidth > 1e-3
      ) {
        oldRect.localWidth = input.authoritativeOldLocalWidth
      }

      if (
        typeof input.authoritativeOldLocalHeight === 'number' &&
        Number.isFinite(input.authoritativeOldLocalHeight) &&
        input.authoritativeOldLocalHeight > 1e-3
      ) {
        oldRect.localHeight = input.authoritativeOldLocalHeight
      }

      const nextRect = this.captureWorldPhotoFromLocalFlipState({
        movedPersoId: input.movedPersoId,
        movedNode: input.movedNode,
        flipTransition: calibratedTransition,
        state: 'to'
      })

      if (
        typeof liveNextSize.width === 'number' &&
        Number.isFinite(liveNextSize.width) &&
        liveNextSize.width > 1e-3
      ) {
        nextRect.localWidth = liveNextSize.width
      }

      if (
        typeof liveNextSize.height === 'number' &&
        Number.isFinite(liveNextSize.height) &&
        liveNextSize.height > 1e-3
      ) {
        nextRect.localHeight = liveNextSize.height
      }

      return {
        old: oldRect,
        next: nextRect,
        source: 'local-transposed'
      }
    } catch {
      return {
        old: {
          rect: input.fallbackOldRect,
          matrix: input.fallbackOldMatrix
        },
        next: {
          rect: input.fallbackNextRect,
          matrix: input.fallbackNextMatrix
        },
        source: 'snapshot-fallback'
      }
    } finally {
      if (inlineStyleBefore === null) {
        input.movedNode.removeAttribute('style')
      } else {
        input.movedNode.setAttribute('style', inlineStyleBefore)
      }

      this.flipEngine.flushLayout([
        {
          id: input.movedPersoId,
          nodeRef: input.movedNode
        }
      ])
    }
  }

  /**
   * Ensures one shared overlay layer exists for world-space transitions.
   */
  private ensureOverlayLayer(): HTMLElement | null {
    if (typeof globalThis.document === 'undefined') {
      return null
    }

    const existingLayer = this.overlayLayerNode
    if (existingLayer !== null && existingLayer.isConnected) {
      return existingLayer
    }

    const overlayLayer = globalThis.document.createElement('div')
    overlayLayer.setAttribute('data-runtime-flip-overlay-layer', 'true')
    overlayLayer.style.position = 'fixed'
    overlayLayer.style.left = '0'
    overlayLayer.style.top = '0'
    overlayLayer.style.width = '100vw'
    overlayLayer.style.height = '100vh'
    overlayLayer.style.pointerEvents = 'none'
    overlayLayer.style.overflow = 'visible'
    overlayLayer.style.zIndex = String(OVERLAY_LAYER_Z_INDEX)

    globalThis.document.body.appendChild(overlayLayer)
    this.overlayLayerNode = overlayLayer
    return overlayLayer
  }

  /**
   * Creates two world-space photo clones mapped to projected old and next rectangles.
   */
  private createOverlayWorldPhotoClones(input: {
    movedNode: Element
    oldPhoto: OverlayWorldPhoto
    nextPhoto: OverlayWorldPhoto
  }): {
    oldCloneNode: HTMLElement
    nextCloneNode: HTMLElement
    finalize: () => void
  } | null {
    const overlayLayer = this.ensureOverlayLayer()
    if (overlayLayer === null || typeof globalThis.HTMLElement === 'undefined' || !(input.movedNode instanceof globalThis.HTMLElement)) {
      return null
    }

    const oldCloneNode = input.movedNode.cloneNode(true)
    const nextCloneNode = input.movedNode.cloneNode(true)
    if (!(oldCloneNode instanceof globalThis.HTMLElement) || !(nextCloneNode instanceof globalThis.HTMLElement)) {
      return null
    }

    const setupClone = (cloneNode: HTMLElement, photo: OverlayWorldPhoto, phase: 'old' | 'next') => {
      const localWidth =
        typeof photo.localWidth === 'number' && Number.isFinite(photo.localWidth) && photo.localWidth > 1e-3
          ? photo.localWidth
          : Math.max(1e-3, photo.rect.width)
      const localHeight =
        typeof photo.localHeight === 'number' && Number.isFinite(photo.localHeight) && photo.localHeight > 1e-3
          ? photo.localHeight
          : Math.max(1e-3, photo.rect.height)
      const tunedMatrix = this.tuneMatrixToWorldSize(
        photo.matrix,
        localWidth,
        localHeight,
        Math.max(1e-3, photo.rect.width),
        Math.max(1e-3, photo.rect.height)
      )

      cloneNode.removeAttribute('id')
      cloneNode.setAttribute('aria-hidden', 'true')
      cloneNode.setAttribute('data-runtime-flip-overlay-photo', phase)
      cloneNode.style.position = 'fixed'
      cloneNode.style.left = `${photo.rect.left}px`
      cloneNode.style.top = `${photo.rect.top}px`
      cloneNode.style.width = `${Math.max(1e-3, localWidth)}px`
      cloneNode.style.height = `${Math.max(1e-3, localHeight)}px`
      cloneNode.style.boxSizing = 'border-box'
      cloneNode.style.margin = '0'
      cloneNode.style.minWidth = '0'
      cloneNode.style.minHeight = '0'
      cloneNode.style.maxWidth = 'none'
      cloneNode.style.maxHeight = 'none'
      cloneNode.style.pointerEvents = 'none'
      cloneNode.style.transformOrigin = '0px 0px'
      cloneNode.style.transform = `matrix(${tunedMatrix.a}, ${tunedMatrix.b}, ${tunedMatrix.c}, ${tunedMatrix.d}, 0, 0)`
      cloneNode.style.zIndex = String(OVERLAY_LAYER_Z_INDEX)
      overlayLayer.appendChild(cloneNode)
      this.calibrateOverlayGhostToWorldSnapshot(cloneNode, photo.rect, {
        lockSize: true
      })
    }

    setupClone(oldCloneNode, input.oldPhoto, 'old')
    setupClone(nextCloneNode, input.nextPhoto, 'next')

    let finalized = false
    const finalize = () => {
      if (finalized) {
        return
      }

      finalized = true
      if (oldCloneNode.parentNode !== null) {
        oldCloneNode.parentNode.removeChild(oldCloneNode)
      }
      if (nextCloneNode.parentNode !== null) {
        nextCloneNode.parentNode.removeChild(nextCloneNode)
      }
      this.overlayFinalizers.delete(finalize)
    }

    this.overlayFinalizers.add(finalize)

    return {
      oldCloneNode,
      nextCloneNode,
      finalize
    }
  }

  /**
   * Calibrates one overlay ghost to match one target world-space snapshot.
   */
  private calibrateOverlayGhostToWorldSnapshot(
    ghostNode: HTMLElement,
    targetSnapshot: { left: number; top: number; width: number; height: number },
    options?: { lockSize?: boolean }
  ): {
    rect: { left: number; top: number; width: number; height: number }
    styleLeftPx: number
    styleTopPx: number
    styleWidthPx: number
    styleHeightPx: number
  } {
    let styleLeftPx = targetSnapshot.left
    let styleTopPx = targetSnapshot.top
    const lockSize = options?.lockSize === true
    let styleWidthPx = Math.max(
      1e-3,
      Number.parseFloat(ghostNode.style.width || '') || targetSnapshot.width
    )
    let styleHeightPx = Math.max(
      1e-3,
      Number.parseFloat(ghostNode.style.height || '') || targetSnapshot.height
    )

    ghostNode.style.left = `${styleLeftPx}px`
    ghostNode.style.top = `${styleTopPx}px`
    ghostNode.style.width = `${styleWidthPx}px`
    ghostNode.style.height = `${styleHeightPx}px`

    let finalRect = ghostNode.getBoundingClientRect()

    for (let index = 0; index < this.overlayGhostCalibrationMaxIterations; index += 1) {
      const residualLeft = targetSnapshot.left - finalRect.left
      const residualTop = targetSnapshot.top - finalRect.top
      const residualWidth = targetSnapshot.width - finalRect.width
      const residualHeight = targetSnapshot.height - finalRect.height

      if (
        Math.abs(residualLeft) <= this.overlayGhostCalibrationTolerancePx &&
        Math.abs(residualTop) <= this.overlayGhostCalibrationTolerancePx &&
        (lockSize || Math.abs(residualWidth) <= this.overlayGhostCalibrationTolerancePx) &&
        (lockSize || Math.abs(residualHeight) <= this.overlayGhostCalibrationTolerancePx)
      ) {
        break
      }

      if (!lockSize && finalRect.width > 1e-3) {
        styleWidthPx = Math.max(1e-3, styleWidthPx * (targetSnapshot.width / finalRect.width))
      }

      if (!lockSize && finalRect.height > 1e-3) {
        styleHeightPx = Math.max(1e-3, styleHeightPx * (targetSnapshot.height / finalRect.height))
      }

      styleLeftPx += residualLeft
      styleTopPx += residualTop

      ghostNode.style.left = `${styleLeftPx}px`
      ghostNode.style.top = `${styleTopPx}px`
      ghostNode.style.width = `${styleWidthPx}px`
      ghostNode.style.height = `${styleHeightPx}px`
      finalRect = ghostNode.getBoundingClientRect()
    }

    return {
      rect: {
        left: finalRect.left,
        top: finalRect.top,
        width: finalRect.width,
        height: finalRect.height
      },
      styleLeftPx,
      styleTopPx,
      styleWidthPx,
      styleHeightPx
    }
  }

  /**
   * Finalizes all active overlay artifacts.
   */
  private cleanupOverlayRuntime(): void {
    for (const finalize of [...this.overlayFinalizers]) {
      finalize()
    }

    this.overlayFinalizers.clear()
    if (this.overlayLayerNode !== null && this.overlayLayerNode.parentNode !== null) {
      this.overlayLayerNode.parentNode.removeChild(this.overlayLayerNode)
    }

    this.overlayLayerNode = null
  }

  /**
   * Computes max absolute residual in world-space for one moved item.
   */
  private computeFlipResidual(
    oldSnapshots: Array<{
      id: string
      left: number
      top: number
      width: number
      height: number
    }>,
    firstFlipSnapshots: Array<{
      id: string
      left: number
      top: number
      width: number
      height: number
    }>,
    movedPersoId: string
  ): number {
    const oldSnapshot = oldSnapshots.find((snapshot) => snapshot.id === movedPersoId)
    const firstFlipSnapshot = firstFlipSnapshots.find((snapshot) => snapshot.id === movedPersoId)
    if (!oldSnapshot || !firstFlipSnapshot) {
      return 0
    }

    const dx = Math.abs(oldSnapshot.left - firstFlipSnapshot.left)
    const dy = Math.abs(oldSnapshot.top - firstFlipSnapshot.top)
    const dw = Math.abs(oldSnapshot.width - firstFlipSnapshot.width)
    const dh = Math.abs(oldSnapshot.height - firstFlipSnapshot.height)
    return Math.max(dx, dy, dw, dh)
  }

  /**
   * Applies one correction pass so first FLIP frame matches old world snapshot.
   */
  private calibrateFlipTransitions(
    oldSnapshots: Array<{
      id: string
      left: number
      top: number
      width: number
      height: number
      parentMatrix: Matrix2D
      matrix: Matrix2D
      translateX: number
      translateY: number
    }>,
    firstFlipSnapshots: Array<{
      id: string
      left: number
      top: number
      width: number
      height: number
      parentMatrix: Matrix2D
      matrix: Matrix2D
      translateX: number
      translateY: number
    }>,
    transitions: Array<{
      transitionId: string
      from: {
        x?: number
        y?: number
        width?: number
        height?: number
      }
    }>
  ): void {
    const oldById = new Map(oldSnapshots.map((snapshot) => [snapshot.id, snapshot]))
    const firstById = new Map(firstFlipSnapshots.map((snapshot) => [snapshot.id, snapshot]))

    for (const transition of transitions) {
      const itemId = transition.transitionId.replace('flip-', '')
      const oldSnapshot = oldById.get(itemId)
      const firstFlipSnapshot = firstById.get(itemId)
      if (!oldSnapshot || !firstFlipSnapshot) {
        continue
      }

      const residualX = oldSnapshot.left - firstFlipSnapshot.left
      const residualY = oldSnapshot.top - firstFlipSnapshot.top
      const residualWidth = oldSnapshot.width - firstFlipSnapshot.width
      const residualHeight = oldSnapshot.height - firstFlipSnapshot.height

      const matrixForTranslation = multiplyMatrix(firstFlipSnapshot.parentMatrix, firstFlipSnapshot.matrix)
      const matrixForSize = multiplyMatrix(
        multiplyMatrix(firstFlipSnapshot.parentMatrix, firstFlipSnapshot.matrix),
        createTranslateMatrix(-firstFlipSnapshot.translateX, -firstFlipSnapshot.translateY)
      )

      if (Math.abs(residualX) > this.flipZeroTolerance || Math.abs(residualY) > this.flipZeroTolerance) {
        const localResidual = this.worldDeltaToLocalDelta(matrixForTranslation, residualX, residualY)
        transition.from.x = (transition.from.x ?? 0) + localResidual.x
        transition.from.y = (transition.from.y ?? 0) + localResidual.y
      }

      if (
        transition.from.width !== undefined &&
        transition.from.height !== undefined &&
        (Math.abs(residualWidth) > this.flipZeroTolerance || Math.abs(residualHeight) > this.flipZeroTolerance)
      ) {
        const desiredLocalSize = this.worldSizeToLocalSize(matrixForSize, oldSnapshot.width, oldSnapshot.height)
        transition.from.width = desiredLocalSize.width
        transition.from.height = desiredLocalSize.height
      }
    }
  }

  /**
   * Converts world-space translation drift into local channels.
   */
  private worldDeltaToLocalDelta(matrix: Matrix2D, worldDeltaX: number, worldDeltaY: number): { x: number; y: number } {
    const inverseMatrix = invertMatrix(matrix)
    if (inverseMatrix === null) {
      return {
        x: worldDeltaX,
        y: worldDeltaY
      }
    }

    return {
      x: inverseMatrix.a * worldDeltaX + inverseMatrix.c * worldDeltaY,
      y: inverseMatrix.b * worldDeltaX + inverseMatrix.d * worldDeltaY
    }
  }

  /**
   * Converts world-space box size to local width/height channels.
   */
  private worldSizeToLocalSize(matrix: Matrix2D, worldWidth: number, worldHeight: number): { width: number; height: number } {
    const aa = Math.abs(matrix.a)
    const bb = Math.abs(matrix.b)
    const cc = Math.abs(matrix.c)
    const dd = Math.abs(matrix.d)

    const determinant = aa * dd - bb * cc
    if (Math.abs(determinant) < 1e-8) {
      return {
        width: worldWidth,
        height: worldHeight
      }
    }

    const localWidth = (worldWidth * dd - worldHeight * cc) / determinant
    const localHeight = (worldHeight * aa - worldWidth * bb) / determinant

    return {
      width: Math.max(0, localWidth),
      height: Math.max(0, localHeight)
    }
  }

}
