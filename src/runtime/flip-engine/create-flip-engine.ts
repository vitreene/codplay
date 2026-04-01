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
 * Determines whether one transition state contains at least one animatable key.
 */
function hasTransitionState(state: { x?: number; y?: number; width?: number; height?: number }): boolean {
  return state.x !== undefined || state.y !== undefined || state.width !== undefined || state.height !== undefined
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
      payload.width = state.width
    }
    if (state.height !== undefined) {
      payload.height = state.height
    }

    if (Object.keys(payload).length > 0) {
      utils.set(target, payload as Parameters<typeof utils.set>[1])
    }
    return
  }

  if (typeof target === 'object' && target !== null) {
    const mutableTarget = target as Record<string, unknown>
    if (state.x !== undefined) {
      mutableTarget.x = state.x
    }
    if (state.y !== undefined) {
      mutableTarget.y = state.y
    }
    if (state.width !== undefined) {
      mutableTarget.width = state.width
    }
    if (state.height !== undefined) {
      mutableTarget.height = state.height
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
 * Waits for the next animation frame with a scheduler fallback.
 */
function waitNextFrame(requestFrame: (callback: () => void) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    requestFrame(() => resolve())
  })
}

/**
 * Creates one FLIP engine aligned with runtime move semantics.
 */
export function createFlipEngine(options: FlipEngineOptions = {}): FlipEngine {
  const requestFrame =
    options.requestFrame ??
    ((callback: () => void) => {
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => callback())
        return
      }

      setTimeout(callback, 0)
    })

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
        transformOrigin: transformState.transformOrigin
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

      const transformMatrix = includeTransformMatrix
        ? multiplyMatrix(
            multiplyMatrix(lastSnapshot.parentMatrix, lastSnapshot.matrix),
            createTranslateMatrix(-px, -py)
          )
        : createIdentityMatrix()

      const localDiff = includeTransformMatrix ? toLocalDelta(transformMatrix, dx, dy) : { x: dx, y: dy }

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
        fromState.width = firstSnapshot.width
        toState.width = lastSnapshot.width
        fromState.height = firstSnapshot.height
        toState.height = lastSnapshot.height
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
        delayMs: index * staggerMs
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
          composition: 'merge'
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
    run
  }
}
