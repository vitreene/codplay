/** DOM-only motion authoring surface. It never reads the document or a player node. */

import type { SelectionFrameValue } from '../decor-editor/types'
import { bindGestureSession, type GestureSessionHandle } from '@codplay/selection-frame/gesture-session'
import {
  createDisplayArcPath,
  createMotionArcPath,
  frameVisualCenter,
  midpoint,
  motionPathPointAtProgress,
  translateFrame,
  type MotionPoint,
} from './geometry'

export type MotionOverlayRole = 'source' | 'target'

export type MotionOverlaySegment = Readonly<{
  sourceFrame: SelectionFrameValue
  targetFrame: SelectionFrameValue
  control: MotionPoint
  path?: string
  role: MotionOverlayRole
}>

export type MotionDrop = Readonly<{
  sourceFrame: SelectionFrameValue
  targetFrame: SelectionFrameValue
}>

export type MotionPathChange = Readonly<{
  control: MotionPoint
  path?: string
}>

export interface MotionOverlayCallbacks {
  /** Called when a central-zone gesture is released with a meaningful displacement. */
  onDrop: (drop: MotionDrop) => MotionOverlaySegment | null
  /** Called when the user clicks one of the two persisted pose ghosts. */
  onActivateRole: (role: MotionOverlayRole) => void
  /** Called when the SVG path is selected. */
  onPathActivate: () => void
  /** Called after the midpoint has been moved or reset. */
  onPathChange: (change: MotionPathChange) => void
  /** Called when Escape cancels an unreleased central-zone trace. */
  onDrawCancel?: () => void
}

export interface MotionOverlayHandle {
  /** Updates the current CS pose and central-zone availability. */
  setSelection: (frame: SelectionFrameValue | null, enabled: boolean) => void
  /** Sets or clears the persisted source/target projection. */
  setSegment: (segment: MotionOverlaySegment | null) => void
  /** Suspends all artefacts during playback or host teardown. */
  setSuspended: (suspended: boolean) => void
  /** Removes all listeners and artefacts from the scene host. */
  destroy: () => void
}

type DragState = Readonly<{
  kind: 'move' | 'control'
  pointerId: number
  startClientX: number
  startClientY: number
  baseFrame?: SelectionFrameValue
}>

