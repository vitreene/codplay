/** DOM-only motion authoring surface. It never reads the document or a player node. */

import type { SelectionFrameValue } from '../decor-editor/types'
import { bindGestureSession, type GestureSessionHandle } from '@codplay/selection-frame/gesture-session'
import {
  createDisplayArcPath,
  createMotionArcPath,
  frameVisualCenter,
  midpoint,
  motionControlFromPath,
  motionPathPointAtProgress,
  translateFrame,
  type MotionPoint,
} from './geometry'

export type MotionOverlayRole = 'source' | 'target'

export type MotionOverlaySegment = Readonly<{
  /** Stable segment key used to keep the inactive SVG paths mounted across refreshes. */
  id?: string
  /** Document keyframe owning the source endpoint, when the bridge has document context. */
  sourceKeyframeId?: string
  /** Document keyframe owning the target endpoint, when the bridge has document context. */
  targetKeyframeId?: string
  sourceFrame: SelectionFrameValue
  targetFrame: SelectionFrameValue
  control: MotionPoint
  path?: string
  /** Only the active segment exposes its role and path-control affordance. */
  role?: MotionOverlayRole
  /** Marks the one segment whose pose and path can currently be edited. */
  active?: boolean
  /** Marks an interpolated pose with no document KF; its movement preview splits the route in two. */
  isTemporary?: boolean
}>

export type MotionOverlayGhost = Readonly<{
  /** Stable key used to preserve one DOM ghost for one document keyframe. */
  id: string
  /** Real document keyframe represented by this ghost. */
  keyframeId: string
  frame: SelectionFrameValue
  /** Temporal distance from the current author pose in the ordered keyframe chain. */
  chainDistance: number
  /** Gives the first keyframe the existing route-level ghost semantics. */
  isInitial?: boolean
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
  /** Called when the single movement-surface gesture is released with a meaningful displacement. */
  onDrop: (drop: MotionDrop) => MotionOverlaySegment | null
  /** Called when the user clicks one of the two persisted pose ghosts. */
  onActivateRole: (role: MotionOverlayRole) => void
  /** Called when the user clicks a persisted ghost outside the active segment. */
  onActivateKeyframe?: (keyframeId: string) => void
  /** Called when the user clicks the first pose ghost of the complete item route. */
  onActivateInitial?: () => void
  /** Called when the SVG path is selected. */
  onPathActivate: () => void
  /** Called after the midpoint has been moved or reset. */
  onPathChange: (change: MotionPathChange) => void
  /** Called when Escape cancels an unreleased movement-surface trace. */
  onDrawCancel?: () => void
}

export interface MotionOverlayHandle {
  /** Updates the current CS pose and the single movement-surface availability. */
  setSelection: (frame: SelectionFrameValue | null, enabled: boolean) => void
  /** Replaces the complete path projection, with at most one active segment. */
  setSegments: (segments: readonly MotionOverlaySegment[]) => void
  /** Replaces the complete ghost projection for the selected item. */
  setGhosts: (ghosts: readonly MotionOverlayGhost[]) => void
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
  // Keep the historical selector as a compatibility marker only. This is one full-frame movement
  // surface; it is not a central-vs-border split and no second border zone is mounted.
  moveZone.dataset.motionMoveZone = ''
  moveZone.dataset.motionCentral = ''
  moveZone.style.position = 'absolute'
  moveZone.style.boxSizing = 'border-box'
  moveZone.style.pointerEvents = 'auto'
  moveZone.style.touchAction = 'none'
  moveZone.style.cursor = 'grab'
  moveZone.style.background = 'transparent'
  moveZone.style.border = '1px solid transparent'
  // The former 12px central routing remains dormant: the movement surface covers the whole pose.
  moveZone.style.clipPath = 'none'
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
  let ghosts: MotionOverlayGhost[] = []
  let initialFrame: SelectionFrameValue | null = null
  const inactivePaths = new Map<string, SVGPathElement>()
  const keyframeGhosts = new Map<string, HTMLElement>()
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

