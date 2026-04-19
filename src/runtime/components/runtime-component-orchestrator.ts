import type { AnimationResolvedAction } from '../../animation/types'
import type { TransitionRequest } from '../../animation/types'
import type { RuntimeElementMap, StoryDoc } from '../types'
import type { MoveCommand } from '../types'
import { createFlipEngine, type FlipEntry, type Matrix2D } from '../flip-engine'
import { createTranslateMatrix, invertMatrix, multiplyMatrix } from '../flip-engine/matrix-2d'
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
  private readonly warningKeys = new Set<string>()
  private readonly flipEngine = createFlipEngine()

  private readonly componentClassByType = new Map<string, RuntimeComponentClass>()
  private readonly componentByPersoId = new Map<string, RuntimeComponent>()
  private readonly nodeByPersoId = new Map<string, unknown>()
  private readonly listByPersoId = new Map<string, RuntimeListComponent>()
  private readonly parentListByPersoId = new Map<string, string | null>()
  private readonly mountedByPersoId = new Map<string, boolean>()

  private createElementOptions: import('../create-element').CreateElementOptions | undefined

  private readonly flipZeroTolerance = 1e-3
  private readonly flipCalibrationTolerancePx = 0.5
  private readonly flipCalibrationMaxIterations = 5

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
      const isListComponent = item.type === 'list' && this.isRuntimeListComponent(component)

      if (!isListComponent) {
        this.detachNodeFromParent(rootNode)
      }

      this.componentByPersoId.set(item.id, component)
      this.nodeByPersoId.set(item.id, rootNode)
      this.parentListByPersoId.set(item.id, null)
      this.mountedByPersoId.set(item.id, isListComponent)

      if (isListComponent) {
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
    this.warningKeys.clear()
    const animatableActions: AnimationResolvedAction[] = []
    const directTransitions: TransitionRequest[] = []
    let appliedActionsCount = 0
    const moveDecisionsByUpdateIndex = this.resolveMoveDecisions(updates)

    for (const [updateIndex, update] of updates.entries()) {
      const targetPersoId = this.resolveTargetPersoId(update.resolvedAction)
      const component = this.componentByPersoId.get(targetPersoId)
      if (!component) {
        this.warnOnce(
          update.eventSeq,
          'RUNTIME_COMPONENT_NODE_NOT_FOUND',
          {
            targetPersoId,
            eventId: update.resolvedAction.eventId,
            eventSeq: update.eventSeq
          },
          targetPersoId
        )
        continue
      }

      const moveDecision = moveDecisionsByUpdateIndex.get(updateIndex)
      const flipEntries =
        moveDecision !== undefined && moveDecision !== null
          ? this.collectFlipEntriesForMove(targetPersoId, moveDecision)
          : []
      const firstFlipSnapshots = flipEntries.length > 0 ? this.flipEngine.capture(flipEntries) : []

      if (moveDecision !== undefined && moveDecision !== null) {
        this.applyMoveForPerso({
          persoId: targetPersoId,
          move: moveDecision,
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

      if (firstFlipSnapshots.length > 0) {
        const lastFlipSnapshots = this.flipEngine.capture(flipEntries)
        const flipPlan = this.flipEngine.plan(firstFlipSnapshots, lastFlipSnapshots)
        this.flipEngine.applyInvert(flipPlan.transitions)
        this.flipEngine.flushLayout(flipEntries)
        let firstFlipAppliedSnapshots = this.flipEngine.capture(flipEntries)

        for (let calibrationStep = 0; calibrationStep < this.flipCalibrationMaxIterations; calibrationStep += 1) {
          const residual = this.computeFlipResidual(
            firstFlipSnapshots,
            firstFlipAppliedSnapshots,
            targetPersoId
          )

          if (residual <= this.flipCalibrationTolerancePx) {
            break
          }

          this.calibrateFlipTransitions(firstFlipSnapshots, firstFlipAppliedSnapshots, flipPlan.transitions)
          this.flipEngine.applyInvert(flipPlan.transitions)
          this.flipEngine.flushLayout(flipEntries)
          firstFlipAppliedSnapshots = this.flipEngine.capture(flipEntries)
        }

        const flipTransitions = this.flipEngine.toAnimationTransitions(flipPlan.transitions)

        for (const transition of flipTransitions) {
          directTransitions.push({
            ...transition,
            eventId: update.resolvedAction.eventId,
            eventName: update.resolvedAction.eventName,
            listenerId: targetPersoId,
            transitionId: `${transition.transitionId}-${update.resolvedAction.eventId}`
          })
        }
      }

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
      animatableActions,
      directTransitions
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
