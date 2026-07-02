import { createActor } from 'xstate'
import { worldDeltaToLocalDelta } from 'codplay/runtime/modules/list-flip/engine/dom-matrix'
import type { Matrix2D } from 'codplay/runtime/modules/list-flip/engine/types'
import type { AutoCapsuleGridArtifact } from '@codplay/capsule-automation'
import { csMachine } from './machine'
import {
  calibrateGhostToWorldSnapshot,
  captureOverlayPose,
  ensureOverlayLayer,
  localFractionToViewportPoint,
  measureWorldRect
} from './overlay-pose'
import type { OverlayPose } from './overlay-pose'
import type {
  CapabilityPreset,
  CsValueAdapter,
  SelectionFrameHandle,
  SelectionFrameOptions,
  SelectionFramePart
} from './types'

const HANDLE_SIZE_PX = 10
const PIVOT_SIZE_PX = 12
const NEEDLE_LENGTH_PX = 36
const PIVOT_MAGNET_RADIUS_PX = 8
const ROTATE_STEP_DEG = 15
const DENSE_GRID_THRESHOLD = 50
const DENSE_GRID_STEP = 10

type CornerId = 'nw' | 'ne' | 'se' | 'sw'
type SideId = 'n' | 'e' | 's' | 'w'
type HandleId = CornerId | SideId

/** Characteristic points in cs-local fractions (0..1). */
const CHARACTERISTIC_POINTS: Record<HandleId, { fx: number; fy: number }> = {
  nw: { fx: 0, fy: 0 },
  ne: { fx: 1, fy: 0 },
  se: { fx: 1, fy: 1 },
  sw: { fx: 0, fy: 1 },
  n: { fx: 0.5, fy: 0 },
  e: { fx: 1, fy: 0.5 },
  s: { fx: 0.5, fy: 1 },
  w: { fx: 0, fy: 0.5 }
}

/** Anchor of each handle: the opposite characteristic point stays fixed. */
const OPPOSITE_POINT: Record<HandleId, HandleId> = {
  nw: 'se',
  ne: 'sw',
  se: 'nw',
  sw: 'ne',
  n: 's',
  e: 'w',
  s: 'n',
  w: 'e'
}

/** Releases pointer capture without letting an InvalidPointerId abort the caller. */
function safeReleaseCapture(node: HTMLElement, pointerId: number): void {
  try {
    if (node.hasPointerCapture(pointerId)) {
      node.releasePointerCapture(pointerId)
    }
  } catch {
    // Capture already gone (pointercancel, implicit release): nothing to do.
  }
}

/**
 * Places one visual selection frame (cs) over the DOM element of one player
 * perso and turns pointer gestures into raw diffs handed to the editor-owned
 * CsValueAdapter. Emission is continuous: the element follows the gesture
 * live. See docs/plans/2026-06-09-selection-frame-plan.md.
 */