  /** Returns the frame that owns the movement surface. */
  function activeFrame(): SelectionFrameValue | null {
    // Once a segment exists, the currently active pose can be either endpoint. During a second
    // movement drag the source is the pose captured by this gesture, not necessarily the segment's
    // original source. Keeping that distinction here makes repeated intra-capsule moves compose
    // without silently drawing from the first keyframe again.
    if (drawing) return drag?.baseFrame ?? selectionFrame ?? segment?.sourceFrame ?? null
    // A temporary segment represents the interpolated pose at the current playhead, not its source
    // endpoint. The movement surface must follow that visible pose; otherwise the native hit-test
    // lands on SelectionFrameV2 and performs a normal reposition instead of materializing a KF.
    if (segment?.isTemporary === true) return selectionFrame ?? segment.targetFrame
    if (segment?.role === 'source') return segment.sourceFrame
    // A terminal KF owns the incoming transition. Its movement surface must start from the
    // trajectory endpoint, not from a presentation frame that may still describe the item
    // before the transition handoff. The bridge keeps this endpoint in the active segment and
    // refreshes the Selection Frame separately for display.
    if (segment?.role === 'target') return segment.targetFrame
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

  /** Renders the one full-frame movement surface over the active pose. */
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
    // At an interpolated pose the trajectory median can coincide with the visible item. The
    // movement surface must win that hit-test so a drag creates the middle KF; the path control
    // remains mounted and keeps its normal priority on real KF poses.
    moveZone.style.zIndex = segment?.isTemporary === true ? '5' : '1'
    moveZone.style.cursor = drawing ? 'grabbing' : 'grab'
  }

  /** Returns the route that will exist after a temporary middle-of-segment drop is committed. */
  function renderSegments(): MotionOverlaySegment[] {
    if (!drawing || draftTargetFrame === null || segment?.isTemporary !== true) return segments
    const activeIndex = segments.findIndex((candidate) => candidate.active !== false)
    if (activeIndex < 0) return segments

    const sourceCenter = frameVisualCenter(segment.sourceFrame)
    const draftCenter = frameVisualCenter(draftTargetFrame)
    const targetCenter = frameVisualCenter(segment.targetFrame)
    const targetControl = segment.path === undefined
      ? midpoint(draftCenter, targetCenter)
      : motionControlFromPath(segment.path, draftCenter, targetCenter) ?? midpoint(draftCenter, targetCenter)
    const previewBefore: MotionOverlaySegment = {
      id: `${segment.id ?? 'motion-segment'}:preview-before`,
      ...(segment.sourceKeyframeId === undefined ? {} : { sourceKeyframeId: segment.sourceKeyframeId }),
      sourceFrame: segment.sourceFrame,
      targetFrame: draftTargetFrame,
      control: midpoint(sourceCenter, draftCenter),
      role: 'target',
      active: true,
      isTemporary: true,
    }
    const previewAfter: MotionOverlaySegment = {
      id: `${segment.id ?? 'motion-segment'}:preview-after`,
      ...(segment.targetKeyframeId === undefined ? {} : { targetKeyframeId: segment.targetKeyframeId }),
      sourceFrame: draftTargetFrame,
      targetFrame: segment.targetFrame,
      control: targetControl,
      ...(segment.path === undefined ? {} : { path: segment.path }),
      active: false,
    }
    return [
      ...segments.slice(0, activeIndex),
      previewBefore,
      previewAfter,
      ...segments.slice(activeIndex + 1),
    ]
  }

  /** Removes secondary paths when the overlay no longer has a valid scene projection. */
  function clearInactivePaths(): void {
    for (const inactivePath of inactivePaths.values()) inactivePath.remove()
    inactivePaths.clear()
  }

