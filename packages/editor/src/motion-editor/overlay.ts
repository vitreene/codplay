/** DOM-only motion authoring surface. It never reads the document or a player node. */

import type { SelectionFrameValue } from '../decor-editor/types'
import { bindGestureSession, type GestureSessionHandle } from '@codplay/selection-frame/gesture-session'
import {
  createDisplayArcPath,
  createMotionArcPath,
  midpoint,
  motionPathPointAtProgress,
  sameFramePose,
  splitMotionPath,
  type MotionGeometryPose,
  type MotionPoint,
} from './geometry'
import type { MotionGeometryStore, MotionGeometryProjection } from './geometry-store'

export type MotionOverlayRole = 'source' | 'target'

export type MotionOverlaySegment = Readonly<{
  /** Stable segment key used to keep the inactive SVG paths mounted across refreshes. */
  id?: string
  /** Document keyframe owning the source endpoint, when the bridge has document context. */
  sourceKeyframeId?: string
  /** Document keyframe owning the target endpoint, when the bridge has document context. */
  targetKeyframeId?: string
  sourceGeometry: MotionGeometryPose
  targetGeometry: MotionGeometryPose
  /** Current interpolated geometry, used while previewing a temporary waypoint. */
  selectionGeometry?: MotionGeometryPose
  control: MotionPoint
  path?: string
  orientToPath?: boolean
  /** Only the active segment exposes its role and path-control affordance. */
  role?: MotionOverlayRole
  /** Marks the one segment whose pose and path can currently be edited. */
  active?: boolean
  /** Marks an interpolated pose with no document KF; its movement preview splits the route in two. */
  isTemporary?: boolean
  /** Eased progress of a potential waypoint in its original segment. */
  splitProgress?: number
  /** Projects the future split while a CS pose gesture is still a snapshot preview. */
  posePreview?: boolean
}>

export type MotionOverlayGhost = Readonly<{
  /** Stable key used to preserve one DOM ghost for one document keyframe. */
  id: string
  /** Real document keyframe represented by this ghost. */
  keyframeId: string
  geometry: MotionGeometryPose
  /** Temporal distance from the current author pose in the ordered keyframe chain. */
  chainDistance: number
  /** Gives the first keyframe the existing route-level ghost semantics. */
  isInitial?: boolean
}>

export type MotionPathChange = Readonly<{
  control: MotionPoint
  path?: string
}>

export interface MotionOverlayCallbacks {
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
  /** Called when the selected incoming path's orientation option changes. */
  onPathOrientationChange?: (enabled: boolean) => void
}

export interface MotionOverlayHandle {
  /** Suspends all artefacts during playback or host teardown. */
  setSuspended: (suspended: boolean) => void
  /** Removes all listeners and artefacts from the scene host. */
  destroy: () => void
}

type DragState = Readonly<{ pointerId: number }>

