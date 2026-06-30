import { utils } from 'animejs'

import type { TransitionRequest } from '../../../animation/types'
import { isDomElement } from '../../components/lib/dom-component-adapter'
import type { MoveCommand } from '../../types'
import { createFlipEngine, type FlipEntry, type FlipSnapshot, type FlipTransitionRequest, type Matrix2D } from './engine'
import { createTranslateMatrix, multiplyMatrix } from './engine/matrix-2d'
import { captureCombinedMatrixForNode, readElementTransformValue, worldDeltaToLocalDelta, worldSizeToLocalSize } from './engine/dom-matrix'
import type { ListFlipModule, ListFlipModuleContext, ListFlipSession, PrepareListFlipMoveInput } from './types'

type WorldRectSnapshot = {
  left: number
  top: number
  width: number
  height: number
}

type Point2D = {
  x: number
  y: number
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

type PreparedListFlipMove = {
  input: PrepareListFlipMoveInput
  firstSnapshots: FlipSnapshot[]
  flipEntries: FlipEntry[]
  movedNodeBoxBeforeMove: NodeBoxSnapshot | null
  movedWorldPhotoBeforeMove: OverlayWorldPhoto | null
  sourceListIdBeforeMove: string | null
}

/**
 * Reads one finite z-index value when the element exposes one.
 */
function readFiniteZIndex(nodeRef: Element): number | null {
  if (typeof globalThis.getComputedStyle !== 'function') {
    return null
  }

  const rawValue = globalThis.getComputedStyle(nodeRef).zIndex
  const parsedValue = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

/**
 * Resolves the top-most player context element below document body.
 */
function resolveOverlayContextRoot(anchorNode: Element): Element {
  let contextRoot = anchorNode
  let currentNode: Element | null = anchorNode

  while (
    currentNode?.parentElement !== null &&
    currentNode.parentElement !== globalThis.document.body &&
    currentNode.parentElement !== globalThis.document.documentElement
  ) {
    contextRoot = currentNode.parentElement
    currentNode = currentNode.parentElement
  }

  return contextRoot
}

class ListFlipModuleInstance implements ListFlipModule {
  private readonly context: ListFlipModuleContext
  private readonly flipEngine = createFlipEngine()
  private overlayLayerNode: HTMLElement | null = null
  private readonly overlayFinalizers = new Set<() => void>()

  private readonly flipZeroTolerance = 1e-3
  private readonly flipCalibrationTolerancePx = 0.5
  private readonly flipCalibrationMaxIterations = 5
  private readonly overlayGhostCalibrationTolerancePx = 0.2
  private readonly overlayGhostCalibrationMaxIterations = 5

  constructor(context: ListFlipModuleContext) {
    this.context = context
  }

  prepareMove(input: PrepareListFlipMoveInput): ListFlipSession | null {
    const flipEntries = this.collectFlipEntriesForMove(input.persoId, input.move)
    if (flipEntries.length === 0) {
      return null
    }

    const movedNodeBeforeMove = this.context.getNodeById(input.persoId)
    const movedNodeBoxBeforeMove =
      isDomElement(movedNodeBeforeMove) ? this.captureElementBoxSnapshot(movedNodeBeforeMove) : null
    const movedWorldPhotoBeforeMove =
      isDomElement(movedNodeBeforeMove) ? this.captureLiveWorldPhoto(movedNodeBeforeMove) : null

    const preparedMove: PreparedListFlipMove = {
      input,
      firstSnapshots: this.flipEngine.capture(flipEntries),
      flipEntries,
      movedNodeBoxBeforeMove,
      movedWorldPhotoBeforeMove,
      sourceListIdBeforeMove: this.context.getParentListId(input.persoId)
    }

    if (preparedMove.firstSnapshots.length === 0) {
      return null
    }

    return {
      commit: () => this.commitPreparedMove(preparedMove)
    }
  }

  cleanup(): void {
    this.cleanupOverlayRuntime()
  }

  private commitPreparedMove(preparedMove: PreparedListFlipMove): TransitionRequest[] {
    // Reset the moved item's anime.js translate to 0 before capturing "last".
    // readCurrentTranslate uses utils.get which reads anime.js internal state —
    // if not reset, the drag offset leaks into lastSnapshot.translateX, causing
    // toState.x = dragOffset instead of 0 and a wrong FLIP endpoint.
    const movedNode = this.context.getNodeById(preparedMove.input.persoId)
    if (isDomElement(movedNode)) {
      utils.set(movedNode as Element, { x: 0, y: 0 } as Parameters<typeof utils.set>[1])
    }

    const lastFlipSnapshots = this.flipEngine.capture(preparedMove.flipEntries)
    const flipPlan = this.flipEngine.plan(
      preparedMove.firstSnapshots,
      lastFlipSnapshots,
      this.resolveFlipPlanOptions(preparedMove.input.move)
    )

    const isOverlayWorldMove = preparedMove.input.move.flipMode === 'overlay-world'
    const movedTransitionId = `flip-${preparedMove.input.persoId}`
    const localFlipPlanTransitions =
      isOverlayWorldMove && preparedMove.input.isSeekReplay === true
        ? []
        : isOverlayWorldMove
        ? flipPlan.transitions.filter((transition) => transition.transitionId !== movedTransitionId)
        : flipPlan.transitions

    this.flipEngine.applyInvert(localFlipPlanTransitions)
    this.flipEngine.flushLayout(preparedMove.flipEntries)
    let firstFlipAppliedSnapshots = this.flipEngine.capture(preparedMove.flipEntries)

    if (!isOverlayWorldMove) {
      for (let calibrationStep = 0; calibrationStep < this.flipCalibrationMaxIterations; calibrationStep += 1) {
        const residual = this.computeFlipResidual(
          preparedMove.firstSnapshots,
          firstFlipAppliedSnapshots,
          preparedMove.input.persoId
        )

        if (residual <= this.flipCalibrationTolerancePx) {
          break
        }

        this.calibrateFlipTransitions(
          preparedMove.firstSnapshots,
          firstFlipAppliedSnapshots,
          localFlipPlanTransitions
        )
        this.flipEngine.applyInvert(localFlipPlanTransitions)
        this.flipEngine.flushLayout(preparedMove.flipEntries)
        firstFlipAppliedSnapshots = this.flipEngine.capture(preparedMove.flipEntries)
      }
    }

    const flipTransitions = this.flipEngine.toAnimationTransitions(localFlipPlanTransitions)
    const overlayWorldTransitions = this.tryBuildOverlayWorldTransitions({
      eventId: preparedMove.input.eventId,
      eventName: preparedMove.input.eventName,
      eventSeq: preparedMove.input.eventSeq,
      movedPersoId: preparedMove.input.persoId,
      sourceListId: preparedMove.sourceListIdBeforeMove,
      oldNodeBoxBeforeMove: preparedMove.movedNodeBoxBeforeMove,
      oldWorldPhotoBeforeMove: preparedMove.movedWorldPhotoBeforeMove,
      move: preparedMove.input.move,
      flipPlanTransitions: flipPlan.transitions,
      firstSnapshots: preparedMove.firstSnapshots,
      lastSnapshots: lastFlipSnapshots
    })

    const movedTransitionPrefix = `flip-${preparedMove.input.persoId}-`
    const localTransitions =
      overlayWorldTransitions === null
        ? flipTransitions
        : flipTransitions.filter((transition) => !transition.transitionId.startsWith(movedTransitionPrefix))

    const directTransitions: TransitionRequest[] = []
    for (const transition of localTransitions) {
      directTransitions.push({
        ...transition,
        eventId: preparedMove.input.eventId,
        eventName: preparedMove.input.eventName,
        listenerId: preparedMove.input.persoId,
        transitionId: `${transition.transitionId}-${preparedMove.input.eventId}`
      })
    }

    for (const transition of overlayWorldTransitions ?? []) {
      directTransitions.push(transition)
    }

    return directTransitions
  }

  /**
   * Resolves FLIP plan timing options carried by one authored move command.
   */
  private resolveFlipPlanOptions(move: MoveCommand): { durationMs?: number; easing?: string } {
    return {
      durationMs: typeof move.duration === 'number' && Number.isFinite(move.duration) ? move.duration : undefined,
      easing: move.easing ?? move.ease
    }
  }

  private collectFlipEntriesForMove(persoId: string, move: MoveCommand): FlipEntry[] {
    if (move.flip === false) {
      return []
    }

    const sourceListId = this.context.getParentListId(persoId)
    const targetListId = move.parentId
    const sourceList = sourceListId ? this.context.getListById(sourceListId) : null
    const targetList = this.context.getListById(targetListId)
    const targetNode = targetList === null ? this.context.getNodeById(targetListId) : null
    if (sourceListId === null && targetList === null && targetNode === null) {
      return []
    }

    if (targetList === null && (move.flipMode !== 'overlay-world' || targetNode === null)) {
      return []
    }

    if (targetList !== null && this.context.isMounted(targetListId) === false) {
      return []
    }

    const touchedIds = new Set<string>()
    touchedIds.add(persoId)

    for (const childId of sourceList?.getChildrenSnapshot() ?? []) {
      touchedIds.add(childId)
    }

    if (targetList !== null) {
      for (const childId of targetList.getChildrenSnapshot()) {
        touchedIds.add(childId)
      }
    }

    const entries: FlipEntry[] = []
    for (const touchedId of touchedIds) {
      const nodeRef = this.context.getNodeById(touchedId)
      if (nodeRef === null) {
        continue
      }

      entries.push({
        id: touchedId,
        nodeRef
      })
    }

    return entries
  }

  private tryBuildOverlayWorldTransitions(input: {
    eventId: string
    eventName: string
    eventSeq: number
    movedPersoId: string
    sourceListId: string | null
    oldNodeBoxBeforeMove: NodeBoxSnapshot | null
    oldWorldPhotoBeforeMove: OverlayWorldPhoto | null
    move: MoveCommand
    flipPlanTransitions: FlipTransitionRequest[]
    firstSnapshots: FlipSnapshot[]
    lastSnapshots: FlipSnapshot[]
  }): TransitionRequest[] | null {
    void input.sourceListId

    if (input.move.flipMode !== 'overlay-world') {
      return null
    }

    const nodeRef = this.context.getNodeById(input.movedPersoId)
    if (!isDomElement(nodeRef)) {
      this.context.warnOnce(
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
    const worldPhotos = input.oldWorldPhotoBeforeMove === null
      ? this.computeOverlayWorldPhotosFromLocalFlip({
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
      : {
          old: {
            ...input.oldWorldPhotoBeforeMove,
            localWidth: authoritativeOldLocalSize.width ?? input.oldWorldPhotoBeforeMove.localWidth,
            localHeight: authoritativeOldLocalSize.height ?? input.oldWorldPhotoBeforeMove.localHeight
          },
          next: this.captureLiveWorldPhoto(movedNodeElement),
          source: 'snapshot-fallback' as const
        }

    const worldPhotoClones = this.createOverlayWorldPhotoClones({
      movedNode: movedNodeElement,
      oldPhoto: worldPhotos.old,
      nextPhoto: worldPhotos.next
    })
    if (worldPhotoClones === null) {
      this.context.warnOnce(
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
      movedNode: movedNodeElement,
      animatedCloneNode: worldPhotoClones.oldCloneNode,
      targetCloneNode: worldPhotoClones.nextCloneNode,
      attraction: input.move.attraction ?? 0,
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

  private buildOverlayWorldTransitions(input: {
    eventId: string
    eventName: string
    movedPersoId: string
    movedNode: HTMLElement
    animatedCloneNode: HTMLElement
    targetCloneNode: HTMLElement
    attraction: number
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
    const fromTransformValue = readElementTransformValue(input.animatedCloneNode)
    const toTransformValue = readElementTransformValue(input.targetCloneNode)

    let finalized = false
    const finalize = (reason: 'completed' | 'stopped') => {
      if (finalized) {
        return
      }

      finalized = true
      input.onFinalize(reason)
    }

    const pushTransition = (property: string, from: number | string, to: number | string, options?: {
      finalValue?: number | string
      modifier?: (value: number) => number | string
    }) => {
      transitions.push({
        transitionId: `${transitionIdPrefix}-${property}`,
        eventId: input.eventId,
        eventName: input.eventName,
        listenerId: input.movedPersoId,
        property,
        target: input.animatedCloneNode,
        from,
        to,
        finalValue: options?.finalValue,
        modifier: options?.modifier,
        duration: input.flipTransition.duration,
        easing: input.flipTransition.easing,
        delayMs: input.flipTransition.delayMs,
        composition: 'merge',
        onFinalize: finalize
      })
    }

    const shouldUseCurvedTrajectory = input.attraction !== 0 && (
      Math.abs(toLeft - fromLeft) > this.flipZeroTolerance ||
      Math.abs(toTop - fromTop) > this.flipZeroTolerance
    )

    if (shouldUseCurvedTrajectory) {
      const controlPoint = this.resolveOverlayTrajectoryControlPoint({
        movedNode: input.movedNode,
        fromLeft,
        fromTop,
        toLeft,
        toTop,
        fromWidth,
        fromHeight,
        toWidth,
        toHeight,
        attraction: input.attraction
      })

      pushTransition('x', 0, 1, {
        finalValue: toLeft - fromLeft,
        modifier: (progress) => this.computeQuadraticBezier(progress, 0, controlPoint.x - fromLeft, toLeft - fromLeft)
      })
      pushTransition('y', 0, 1, {
        finalValue: toTop - fromTop,
        modifier: (progress) => this.computeQuadraticBezier(progress, 0, controlPoint.y - fromTop, toTop - fromTop)
      })
    } else {
      if (Math.abs(toLeft - fromLeft) > this.flipZeroTolerance) {
        pushTransition('left', `${fromLeft}px`, `${toLeft}px`)
      }
      if (Math.abs(toTop - fromTop) > this.flipZeroTolerance) {
        pushTransition('top', `${fromTop}px`, `${toTop}px`)
      }
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
   * Resolves the Bezier control point for one attracted/repelled overlay trajectory.
   */
  private resolveOverlayTrajectoryControlPoint(input: {
    movedNode: HTMLElement
    fromLeft: number
    fromTop: number
    toLeft: number
    toTop: number
    fromWidth: number
    fromHeight: number
    toWidth: number
    toHeight: number
    attraction: number
  }): Point2D {
    const runtimeCenter = this.resolveRuntimeContextCenter(input.movedNode)
    const fromCenter = {
      x: input.fromLeft + input.fromWidth / 2,
      y: input.fromTop + input.fromHeight / 2
    }
    const toCenter = {
      x: input.toLeft + input.toWidth / 2,
      y: input.toTop + input.toHeight / 2
    }
    const midpoint = {
      x: (fromCenter.x + toCenter.x) / 2,
      y: (fromCenter.y + toCenter.y) / 2
    }
    const attractionRatio = input.attraction / 100
    const controlCenter = {
      x: midpoint.x + (runtimeCenter.x - midpoint.x) * attractionRatio,
      y: midpoint.y + (runtimeCenter.y - midpoint.y) * attractionRatio
    }
    const averageWidth = (input.fromWidth + input.toWidth) / 2
    const averageHeight = (input.fromHeight + input.toHeight) / 2

    return {
      x: controlCenter.x - averageWidth / 2,
      y: controlCenter.y - averageHeight / 2
    }
  }

  /**
   * Resolves the visible center of the runtime context containing one moved node.
   */
  private resolveRuntimeContextCenter(anchorNode: Element): Point2D {
    const contextRoot = resolveOverlayContextRoot(anchorNode)
    const rect = contextRoot.getBoundingClientRect()
    if (rect.width > 1e-3 && rect.height > 1e-3) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    }

    return {
      x: (globalThis.innerWidth ?? 0) / 2,
      y: (globalThis.innerHeight ?? 0) / 2
    }
  }

  /**
   * Computes one scalar coordinate on a quadratic Bezier curve.
   */
  private computeQuadraticBezier(progress: number, from: number, control: number, to: number): number {
    const t = Math.max(0, Math.min(1, progress))
    const inverse = 1 - t
    return inverse * inverse * from + 2 * inverse * t * control + t * t * to
  }

  private toWorldRectSnapshot(input: { left: number; top: number; width: number; height: number }): WorldRectSnapshot {
    return {
      left: input.left,
      top: input.top,
      width: input.width,
      height: input.height
    }
  }

  private captureLiveWorldPhoto(nodeRef: Element): OverlayWorldPhoto {
    const rect = nodeRef.getBoundingClientRect()
    const boxSnapshot = this.captureElementBoxSnapshot(nodeRef)

    return {
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      },
      matrix: captureCombinedMatrixForNode(nodeRef),
      localWidth: boxSnapshot.computedWidthPx ?? boxSnapshot.offsetWidth ?? boxSnapshot.clientWidth ?? undefined,
      localHeight: boxSnapshot.computedHeightPx ?? boxSnapshot.offsetHeight ?? boxSnapshot.clientHeight ?? undefined
    }
  }

  private readInlinePxValue(nodeRef: HTMLElement, key: 'left' | 'top' | 'width' | 'height'): number {
    const rawValue = nodeRef.style[key]
    const parsed = Number.parseFloat(rawValue)
    return Number.isFinite(parsed) ? parsed : 0
  }

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

  private toPreferredLocalSize(box: NodeBoxSnapshot | null): { width?: number; height?: number } {
    if (box === null) {
      return {}
    }

    return {
      width: box.computedWidthPx ?? box.offsetWidth ?? box.clientWidth ?? undefined,
      height: box.computedHeightPx ?? box.offsetHeight ?? box.clientHeight ?? undefined
    }
  }

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
      from: { ...localState },
      to: { ...localState }
    }

    this.flipEngine.applyInvert([photoTransition])
    this.flipEngine.flushLayout([{ id: input.movedPersoId, nodeRef: input.movedNode }])

    const rect = input.movedNode.getBoundingClientRect()
    const boxSnapshot = this.captureElementBoxSnapshot(input.movedNode)

    return {
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      },
      matrix: captureCombinedMatrixForNode(input.movedNode),
      localWidth: boxSnapshot.computedWidthPx ?? boxSnapshot.offsetWidth ?? boxSnapshot.clientWidth ?? undefined,
      localHeight: boxSnapshot.computedHeightPx ?? boxSnapshot.offsetHeight ?? boxSnapshot.clientHeight ?? undefined
    }
  }

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
        old: { rect: input.fallbackOldRect, matrix: input.fallbackOldMatrix },
        next: { rect: input.fallbackNextRect, matrix: input.fallbackNextMatrix },
        source: 'snapshot-fallback'
      }
    }

    const liveNextSize = this.toPreferredLocalSize(this.captureElementBoxSnapshot(input.movedNode))
    const inlineStyleBefore = input.movedNode.getAttribute('style')

    try {
      const calibratedTransition: FlipTransitionRequest = {
        ...input.flipTransition,
        from: { ...input.flipTransition.from },
        to: { ...input.flipTransition.to }
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

      if (typeof input.authoritativeOldLocalWidth === 'number' && Number.isFinite(input.authoritativeOldLocalWidth) && input.authoritativeOldLocalWidth > 1e-3) {
        oldRect.localWidth = input.authoritativeOldLocalWidth
      }
      if (typeof input.authoritativeOldLocalHeight === 'number' && Number.isFinite(input.authoritativeOldLocalHeight) && input.authoritativeOldLocalHeight > 1e-3) {
        oldRect.localHeight = input.authoritativeOldLocalHeight
      }

      const nextRect = this.captureWorldPhotoFromLocalFlipState({
        movedPersoId: input.movedPersoId,
        movedNode: input.movedNode,
        flipTransition: calibratedTransition,
        state: 'to'
      })

      if (typeof liveNextSize.width === 'number' && Number.isFinite(liveNextSize.width) && liveNextSize.width > 1e-3) {
        nextRect.localWidth = liveNextSize.width
      }
      if (typeof liveNextSize.height === 'number' && Number.isFinite(liveNextSize.height) && liveNextSize.height > 1e-3) {
        nextRect.localHeight = liveNextSize.height
      }

      return {
        old: oldRect,
        next: nextRect,
        source: 'local-transposed'
      }
    } catch {
      return {
        old: { rect: input.fallbackOldRect, matrix: input.fallbackOldMatrix },
        next: { rect: input.fallbackNextRect, matrix: input.fallbackNextMatrix },
        source: 'snapshot-fallback'
      }
    } finally {
      if (inlineStyleBefore === null) {
        input.movedNode.removeAttribute('style')
      } else {
        input.movedNode.setAttribute('style', inlineStyleBefore)
      }

      this.flipEngine.flushLayout([{ id: input.movedPersoId, nodeRef: input.movedNode }])
    }
  }

  private ensureOverlayLayer(anchorNode: Element): HTMLElement | null {
    if (typeof globalThis.document === 'undefined') {
      return null
    }

    const overlayLayerZIndex = this.resolveOverlayLayerZIndex(anchorNode)

    if (this.overlayLayerNode !== null && this.overlayLayerNode.isConnected) {
      this.overlayLayerNode.style.zIndex = String(overlayLayerZIndex)
      return this.overlayLayerNode
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
    overlayLayer.style.zIndex = String(overlayLayerZIndex)
    globalThis.document.body.appendChild(overlayLayer)
    this.overlayLayerNode = overlayLayer
    return overlayLayer
  }

  /**
   * Resolves one overlay z-index above the player subtree only.
   */
  private resolveOverlayLayerZIndex(anchorNode: Element): number {
    const contextRoot = resolveOverlayContextRoot(anchorNode)
    let maxZIndex = 0

    let currentNode: Element | null = anchorNode
    while (currentNode !== null) {
      maxZIndex = Math.max(maxZIndex, readFiniteZIndex(currentNode) ?? 0)
      currentNode = currentNode.parentElement
    }

    maxZIndex = Math.max(maxZIndex, readFiniteZIndex(contextRoot) ?? 0)
    for (const descendantNode of contextRoot.querySelectorAll('*')) {
      maxZIndex = Math.max(maxZIndex, readFiniteZIndex(descendantNode) ?? 0)
    }

    return maxZIndex + 1
  }

  private createOverlayWorldPhotoClones(input: {
    movedNode: Element
    oldPhoto: OverlayWorldPhoto
    nextPhoto: OverlayWorldPhoto
  }): {
    oldCloneNode: HTMLElement
    nextCloneNode: HTMLElement
    finalize: () => void
  } | null {
    const overlayLayer = this.ensureOverlayLayer(input.movedNode)
    if (overlayLayer === null || typeof globalThis.HTMLElement === 'undefined' || !(input.movedNode instanceof globalThis.HTMLElement)) {
      return null
    }

    const oldCloneNode = input.movedNode.cloneNode(true)
    const nextCloneNode = input.movedNode.cloneNode(true)
    if (!(oldCloneNode instanceof globalThis.HTMLElement) || !(nextCloneNode instanceof globalThis.HTMLElement)) {
      return null
    }

    const setupClone = (cloneNode: HTMLElement, photo: OverlayWorldPhoto, phase: 'old' | 'next') => {
      const localWidth = typeof photo.localWidth === 'number' && Number.isFinite(photo.localWidth) && photo.localWidth > 1e-3 ? photo.localWidth : Math.max(1e-3, photo.rect.width)
      const localHeight = typeof photo.localHeight === 'number' && Number.isFinite(photo.localHeight) && photo.localHeight > 1e-3 ? photo.localHeight : Math.max(1e-3, photo.rect.height)
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
      cloneNode.style.zIndex = overlayLayer.style.zIndex
      overlayLayer.appendChild(cloneNode)
      this.calibrateOverlayGhostToWorldSnapshot(cloneNode, photo.rect, { lockSize: true })
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
    let styleWidthPx = Math.max(1e-3, Number.parseFloat(ghostNode.style.width || '') || targetSnapshot.width)
    let styleHeightPx = Math.max(1e-3, Number.parseFloat(ghostNode.style.height || '') || targetSnapshot.height)

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

  private computeFlipResidual(
    oldSnapshots: Array<{ id: string; left: number; top: number; width: number; height: number }>,
    firstFlipSnapshots: Array<{ id: string; left: number; top: number; width: number; height: number }>,
    movedPersoId: string
  ): number {
    const oldSnapshot = oldSnapshots.find((snapshot) => snapshot.id === movedPersoId)
    const firstFlipSnapshot = firstFlipSnapshots.find((snapshot) => snapshot.id === movedPersoId)
    if (!oldSnapshot || !firstFlipSnapshot) {
      return 0
    }

    return Math.max(
      Math.abs(oldSnapshot.left - firstFlipSnapshot.left),
      Math.abs(oldSnapshot.top - firstFlipSnapshot.top),
      Math.abs(oldSnapshot.width - firstFlipSnapshot.width),
      Math.abs(oldSnapshot.height - firstFlipSnapshot.height)
    )
  }

  private calibrateFlipTransitions(
    oldSnapshots: Array<{ id: string; left: number; top: number; width: number; height: number; parentMatrix: Matrix2D; matrix: Matrix2D; translateX: number; translateY: number }>,
    firstFlipSnapshots: Array<{ id: string; left: number; top: number; width: number; height: number; parentMatrix: Matrix2D; matrix: Matrix2D; translateX: number; translateY: number }>,
    transitions: Array<{ transitionId: string; from: { x?: number; y?: number; width?: number; height?: number } }>
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
        const localResidual = worldDeltaToLocalDelta(matrixForTranslation, residualX, residualY)
        transition.from.x = (transition.from.x ?? 0) + localResidual.x
        transition.from.y = (transition.from.y ?? 0) + localResidual.y
      }

      if (
        transition.from.width !== undefined &&
        transition.from.height !== undefined &&
        (Math.abs(residualWidth) > this.flipZeroTolerance || Math.abs(residualHeight) > this.flipZeroTolerance)
      ) {
        const desiredLocalSize = worldSizeToLocalSize(matrixForSize, oldSnapshot.width, oldSnapshot.height)
        transition.from.width = desiredLocalSize.width
        transition.from.height = desiredLocalSize.height
      }
    }
  }

}

export function createListFlipModule(context: ListFlipModuleContext): ListFlipModule {
  return new ListFlipModuleInstance(context)
}