  /** Creates or reuses one clickable ghost for a non-active keyframe. */
  function keyframeGhostFor(id: string): HTMLElement {
    const existing = keyframeGhosts.get(id)
    if (existing !== undefined) return existing
    const ghost = createGhost(doc, 'keyframe')
    ghost.dataset.motionGhost = 'keyframe'
    ghost.dataset.motionKeyframeId = id
    ghost.style.zIndex = '2'
    ghost.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const keyframeId = ghost.dataset.motionKeyframeId
      if (keyframeId !== undefined) callbacks.onActivateKeyframe?.(keyframeId)
    })
    keyframeGhosts.set(id, ghost)
    root.appendChild(ghost)
    return ghost
  }

  /** Renders every inactive path, including the complete route when no segment is active. */
  function renderInactivePaths(renderedSegments: readonly MotionOverlaySegment[]): void {
    const inactiveKeys = new Set<string>()
    const activeIndex = renderedSegments.findIndex((candidate) => candidate.active !== false)
    for (let segmentIndex = 0; segmentIndex < renderedSegments.length; segmentIndex += 1) {
      const inactiveSegment = renderedSegments[segmentIndex]!
      if (inactiveSegment.active !== false) continue
      const key = inactiveSegment.id ?? `inactive-${segmentIndex}`
      inactiveKeys.add(key)
      const inactivePath = inactivePaths.get(key) ?? createPathElement(doc, 'inactive')
      inactivePaths.set(key, inactivePath)
      const chainDistance = activeIndex < 0
        ? segmentIndex
        : Math.abs(segmentIndex - activeIndex)
      inactivePath.style.stroke = motionGhostColor(chainDistance)
      renderPathElement(inactivePath, inactiveSegment, false, inactivePathOpacity(chainDistance))
      // Keep the dedicated active path as the first SVG child for stable overlay semantics; the
      // secondary stroke remains pointer-transparent and cannot steal its hit target.
      if (inactivePath.parentNode !== svg) svg.appendChild(inactivePath)
    }
    for (const [key, inactivePath] of inactivePaths) {
      if (inactiveKeys.has(key)) continue
      inactivePath.remove()
      inactivePaths.delete(key)
    }
  }

  /** Renders all keyframe ghosts and hides only the pose occupied by the live item. */
  function renderGhosts(): void {
    const activeSourceId = segment?.sourceKeyframeId
    const activeTargetId = segment?.targetKeyframeId
    const activeSourceFrame = segment?.sourceFrame ?? null
    const activeTargetFrame = segment?.targetFrame ?? null
    const usedElements = new Set<HTMLElement>()
    const usedDynamicKeys = new Set<string>()
    let hasInitialDescriptor = false

    for (const ghost of ghosts) {
      if (ghost.isInitial === true) hasInitialDescriptor = true
      let element: HTMLElement
      let kind: MotionOverlayRole | 'initial' | 'keyframe'
      if (activeSourceId !== undefined && ghost.keyframeId === activeSourceId) {
        element = sourceGhost
        kind = 'source'
      } else if (activeTargetId !== undefined && ghost.keyframeId === activeTargetId) {
        element = targetGhost
        kind = 'target'
      } else if (ghost.isInitial === true) {
        element = initialGhost
        kind = 'initial'
      } else {
        element = keyframeGhostFor(ghost.id)
        usedDynamicKeys.add(ghost.id)
        kind = 'keyframe'
      }

      usedElements.add(element)
      renderFrame(element, ghost.frame)
      element.dataset.motionKeyframeId = ghost.keyframeId
      element.dataset.motionGhostDistance = String(Math.max(0, Math.round(ghost.chainDistance)))
      const isActiveGhost = kind === 'source' || kind === 'target'
      const isCurrentPose = selectionFrame !== null && sameFramePose(selectionFrame, ghost.frame)
      const overlapsActive = kind === 'initial'
        && activeSourceFrame !== null
        && activeTargetFrame !== null
        && (sameFramePose(ghost.frame, activeSourceFrame) || sameFramePose(ghost.frame, activeTargetFrame))
      const isInactiveGhost = kind === 'keyframe' || (kind === 'initial' && !overlapsActive)
      element.style.borderColor = motionGhostColor(ghost.chainDistance, isActiveGhost)
      element.style.zIndex = kind === 'target' ? '3' : '2'
      // Non-active ghosts are deliberately subdued by both opacity and colour; the active
      // segment endpoints stay strong so the editable route remains immediately legible.
      element.style.opacity = isInactiveGhost
        ? motionGhostOpacity(ghost.chainDistance, kind === 'initial')
        : '1'
      element.style.pointerEvents = isCurrentPose ? 'none' : 'auto'
      element.style.display = drawing || isCurrentPose || overlapsActive ? 'none' : ''
    }

    // The public overlay API still accepts a single segment for isolated callers and older tests.
    // In the document bridge every segment carries endpoint ids and therefore uses the complete
    // ghost projection above.
    const hasStructuredEndpoints = segment !== null
      && activeSourceId !== undefined
      && activeTargetId !== undefined
      && ghosts.some((ghost) => ghost.keyframeId === activeSourceId || ghost.keyframeId === activeTargetId)
    if (segment !== null && !hasStructuredEndpoints) {
      const sourceFrame = segment.sourceFrame
      const targetFrame = segment.targetFrame
      const sourceIsCurrentPose = selectionFrame !== null && sameFramePose(selectionFrame, sourceFrame)
      const targetIsCurrentPose = selectionFrame !== null && sameFramePose(selectionFrame, targetFrame)
      renderFrame(sourceGhost, sourceFrame)
      renderFrame(targetGhost, targetFrame)
      if (segment.sourceKeyframeId === undefined) delete sourceGhost.dataset.motionKeyframeId
      else sourceGhost.dataset.motionKeyframeId = segment.sourceKeyframeId
      if (segment.targetKeyframeId === undefined) delete targetGhost.dataset.motionKeyframeId
      else targetGhost.dataset.motionKeyframeId = segment.targetKeyframeId
      sourceGhost.style.borderColor = motionGhostColor(0, true)
      targetGhost.style.borderColor = motionGhostColor(0, true)
      sourceGhost.style.zIndex = '2'
      targetGhost.style.zIndex = '3'
      sourceGhost.style.pointerEvents = sourceIsCurrentPose ? 'none' : 'auto'
      targetGhost.style.pointerEvents = targetIsCurrentPose ? 'none' : 'auto'
      sourceGhost.style.display = drawing || sourceIsCurrentPose ? 'none' : ''
      targetGhost.style.display = drawing || targetIsCurrentPose ? 'none' : ''
      usedElements.add(sourceGhost)
      usedElements.add(targetGhost)
    }

    // Keep the legacy initial-ghost API available for isolated overlay users. A complete bridge
    // projection supplies its own `isInitial` descriptor and therefore supersedes this fallback.
    if (!hasInitialDescriptor && initialFrame !== null) {
      renderFrame(initialGhost, initialFrame)
      const initialOverlapsActive = activeSourceFrame !== null
        && activeTargetFrame !== null
        && (sameFramePose(initialFrame, activeSourceFrame) || sameFramePose(initialFrame, activeTargetFrame))
      const initialIsCurrentPose = selectionFrame !== null && sameFramePose(selectionFrame, initialFrame)
      initialGhost.style.borderColor = motionGhostColor(1)
      initialGhost.style.zIndex = '2'
      initialGhost.style.opacity = initialOverlapsActive ? '1' : motionGhostOpacity(1, true)
      initialGhost.style.pointerEvents = initialIsCurrentPose ? 'none' : 'auto'
      initialGhost.style.display = drawing || initialOverlapsActive || initialIsCurrentPose ? 'none' : ''
      usedElements.add(initialGhost)
    }

    for (const element of [sourceGhost, targetGhost, initialGhost]) {
      if (usedElements.has(element)) continue
      element.style.display = 'none'
      element.style.pointerEvents = 'none'
    }
    for (const [id, element] of keyframeGhosts) {
      if (usedDynamicKeys.has(id)) continue
      element.remove()
      keyframeGhosts.delete(id)
    }
  }

  /** Draws every persisted path and every keyframe ghost in one shared overlay projection. */
  function render(): void {
    const renderedSegments = renderSegments()
    root.style.display = suspended ? 'none' : ''
    renderInactivePaths(renderedSegments)

    const activeRenderedSegment = renderedSegments.find((candidate) => candidate.active !== false)
    const splitPreview = drawing && segment?.isTemporary === true && activeRenderedSegment !== undefined
    const sourceFrame = splitPreview
      ? activeRenderedSegment.sourceFrame
      : drawing
        ? drag?.baseFrame ?? selectionFrame ?? segment?.sourceFrame ?? null
        : segment?.sourceFrame ?? selectionFrame
    const targetFrame = splitPreview
      ? activeRenderedSegment.targetFrame
      : drawing ? draftTargetFrame : segment?.targetFrame
    renderGhosts()
    if (sourceFrame === null || targetFrame === null || targetFrame === undefined) {
      path.style.display = 'none'
      control.style.display = 'none'
      renderMoveZone()
      return
    }

    const source = frameVisualCenter(sourceFrame)
    const target = frameVisualCenter(targetFrame)
    const authoredControlPoint = splitPreview
      ? activeRenderedSegment.control
      : drawing
        ? draftControl ?? midpoint(source, target)
      : drag?.kind === 'control' && draftControl !== null
        ? draftControl
        : segment?.control ?? midpoint(source, target)
    const displayControlPoint = motionPathPointAtProgress(source, authoredControlPoint, target, 0.5)
    const displayPath = createDisplayArcPath(source, authoredControlPoint, target)
      ?? `M ${formatCoordinate(source.x)} ${formatCoordinate(source.y)} L ${formatCoordinate(target.x)} ${formatCoordinate(target.y)}`

    path.style.display = ''
    path.setAttribute('d', displayPath)
    path.dataset.motionPathActive = ''
    path.style.opacity = '1'
    control.style.display = drawing || segment !== null ? '' : 'none'
    // The visible median is a path marker, not the raw authoring handle. It therefore remains on
    // the canonical curve at 50% traversal even when the three-point circle's authoring point is
    // not itself the arc midpoint.
    control.style.left = `${displayControlPoint.x - 6}px`
    control.style.top = `${displayControlPoint.y - 6}px`
    moveZone.style.display = drawing || selectionEnabled ? '' : 'none'
    renderMoveZone()
  }

  /** Begins either the movement trace or the path-control edit. */
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
  /** Activates a ghost by its document keyframe id whenever that id is available. */
  function activateEndpointGhost(element: HTMLElement, role: MotionOverlayRole): void {
    const keyframeId = element.dataset.motionKeyframeId
    if (keyframeId !== undefined && callbacks.onActivateKeyframe !== undefined) {
      callbacks.onActivateKeyframe(keyframeId)
      return
    }
    callbacks.onActivateRole(role)
  }

  const onSourceClick = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    activateEndpointGhost(sourceGhost, 'source')
  }
  const onTargetClick = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    activateEndpointGhost(targetGhost, 'target')
  }
  const onInitialClick = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    if (callbacks.onActivateInitial !== undefined) {
      callbacks.onActivateInitial()
      return
    }
    const keyframeId = initialGhost.dataset.motionKeyframeId
    if (keyframeId !== undefined) callbacks.onActivateKeyframe?.(keyframeId)
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
    setGhosts(next): void {
      ghosts = [...next]
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
        ghosts = []
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
  path.style.opacity = kind === 'active' ? '1' : '0.18'
  return path
}