/** Mounts one reusable, document-agnostic motion overlay into a scene host. */
export function createMotionOverlay(host: HTMLElement, callbacks: MotionOverlayCallbacks): MotionOverlayHandle {
  const doc = host.ownerDocument
  const root = doc.createElement('div')
  root.dataset.editorOverlay = 'motion'
  root.setAttribute('aria-hidden', 'true')
  root.style.position = 'absolute'
  root.style.inset = '0'
  root.style.pointerEvents = 'none'
  root.style.zIndex = '1050'
  root.style.touchAction = 'none'

  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('data-motion-overlay-svg', '')
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.setAttribute('overflow', 'visible')
  svg.style.position = 'absolute'
  svg.style.inset = '0'
  svg.style.pointerEvents = 'none'
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('data-motion-path', '')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', '#f59e0b')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-dasharray', '6 4')
  path.style.pointerEvents = 'stroke'
  path.style.cursor = 'pointer'
  svg.appendChild(path)
  root.appendChild(svg)

  const sourceGhost = createGhost(doc, 'source')
  const targetGhost = createGhost(doc, 'target')
  root.append(sourceGhost, targetGhost)

  const moveZone = doc.createElement('div')
  moveZone.dataset.motionCentral = ''
  moveZone.style.position = 'absolute'
  moveZone.style.boxSizing = 'border-box'
  moveZone.style.pointerEvents = 'auto'
  moveZone.style.touchAction = 'none'
  moveZone.style.cursor = 'grab'
  moveZone.style.background = 'transparent'
  moveZone.style.border = '1px solid transparent'
  moveZone.style.clipPath = 'inset(12px)'
  root.appendChild(moveZone)

  const control = doc.createElement('button')
  control.type = 'button'
  control.dataset.motionPathControl = ''
  control.setAttribute('aria-label', 'Modifier la trajectoire')
  control.textContent = ''
  control.style.position = 'absolute'
  control.style.boxSizing = 'border-box'
  control.style.width = '12px'
  control.style.height = '12px'
  control.style.padding = '0'
  control.style.border = '2px solid #f59e0b'
  control.style.borderRadius = '50%'
  control.style.background = '#111827'
  control.style.pointerEvents = 'auto'
  control.style.cursor = 'crosshair'
  root.appendChild(control)

  host.appendChild(root)

  let selectionFrame: SelectionFrameValue | null = null
  let selectionEnabled = false
  let segment: MotionOverlaySegment | null = null
  let drawing = false
  let suspended = false
  let drag: DragState | null = null
  let moveGesture: GestureSessionHandle | null = null
  let controlGesture: GestureSessionHandle | null = null
  let draftTargetFrame: SelectionFrameValue | null = null
  let draftControl: MotionPoint | null = null

  /** Converts a client pointer coordinate into scene-host local coordinates. */
  function localPoint(event: PointerEvent): MotionPoint {
    const bounds = host.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  /** Returns the frame that owns the central movement zone. */
  function activeFrame(): SelectionFrameValue | null {
    // Once a segment exists, the currently active pose can be either endpoint. During a second
    // central drag the source is the pose captured by this gesture, not necessarily the segment's
    // original source. Keeping that distinction here makes repeated intra-capsule moves compose
    // without silently drawing from the first keyframe again.
    if (drawing) return drag?.baseFrame ?? segment?.sourceFrame ?? selectionFrame
    if (segment?.role === 'source') return segment.sourceFrame
    // During a seek the active item is the interpolated presentation between the endpoint
    // ghosts. `selectionFrame` is refreshed by the bridge from that presentation; falling back
    // to the target keeps the post-drop state deterministic before the first refresh.
    if (segment?.role === 'target') return selectionFrame ?? segment.targetFrame
    return selectionFrame
  }

  /** Applies one frame pose to an overlay element without inspecting a player DOM node. */
  function renderFrame(element: HTMLElement, frame: SelectionFrameValue): void {
    element.style.left = `${frame.x}px`
    element.style.top = `${frame.y}px`
    element.style.width = `${Math.max(0, frame.width)}px`
    element.style.height = `${Math.max(0, frame.height)}px`
    element.style.transformOrigin = `${(frame.rotationOrigin?.fx ?? 0.5) * 100}% ${(frame.rotationOrigin?.fy ?? 0.5) * 100}%`
    element.style.transform = `rotate(${frame.rotate ?? 0}deg) scale(${frame.scaleX ?? 1}, ${frame.scaleY ?? 1})`
  }

  /** Renders the central 12px-excluded interaction area over the active pose. */
  function renderMoveZone(): void {
    const frame = activeFrame()
    if (frame === null || !selectionEnabled || suspended) {
      moveZone.style.display = 'none'
      return
    }
    moveZone.style.display = ''
    moveZone.style.left = `${frame.x}px`
    moveZone.style.top = `${frame.y}px`
    moveZone.style.width = `${Math.max(0, frame.width)}px`
    moveZone.style.height = `${Math.max(0, frame.height)}px`
    moveZone.style.padding = '0'
    moveZone.style.transformOrigin = `${(frame.rotationOrigin?.fx ?? 0.5) * 100}% ${(frame.rotationOrigin?.fy ?? 0.5) * 100}%`
    moveZone.style.transform = `rotate(${frame.rotate ?? 0}deg) scale(${frame.scaleX ?? 1}, ${frame.scaleY ?? 1})`
    moveZone.style.cursor = drawing ? 'grabbing' : 'grab'
  }

  /** Draws ghosts, path and control point for one stable overlay state. */
  function render(): void {
    root.style.display = suspended ? 'none' : ''
    if (segment === null && !drawing) {
      sourceGhost.style.display = 'none'
      targetGhost.style.display = 'none'
      path.style.display = 'none'
      control.style.display = 'none'
      renderMoveZone()
      return
    }

    const sourceFrame = drawing
      ? drag?.baseFrame ?? segment?.sourceFrame ?? selectionFrame
      : segment?.sourceFrame ?? selectionFrame
    const targetFrame = drawing ? draftTargetFrame : segment?.targetFrame
    if (sourceFrame === null || targetFrame === null || targetFrame === undefined) {
      renderMoveZone()
      return
    }
    const source = frameVisualCenter(sourceFrame)
    const target = frameVisualCenter(targetFrame)
    const authoredControlPoint = drawing
      ? draftControl ?? midpoint(source, target)
      : drag?.kind === 'control' && draftControl !== null
        ? draftControl
        : segment?.control ?? midpoint(source, target)
    const displayControlPoint = motionPathPointAtProgress(source, authoredControlPoint, target, 0.5)
    const displayPath = createDisplayArcPath(source, authoredControlPoint, target)
      ?? `M ${formatCoordinate(source.x)} ${formatCoordinate(source.y)} L ${formatCoordinate(target.x)} ${formatCoordinate(target.y)}`

    path.style.display = ''
    path.setAttribute('d', displayPath)
    renderFrame(sourceGhost, sourceFrame)
    renderFrame(targetGhost, targetFrame)
    sourceGhost.style.display = drawing ? 'none' : segment?.role === 'target' ? '' : 'none'
    targetGhost.style.display = drawing || segment?.role === 'source' ? '' : 'none'
    control.style.display = drawing || segment !== null ? '' : 'none'
    // The visible median is a path marker, not the raw authoring handle. It therefore remains on
    // the canonical curve at 50% traversal even when the three-point circle's authoring point is
    // not itself the arc midpoint.
    control.style.left = `${displayControlPoint.x - 6}px`
    control.style.top = `${displayControlPoint.y - 6}px`
    moveZone.style.display = drawing || selectionEnabled ? '' : 'none'
    renderMoveZone()
  }

  /** Begins either the central movement trace or the path-control edit. */
  function beginDrag(kind: DragState['kind'], event: PointerEvent): DragState | null {
    if (suspended) return null
    if (kind === 'move') {
      const frame = activeFrame()
      if (!selectionEnabled || frame === null) return null
      event.preventDefault()
      event.stopPropagation()
      drawing = true
      draftTargetFrame = frame
      draftControl = midpoint(frameVisualCenter(frame), frameVisualCenter(frame))
      const next = { kind, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, baseFrame: frame }
      drag = next
      render()
      return next
    }
    if (segment === null) return null
    event.preventDefault()
    event.stopPropagation()
    const next = { kind, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY }
    drag = next
    return next
  }

  /** Updates an in-memory trace; no document or player mutation occurs here. */
  function moveDrag(event: PointerEvent, session: DragState): void {
    if (drag !== session || session.pointerId !== event.pointerId) return
    if (session.kind === 'move') {
      const base = session.baseFrame
      if (base === undefined) return
      const dx = event.clientX - drag.startClientX
      const dy = event.clientY - drag.startClientY
      draftTargetFrame = translateFrame(base, dx, dy)
      draftControl = midpoint(frameVisualCenter(base), frameVisualCenter(draftTargetFrame))
      render()
      return
    }
    const point = localPoint(event)
    draftControl = point
    render()
  }

  /** Completes one trace, delegating persistence to the bridge only after pointer release. */
  function endDrag(current: DragState, apply: boolean, event: PointerEvent | null): void {
    if (drag !== current) return
    drag = null
    if (current.kind === 'control') {
      if (apply && segment !== null && draftControl !== null) {
        const source = frameVisualCenter(segment.sourceFrame)
        const target = frameVisualCenter(segment.targetFrame)
        const pathValue = createMotionArcPath(source, draftControl, target)
        callbacks.onPathChange({ control: draftControl, ...(pathValue === undefined ? {} : { path: pathValue }) })
      }
      draftControl = null
      render()
      return
    }
    const base = current.baseFrame
    const target = draftTargetFrame
    drawing = false
    draftTargetFrame = null
    draftControl = null
    if (!apply || base === undefined || target === null || event === null
      || Math.hypot(event.clientX - current.startClientX, event.clientY - current.startClientY) < 3) {
      callbacks.onDrawCancel?.()
      render()
      return
    }
    const created = callbacks.onDrop({ sourceFrame: base, targetFrame: target })
    if (created === null) {
      callbacks.onDrawCancel?.()
      render()
      return
    }
    segment = created
    selectionFrame = created.role === 'target' ? created.targetFrame : created.sourceFrame
    render()
  }

  /** Resets the current control point to the exact straight-line midpoint. */
  function resetControl(event: MouseEvent): void {
    if (segment === null) return
    event.preventDefault()
    event.stopPropagation()
    const source = frameVisualCenter(segment.sourceFrame)
    const target = frameVisualCenter(segment.targetFrame)
    const controlPoint = midpoint(source, target)
    segment = { ...segment, control: controlPoint, path: undefined }
    callbacks.onPathChange({ control: controlPoint })
    render()
  }

  const onPathClick = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    root.dataset.motionPathActive = ''
    callbacks.onPathActivate()
    render()
  }
  const onSourceClick = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    callbacks.onActivateRole('source')
  }
  const onTargetClick = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    callbacks.onActivateRole('target')
  }
  const onDoubleClick = (event: MouseEvent): void => resetControl(event)
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !drawing) return
    event.preventDefault()
    // This Escape belongs to the in-flight trace. Prevent the app-level Escape shortcut from
    // clearing the selection after the trace has been cancelled.
    event.stopImmediatePropagation()
    moveGesture?.abort()
  }

  moveGesture = bindGestureSession<DragState>(moveZone, {
    onStart: (event) => beginDrag('move', event),
    onMove: moveDrag,
    onEnd: endDrag,
  })
  controlGesture = bindGestureSession<DragState>(control, {
    onStart: (event) => beginDrag('control', event),
    onMove: moveDrag,
    onEnd: endDrag,
  })
  control.addEventListener('dblclick', onDoubleClick)
  path.addEventListener('click', onPathClick)
  sourceGhost.addEventListener('click', onSourceClick)
  targetGhost.addEventListener('click', onTargetClick)
  doc.addEventListener('keydown', onKeyDown, { capture: true })
  // The controls are created before the first scene/selection arrives. Render once so the
  // empty overlay starts fully hidden instead of exposing its default button display.
  render()

  return {
    setSelection(frame, enabled): void {
      selectionFrame = frame
      selectionEnabled = enabled
      render()
    },
    setSegment(next): void {
      segment = next
      if (next === null) {
        delete root.dataset.motionPathActive
      }
      render()
    },
    setSuspended(next): void {
      suspended = next
      render()
    },
    destroy(): void {
      moveGesture?.unbind()
      controlGesture?.unbind()
      moveGesture = null
      controlGesture = null
      control.removeEventListener('dblclick', onDoubleClick)
      path.removeEventListener('click', onPathClick)
      sourceGhost.removeEventListener('click', onSourceClick)
      targetGhost.removeEventListener('click', onTargetClick)
      doc.removeEventListener('keydown', onKeyDown, { capture: true })
      root.remove()
    },
  }
}

/** Creates one transparent geometric ghost with pointer interaction enabled. */
function createGhost(doc: Document, role: MotionOverlayRole): HTMLElement {
  const ghost = doc.createElement('div')
  ghost.dataset.motionGhost = role
  ghost.style.position = 'absolute'
  ghost.style.boxSizing = 'border-box'
  ghost.style.border = '2px dashed #f59e0b'
  ghost.style.background = 'transparent'
  ghost.style.pointerEvents = 'auto'
  ghost.style.cursor = 'pointer'
  ghost.style.touchAction = 'none'
  ghost.style.display = 'none'
  return ghost
}

/** Formats one display coordinate independently of locale and browser CSS. */
function formatCoordinate(value: number): string {
  return Number(value.toFixed(3)).toString()
}
