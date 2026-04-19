import { utils } from 'animejs'

import { runAnimationBatch } from '../../animation/run-batch'
import type { TransitionRequest } from '../../animation/types'
import { createIdentityMatrix, createTranslateMatrix, invertMatrix, multiplyMatrix, parseCssMatrix } from './matrix-2d'
import type {
  FlipEngine,
  FlipEngineOptions,
  FlipEntry,
  FlipPlanOptions,
  FlipPlanResult,
  FlipRunOptions,
  FlipSnapshot,
  FlipTransitionRequest,
  Matrix2D
} from './types'

type RectLike = {
  left: number
  top: number
  width: number
  height: number
}

type MeasurableNode = {
  getBoundingClientRect: () => RectLike
}

type MutableStyle = {
  transform?: string
  transformOrigin?: string
}

type NodeWithStyle = {
  style?: MutableStyle
}

type ParentAwareNode = {
  parentElement?: unknown
  parentNode?: unknown
}

type LastEndCoords = {
  left: number
  top: number
  width: number
  height: number
}

const DEFAULT_DURATION_MS = 320
const DEFAULT_EASING = 'easeOutCubic'
const DEFAULT_STAGGER_MS = 0

/**
 * Checks whether one unknown node can be measured.
 */
function isMeasurableNode(nodeRef: unknown): nodeRef is MeasurableNode {
  return (
    typeof nodeRef === 'object' &&
    nodeRef !== null &&
    typeof (nodeRef as MeasurableNode).getBoundingClientRect === 'function'
  )
}

/**
 * Checks whether one target is a DOM Element.
 */
function isElementTarget(nodeRef: unknown): nodeRef is Element {
  return typeof Element !== 'undefined' && nodeRef instanceof Element
}

/**
 * Reads a mutable style object from one unknown node when available.
 */
function getNodeStyle(nodeRef: unknown): MutableStyle | null {
  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return null
  }

  const style = (nodeRef as NodeWithStyle).style
  if (typeof style !== 'object' || style === null) {
    return null
  }

  return style
}

/**
 * Reads the current transform and transform-origin values from one node.
 */
function readTransformState(nodeRef: unknown): { transform: string; transformOrigin: string } {
  if (typeof globalThis.getComputedStyle === 'function' && isElementTarget(nodeRef)) {
    const computedStyle = globalThis.getComputedStyle(nodeRef)
    return {
      transform: computedStyle.transform || 'none',
      transformOrigin: computedStyle.transformOrigin || '50% 50%'
    }
  }

  const style = getNodeStyle(nodeRef)
  return {
    transform: style?.transform ?? 'none',
    transformOrigin: style?.transformOrigin ?? '50% 50%'
  }
}

/**
 * Reads only the transform string from one node-like reference.
 */
function readTransformValue(nodeRef: unknown): string {
  return readTransformState(nodeRef).transform
}

/**
 * Resolves the parent node reference used for transform-chain traversal.
 */
function getParentNodeRef(nodeRef: unknown): unknown {
  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return null
  }

  const parentAwareNode = nodeRef as ParentAwareNode
  return parentAwareNode.parentElement ?? parentAwareNode.parentNode ?? null
}

/**
 * Reads one combined parent transform matrix from root ancestor to direct parent.
 */
function readParentMatrix(nodeRef: unknown): Matrix2D {
  const parentChain: unknown[] = []
  let currentParent = getParentNodeRef(nodeRef)

  while (currentParent !== null) {
    parentChain.push(currentParent)
    currentParent = getParentNodeRef(currentParent)
  }

  let combinedParentMatrix = createIdentityMatrix()
  for (const parentNodeRef of parentChain.reverse()) {
    const parentMatrix = parseCssMatrix(readTransformValue(parentNodeRef))
    combinedParentMatrix = multiplyMatrix(combinedParentMatrix, parentMatrix)
  }

  return combinedParentMatrix
}

/**
 * Reads current x/y translate channels from one node.
 */
