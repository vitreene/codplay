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
  /** Stable segment key used to keep the inactive SVG paths mounted across refreshes. */
  id?: string
  sourceFrame: SelectionFrameValue
  targetFrame: SelectionFrameValue
  control: MotionPoint
  path?: string
  /** Only the active segment exposes its role, ghosts and path-control affordance. */
  role?: MotionOverlayRole
  /** Marks the one segment whose pose and path can currently be edited. */
  active?: boolean
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
  /** Called when the user clicks the first pose ghost of the complete item route. */
  onActivateInitial?: () => void
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
  /** Replaces the complete path projection, with at most one active segment. */
  setSegments: (segments: readonly MotionOverlaySegment[]) => void
  /** Sets or clears the first-pose ghost shared by the complete route projection. */
  setInitialGhost: (frame: SelectionFrameValue | null) => void
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
  const path = createPathElement(doc, 'active')
  path.style.pointerEvents = 'stroke'
  path.style.cursor = 'pointer'
  svg.appendChild(path)
  root.appendChild(svg)

  const sourceGhost = createGhost(doc, 'source')
  const targetGhost = createGhost(doc, 'target')
  const initialGhost = createGhost(doc, 'initial')
  root.append(sourceGhost, targetGhost, initialGhost)

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
  moveZone.style.zIndex = '1'
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
  control.style.zIndex = '4'
  root.appendChild(control)

  host.appendChild(root)

  let selectionFrame: SelectionFrameValue | null = null
  let selectionEnabled = false
  let segment: MotionOverlaySegment | null = null
  let segments: MotionOverlaySegment[] = []
  let initialFrame: SelectionFrameValue | null = null
  const inactivePaths = new Map<string, SVGPathElement>()
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

  /** Removes secondary paths when the overlay no longer has a valid scene projection. */
  function clearInactivePaths(): void {
    for (const inactivePath of inactivePaths.values()) inactivePath.remove()
    inactivePaths.clear()
  }

  /** Draws every persisted path while keeping controls and ghosts exclusive to the active segment. */
  function render(): void {
    root.style.display = suspended ? 'none' : ''
    if (segments.length === 0 && segment === null && !drawing) {
      sourceGhost.style.display = 'none'
      targetGhost.style.display = 'none'
      initialGhost.style.display = 'none'
      path.style.display = 'none'
      control.style.display = 'none'
      clearInactivePaths()
      renderMoveZone()
      return
    }

    const sourceFrame = drawing
      ? drag?.baseFrame ?? segment?.sourceFrame ?? selectionFrame
      : segment?.sourceFrame ?? selectionFrame
    const targetFrame = drawing ? draftTargetFrame : segment?.targetFrame
    if (sourceFrame === null || targetFrame === null || targetFrame === undefined) {
      sourceGhost.style.display = 'none'
      targetGhost.style.display = 'none'
      initialGhost.style.display = 'none'
      path.style.display = 'none'
      clearInactivePaths()
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

    // Only segments explicitly marked inactive are projected as secondary paths. The active
    // segment is rendered by the dedicated path/control layer below; keeping this distinction
    // explicit prevents a missing marker from accidentally producing a second median.
    const inactiveKeys = new Set<string>()
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      const inactiveSegment = segments[segmentIndex]!
      if (inactiveSegment.active !== false) continue
      const key = inactiveSegment.id ?? `inactive-${segmentIndex}`
      inactiveKeys.add(key)
      const inactivePath = inactivePaths.get(key) ?? createPathElement(doc, 'inactive')
      inactivePaths.set(key, inactivePath)
      renderPathElement(inactivePath, inactiveSegment, false, inactivePathOpacity(segmentIndex, segments.length))
      // Keep the dedicated active path as the first SVG child for stable overlay semantics; the
      // secondary stroke remains pointer-transparent and cannot steal its hit target.
      if (inactivePath.parentNode !== svg) svg.appendChild(inactivePath)
    }
    for (const [key, inactivePath] of inactivePaths) {
      if (inactiveKeys.has(key)) continue
      inactivePath.remove()
      inactivePaths.delete(key)
    }

    path.style.display = ''
    path.setAttribute('d', displayPath)
    path.dataset.motionPathActive = ''
    path.style.opacity = '1'
    renderFrame(sourceGhost, sourceFrame)
    renderFrame(targetGhost, targetFrame)
    if (initialFrame !== null) renderFrame(initialGhost, initialFrame)
    // Both endpoint ghosts are projected by default. The endpoint occupied by the live item is
    // hidden so the Selection Frame remains the only visible authoring surface at that pose; the
    // opposite endpoint stays visible and clickable for navigation.
    sourceGhost.style.zIndex = '2'
    targetGhost.style.zIndex = '3'
    // The pose comparison is structured (never DOM bounds) and tolerant to cqw/layout rounding.
    // The current endpoint is hidden rather than merely made pointer-transparent: it is not a
    // navigation target while the item occupies that pose.
    const sourceIsCurrentPose = selectionFrame !== null && sameFramePose(selectionFrame, sourceFrame)
    const targetIsCurrentPose = selectionFrame !== null && sameFramePose(selectionFrame, targetFrame)
    // The initial pose is a route-level anchor, not a third endpoint of the active segment. When
    // the active segment starts at the first KF it coincides with the source ghost and is hidden to
    // avoid a duplicate outline; once a later segment is active it remains visible as a clickable
    // navigation artefact. At the current pose it lets the CS receive gestures just like an
    // endpoint ghost at its exact bound.
    const initialOverlapsActive = initialFrame !== null
      && (sameFramePose(initialFrame, sourceFrame) || sameFramePose(initialFrame, targetFrame))
    const initialIsCurrentPose = initialFrame !== null
      && selectionFrame !== null
      && sameFramePose(selectionFrame, initialFrame)
    sourceGhost.style.pointerEvents = sourceIsCurrentPose ? 'none' : 'auto'
    targetGhost.style.pointerEvents = targetIsCurrentPose ? 'none' : 'auto'
    initialGhost.style.zIndex = '2'
    // A route-level initial pose is an inactive navigation reference whenever it does not
    // coincide with the active segment. Match inactive paths' visual hierarchy without filling or
    // tinting the item's content; the active endpoint ghosts keep their opaque outline.
    initialGhost.style.opacity = initialOverlapsActive ? '1' : '0.28'
    initialGhost.style.pointerEvents = initialIsCurrentPose ? 'none' : 'auto'
    initialGhost.style.display = drawing || initialFrame === null || initialOverlapsActive ? 'none' : ''
    sourceGhost.style.display = drawing || sourceIsCurrentPose ? 'none' : ''
    targetGhost.style.display = drawing || targetIsCurrentPose ? 'none' : ''
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
    const activeSegment = { ...created, active: true }
    segment = activeSegment
    segments = [activeSegment, ...segments.filter((candidate) => candidate.active === false)]
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
    const nextSegment = { ...segment, active: true, control: controlPoint, path: undefined }
    segment = nextSegment
    segments = [nextSegment, ...segments.filter((candidate) => candidate.active === false)]
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
  const onInitialClick = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    callbacks.onActivateInitial?.()
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
  initialGhost.addEventListener('click', onInitialClick)
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
    setSegments(next): void {
      const projected = [...next]
      const activeIndex = projected.findIndex((candidate) => candidate.active !== false)
      segments = projected.map((candidate, index) => index === activeIndex
        ? { ...candidate, active: true }
        : { ...candidate, active: false })
      segment = activeIndex < 0 ? null : segments[activeIndex]!
      if (segment === null) delete root.dataset.motionPathActive
      render()
    },
    setInitialGhost(frame): void {
      initialFrame = frame
      render()
    },
    setSegment(next): void {
      if (next === null) {
        segment = null
        segments = []
        initialFrame = null
        delete root.dataset.motionPathActive
      } else {
        segment = { ...next, active: true }
        segments = [segment]
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
      initialGhost.removeEventListener('click', onInitialClick)
      doc.removeEventListener('keydown', onKeyDown, { capture: true })
      clearInactivePaths()
      root.remove()
    },
  }
}

