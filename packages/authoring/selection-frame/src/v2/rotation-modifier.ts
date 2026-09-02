/** Reusable V2 rotation needle and movable-axis capability module. */

import { bindGestureSession, type GestureSessionHandle } from '../gesture-session'
import { CHARACTERISTIC_POINTS, HANDLE_SIZE_PX } from '../handle-geometry'
import type {
  SelectionFrameDelta,
  SelectionFrameHandleId,
  SelectionFrameRotationOrigin,
  SelectionFrameValue,
  SelectionFrameV2Modifier,
  SelectionFrameV2ModifierContext,
  SelectionFrameV2ModifierHandle,
} from './types'

const PIVOT_SIZE_PX = 12
const NEEDLE_LENGTH_PX = 36
const PIVOT_MAGNET_RADIUS_PX = 8
const ROTATE_STEP_DEG = 15

type Point = Readonly<{ x: number; y: number }>
type Gesture =
  | {
    kind: 'rotate'
    startValue: SelectionFrameValue
    pivot: Point
    previousPointerAngleDeg: number
    accumulatedDeg: number
  }
  | { kind: 'pivot'; startValue: SelectionFrameValue }

/** Creates the reusable rotation/pivot modifier used by the V2 editor frame. */
export function createRotationModifier(): SelectionFrameV2Modifier {
  return {
    name: 'rotation',
    mount: mountRotationModifier,
  }
}