function readCurrentTranslate(nodeRef: unknown): { x: number; y: number } {
  if (isElementTarget(nodeRef)) {
    const xValue = Number(utils.get(nodeRef, 'x', false))
    const yValue = Number(utils.get(nodeRef, 'y', false))

    return {
      x: Number.isFinite(xValue) ? xValue : 0,
      y: Number.isFinite(yValue) ? yValue : 0
    }
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    const nodeAsObject = nodeRef as Record<string, unknown>
    return {
      x: typeof nodeAsObject.x === 'number' ? nodeAsObject.x : 0,
      y: typeof nodeAsObject.y === 'number' ? nodeAsObject.y : 0
    }
  }

  return { x: 0, y: 0 }
}

/**
 * Checks whether one node has one inline style value already defined.
 */
function hasInlineStyleValue(nodeRef: unknown, property: 'width' | 'height'): boolean {
  if (isElementTarget(nodeRef)) {
    const elementStyle = (nodeRef as HTMLElement).style
    const styleValue = property === 'width' ? elementStyle.width : elementStyle.height
    return styleValue.trim().length > 0
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    const targetObject = nodeRef as Record<string, unknown>
    const styleRecord =
      typeof targetObject.style === 'object' && targetObject.style !== null
        ? (targetObject.style as Record<string, unknown>)
        : null

    if (styleRecord === null) {
      return false
    }

    const styleValue = styleRecord[property]
    return typeof styleValue === 'string' && styleValue.trim().length > 0
  }

  return false
}

/**
 * Converts one world-space translation vector to local-space using one matrix.
 */
function toLocalDelta(matrix: Matrix2D, worldDeltaX: number, worldDeltaY: number): { x: number; y: number } {
  const inverseMatrix = invertMatrix(matrix)
  if (inverseMatrix === null) {
    return { x: worldDeltaX, y: worldDeltaY }
  }

  return {
    x: inverseMatrix.a * worldDeltaX + inverseMatrix.c * worldDeltaY,
    y: inverseMatrix.b * worldDeltaX + inverseMatrix.d * worldDeltaY
  }
}

/**
 * Resolves local width/height needed to match one world-space bbox size.
 */