/** Projects one persisted segment into an SVG path without creating a control point. */
function renderPathElement(path: SVGPathElement, segment: MotionOverlaySegment, active: boolean, opacity = active ? 1 : 0.18): void {
  const source = frameVisualCenter(segment.sourceFrame)
  const target = frameVisualCenter(segment.targetFrame)
  const displayPath = createDisplayArcPath(source, segment.control, target)
    ?? `M ${formatCoordinate(source.x)} ${formatCoordinate(source.y)} L ${formatCoordinate(target.x)} ${formatCoordinate(target.y)}`
  path.setAttribute('d', displayPath)
  path.style.display = ''
  path.style.opacity = String(opacity)
}

/** Returns the graduated opacity for one non-active route segment. */
function inactivePathOpacity(chainDistance: number): number {
  const distance = Number.isFinite(chainDistance) ? Math.max(0, Math.round(chainDistance)) : 0
  return Number(Math.max(0.08, 0.18 - Math.min(distance, 4) * 0.03).toFixed(2))
}

/** Returns the subdued ghost/path colour or the strong colour for an active endpoint. */
function motionGhostColor(chainDistance: number, active = false): string {
  if (active) return '#f59e0b'
  const distance = Number.isFinite(chainDistance) ? Math.max(0, Math.round(chainDistance)) : 0
  const saturation = Math.max(28, 58 - Math.min(distance, 5) * 6)
  const lightness = Math.min(84, 68 + Math.min(distance, 5) * 3)
  return `hsl(38 ${saturation}% ${lightness}%)`
}

/** Returns the low opacity used by a non-active geometric ghost. */
function motionGhostOpacity(chainDistance: number, initial = false): string {
  const distance = Number.isFinite(chainDistance) ? Math.max(0, Math.round(chainDistance)) : 0
  const baseOpacity = initial ? 0.18 : 0.2
  return Math.max(0.1, baseOpacity - Math.min(distance, 5) * 0.02).toFixed(2)
}

/** Creates one transparent geometric ghost with pointer interaction enabled. */
function createGhost(doc: Document, role: MotionOverlayRole | 'initial' | 'keyframe'): HTMLElement {
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