/** Mounts the needle, pivot and their pointer sessions into one frame instance. */
function mountRotationModifier(context: SelectionFrameV2ModifierContext): SelectionFrameV2ModifierHandle {
  const doc = context.frame.ownerDocument
  const pivotNode = doc.createElement('div')
  pivotNode.setAttribute('data-selection-frame-pivot', '')
  pivotNode.style.position = 'absolute'
  pivotNode.style.width = `${PIVOT_SIZE_PX}px`
  pivotNode.style.height = `${PIVOT_SIZE_PX}px`
  pivotNode.style.marginLeft = `${-PIVOT_SIZE_PX / 2}px`
  pivotNode.style.marginTop = `${-PIVOT_SIZE_PX / 2}px`
  pivotNode.style.borderRadius = '50%'
  pivotNode.style.background = '#0284c7'
  pivotNode.style.border = '2px solid #ffffff'
  pivotNode.style.boxSizing = 'border-box'
  pivotNode.style.cursor = 'grab'
  pivotNode.style.touchAction = 'none'
  context.frame.appendChild(pivotNode)

  const needleLine = doc.createElement('div')
  needleLine.setAttribute('data-selection-frame-needle', '')
  needleLine.style.position = 'absolute'
  needleLine.style.height = '2px'
  needleLine.style.background = '#0284c7'
  needleLine.style.transformOrigin = '0 50%'
  needleLine.style.pointerEvents = 'none'
  context.frame.appendChild(needleLine)

  const needleTip = doc.createElement('div')
  needleTip.setAttribute('data-selection-frame-needle-tip', '')
  needleTip.style.position = 'absolute'
  needleTip.style.width = `${HANDLE_SIZE_PX}px`
  needleTip.style.height = `${HANDLE_SIZE_PX}px`
  needleTip.style.marginLeft = `${-HANDLE_SIZE_PX / 2}px`
  needleTip.style.marginTop = `${-HANDLE_SIZE_PX / 2}px`
  needleTip.style.borderRadius = '50%'
  needleTip.style.background = '#ffffff'
  needleTip.style.border = '2px solid #0284c7'
  needleTip.style.boxSizing = 'border-box'
  needleTip.style.cursor = 'crosshair'
  needleTip.style.touchAction = 'none'
  context.frame.appendChild(needleTip)

  let value: SelectionFrameValue | null = null
  let pivotMagnetTarget: SelectionFrameHandleId | null = null
  let needleAngleDeg = -90
  let needleLengthPx = NEEDLE_LENGTH_PX
  const gestures: GestureSessionHandle[] = []

  /** Returns the bounded rotation origin, preserving the center default. */
  function rotationOriginOf(input: SelectionFrameValue): SelectionFrameRotationOrigin {
    const origin = input.rotationOrigin
    return {
      fx: clampUnit(origin?.fx ?? 0.5),
      fy: clampUnit(origin?.fy ?? 0.5),
    }
  }

  /** Converts one finite value to the 0..1 box-fraction interval. */
  function clampUnit(input: number): number {
    return Number.isFinite(input) ? Math.min(1, Math.max(0, input)) : 0.5
  }

  /** Returns a finite non-zero scale for the local inverse used by pivot placement. */
  function finiteNonZeroScale(input: number | undefined): number {
    return input !== undefined && Number.isFinite(input) && Math.abs(input) > 1e-8 ? input : 1
  }

  /** Returns the local linear transform (rotate then scale) of a frame value. */
  function linearTransform(input: SelectionFrameValue): { a: number; b: number; c: number; d: number } {
    const angle = ((input.rotate ?? 0) * Math.PI) / 180
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    return {
      a: cosine * finiteNonZeroScale(input.scaleX),
      b: sine * finiteNonZeroScale(input.scaleX),
      c: -sine * finiteNonZeroScale(input.scaleY),
      d: cosine * finiteNonZeroScale(input.scaleY),
    }
  }

  /** Returns the scene-root viewport origin used by the absolute overlay. */
  function sceneRootViewportOrigin(): Point {
    const rect = context.sceneRoot.getBoundingClientRect()
    return { x: rect.left, y: rect.top }
  }

  /** Maps one local-box point to the viewport without reading a player node. */
  function localPointToViewport(input: SelectionFrameValue, localX: number, localY: number): Point {
    const origin = rotationOriginOf(input)
    const pivotX = origin.fx * input.width
    const pivotY = origin.fy * input.height
    const matrix = linearTransform(input)
    const root = sceneRootViewportOrigin()
    const baseX = root.x + input.x + pivotX - (matrix.a * pivotX + matrix.c * pivotY)
    const baseY = root.y + input.y + pivotY - (matrix.b * pivotX + matrix.d * pivotY)
    return {
      x: baseX + matrix.a * localX + matrix.c * localY,
      y: baseY + matrix.b * localX + matrix.d * localY,
    }
  }

  /** Maps a viewport point back into the untransformed local box. */
  function viewportPointToLocal(input: SelectionFrameValue, viewportX: number, viewportY: number): Point {
    const origin = rotationOriginOf(input)
    const pivotX = origin.fx * input.width
    const pivotY = origin.fy * input.height
    const matrix = linearTransform(input)
    const root = sceneRootViewportOrigin()
    const baseX = root.x + input.x + pivotX - (matrix.a * pivotX + matrix.c * pivotY)
    const baseY = root.y + input.y + pivotY - (matrix.b * pivotX + matrix.d * pivotY)
    const worldX = viewportX - baseX
    const worldY = viewportY - baseY
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-8) {
      return { x: worldX, y: worldY }
    }
    return {
      x: (matrix.d * worldX - matrix.c * worldY) / determinant,
      y: (-matrix.b * worldX + matrix.a * worldY) / determinant,
    }
  }

  /** Positions the axis marker, needle and tip in frame-local coordinates. */
  function positionNeedle(): void {
    if (value === null) return
    const width = Math.max(0, value.width)
    const height = Math.max(0, value.height)
    const origin = rotationOriginOf(value)
    const pivotX = origin.fx * width
    const pivotY = origin.fy * height
    pivotNode.style.left = `${pivotX}px`
    pivotNode.style.top = `${pivotY}px`
    needleLine.style.left = `${pivotX}px`
    needleLine.style.top = `${pivotY - 1}px`
    needleLine.style.width = `${needleLengthPx}px`
    needleLine.style.transform = `rotate(${needleAngleDeg}deg)`
    const radians = (needleAngleDeg * Math.PI) / 180
    needleTip.style.left = `${pivotX + Math.cos(radians) * needleLengthPx}px`
    needleTip.style.top = `${pivotY + Math.sin(radians) * needleLengthPx}px`
  }

  /** Clears all transient state and releases any base-handle suppression. */
  function reset(): void {
    if (pivotMagnetTarget !== null) context.setHandleSuppressed(pivotMagnetTarget, false)
    pivotMagnetTarget = null
    needleAngleDeg = -90
    needleLengthPx = NEEDLE_LENGTH_PX
  }

  /** Updates modifier-owned controls from the current accepted frame value. */
  function update(next: SelectionFrameValue | null): void {
    value = next
    const visible = next !== null && !context.isSuspended()
    pivotNode.style.display = visible ? '' : 'none'
    needleLine.style.display = visible ? '' : 'none'
    needleTip.style.display = visible ? '' : 'none'
    if (visible) positionNeedle()
  }

  /** Computes a shortest signed angular step, including full-turn gestures. */
  function shortestAngleDelta(current: number, previous: number): number {
    let delta = current - previous
    while (delta > 180) delta -= 360
    while (delta < -180) delta += 360
    return delta
  }

  /** Follows the pointer with the needle; a longer radius naturally gives finer angular motion. */
  function followPointerWithNeedle(event: PointerEvent, input: SelectionFrameValue): void {
    const local = viewportPointToLocal(input, event.clientX, event.clientY)
    const origin = rotationOriginOf(input)
    const pivotX = origin.fx * input.width
    const pivotY = origin.fy * input.height
    needleAngleDeg = (Math.atan2(local.y - pivotY, local.x - pivotX) * 180) / Math.PI
    needleLengthPx = Math.max(NEEDLE_LENGTH_PX, Math.hypot(local.x - pivotX, local.y - pivotY))
    positionNeedle()
  }

  /** Converts a pointer event to one rotation or pivot delta. */
  function deltaFor(event: PointerEvent, gesture: Gesture): SelectionFrameDelta {
    if (gesture.kind === 'rotate') {
      const angle = (Math.atan2(event.clientY - gesture.pivot.y, event.clientX - gesture.pivot.x) * 180) / Math.PI
      gesture.accumulatedDeg += shortestAngleDelta(angle, gesture.previousPointerAngleDeg)
      gesture.previousPointerAngleDeg = angle
      const target = event.shiftKey
        ? Math.round(gesture.accumulatedDeg / ROTATE_STEP_DEG) * ROTATE_STEP_DEG
        : Math.round(gesture.accumulatedDeg)
      return { kind: 'rotate', dr: target }
    }
    const startValue = gesture.startValue
    const local = viewportPointToLocal(startValue, event.clientX, event.clientY)
    let fx = clampUnit(startValue.width > 1e-8 ? local.x / startValue.width : 0.5)
    let fy = clampUnit(startValue.height > 1e-8 ? local.y / startValue.height : 0.5)
    if (pivotMagnetTarget !== null) context.setHandleSuppressed(pivotMagnetTarget, false)
    pivotMagnetTarget = null
    for (const [id, point] of Object.entries(CHARACTERISTIC_POINTS) as Array<[SelectionFrameHandleId, { fx: number; fy: number }]>) {
      const distancePx = Math.hypot(
        (fx - point.fx) * startValue.width,
        (fy - point.fy) * startValue.height,
      )
      if (distancePx <= PIVOT_MAGNET_RADIUS_PX) {
        fx = point.fx
        fy = point.fy
        pivotMagnetTarget = id
        context.setHandleSuppressed(id, true)
        break
      }
    }
    return { kind: 'pivot', fx, fy }
  }

  /** Presents one accepted candidate and keeps the rotation needle under the pointer. */
  function preview(event: PointerEvent, gesture: Gesture): void {
    const delta = deltaFor(event, gesture)
    const candidate = context.onPreview(delta)
    if (candidate !== null) {
      context.renderValue(candidate)
      if (gesture.kind === 'rotate') followPointerWithNeedle(event, candidate)
    }
  }

  /** Ends one modifier gesture and delegates persistence/abandonment to the host. */
  function endGesture(gesture: Gesture, apply: boolean, event: PointerEvent | null): void {
    if (!apply) {
      context.onCancel()
      return
    }
    if (event !== null) preview(event, gesture)
    if (value !== null) context.onCommit(value)
    if (gesture.kind === 'rotate') needleLengthPx = NEEDLE_LENGTH_PX
    positionNeedle()
  }

  const rotateGesture = bindGestureSession<Gesture>(needleTip, {
    onStart: (event) => {
      if (value === null || context.isSuspended()) return null
      const origin = rotationOriginOf(value)
      const pivot = localPointToViewport(value, origin.fx * value.width, origin.fy * value.height)
      const angle = (Math.atan2(event.clientY - pivot.y, event.clientX - pivot.x) * 180) / Math.PI
      event.preventDefault()
      event.stopPropagation()
      return {
        kind: 'rotate',
        startValue: value,
        pivot,
        previousPointerAngleDeg: angle,
        accumulatedDeg: 0,
      }
    },
    onMove: preview,
    onEnd: endGesture,
  })
  gestures.push(rotateGesture)

  const pivotGesture = bindGestureSession<Gesture>(pivotNode, {
    onStart: (event) => {
      if (value === null || context.isSuspended()) return null
      event.preventDefault()
      event.stopPropagation()
      return { kind: 'pivot', startValue: value }
    },
    onMove: preview,
    onEnd: endGesture,
  })
  gestures.push(pivotGesture)

  /** Restores the center axis as a regular, persistable preview/commit operation. */
  const onDoubleClick = (event: MouseEvent): void => {
    if (value === null || context.isSuspended()) return
    const candidate = context.onPreview({ kind: 'pivot', fx: 0.5, fy: 0.5 })
    if (candidate !== null) {
      if (pivotMagnetTarget !== null) context.setHandleSuppressed(pivotMagnetTarget, false)
      pivotMagnetTarget = null
      context.renderValue(candidate)
      context.onCommit(candidate)
    }
    event.preventDefault()
    event.stopPropagation()
  }
  pivotNode.addEventListener('dblclick', onDoubleClick)

  return {
    update,
    reset,
    isGestureActive: () => gestures.some((gesture) => gesture.isActive()),
    ownsTarget: (target) => target instanceof Element && (
      target.closest('[data-selection-frame-pivot]') !== null
      || target.closest('[data-selection-frame-needle-tip]') !== null
    ),
    destroy(): void {
      pivotNode.removeEventListener('dblclick', onDoubleClick)
      for (const gesture of gestures) gesture.unbind()
      if (pivotMagnetTarget !== null) context.setHandleSuppressed(pivotMagnetTarget, false)
      pivotNode.remove()
      needleLine.remove()
      needleTip.remove()
    },
  }
}