function worldSizeToLocalSize(
  matrix: Matrix2D,
  worldWidth: number,
  worldHeight: number
): { width: number; height: number } {
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

/**
 * Decomposes one affine matrix into rotate/scale channels.
 */
function decomposeMatrix(matrix: Matrix2D): { rotateDeg: number; scaleX: number; scaleY: number } {
  const scaleX = Math.hypot(matrix.a, matrix.b)
  const safeScaleX = scaleX > 1e-8 ? scaleX : 1
  const rotateRad = Math.atan2(matrix.b, matrix.a)
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  const scaleY = determinant / safeScaleX

  return {
    rotateDeg: (rotateRad * 180) / Math.PI,
    scaleX: safeScaleX,
    scaleY: Math.abs(scaleY) > 1e-8 ? scaleY : 1
  }
}

/**
 * Determines whether one transition state contains at least one animatable key.
 */
function hasTransitionState(state: { x?: number; y?: number; width?: number; height?: number }): boolean {
  return (
    state.x !== undefined ||
    state.y !== undefined ||
    state.width !== undefined ||
    state.height !== undefined ||
    (state as { rotate?: number }).rotate !== undefined ||
    (state as { scaleX?: number }).scaleX !== undefined ||
    (state as { scaleY?: number }).scaleY !== undefined
  )
}

/**
 * Converts one numeric size to CSS pixels.
 */
function toPx(value: number): string {
  return `${value}px`
}

/**
 * Applies one channel state to target immediately.
 */
function applyChannelState(target: unknown, state: { x?: number; y?: number; width?: number; height?: number }): void {
  if (isElementTarget(target)) {
    const payload: Record<string, unknown> = {}

    if (state.x !== undefined) {
      payload.x = state.x
    }
    if (state.y !== undefined) {
      payload.y = state.y
    }
    if (state.width !== undefined) {
      payload.width = toPx(state.width)
    }
    if (state.height !== undefined) {
      payload.height = toPx(state.height)
    }
    if ((state as { rotate?: number }).rotate !== undefined) {
      payload.rotate = (state as { rotate?: number }).rotate
    }
    if ((state as { scaleX?: number }).scaleX !== undefined) {
      payload.scaleX = (state as { scaleX?: number }).scaleX
    }
    if ((state as { scaleY?: number }).scaleY !== undefined) {
      payload.scaleY = (state as { scaleY?: number }).scaleY
    }

    if (Object.keys(payload).length > 0) {
      utils.set(target, payload as Parameters<typeof utils.set>[1])
    }
    return
  }

  if (typeof target === 'object' && target !== null) {
    const mutableTarget = target as Record<string, unknown>
    const mutableStyle =
      typeof mutableTarget.style === 'object' && mutableTarget.style !== null
        ? (mutableTarget.style as Record<string, unknown>)
        : null

    if (state.x !== undefined) {
      mutableTarget.x = state.x
    }
    if (state.y !== undefined) {
      mutableTarget.y = state.y
    }
    if (state.width !== undefined) {
      mutableTarget.width = state.width
      if (mutableStyle !== null) {
        mutableStyle.width = toPx(state.width)
      }
    }
    if (state.height !== undefined) {
      mutableTarget.height = state.height
      if (mutableStyle !== null) {
        mutableStyle.height = toPx(state.height)
      }
    }
    if ((state as { rotate?: number }).rotate !== undefined) {
      mutableTarget.rotate = (state as { rotate?: number }).rotate
    }
    if ((state as { scaleX?: number }).scaleX !== undefined) {
      mutableTarget.scaleX = (state as { scaleX?: number }).scaleX
    }
    if ((state as { scaleY?: number }).scaleY !== undefined) {
      mutableTarget.scaleY = (state as { scaleY?: number }).scaleY
    }
  }
}

/**
 * Flushes one layout read to lock inversion writes before PLAY.
 */
function flushLayout(entries: FlipEntry[]): void {
  for (const entry of entries) {
    if (!isMeasurableNode(entry.nodeRef)) {
      continue
    }

    entry.nodeRef.getBoundingClientRect()
    return
  }
}

/**
 * Waits for the next animation frame using the provided scheduler.
 */
function waitNextFrame(requestFrame: (callback: () => void) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    requestFrame(() => resolve())
  })
}

/**
 * Requests one frame using the browser animation frame scheduler.
 */
function requestAnimationFrameOnce(callback: () => void): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    throw new Error('FLIP engine requires requestAnimationFrame support')
  }

  globalThis.requestAnimationFrame(() => callback())
}

/**
 * Creates one FLIP engine aligned with runtime move semantics.
 */