/** Creates one path element with the common non-scene overlay presentation. */
function createPathElement(doc: Document, kind: 'active' | 'inactive'): SVGPathElement {
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('data-motion-path', '')
  if (kind === 'inactive') path.setAttribute('data-motion-path-inactive', '')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', '#f59e0b')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-dasharray', '6 4')
  path.style.pointerEvents = kind === 'active' ? 'stroke' : 'none'
  path.style.cursor = kind === 'active' ? 'pointer' : 'default'
  path.style.opacity = kind === 'active' ? '1' : '0.28'
  return path
}

/** Projects one persisted segment into an SVG path without creating a control point. */
function renderPathElement(path: SVGPathElement, segment: MotionOverlaySegment, active: boolean, opacity = active ? 1 : 0.28): void {
  const source = frameVisualCenter(segment.sourceFrame)
  const target = frameVisualCenter(segment.targetFrame)
  const displayPath = createDisplayArcPath(source, segment.control, target)
    ?? `M ${formatCoordinate(source.x)} ${formatCoordinate(source.y)} L ${formatCoordinate(target.x)} ${formatCoordinate(target.y)}`
  path.setAttribute('d', displayPath)
  path.style.display = ''
  path.style.opacity = String(opacity)
}

/** Returns the graduated opacity for one non-active route segment. */
function inactivePathOpacity(index: number, total: number): number {
  if (total <= 1) return 0.28
  const progress = Math.min(1, Math.max(0, index / (total - 1)))
  return Number((0.28 + progress * 0.28).toFixed(2))
}

/** Creates one transparent geometric ghost with pointer interaction enabled. */
function createGhost(doc: Document, role: MotionOverlayRole | 'initial'): HTMLElement {
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

/** Compares two local-pixel poses without relying on a DOM bounding box. */
function sameFramePose(left: SelectionFrameValue, right: SelectionFrameValue): boolean {
  // The runtime presentation and the document projection can differ by a few hundredths of a
  // pixel (cqw conversion versus the browser's layout rounding) while describing the same visible
  // pose. A sub-pixel tolerance prevents a ghost that is visually underneath the item from
  // stealing the CS hit-test; larger differences still leave the ghost navigable.
  const pixelEpsilon = 0.5
  const angleEpsilon = 0.1
  const unitEpsilon = 0.001
  return Math.abs(left.x - right.x) < pixelEpsilon
    && Math.abs(left.y - right.y) < pixelEpsilon
    && Math.abs(left.width - right.width) < pixelEpsilon
    && Math.abs(left.height - right.height) < pixelEpsilon
    && Math.abs((left.rotate ?? 0) - (right.rotate ?? 0)) < angleEpsilon
    && Math.abs((left.scaleX ?? 1) - (right.scaleX ?? 1)) < unitEpsilon
    && Math.abs((left.scaleY ?? 1) - (right.scaleY ?? 1)) < unitEpsilon
    && Math.abs((left.rotationOrigin?.fx ?? 0.5) - (right.rotationOrigin?.fx ?? 0.5)) < unitEpsilon
    && Math.abs((left.rotationOrigin?.fy ?? 0.5) - (right.rotationOrigin?.fy ?? 0.5)) < unitEpsilon
}

/** Formats one display coordinate independently of locale and browser CSS. */
function formatCoordinate(value: number): string {
  return Number(value.toFixed(3)).toString()
}