/** Mounts one reusable, document-agnostic motion overlay into a scene host. */
export function createMotionOverlay(
  host: HTMLElement,
  callbacks: MotionOverlayCallbacks,
  geometry: MotionGeometryStore,
): MotionOverlayHandle {
  const doc = host.ownerDocument
  const root = doc.createElement('div')
  root.id = 'editor-motion-overlay'
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
  // These controls sit above the Selection Frame so its body can own movement without masking
  // the trajectory-specific editing affordances at an interpolated pose.
  control.style.zIndex = '1101'

  const orientationButton = doc.createElement('button')
  orientationButton.id = 'editor-motion-path-orientation'
  orientationButton.type = 'button'
  orientationButton.dataset.editorOverlay = 'motion-orientation'
  orientationButton.setAttribute('aria-label', 'Aligner sur la tangente')
  orientationButton.setAttribute('aria-pressed', 'false')
  orientationButton.style.position = 'absolute'
  orientationButton.style.display = 'none'
  orientationButton.style.zIndex = '1102'
  orientationButton.style.transform = 'translate(-50%, 0)'
  orientationButton.style.boxSizing = 'border-box'
  orientationButton.style.width = '28px'
  orientationButton.style.height = '28px'
  orientationButton.style.padding = '4px'
  orientationButton.style.border = '1px solid rgba(245, 158, 11, 0.9)'
  orientationButton.style.borderRadius = '4px'
  orientationButton.style.background = 'rgba(17, 24, 39, 0.94)'
  orientationButton.style.color = '#e5e7eb'
  orientationButton.style.pointerEvents = 'auto'
  orientationButton.style.touchAction = 'manipulation'
  const tangentIcon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  tangentIcon.id = 'editor-motion-path-tangent-icon'
  tangentIcon.setAttribute('viewBox', '0 0 24 24')
  tangentIcon.setAttribute('width', '18')
  tangentIcon.setAttribute('height', '18')
  tangentIcon.setAttribute('fill', 'none')
  tangentIcon.setAttribute('stroke', 'currentColor')
  tangentIcon.setAttribute('stroke-width', '1.8')
  tangentIcon.setAttribute('stroke-linecap', 'round')
  tangentIcon.setAttribute('stroke-linejoin', 'round')
  tangentIcon.setAttribute('aria-hidden', 'true')
  tangentIcon.setAttribute('focusable', 'false')
  const tangentCurve = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
  tangentCurve.setAttribute('d', 'M 3 3 C 3 11 6 18.5 12 18.5 C 18 18.5 21 11 21 3')
  const tangentLine = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
  tangentLine.setAttribute('d', 'M 2.5 18.5 H 21.5 M 18.5 15.5 L 21.5 18.5 L 18.5 21.5')
  tangentIcon.append(tangentCurve, tangentLine)
  orientationButton.appendChild(tangentIcon)

  host.append(root, control, orientationButton)

  let selectionGeometry: MotionGeometryPose | null = null
  let segment: MotionOverlaySegment | null = null
  let segments: MotionOverlaySegment[] = []
  let ghosts: MotionOverlayGhost[] = []
  let initialFrame: SelectionFrameValue | null = null
  const inactivePaths = new Map<string, SVGPathElement>()
  const keyframeGhosts = new Map<string, HTMLElement>()
  let suspended = false
  let drag: DragState | null = null
  let controlGesture: GestureSessionHandle | null = null
  let draftControl: MotionPoint | null = null

  /** Keeps the orientation button from activating path selection or scene gestures. */
  function stopOrientationEvent(event: Event): void {
    event.stopPropagation()
  }

  /** Toggles tangent alignment for the active incoming path. */
  function toggleOrientation(): void {
    const enabled = orientationButton.getAttribute('aria-pressed') !== 'true'
    orientationButton.setAttribute('aria-pressed', String(enabled))
    callbacks.onPathOrientationChange?.(enabled)
  }

  /** Stops scene gestures before applying the accessible orientation toggle. */
  function onOrientationClick(event: Event): void {
    stopOrientationEvent(event)
    toggleOrientation()
  }

  /** Converts a client pointer coordinate into scene-host local coordinates. */
  function localPoint(event: PointerEvent): MotionPoint {
    const bounds = host.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  /** Resolves the runtime anchor center for one segment endpoint. */
  function sourcePathAnchorFor(segment: MotionOverlaySegment): MotionPoint {
    return segment.sourceGeometry.pathAnchor
  }

  /** Resolves the runtime anchor center for one segment endpoint. */
  function targetPathAnchorFor(segment: MotionOverlaySegment): MotionPoint {
    return segment.targetGeometry.pathAnchor
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

  /** Returns the route that will exist after a temporary middle-of-segment drop is committed. */
  function renderSegments(): MotionOverlaySegment[] {
    const waypointFrame = segment?.posePreview ? selectionGeometry?.frame ?? null : null
    if (waypointFrame === null || segment?.isTemporary !== true) return segments
    const activeIndex = segments.findIndex((candidate) => candidate.active !== false)
    if (activeIndex < 0) return segments

    const sourceCenter = sourcePathAnchorFor(segment)
    const draftGeometry = segment.selectionGeometry ?? selectionGeometry
    if (draftGeometry === null || draftGeometry === undefined) return segments
    const draftCenter = draftGeometry.pathAnchor
    const targetCenter = targetPathAnchorFor(segment)
    const split = segment.path === undefined ? null : splitMotionPath(
      segment.path, sourceCenter, draftCenter, targetCenter, segment.splitProgress ?? 0.5,
    )
    const previewBefore: MotionOverlaySegment = {
      id: `${segment.id ?? 'motion-segment'}:preview-before`,
      ...(segment.sourceKeyframeId === undefined ? {} : { sourceKeyframeId: segment.sourceKeyframeId }),
      sourceGeometry: segment.sourceGeometry,
      targetGeometry: draftGeometry,
      control: split?.beforeControl ?? midpoint(sourceCenter, draftCenter),
      ...(split?.before === undefined ? {} : { path: split.before }),
      ...(segment.orientToPath === true ? { orientToPath: true } : {}),
      role: 'target',
      active: true,
      isTemporary: true,
    }
    const previewAfter: MotionOverlaySegment = {
      id: `${segment.id ?? 'motion-segment'}:preview-after`,
      ...(segment.targetKeyframeId === undefined ? {} : { targetKeyframeId: segment.targetKeyframeId }),
      sourceGeometry: draftGeometry,
      targetGeometry: segment.targetGeometry,
      control: split?.afterControl ?? midpoint(draftCenter, targetCenter),
      ...(split?.after === undefined ? {} : { path: split.after }),
      ...(segment.orientToPath === true ? { orientToPath: true } : {}),
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
    const activeSourceFrame = segment?.sourceGeometry.frame ?? null
    const activeTargetFrame = segment?.targetGeometry.frame ?? null
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
      renderFrame(element, ghost.geometry.borderFrame)
      element.dataset.motionKeyframeId = ghost.keyframeId
      element.dataset.motionGhostDistance = String(Math.max(0, Math.round(ghost.chainDistance)))
      const isActiveGhost = kind === 'source' || kind === 'target'
      const isCurrentPose = selectionGeometry !== null && sameFramePose(selectionGeometry.frame, ghost.geometry.frame)
      const overlapsActive = kind === 'initial'
        && activeSourceFrame !== null
        && activeTargetFrame !== null
        && (sameFramePose(ghost.geometry.frame, activeSourceFrame) || sameFramePose(ghost.geometry.frame, activeTargetFrame))
      const isInactiveGhost = kind === 'keyframe' || (kind === 'initial' && !overlapsActive)
      element.style.borderColor = motionGhostColor(ghost.chainDistance, isActiveGhost)
      element.style.zIndex = kind === 'target' ? '3' : '2'
      // Non-active ghosts are deliberately subdued by both opacity and colour; the active
      // segment endpoints stay strong so the editable route remains immediately legible.
      element.style.opacity = isInactiveGhost
        ? motionGhostOpacity(ghost.chainDistance, kind === 'initial')
        : '1'
      element.style.pointerEvents = isCurrentPose ? 'none' : 'auto'
      element.style.display = isCurrentPose || overlapsActive ? 'none' : ''
    }

    // The public overlay API still accepts a single segment for isolated callers and older tests.
    // In the document bridge every segment carries endpoint ids and therefore uses the complete
    // ghost projection above.
    const hasStructuredEndpoints = segment !== null
      && activeSourceId !== undefined
      && activeTargetId !== undefined
      && ghosts.some((ghost) => ghost.keyframeId === activeSourceId || ghost.keyframeId === activeTargetId)
    if (segment !== null && !hasStructuredEndpoints) {
      const sourceGeometry = segment.sourceGeometry
      const targetGeometry = segment.targetGeometry
      const sourceIsCurrentPose = selectionGeometry !== null && sameFramePose(selectionGeometry.frame, sourceGeometry.frame)
      const targetIsCurrentPose = selectionGeometry !== null && sameFramePose(selectionGeometry.frame, targetGeometry.frame)
      renderFrame(sourceGhost, sourceGeometry.borderFrame)
      renderFrame(targetGhost, targetGeometry.borderFrame)
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
      sourceGhost.style.display = sourceIsCurrentPose ? 'none' : ''
      targetGhost.style.display = targetIsCurrentPose ? 'none' : ''
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
      const initialIsCurrentPose = selectionGeometry !== null && sameFramePose(selectionGeometry.frame, initialFrame)
      initialGhost.style.borderColor = motionGhostColor(1)
      initialGhost.style.zIndex = '2'
      initialGhost.style.opacity = initialOverlapsActive ? '1' : motionGhostOpacity(1, true)
      initialGhost.style.pointerEvents = initialIsCurrentPose ? 'none' : 'auto'
      initialGhost.style.display = initialOverlapsActive || initialIsCurrentPose ? 'none' : ''
      usedElements.add(initialGhost)
    }

    for (const element of [sourceGhost, targetGhost, initialGhost]) {
      if (usedElements.has(element)) continue
      element.style.display = 'none'
      element.style.pointerEvents = 'none'
      delete element.dataset.motionKeyframeId
      delete element.dataset.motionGhostDistance
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
    orientationButton.style.display = 'none'
    renderInactivePaths(renderedSegments)

    const activeRenderedSegment = renderedSegments.find((candidate) => candidate.active !== false)
    const splitPreview = segment?.posePreview === true && segment.isTemporary === true && activeRenderedSegment !== undefined
    const sourceFrame = splitPreview
      ? activeRenderedSegment.sourceGeometry.frame
      : segment?.sourceGeometry.frame ?? selectionGeometry?.frame
    const targetFrame = splitPreview
      ? activeRenderedSegment.targetGeometry.frame
      : segment?.targetGeometry.frame
    renderGhosts()
    if (sourceFrame === null || targetFrame === null || targetFrame === undefined) {
      path.style.display = 'none'
      control.style.display = 'none'
      return
    }

    if (segment === null) {
      path.style.display = 'none'
      control.style.display = 'none'
      return
    }
    const previewGeometry = splitPreview ? activeRenderedSegment.targetGeometry : selectionGeometry
    const previewAnchor = previewGeometry?.pathAnchor ?? null
    const source = splitPreview && activeRenderedSegment !== undefined
      ? sourcePathAnchorFor(activeRenderedSegment)
      : sourcePathAnchorFor(segment)
    const target = splitPreview && activeRenderedSegment !== undefined
      ? targetPathAnchorFor(activeRenderedSegment)
      : targetPathAnchorFor(segment)
    if (source === null || target === null || (splitPreview && previewAnchor === null)) {
      path.style.display = 'none'
      control.style.display = 'none'
      return
    }
    const authoredControlPoint = splitPreview
      ? activeRenderedSegment.control
      : drag !== null && draftControl !== null
        ? draftControl
        : segment.control ?? midpoint(source, target)
    const displayControlPoint = motionPathPointAtProgress(source, authoredControlPoint, target, 0.5)
    const displayPath = createDisplayArcPath(source, authoredControlPoint, target)
      ?? `M ${formatCoordinate(source.x)} ${formatCoordinate(source.y)} L ${formatCoordinate(target.x)} ${formatCoordinate(target.y)}`

    path.style.display = ''
    path.setAttribute('d', displayPath)
    path.dataset.motionPathActive = ''
    path.style.opacity = '1'
    control.style.display = ''
    // The visible median is a path marker, not the raw authoring handle. It therefore remains on
    // the canonical curve at 50% traversal even when the three-point circle's authoring point is
    // not itself the arc midpoint.
    control.style.left = `${displayControlPoint.x - 6}px`
    control.style.top = `${displayControlPoint.y - 6}px`
    if (!suspended && segment.path !== undefined) {
      const aligned = segment.orientToPath === true
      orientationButton.setAttribute('aria-pressed', String(aligned))
      orientationButton.style.color = aligned ? '#fbbf24' : '#e5e7eb'
      orientationButton.style.display = 'flex'
      orientationButton.style.alignItems = 'center'
      orientationButton.style.justifyContent = 'center'
      orientationButton.style.left = `${displayControlPoint.x}px`
      orientationButton.style.top = `${displayControlPoint.y + 13}px`
    }
  }

  /** Begins a path-control edit without taking ownership of item movement. */
  function beginControlDrag(event: PointerEvent): DragState | null {
    if (suspended) return null
    if (segment === null) return null
    event.preventDefault()
    event.stopPropagation()
    const next = { pointerId: event.pointerId }
    drag = next
    return next
  }

  /** Updates the path-control candidate without touching the selected item pose. */
  function moveDrag(event: PointerEvent, session: DragState): void {
    if (drag !== session || session.pointerId !== event.pointerId) return
    const point = localPoint(event)
    draftControl = point
    render()
  }

  /** Commits one path-control edit or discards it on pointer cancellation. */
  function endDrag(current: DragState, apply: boolean, event: PointerEvent | null): void {
    if (drag !== current) return
    drag = null
    if (apply && segment !== null && draftControl !== null && event !== null) {
      const source = sourcePathAnchorFor(segment)
      const target = targetPathAnchorFor(segment)
      const pathValue = createMotionArcPath(source, draftControl, target)
      callbacks.onPathChange({ control: draftControl, ...(pathValue === undefined ? {} : { path: pathValue }) })
    }
    draftControl = null
    render()
  }

  /** Resets the current control point to the exact straight-line midpoint. */
  function resetControl(event: MouseEvent): void {
    if (segment === null) return
    event.preventDefault()
    event.stopPropagation()
    const source = sourcePathAnchorFor(segment)
    const target = targetPathAnchorFor(segment)
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
  controlGesture = bindGestureSession<DragState>(control, {
    onStart: beginControlDrag,
    onMove: moveDrag,
    onEnd: endDrag,
  })
  control.addEventListener('dblclick', onDoubleClick)
  orientationButton.addEventListener('click', onOrientationClick)
  orientationButton.addEventListener('pointerdown', stopOrientationEvent)
  path.addEventListener('click', onPathClick)
  sourceGhost.addEventListener('click', onSourceClick)
  targetGhost.addEventListener('click', onTargetClick)
  initialGhost.addEventListener('click', onInitialClick)
  const unsubscribeGeometry = geometry.subscribe((projection: MotionGeometryProjection) => {
    selectionGeometry = projection.selection?.geometry ?? null
    ghosts = [...projection.ghosts]
    initialFrame = projection.initialGhost
    const activeIndex = projection.segments.findIndex((candidate) => candidate.active !== false)
    segments = projection.segments.map((candidate, index) => index === activeIndex
      ? { ...candidate, active: true }
      : { ...candidate, active: false })
    segment = activeIndex < 0 ? null : segments[activeIndex]!
    if (segment === null) delete root.dataset.motionPathActive
    render()
  })

  return {
    setSuspended(next): void {
      suspended = next
      render()
    },
    destroy(): void {
      unsubscribeGeometry()
      controlGesture?.unbind()
      controlGesture = null
      control.removeEventListener('dblclick', onDoubleClick)
      orientationButton.removeEventListener('click', onOrientationClick)
      orientationButton.removeEventListener('pointerdown', stopOrientationEvent)
      path.removeEventListener('click', onPathClick)
      sourceGhost.removeEventListener('click', onSourceClick)
      targetGhost.removeEventListener('click', onTargetClick)
      initialGhost.removeEventListener('click', onInitialClick)
      clearInactivePaths()
      root.remove()
      control.remove()
      orientationButton.remove()
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
  const source = segment.sourceGeometry.pathAnchor
  const target = segment.targetGeometry.pathAnchor
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

/** Formats one display coordinate independently of locale and browser CSS. */
function formatCoordinate(value: number): string {
  return Number(value.toFixed(3)).toString()
}