export function createFlipEngine(options: FlipEngineOptions = {}): FlipEngine {
  const requestFrame = options.requestFrame ?? requestAnimationFrameOnce

  const lastEndCoords = new Map<string, LastEndCoords>()

  /**
   * Captures geometry and transform snapshots for one batch of nodes.
   */
  function capture(entries: FlipEntry[], useLastEndCoords = false): FlipSnapshot[] {
    const snapshots: FlipSnapshot[] = []

    for (const entry of entries) {
      if (!isMeasurableNode(entry.nodeRef)) {
        continue
      }

      const measuredRect = entry.nodeRef.getBoundingClientRect()
      const carriedRect = useLastEndCoords ? lastEndCoords.get(entry.id) : undefined
      const rect = {
        left: carriedRect?.left ?? measuredRect.left,
        top: carriedRect?.top ?? measuredRect.top,
        width: carriedRect?.width ?? measuredRect.width,
        height: carriedRect?.height ?? measuredRect.height
      }

      const transformState = readTransformState(entry.nodeRef)
      const currentTranslate = readCurrentTranslate(entry.nodeRef)

      snapshots.push({
        id: entry.id,
        nodeRef: entry.nodeRef,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        parentMatrix: readParentMatrix(entry.nodeRef),
        transformValue: transformState.transform,
        translateX: currentTranslate.x,
        translateY: currentTranslate.y,
        matrix: parseCssMatrix(transformState.transform),
        transformOrigin: transformState.transformOrigin,
        hasInlineWidth: hasInlineStyleValue(entry.nodeRef, 'width'),
        hasInlineHeight: hasInlineStyleValue(entry.nodeRef, 'height')
      })
    }

    return snapshots
  }

  /**
   * Plans FLIP transitions from first and last snapshots.
   */
  function plan(first: FlipSnapshot[], last: FlipSnapshot[], planOptions: FlipPlanOptions = {}): FlipPlanResult {
    const transitions: FlipTransitionRequest[] = []
    const lastById = new Map(last.map((snapshot) => [snapshot.id, snapshot]))

    const includeSize = planOptions.includeSize ?? true
    const includeTransformMatrix = planOptions.includeTransformMatrix ?? true
    const duration = planOptions.durationMs ?? DEFAULT_DURATION_MS
    const easing = planOptions.easing ?? DEFAULT_EASING
    const staggerMs = planOptions.staggerMs ?? DEFAULT_STAGGER_MS

    for (const [index, firstSnapshot] of first.entries()) {
      const lastSnapshot = lastById.get(firstSnapshot.id)
      if (!lastSnapshot) {
        continue
      }

      const dx = firstSnapshot.left - lastSnapshot.left
      const dy = firstSnapshot.top - lastSnapshot.top
      const px = lastSnapshot.translateX
      const py = lastSnapshot.translateY

      const oldCombinedMatrix = multiplyMatrix(firstSnapshot.parentMatrix, firstSnapshot.matrix)
      const lastCombinedMatrix = multiplyMatrix(lastSnapshot.parentMatrix, lastSnapshot.matrix)
      const fromSizeMatrix = includeTransformMatrix
        ? multiplyMatrix(oldCombinedMatrix, createTranslateMatrix(-px, -py))
        : createIdentityMatrix()
      const toSizeMatrix = includeTransformMatrix
        ? multiplyMatrix(lastCombinedMatrix, createTranslateMatrix(-px, -py))
        : createIdentityMatrix()
      const localDiff = includeTransformMatrix ? toLocalDelta(oldCombinedMatrix, dx, dy) : { x: dx, y: dy }
      const inverseLastCombinedMatrix = invertMatrix(lastCombinedMatrix)
      const inheritedTransformDelta =
        includeTransformMatrix && inverseLastCombinedMatrix !== null
          ? multiplyMatrix(inverseLastCombinedMatrix, oldCombinedMatrix)
          : createIdentityMatrix()
      const inheritedTransformChannels = decomposeMatrix(inheritedTransformDelta)

      const moved = Math.abs(localDiff.x) > 1e-3 || Math.abs(localDiff.y) > 1e-3
      const resized = Math.abs(firstSnapshot.width - lastSnapshot.width) > 1e-3 || Math.abs(firstSnapshot.height - lastSnapshot.height) > 1e-3

      const fromState: FlipTransitionRequest['from'] = {}
      const toState: FlipTransitionRequest['to'] = {}

      if (moved) {
        fromState.x = localDiff.x + px
        toState.x = px
        fromState.y = localDiff.y + py
        toState.y = py
      }

      if (includeSize && resized) {
        const fromSize = includeTransformMatrix
          ? worldSizeToLocalSize(fromSizeMatrix, firstSnapshot.width, firstSnapshot.height)
          : { width: firstSnapshot.width, height: firstSnapshot.height }

        const toSize = includeTransformMatrix
          ? worldSizeToLocalSize(toSizeMatrix, lastSnapshot.width, lastSnapshot.height)
          : { width: lastSnapshot.width, height: lastSnapshot.height }

        if (Math.abs(fromSize.width - toSize.width) > 1e-3) {
          fromState.width = fromSize.width
          toState.width = toSize.width
        }

        if (Math.abs(fromSize.height - toSize.height) > 1e-3) {
          fromState.height = fromSize.height
          toState.height = toSize.height
        }
      }

      if (includeTransformMatrix) {
        const rotateDiff = inheritedTransformChannels.rotateDeg
        const scaleXDiff = inheritedTransformChannels.scaleX
        const scaleYDiff = inheritedTransformChannels.scaleY

        if (Math.abs(rotateDiff) > 1e-3) {
          ;(fromState as { rotate?: number }).rotate = rotateDiff
          ;(toState as { rotate?: number }).rotate = 0
        }

        if (Math.abs(scaleXDiff - 1) > 1e-3) {
          ;(fromState as { scaleX?: number }).scaleX = scaleXDiff
          ;(toState as { scaleX?: number }).scaleX = 1
        }

        if (Math.abs(scaleYDiff - 1) > 1e-3) {
          ;(fromState as { scaleY?: number }).scaleY = scaleYDiff
          ;(toState as { scaleY?: number }).scaleY = 1
        }
      }

      if (!hasTransitionState(fromState)) {
        continue
      }

      transitions.push({
        transitionId: `flip-${firstSnapshot.id}`,
        nodeRef: firstSnapshot.nodeRef,
        from: fromState,
        to: toState,
        duration,
        easing,
        delayMs: index * staggerMs,
        cleanupWidthAfterPlay: fromState.width !== undefined && lastSnapshot.hasInlineWidth !== true,
        cleanupHeightAfterPlay: fromState.height !== undefined && lastSnapshot.hasInlineHeight !== true
      })
    }

    return { transitions }
  }

  /**
   * Converts FLIP transitions to runtime animation transition requests.
   */
  function toAnimationTransitions(transitions: FlipTransitionRequest[]): TransitionRequest[] {
    const animationTransitions: TransitionRequest[] = []

    for (const transition of transitions) {
      const eventId = `evt-${transition.transitionId}`
      const eventName = 'flip:play'
      const listenerId = transition.transitionId

      if (transition.from.x !== undefined && transition.to.x !== undefined && transition.from.x !== transition.to.x) {
        animationTransitions.push({
          transitionId: `${transition.transitionId}-x`,
          eventId,
          eventName,
          listenerId,
          property: 'x',
          target: transition.nodeRef,
          from: transition.from.x,
          to: transition.to.x,
          duration: transition.duration,
          easing: transition.easing,
          delayMs: transition.delayMs,
          composition: 'merge'
        })
      }

      if (transition.from.y !== undefined && transition.to.y !== undefined && transition.from.y !== transition.to.y) {
        animationTransitions.push({
          transitionId: `${transition.transitionId}-y`,
          eventId,
          eventName,
          listenerId,
          property: 'y',
          target: transition.nodeRef,
          from: transition.from.y,
          to: transition.to.y,
          duration: transition.duration,
          easing: transition.easing,
          delayMs: transition.delayMs,
          composition: 'merge'
        })
      }

      if (transition.from.width !== undefined && transition.to.width !== undefined && transition.from.width !== transition.to.width) {
        animationTransitions.push({
          transitionId: `${transition.transitionId}-width`,
          eventId,
          eventName,
          listenerId,
          property: 'width',
          target: transition.nodeRef,
          from: toPx(transition.from.width),
          to: toPx(transition.to.width),
          duration: transition.duration,
          easing: transition.easing,
          delayMs: transition.delayMs,
          composition: 'merge',
          cleanupStyleProperty: transition.cleanupWidthAfterPlay ? 'width' : undefined
        })
      }

      if (transition.from.height !== undefined && transition.to.height !== undefined && transition.from.height !== transition.to.height) {
        animationTransitions.push({
          transitionId: `${transition.transitionId}-height`,
          eventId,
          eventName,
          listenerId,
          property: 'height',
          target: transition.nodeRef,
          from: toPx(transition.from.height),
          to: toPx(transition.to.height),
          duration: transition.duration,
          easing: transition.easing,
          delayMs: transition.delayMs,
          composition: 'merge',
          cleanupStyleProperty: transition.cleanupHeightAfterPlay ? 'height' : undefined
        })
      }

      if (
        transition.from.rotate !== undefined &&
        transition.to.rotate !== undefined &&
        transition.from.rotate !== transition.to.rotate
      ) {
        animationTransitions.push({
          transitionId: `${transition.transitionId}-rotate`,
          eventId,
          eventName,
          listenerId,
          property: 'rotate',
          target: transition.nodeRef,
          from: transition.from.rotate,
          to: transition.to.rotate,
          duration: transition.duration,
          easing: transition.easing,
          delayMs: transition.delayMs,
          composition: 'merge'
        })
      }

      if (
        transition.from.scaleX !== undefined &&
        transition.to.scaleX !== undefined &&
        transition.from.scaleX !== transition.to.scaleX
      ) {
        animationTransitions.push({
          transitionId: `${transition.transitionId}-scale-x`,
          eventId,
          eventName,
          listenerId,
          property: 'scaleX',
          target: transition.nodeRef,
          from: transition.from.scaleX,
          to: transition.to.scaleX,
          duration: transition.duration,
          easing: transition.easing,
          delayMs: transition.delayMs,
          composition: 'merge'
        })
      }

      if (
        transition.from.scaleY !== undefined &&
        transition.to.scaleY !== undefined &&
        transition.from.scaleY !== transition.to.scaleY
      ) {
        animationTransitions.push({
          transitionId: `${transition.transitionId}-scale-y`,
          eventId,
          eventName,
          listenerId,
          property: 'scaleY',
          target: transition.nodeRef,
          from: transition.from.scaleY,
          to: transition.to.scaleY,
          duration: transition.duration,
          easing: transition.easing,
          delayMs: transition.delayMs,
          composition: 'merge'
        })
      }

    }

    return animationTransitions
  }

  /**
   * Applies FLIP inversion channels immediately after LAST capture.
   */
  function applyInvertState(transitions: FlipTransitionRequest[], applyTransform: boolean): void {
    if (!applyTransform) {
      return
    }

    for (const transition of transitions) {
      applyChannelState(transition.nodeRef, transition.from)
    }
  }

  /**
   * Applies one invert state batch without triggering playback.
   */
  function applyInvert(transitions: FlipTransitionRequest[]): void {
    applyInvertState(transitions, true)
  }

  /**
   * Updates cached end geometry for continuity across consecutive runs.
   */
  function storeLastEndCoords(lastSnapshots: FlipSnapshot[]): void {
    for (const snapshot of lastSnapshots) {
      lastEndCoords.set(snapshot.id, {
        left: snapshot.left,
        top: snapshot.top,
        width: snapshot.width,
        height: snapshot.height
      })
    }
  }

  /**
   * Executes FIRST/LAST/INVERT/PLAY with one frame barrier before playback.
   */
  async function run(runOptions: FlipRunOptions) {
    const first = capture(runOptions.entries, true)

    runOptions.mutate()

    const last = capture(runOptions.entries, false)
    const planResult = plan(first, last, runOptions.options)
    const applyInvertTransformToTarget = runOptions.applyInvertTransformToTarget ?? false

    applyInvertState(planResult.transitions, applyInvertTransformToTarget)
    flushLayout(runOptions.entries)

    await waitNextFrame(requestFrame)

    const animationTransitions = toAnimationTransitions(planResult.transitions)
    const animation = runAnimationBatch(animationTransitions, runOptions.animationAdapter)

    storeLastEndCoords(last)

    return {
      first,
      last,
      transitions: planResult.transitions,
      animationTransitions,
      animation
    }
  }

  return {
    capture: (entries) => capture(entries, false),
    plan,
    toAnimationTransitions,
    applyInvert,
    flushLayout,
    run
  }
}