export function createSelectionFrame(options: SelectionFrameOptions): SelectionFrameHandle {
  const doc = options.sceneRoot.ownerDocument
  const overlayLayer = ensureOverlayLayer(options.sceneRoot)

  let adapter: CsValueAdapter = options.adapter
  let elementNode: HTMLElement | null = null
  let containerNode: HTMLElement | null = null
  let containerGrid: AutoCapsuleGridArtifact | null = null
  let pose: OverlayPose | null = null
  let destroyed = false

  const actor = createActor(csMachine)
  actor.start()

  // ── cs DOM ────────────────────────────────────────────────────────────────

  const csRoot = doc.createElement('div')
  csRoot.setAttribute('data-selection-frame', options.itemId)
  csRoot.style.position = 'fixed'
  csRoot.style.boxSizing = 'border-box'
  csRoot.style.border = '1px solid #4a90d9'
  csRoot.style.transformOrigin = '0px 0px'
  csRoot.style.display = 'none'
  csRoot.style.pointerEvents = 'auto'
  csRoot.style.touchAction = 'none'
  csRoot.style.cursor = 'move'
  overlayLayer.appendChild(csRoot)

  const handleNodes = new Map<HandleId, HTMLElement>()

  const handleCursors: Record<HandleId, string> = {
    nw: 'nwse-resize',
    ne: 'nesw-resize',
    se: 'nwse-resize',
    sw: 'nesw-resize',
    n: 'ns-resize',
    e: 'ew-resize',
    s: 'ns-resize',
    w: 'ew-resize'
  }

  for (const [id, point] of Object.entries(CHARACTERISTIC_POINTS) as Array<[HandleId, { fx: number; fy: number }]>) {
    const handle = doc.createElement('div')
    handle.setAttribute('data-cs-handle', id)
    handle.style.position = 'absolute'
    handle.style.left = `${point.fx * 100}%`
    handle.style.top = `${point.fy * 100}%`
    handle.style.width = `${HANDLE_SIZE_PX}px`
    handle.style.height = `${HANDLE_SIZE_PX}px`
    handle.style.marginLeft = `${-HANDLE_SIZE_PX / 2}px`
    handle.style.marginTop = `${-HANDLE_SIZE_PX / 2}px`
    handle.style.background = '#ffffff'
    handle.style.border = '1px solid #4a90d9'
    handle.style.boxSizing = 'border-box'
    handle.style.cursor = handleCursors[id]
    handle.style.touchAction = 'none'
    csRoot.appendChild(handle)
    handleNodes.set(id, handle)
  }

  // ── rotation needle (pivot + tip) ─────────────────────────────────────────

  // Pivot position in cs-local fractions; center by default. Magnetized to
  // the 8 characteristic points; when coincident, the underlying resize
  // handle is disabled (two functions cannot share one point).
  let pivotFraction = { fx: 0.5, fy: 0.5 }
  let pivotMagnetTarget: HandleId | null = null
  let needleAngleDeg = -90
  let needleLengthPx = NEEDLE_LENGTH_PX

  const pivotNode = doc.createElement('div')
  pivotNode.setAttribute('data-cs-pivot', '')
  pivotNode.style.position = 'absolute'
  pivotNode.style.width = `${PIVOT_SIZE_PX}px`
  pivotNode.style.height = `${PIVOT_SIZE_PX}px`
  pivotNode.style.marginLeft = `${-PIVOT_SIZE_PX / 2}px`
  pivotNode.style.marginTop = `${-PIVOT_SIZE_PX / 2}px`
  pivotNode.style.borderRadius = '50%'
  pivotNode.style.background = '#4a90d9'
  pivotNode.style.border = '2px solid #ffffff'
  pivotNode.style.boxSizing = 'border-box'
  pivotNode.style.cursor = 'grab'
  pivotNode.style.touchAction = 'none'
  csRoot.appendChild(pivotNode)

  const needleLine = doc.createElement('div')
  needleLine.setAttribute('data-cs-needle-line', '')
  needleLine.style.position = 'absolute'
  needleLine.style.width = `${NEEDLE_LENGTH_PX}px`
  needleLine.style.height = '2px'
  needleLine.style.background = '#4a90d9'
  needleLine.style.transformOrigin = '0 50%'
  needleLine.style.pointerEvents = 'none'
  csRoot.appendChild(needleLine)

  const needleTip = doc.createElement('div')
  needleTip.setAttribute('data-cs-needle-tip', '')
  needleTip.style.position = 'absolute'
  needleTip.style.width = `${HANDLE_SIZE_PX}px`
  needleTip.style.height = `${HANDLE_SIZE_PX}px`
  needleTip.style.marginLeft = `${-HANDLE_SIZE_PX / 2}px`
  needleTip.style.marginTop = `${-HANDLE_SIZE_PX / 2}px`
  needleTip.style.borderRadius = '50%'
  needleTip.style.background = '#ffffff'
  needleTip.style.border = '2px solid #4a90d9'
  needleTip.style.boxSizing = 'border-box'
  needleTip.style.cursor = 'crosshair'
  needleTip.style.touchAction = 'none'
  csRoot.appendChild(needleTip)

  const positionNeedle = (): void => {
    const width = Number.parseFloat(csRoot.style.width) || 0
    const height = Number.parseFloat(csRoot.style.height) || 0
    const px = pivotFraction.fx * width
    const py = pivotFraction.fy * height
    pivotNode.style.left = `${px}px`
    pivotNode.style.top = `${py}px`
    needleLine.style.left = `${px}px`
    needleLine.style.top = `${py - 1}px`
    needleLine.style.width = `${needleLengthPx}px`
    needleLine.style.rotate = `${needleAngleDeg}deg`
    const rad = (needleAngleDeg * Math.PI) / 180
    needleTip.style.left = `${px + Math.cos(rad) * needleLengthPx}px`
    needleTip.style.top = `${py + Math.sin(rad) * needleLengthPx}px`
  }

  // ── gabarit DOM (grid positioning context only) ──────────────────────────

  const gabaritRoot = doc.createElement('div')
  gabaritRoot.setAttribute('data-cs-gabarit', options.itemId)
  gabaritRoot.style.position = 'fixed'
  gabaritRoot.style.boxSizing = 'border-box'
  gabaritRoot.style.transformOrigin = '0px 0px'
  gabaritRoot.style.display = 'none'
  gabaritRoot.style.pointerEvents = 'none'
  overlayLayer.insertBefore(gabaritRoot, csRoot)

  // ── state application ────────────────────────────────────────────────────

  const isSuspended = (): boolean => actor.getSnapshot().matches('suspended') || actor.getSnapshot().matches('idle')

  const capabilityActive = (capability: string): boolean =>
    actor.getSnapshot().context.capabilities.includes(capability as never)

  const operationEnabled = (op: string): boolean => !actor.getSnapshot().context.disabledOperations.includes(op)

  const csShouldDisplay = (): boolean => {
    const context = actor.getSnapshot().context
    if (isSuspended() || !context.csVisible || pose === null) return false
    if (options.minSizePx !== undefined && (pose.frameWidth < options.minSizePx || pose.frameHeight < options.minSizePx)) {
      return false
    }
    return true
  }

  const refreshHandleVisibility = (): void => {
    const resizeEnabled = (capabilityActive('resize') || capabilityActive('scale')) && operationEnabled('resize')
    for (const [id, handle] of handleNodes) {
      const suppressed = pivotMagnetTarget === id
      handle.style.display = resizeEnabled && !suppressed ? '' : 'none'
      // The current mode is visualized: a thicker border means scale.
      handle.style.borderWidth = currentHandleMode(id) === 'scale' ? '3px' : '1px'
    }
    const rotationEnabled = capabilityActive('rotate') && operationEnabled('rotate')
    needleLine.style.display = rotationEnabled ? '' : 'none'
    needleTip.style.display = rotationEnabled ? '' : 'none'
    pivotNode.style.display = rotationEnabled || capabilityActive('rotation-origin') ? '' : 'none'
    pivotNode.style.pointerEvents = capabilityActive('rotation-origin') ? 'auto' : 'none'
    csRoot.style.cursor = capabilityActive('move') && operationEnabled('move') ? 'move' : 'default'
  }

  const applyMachineState = (): void => {
    const context = actor.getSnapshot().context
    csRoot.style.display = csShouldDisplay() ? '' : 'none'
    csRoot.style.pointerEvents = context.csActive ? 'auto' : 'none'
    if (elementNode !== null) {
      elementNode.style.visibility = context.elementVisible ? '' : 'hidden'
    }
    refreshHandleVisibility()
    refreshGabarit()
  }

  const positionCs = (): void => {
    if (elementNode === null) return
    pose = captureOverlayPose(elementNode)
    const m = pose.rotationMatrix
    csRoot.style.width = `${pose.frameWidth}px`
    csRoot.style.height = `${pose.frameHeight}px`
    csRoot.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, 0, 0)`
    csRoot.style.translate = '0px 0px'
    calibrateGhostToWorldSnapshot(csRoot, pose.rect)
    positionNeedle()
  }

  // ── gabarit ──────────────────────────────────────────────────────────────

  const supportsGapDecoration = (): boolean =>
    typeof globalThis.CSS !== 'undefined' && typeof globalThis.CSS.supports === 'function'
      ? globalThis.CSS.supports('gap-decoration', 'outline')
      : false

  const zoneNodes = new Map<string, HTMLElement>()

  const renderGabaritZones = (): void => {
    gabaritRoot.replaceChildren()
    zoneNodes.clear()
    if (containerGrid === null) return
    const { rows, cols } = containerGrid.context

    // The artifact's inlineStyle is the single source of truth for the grid
    // structure (templates AND gaps) — applying it keeps the gabarit zones
    // exactly aligned with the real container cells.
    gabaritRoot.style.display = 'grid'
    gabaritRoot.style.gridTemplateRows = `repeat(${rows}, 1fr)`
    gabaritRoot.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
    for (const [key, value] of Object.entries(containerGrid.inlineStyle)) {
      gabaritRoot.style[key as never] = String(value) as never
    }

    if (supportsGapDecoration()) {
      gabaritRoot.style.setProperty('gap-decoration', '1px dashed rgba(74, 144, 217, 0.6)')
      return
    }

    const rowStep = rows > DENSE_GRID_THRESHOLD ? DENSE_GRID_STEP : 1
    const colStep = cols > DENSE_GRID_THRESHOLD ? DENSE_GRID_STEP : 1

    for (let row = 1; row <= rows; row += rowStep) {
      for (let col = 1; col <= cols; col += colStep) {
        const zone = doc.createElement('div')
        zone.setAttribute('data-cs-zone', `${row}:${col}`)
        zone.style.gridRow = `${row} / span ${Math.min(rowStep, rows - row + 1)}`
        zone.style.gridColumn = `${col} / span ${Math.min(colStep, cols - col + 1)}`
        zone.style.outline = '1px dashed rgba(74, 144, 217, 0.6)'
        zone.style.outlineOffset = '-1px'
        zone.style.pointerEvents = 'auto'
        gabaritRoot.appendChild(zone)
        zoneNodes.set(`${row}:${col}`, zone)
      }
    }
  }

  const refreshGabarit = (): void => {
    const active = capabilityActive('positioning') && containerNode !== null && containerGrid !== null && !isSuspended()

    if (!active) {
      gabaritRoot.style.display = 'none'
      return
    }

    const containerPose = captureOverlayPose(containerNode!)
    const m = containerPose.rotationMatrix
    gabaritRoot.style.width = `${containerPose.frameWidth}px`
    gabaritRoot.style.height = `${containerPose.frameHeight}px`
    gabaritRoot.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, 0, 0)`
    renderGabaritZones()
    calibrateGhostToWorldSnapshot(gabaritRoot, containerPose.rect)
  }

  const gridDragActive = (): boolean =>
    capabilityActive('positioning') && containerNode !== null && containerGrid !== null

  /** Gap sizes in local pixels, read from the artifact's inlineStyle. */
  const gridGapsPx = (): { column: number; row: number } => {
    const inline = (containerGrid?.inlineStyle ?? {}) as Record<string, unknown>
    const parse = (value: unknown): number => {
      const parsed = Number.parseFloat(String(value ?? ''))
      return Number.isFinite(parsed) ? parsed : 0
    }
    const shared = parse(inline.gap)
    return {
      column: parse(inline.columnGap) || shared,
      row: parse(inline.rowGap) || shared
    }
  }

  /** Cell strides (cell + gap) in the container's local space. */
  const gridStrides = (
    containerPose: OverlayPose
  ): { strideX: number; strideY: number; cellWidth: number; cellHeight: number } | null => {
    if (containerGrid === null) return null
    const { rows, cols } = containerGrid.context
    const gaps = gridGapsPx()
    const cellWidth = Math.max(1e-3, (containerPose.localWidth - gaps.column * (cols - 1)) / cols)
    const cellHeight = Math.max(1e-3, (containerPose.localHeight - gaps.row * (rows - 1)) / rows)
    return { strideX: cellWidth + gaps.column, strideY: cellHeight + gaps.row, cellWidth, cellHeight }
  }

  /**
   * Resolves the grid cell under one viewport point (1-based row/col). The
   * pointer is inverse-transformed into the container's LOCAL space through
   * its pose — no fraction is ever computed on the axis-aligned rect — and
   * the boundaries account for the grid gaps.
   */
  const cellFromViewportPoint = (x: number, y: number): { row: number; col: number } | null => {
    if (containerNode === null || containerGrid === null) return null
    const containerPose = captureOverlayPose(containerNode)
    if (containerPose.localWidth < 1e-3 || containerPose.localHeight < 1e-3) return null
    const strides = gridStrides(containerPose)
    if (strides === null) return null
    const origin = localFractionToViewportPoint(containerPose, 0, 0)
    const local = worldDeltaToLocalDelta(containerPose.matrix, x - origin.x, y - origin.y)
    const { rows, cols } = containerGrid.context
    const col = Math.min(cols, Math.max(1, Math.floor(local.x / strides.strideX) + 1))
    const row = Math.min(rows, Math.max(1, Math.floor(local.y / strides.strideY) + 1))
    return { row, col }
  }

  /** Viewport anchor of one grid cell (gap-aware), via the affine mapping. */
  const cellViewportAnchor = (row: number, col: number): { left: number; top: number } | null => {
    if (containerNode === null || containerGrid === null) return null
    const containerPose = captureOverlayPose(containerNode)
    const strides = gridStrides(containerPose)
    if (strides === null || containerPose.localWidth < 1e-3 || containerPose.localHeight < 1e-3) return null
    const point = localFractionToViewportPoint(
      containerPose,
      ((col - 1) * strides.strideX) / containerPose.localWidth,
      ((row - 1) * strides.strideY) / containerPose.localHeight
    )
    return { left: point.x, top: point.y }
  }

  let highlightedZone: HTMLElement | null = null
  const highlightZone = (cell: { row: number; col: number } | null): void => {
    if (highlightedZone !== null) {
      highlightedZone.style.background = ''
      highlightedZone = null
    }
    if (cell === null) return
    const zone = zoneNodes.get(`${cell.row}:${cell.col}`)
    if (zone !== undefined) {
      zone.style.background = 'rgba(74, 144, 217, 0.25)'
      highlightedZone = zone
    }
  }

  // ── drag (cs body) ───────────────────────────────────────────────────────

  type DragSession = {
    pointerId: number
    startX: number
    startY: number
    /** Conversion space frozen at session start. */
    parentMatrix: Matrix2D
    /** Element viewport anchor at session start — baseline for measured correction. */
    startRectLeft: number
    startRectTop: number
    emittedX: number
    emittedY: number
    axisLock: 'x' | 'y' | null
    /** Grid libre mode: element stays put, a temporary clone previews the snap. */
    gridClone: HTMLElement | null
    /** Last highlighted cell — the single source of truth for the drop. */
    lastCell: { row: number; col: number } | null
    lastLocalX: number
    lastLocalY: number
  }
  let dragSession: DragSession | null = null

  const endDragSession = (apply: boolean): void => {
    if (dragSession === null) return
    const session = dragSession
    dragSession = null
    safeReleaseCapture(csRoot, session.pointerId)
    actor.send({ type: 'DRAG_END' })

    if (session.gridClone !== null) {
      session.gridClone.remove()
      highlightZone(null)
      if (apply) {
        // Drop contract: the element lands exactly where the author saw it —
        // the highlighted cell drives the drop when the adapter exposes the
        // channel; the pixel delta is only the fallback.
        if (adapter.applyCellDrop !== undefined && session.lastCell !== null) {
          adapter.applyCellDrop(session.lastCell)
        } else {
          adapter.applyMove({ dx: Math.round(session.lastLocalX), dy: Math.round(session.lastLocalY) })
        }
      }
    }

    csRoot.style.translate = '0px 0px'
    sync()
  }

  const onBodyPointerDown = (event: PointerEvent): void => {
    if (event.target !== csRoot || pose === null || event.button !== 0) return
    actor.send({ type: 'DRAG_START' })
    if (!actor.getSnapshot().matches({ active: 'dragging' })) return

    let gridClone: HTMLElement | null = null
    if (gridDragActive() && elementNode !== null) {
      const clone = elementNode.cloneNode(true)
      if (clone instanceof HTMLElement) {
        clone.removeAttribute('id')
        clone.setAttribute('aria-hidden', 'true')
        clone.setAttribute('data-cs-grid-clone', '')
        clone.style.position = 'fixed'
        clone.style.margin = '0'
        clone.style.opacity = '0.5'
        clone.style.pointerEvents = 'none'
        // Explicit dimensions: in position fixed the clone loses its
        // grid-driven size — reproduce the element's rendered size.
        clone.style.width = `${pose.frameWidth}px`
        clone.style.height = `${pose.frameHeight}px`
        clone.style.boxSizing = 'border-box'
        clone.style.left = `${pose.rect.left}px`
        clone.style.top = `${pose.rect.top}px`
        overlayLayer.appendChild(clone)
        gridClone = clone
      }
    }

    dragSession = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      parentMatrix: pose.parentMatrix,
      startRectLeft: pose.rect.left,
      startRectTop: pose.rect.top,
      emittedX: 0,
      emittedY: 0,
      axisLock: null,
      gridClone,
      lastCell: null,
      lastLocalX: 0,
      lastLocalY: 0
    }
    csRoot.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const onBodyPointerMove = (event: PointerEvent): void => {
    if (dragSession === null || event.pointerId !== dragSession.pointerId) return
    if (event.buttons === 0) {
      // Missed release (pointercancel, focus loss): end without a grid emission.
      endDragSession(false)
      return
    }

    let viewportDx = event.clientX - dragSession.startX
    let viewportDy = event.clientY - dragSession.startY

    if (event.shiftKey) {
      if (dragSession.axisLock === null && (Math.abs(viewportDx) > 2 || Math.abs(viewportDy) > 2)) {
        dragSession.axisLock = Math.abs(viewportDx) >= Math.abs(viewportDy) ? 'x' : 'y'
      }
      if (dragSession.axisLock === 'x') viewportDy = 0
      if (dragSession.axisLock === 'y') viewportDx = 0
    } else {
      dragSession.axisLock = null
    }

    // The cs follows the raw pointer.
    csRoot.style.translate = `${viewportDx}px ${viewportDy}px`

    // CSS `translate` on the element operates in the PARENT's space: convert
    // through the parent matrix, not the element matrix (which would apply
    // the element's own rotation twice).
    const local = worldDeltaToLocalDelta(dragSession.parentMatrix, viewportDx, viewportDy)
    dragSession.lastLocalX = local.x
    dragSession.lastLocalY = local.y

    if (dragSession.gridClone !== null) {
      // Grid libre: the element stays put until validation; the clone snaps
      // to the hovered cell and the matching zone is highlighted. The cell is
      // memorized: it IS the drop target (contract: land where the author saw).
      const cell = cellFromViewportPoint(event.clientX, event.clientY)
      highlightZone(cell)
      if (cell !== null) {
        dragSession.lastCell = cell
        const anchor = cellViewportAnchor(cell.row, cell.col)
        if (anchor !== null) {
          dragSession.gridClone.style.left = `${anchor.left}px`
          dragSession.gridClone.style.top = `${anchor.top}px`
        }
      }
      return
    }

    // Libre: continuous incremental emission, exact accumulation on rounded totals.
    const targetX = Math.round(local.x)
    const targetY = Math.round(local.y)
    const dx = targetX - dragSession.emittedX
    const dy = targetY - dragSession.emittedY
    if (dx === 0 && dy === 0) return
    dragSession.emittedX = targetX
    dragSession.emittedY = targetY
    adapter.applyMove({ dx, dy })
    actor.send({ type: 'DRAG_MOVE' })

    // Measured correction before repaint: the element is the truth. Any
    // layout interference (auto margins, min/max constraints, unforeseen
    // properties) deflects it from the theoretical delta — measure where it
    // actually landed (world-anchor seam) and glue the cs to it.
    if (elementNode !== null) {
      const measured = measureWorldRect(elementNode)
      csRoot.style.translate = `${measured.left - dragSession.startRectLeft}px ${measured.top - dragSession.startRectTop}px`
    }
  }

  const onBodyPointerUp = (event: PointerEvent): void => {
    if (dragSession === null || event.pointerId !== dragSession.pointerId) return
    endDragSession(true)
  }

  // ── resize / scale (handles) ─────────────────────────────────────────────

  type ResizeSession = {
    pointerId: number
    handleId: HandleId
    mode: 'resize' | 'scale'
    startX: number
    startY: number
    /** Conversion spaces frozen at session start. */
    matrix: Matrix2D
    parentMatrix: Matrix2D
    startLocalWidth: number
    startLocalHeight: number
    /** Anchor (opposite point) locked at its session-start viewport position. */
    anchorFx: number
    anchorFy: number
    anchorStartX: number
    anchorStartY: number
    emittedW: number
    emittedH: number
    emittedFx: number
    emittedFy: number
  }
  let resizeSession: ResizeSession | null = null

  const handleFactors: Record<HandleId, { w: number; h: number }> = {
    nw: { w: -1, h: -1 },
    ne: { w: 1, h: -1 },
    se: { w: 1, h: 1 },
    sw: { w: -1, h: 1 },
    n: { w: 0, h: -1 },
    e: { w: 1, h: 0 },
    s: { w: 0, h: 1 },
    w: { w: -1, h: 0 }
  }

  const isCorner = (id: HandleId): boolean => id === 'nw' || id === 'ne' || id === 'se' || id === 'sw'

  // ── per-handle mode (resize | scale) ─────────────────────────────────────
  // Each handle carries a persistent current mode; alt-click toggles it (a
  // held modifier is too invisible to understand what is happening). The
  // editor configures defaults and swap permission through the preset.

  let presetHandles: CapabilityPreset['handles'] = undefined
  const handleModes = new Map<HandleId, 'resize' | 'scale'>()

  const resolveHandleBehavior = (id: HandleId): { mode: 'resize' | 'scale'; allowSwap: boolean } => {
    const group = isCorner(id) ? 'corners' : 'sides'
    const specific = presetHandles?.[id]
    const groupConfig = presetHandles?.[group]
    const resizeAllowed = capabilityActive('resize')
    const scaleAllowed = capabilityActive('scale')
    return {
      mode: specific?.mode ?? groupConfig?.mode ?? (resizeAllowed ? 'resize' : 'scale'),
      allowSwap: specific?.allowSwap ?? groupConfig?.allowSwap ?? (resizeAllowed && scaleAllowed)
    }
  }

  const currentHandleMode = (id: HandleId): 'resize' | 'scale' => handleModes.get(id) ?? resolveHandleBehavior(id).mode

  const toggleHandleMode = (id: HandleId): void => {
    const behavior = resolveHandleBehavior(id)
    if (!behavior.allowSwap) return
    const next = currentHandleMode(id) === 'resize' ? 'scale' : 'resize'
    if (!capabilityActive(next)) return
    handleModes.set(id, next)
    refreshHandleVisibility()
  }

  const endResizeSession = (): void => {
    if (resizeSession === null) return
    const session = resizeSession
    resizeSession = null
    const handle = handleNodes.get(session.handleId)
    if (handle !== undefined) {
      safeReleaseCapture(handle, session.pointerId)
    }
    actor.send({ type: 'RESIZE_END' })
    sync()
  }

  const onHandlePointerDown = (handleId: HandleId) => (event: PointerEvent): void => {
    if (pose === null || event.button !== 0) return

    // Alt-click: toggle the handle's persistent mode, no gesture starts.
    if (event.altKey) {
      toggleHandleMode(handleId)
      event.preventDefault()
      event.stopPropagation()
      return
    }

    actor.send({ type: 'RESIZE_START' })
    if (!actor.getSnapshot().matches({ active: 'resizing' })) return
    const handle = handleNodes.get(handleId)!
    const anchorPoint = CHARACTERISTIC_POINTS[OPPOSITE_POINT[handleId]]
    const anchorStart = localFractionToViewportPoint(pose, anchorPoint.fx, anchorPoint.fy)
    resizeSession = {
      pointerId: event.pointerId,
      handleId,
      mode: currentHandleMode(handleId),
      startX: event.clientX,
      startY: event.clientY,
      matrix: pose.matrix,
      parentMatrix: pose.parentMatrix,
      startLocalWidth: pose.localWidth,
      startLocalHeight: pose.localHeight,
      anchorFx: anchorPoint.fx,
      anchorFy: anchorPoint.fy,
      anchorStartX: anchorStart.x,
      anchorStartY: anchorStart.y,
      emittedW: 0,
      emittedH: 0,
      emittedFx: 1,
      emittedFy: 1
    }
    handle.setPointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }

  /**
   * Measured anchor lock: after a size/scale mutation, the anchor (opposite
   * point) may have drifted — transform-origin effects (a rotation around the
   * center spreads any growth on both sides), auto margins, any layout
   * property. Measure where it actually is, emit the corrective move. The
   * loop is error-driven: each correction starts from the measured error
   * after the previous ones, so no drift accumulates.
   */
  const lockAnchor = (session: ResizeSession): void => {
    if (elementNode === null) return
    const poseNow = captureOverlayPose(elementNode)
    const anchorNow = localFractionToViewportPoint(poseNow, session.anchorFx, session.anchorFy)
    const worldDx = session.anchorStartX - anchorNow.x
    const worldDy = session.anchorStartY - anchorNow.y
    const parentDelta = worldDeltaToLocalDelta(session.parentMatrix, worldDx, worldDy)
    const dx = Math.round(parentDelta.x)
    const dy = Math.round(parentDelta.y)
    if (dx !== 0 || dy !== 0) {
      adapter.applyMove({ dx, dy })
    }
  }

  const onHandlePointerMove = (event: PointerEvent): void => {
    if (resizeSession === null || event.pointerId !== resizeSession.pointerId) return
    if (event.buttons === 0) {
      endResizeSession()
      return
    }
    const session = resizeSession
    const factors = handleFactors[session.handleId]
    // Project the raw pointer delta onto the element's LOCAL axes (rotation
    // included) so the dragged handle stays under the pointer, then apply the
    // handle sign. worldSizeToLocalSize is unfit here: it converts sizes
    // (clamped at 0) and would block any reduction.
    const localDelta = worldDeltaToLocalDelta(
      session.matrix,
      event.clientX - session.startX,
      event.clientY - session.startY
    )
    let localW = factors.w === 0 ? 0 : localDelta.x * factors.w
    let localH = factors.h === 0 ? 0 : localDelta.y * factors.h

    // Corner ratio constraint: the w/h ratio is preserved by default (resize
    // and scale alike) — the dominant axis of the gesture drives, the other
    // follows the session-start ratio. Shift lifts the constraint.
    if (isCorner(session.handleId) && !event.shiftKey && session.startLocalWidth > 1e-6 && session.startLocalHeight > 1e-6) {
      const relW = Math.abs(localW) / session.startLocalWidth
      const relH = Math.abs(localH) / session.startLocalHeight
      if (relW >= relH) {
        localH = localW * (session.startLocalHeight / session.startLocalWidth)
      } else {
        localW = localH * (session.startLocalWidth / session.startLocalHeight)
      }
    }

    if (session.mode === 'scale') {
      // Scale: multiplicative factors; w/h ratio locked unless Shift lifts it.
      // The cs itself is not rescaled — it re-captures the element after emission.
      let targetFx = session.startLocalWidth > 1e-3 ? (session.startLocalWidth + localW) / session.startLocalWidth : 1
      let targetFy = session.startLocalHeight > 1e-3 ? (session.startLocalHeight + localH) / session.startLocalHeight : 1
      if (factors.w === 0) targetFx = event.shiftKey ? 1 : targetFy
      if (factors.h === 0) targetFy = event.shiftKey ? 1 : targetFx
      if (isCorner(session.handleId) && !event.shiftKey) {
        const uniform = Math.abs(targetFx - 1) >= Math.abs(targetFy - 1) ? targetFx : targetFy
        targetFx = uniform
        targetFy = uniform
      }
      targetFx = Math.max(0.01, Math.round(targetFx * 100) / 100)
      targetFy = Math.max(0.01, Math.round(targetFy * 100) / 100)
      const fx = targetFx / session.emittedFx
      const fy = targetFy / session.emittedFy
      if (Math.abs(fx - 1) < 1e-9 && Math.abs(fy - 1) < 1e-9) return
      session.emittedFx = targetFx
      session.emittedFy = targetFy
      adapter.applyScale({ fx, fy })
      lockAnchor(session)
      positionCs()
      return
    }

    // Resize: continuous incremental emission on rounded totals.
    const targetW = Math.round(localW)
    const targetH = Math.round(localH)
    const dw = targetW - session.emittedW
    const dh = targetH - session.emittedH
    if (dw === 0 && dh === 0) return
    session.emittedW = targetW
    session.emittedH = targetH
    adapter.applyResize({ dw, dh })

    // Only the dragged handle moves: lock the anchor by measurement, then
    // re-capture so the cs keeps tracking the element.
    lockAnchor(session)
    positionCs()
  }

  const onHandlePointerUp = (event: PointerEvent): void => {
    if (resizeSession === null || event.pointerId !== resizeSession.pointerId) return
    endResizeSession()
  }

  // ── rotation (needle tip) + pivot placement ──────────────────────────────

  type RotateSession = {
    pointerId: number
    startPointerAngleDeg: number
    /** Pivot frozen in viewport space at session start. */
    pivotX: number
    pivotY: number
    emittedDeg: number
  }
  let rotateSession: RotateSession | null = null

  /**
   * Glues the needle tip to the pointer: the pointer is inverse-transformed
   * into the cs local space (same affine rule as the pivot), and the needle
   * elongates with the drag — a longer radius gives finer angular precision.
   */
  const followPointerWithNeedle = (event: PointerEvent): void => {
    if (pose === null) return
    const origin = localFractionToViewportPoint(pose, 0, 0)
    const local = worldDeltaToLocalDelta(pose.matrix, event.clientX - origin.x, event.clientY - origin.y)
    const tipX = local.x * pose.scaleX
    const tipY = local.y * pose.scaleY
    const pivotX = pivotFraction.fx * pose.frameWidth
    const pivotY = pivotFraction.fy * pose.frameHeight
    needleAngleDeg = (Math.atan2(tipY - pivotY, tipX - pivotX) * 180) / Math.PI
    needleLengthPx = Math.max(NEEDLE_LENGTH_PX, Math.hypot(tipX - pivotX, tipY - pivotY))
    positionNeedle()
  }

  const pivotViewportPoint = (): { x: number; y: number } | null => {
    // The pivot lives in the LOCAL box; its viewport position goes through
    // the affine mapping — never through the axis-aligned bounding rect.
    if (pose === null) return null
    return localFractionToViewportPoint(pose, pivotFraction.fx, pivotFraction.fy)
  }

  const endRotateSession = (): void => {
    if (rotateSession === null) return
    const session = rotateSession
    rotateSession = null
    safeReleaseCapture(needleTip, session.pointerId)
    actor.send({ type: 'ROTATE_END' })
    // The needle retracts to its resting length once the gesture ends.
    needleLengthPx = NEEDLE_LENGTH_PX
    sync()
  }

  needleTip.addEventListener('pointerdown', (event: PointerEvent) => {
    if (pose === null || event.button !== 0) return
    actor.send({ type: 'ROTATE_START' })
    if (!actor.getSnapshot().matches({ active: 'rotating' })) return
    const pivot = pivotViewportPoint()
    if (pivot === null) return
    rotateSession = {
      pointerId: event.pointerId,
      startPointerAngleDeg: (Math.atan2(event.clientY - pivot.y, event.clientX - pivot.x) * 180) / Math.PI,
      pivotX: pivot.x,
      pivotY: pivot.y,
      emittedDeg: 0
    }
    needleTip.setPointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  })

  needleTip.addEventListener('pointermove', (event: PointerEvent) => {
    if (rotateSession === null || event.pointerId !== rotateSession.pointerId) return
    if (event.buttons === 0) {
      endRotateSession()
      return
    }
    // Emission: physical rotation described by the pointer around the pivot
    // frozen at gesture start (the pivot IS the rotation center — it does
    // not move during the gesture).
    const pointerAngle =
      (Math.atan2(event.clientY - rotateSession.pivotY, event.clientX - rotateSession.pivotX) * 180) / Math.PI
    let deltaDeg = pointerAngle - rotateSession.startPointerAngleDeg
    if (event.shiftKey) {
      deltaDeg = Math.round(deltaDeg / ROTATE_STEP_DEG) * ROTATE_STEP_DEG
    }

    const target = Math.round(deltaDeg)
    const dr = target - rotateSession.emittedDeg
    if (dr !== 0) {
      rotateSession.emittedDeg = target
      adapter.applyRotate({ dr, origin: { fx: pivotFraction.fx, fy: pivotFraction.fy } })
      // The element rotated live: re-capture so the cs keeps tracking it.
      positionCs()
    }

    // Visual: the needle tip stays glued to the pointer and elongates with
    // the drag, using the pose refreshed by the emission above.
    followPointerWithNeedle(event)
  })

  needleTip.addEventListener('pointerup', (event: PointerEvent) => {
    if (rotateSession === null || event.pointerId !== rotateSession.pointerId) return
    endRotateSession()
  })
  needleTip.addEventListener('pointercancel', endRotateSession)
  needleTip.addEventListener('lostpointercapture', () => {
    if (rotateSession !== null) endRotateSession()
  })

  let pivotDragPointerId: number | null = null

  const endPivotDrag = (): void => {
    if (pivotDragPointerId === null) return
    const pointerId = pivotDragPointerId
    pivotDragPointerId = null
    safeReleaseCapture(pivotNode, pointerId)
  }

  pivotNode.addEventListener('pointerdown', (event: PointerEvent) => {
    if (!capabilityActive('rotation-origin') || event.button !== 0) return
    pivotDragPointerId = event.pointerId
    pivotNode.setPointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  })

  pivotNode.addEventListener('pointermove', (event: PointerEvent) => {
    if (pivotDragPointerId === null || event.pointerId !== pivotDragPointerId) return
    if (event.buttons === 0) {
      endPivotDrag()
      return
    }
    if (pose === null || pose.localWidth < 1e-3 || pose.localHeight < 1e-3) return

    // Map the pointer into the LOCAL box: offset from the local origin's
    // viewport position, inverse-transformed through the element matrix.
    // Dividing by the axis-aligned bounding rect would be wrong as soon as
    // the element is rotated (the transposition the pivot needs is affine).
    const origin = localFractionToViewportPoint(pose, 0, 0)
    const local = worldDeltaToLocalDelta(pose.matrix, event.clientX - origin.x, event.clientY - origin.y)
    let fx = Math.min(1, Math.max(0, local.x / pose.localWidth))
    let fy = Math.min(1, Math.max(0, local.y / pose.localHeight))

    // Magnetize to the 8 characteristic points (distance in rendered pixels).
    pivotMagnetTarget = null
    for (const [id, point] of Object.entries(CHARACTERISTIC_POINTS) as Array<[HandleId, { fx: number; fy: number }]>) {
      const distancePx = Math.hypot((fx - point.fx) * pose.frameWidth, (fy - point.fy) * pose.frameHeight)
      if (distancePx <= PIVOT_MAGNET_RADIUS_PX) {
        fx = point.fx
        fy = point.fy
        pivotMagnetTarget = id
        break
      }
    }

    pivotFraction = { fx, fy }
    positionNeedle()
    refreshHandleVisibility()
  })

  pivotNode.addEventListener('pointerup', endPivotDrag)
  pivotNode.addEventListener('pointercancel', endPivotDrag)

  // Double-click on the rotation axis: back to its default position (center).
  pivotNode.addEventListener('dblclick', (event: MouseEvent) => {
    if (!capabilityActive('rotation-origin')) return
    pivotFraction = { fx: 0.5, fy: 0.5 }
    pivotMagnetTarget = null
    positionNeedle()
    refreshHandleVisibility()
    event.preventDefault()
    event.stopPropagation()
  })

  // ── wiring ───────────────────────────────────────────────────────────────

  csRoot.addEventListener('pointerdown', onBodyPointerDown)
  csRoot.addEventListener('pointermove', onBodyPointerMove)
  csRoot.addEventListener('pointerup', onBodyPointerUp)
  csRoot.addEventListener('pointercancel', () => endDragSession(false))
  csRoot.addEventListener('lostpointercapture', () => {
    if (dragSession !== null) endDragSession(false)
  })

  for (const [handleId, handle] of handleNodes) {
    handle.addEventListener('pointerdown', onHandlePointerDown(handleId))
    handle.addEventListener('pointermove', onHandlePointerMove)
    handle.addEventListener('pointerup', onHandlePointerUp)
    handle.addEventListener('pointercancel', endResizeSession)
    handle.addEventListener('lostpointercapture', () => {
      if (resizeSession !== null && resizeSession.handleId === handleId) endResizeSession()
    })
  }

  // ── node lifecycle ───────────────────────────────────────────────────────

  let resizeObserver: ResizeObserver | null = null

  const observeElement = (node: HTMLElement): void => {
    if (typeof globalThis.ResizeObserver === 'undefined') return
    resizeObserver?.disconnect()
    resizeObserver = new globalThis.ResizeObserver(() => {
      if (dragSession === null && resizeSession === null && rotateSession === null) {
        sync()
      }
    })
    resizeObserver.observe(node)
  }

  const unsubscribeElement = options.authorApi.subscribeToNode(options.itemId, (node) => {
    if (destroyed) return
    if (node instanceof HTMLElement) {
      elementNode = node
      actor.send({ type: 'NODE_APPEARED' })
      positionCs()
      observeElement(node)
    } else {
      elementNode = null
      pose = null
      resizeObserver?.disconnect()
      actor.send({ type: 'NODE_DISAPPEARED' })
    }
    applyMachineState()
  })

  const unsubscribeContainer =
    options.containerId !== undefined
      ? options.authorApi.subscribeToNode(options.containerId, (node) => {
          if (destroyed) return
          containerNode = node instanceof HTMLElement ? node : null
          refreshGabarit()
        })
      : null

  // ── handle ───────────────────────────────────────────────────────────────

  function sync(): void {
    if (destroyed || elementNode === null) return
    positionCs()
    applyMachineState()
  }

  return {
    destroy(): void {
      if (destroyed) return
      destroyed = true
      unsubscribeElement()
      unsubscribeContainer?.()
      resizeObserver?.disconnect()
      actor.stop()
      csRoot.remove()
      gabaritRoot.remove()
    },

    setPartVisibility(part: SelectionFramePart, visible: boolean): void {
      actor.send({ type: 'VISIBILITY_CHANGED', part, visible })
      applyMachineState()
    },

    setPartActive(_part: 'cs', active: boolean): void {
      actor.send({ type: 'CS_ACTIVE_CHANGED', active })
      applyMachineState()
    },

    sync,

    setOperationEnabled(op: string, enabled: boolean): void {
      actor.send({ type: 'OPERATION_ENABLED_CHANGED', op, enabled })
      applyMachineState()
    },

    applyPreset(preset: CapabilityPreset): void {
      presetHandles = preset.handles
      handleModes.clear()
      actor.send({ type: 'PRESET_APPLIED', preset })
      applyMachineState()
    },

    setAdapter(next: CsValueAdapter): void {
      adapter = next
      actor.send({ type: 'ADAPTER_CHANGED' })
      applyMachineState()
    },

    setContainerGrid(grid: AutoCapsuleGridArtifact | null): void {
      containerGrid = grid
      refreshGabarit()
    }
  }
}
