// waapi.animate uniquement : les animations WAAPI sont pilotées par la
// timeline native du navigateur. Le moteur JS d'anime est une ressource
// interne de codplay (useDefaultMainLoop désactivé, engine.update() par le
// ticker du player, engine.speed = rate) — un animate() classique serait gelé
// hors lecture et subirait le rate. Ne jamais importer animate/engine ici.
import { waapi } from 'animejs'
import type { WAAPIAnimation } from 'animejs'
import { createActor } from 'xstate'
import { worldDeltaToLocalDelta } from 'codplay/runtime/modules/list-flip/engine/dom-matrix'
import type { Matrix2D } from 'codplay/runtime/modules/list-flip/engine/types'
import type { AutoCapsuleGridArtifact } from '@codplay/capsule-automation'
import { csMachine } from './machine'
import { bindGestureSession } from './gesture-session'
import { createMinimalAnchor, isTrackedSession, type TrackedTarget } from './tracked-session'
import { CHARACTERISTIC_POINTS, HANDLE_SIZE_PX, OPPOSITE_POINT, createHandleNode } from './handle-geometry'
import type { HandleId } from './handle-geometry'
import type { GridTrackGeometry } from './grid-geometry'
import {
  measureGridTracks,
  nearestTrackSpan,
  trackAnchorPx,
  trackIndexAtPx,
  trackSpanPx,
  uniformTrackGeometry
} from './grid-geometry'
import {
  calibrateGhostToWorldSnapshot,
  captureOverlayPose,
  captureOwnTransformComponents,
  ensureOverlayLayer,
  localFractionToViewportPoint,
  measureWorldRect,
  ownCornerDisplacement
} from './overlay-pose'
import type { OverlayPose } from './overlay-pose'
import type {
  CapabilityPreset,
  CreationGeometry,
  CreationResult,
  CsValueAdapter,
  SelectionFrameHandle,
  SelectionFrameOptions,
  SelectionFramePart
} from './types'

const PIVOT_SIZE_PX = 12
const NEEDLE_LENGTH_PX = 36
const PIVOT_MAGNET_RADIUS_PX = 8
const ROTATE_STEP_DEG = 15
const DENSE_GRID_THRESHOLD = 50
const DENSE_GRID_STEP = 10

/**
 * Places one visual selection frame (cs) over the DOM element of one player
 * perso and turns pointer gestures into raw diffs handed to the editor-owned
 * CsValueAdapter. Emission is continuous: the element follows the gesture
 * live. See docs/plans/2026-06-09-selection-frame-plan.md.
 */
export function createSelectionFrame(options: SelectionFrameOptions): SelectionFrameHandle {
  const doc = options.sceneRoot.ownerDocument
  const overlayLayer = ensureOverlayLayer(options.sceneRoot)

  let adapter: CsValueAdapter | null = options.adapter ?? null
  let elementNode: HTMLElement | null = null
  let containerNode: HTMLElement | null = null
  let containerGrid: AutoCapsuleGridArtifact | null = null
  let pose: OverlayPose | null = null
  let destroyed = false

  if (options.creation === undefined && (options.itemId === undefined || options.adapter === undefined)) {
    throw new Error('createSelectionFrame: itemId and adapter are required unless creation is provided')
  }
  let creation = options.creation ?? null

  const actor = createActor(csMachine)
  actor.start()

  // ── cs DOM ────────────────────────────────────────────────────────────────

  const csRoot = doc.createElement('div')
  csRoot.setAttribute('data-selection-frame', options.itemId ?? '')
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

  for (const id of Object.keys(CHARACTERISTIC_POINTS) as HandleId[]) {
    const handle = createHandleNode({ doc, id, attributeName: 'data-cs-handle', borderColor: '#4a90d9', pointerEventsAuto: false })
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
  gabaritRoot.setAttribute('data-cs-gabarit', options.itemId ?? '')
  gabaritRoot.style.position = 'fixed'
  gabaritRoot.style.boxSizing = 'border-box'
  gabaritRoot.style.transformOrigin = '0px 0px'
  gabaritRoot.style.display = 'none'
  gabaritRoot.style.pointerEvents = 'none'
  overlayLayer.insertBefore(gabaritRoot, csRoot)

  // ── creation surface (create mode only) ──────────────────────────────────
  // Invisible veil covering the trace reference (container or scene root):
  // catches the pointerdown that starts a trace. Appended LAST so it always
  // wins hit-testing over the gabarit zones and the cs itself (both inert
  // during creation). Removed once attachItem hands off to the regular flow.

  let creationSurface: HTMLElement | null = null
  if (creation !== null) {
    creationSurface = doc.createElement('div')
    creationSurface.setAttribute('data-cs-creation-surface', '')
    creationSurface.style.position = 'fixed'
    creationSurface.style.boxSizing = 'border-box'
    creationSurface.style.transformOrigin = '0px 0px'
    creationSurface.style.display = 'none'
    creationSurface.style.pointerEvents = 'none'
    creationSurface.style.cursor = 'crosshair'
    creationSurface.style.touchAction = 'none'
    overlayLayer.appendChild(creationSurface)
  }

  // ── state application ────────────────────────────────────────────────────

  const isSuspended = (): boolean => actor.getSnapshot().matches('suspended') || actor.getSnapshot().matches('idle')

  const isCreatingState = (): boolean => actor.getSnapshot().matches('creating')

  const capabilityActive = (capability: string): boolean =>
    actor.getSnapshot().context.capabilities.includes(capability as never)

  const operationEnabled = (op: string): boolean => !actor.getSnapshot().context.disabledOperations.includes(op)

  // Set true the moment a trace starts (or a geometry is applied) and never
  // reset within the creating branch: the cs stays visible through
  // awaitingItem ("le cadre reste affiché") until ITEM_ATTACHED hands off.
  let creationHasGeometry = false

  const csShouldDisplay = (): boolean => {
    const context = actor.getSnapshot().context
    if (!context.csVisible) return false
    if (isCreatingState()) return creationHasGeometry
    if (isSuspended() || pose === null) return false
    if (options.minSizePx !== undefined && (pose.frameWidth < options.minSizePx || pose.frameHeight < options.minSizePx)) {
      return false
    }
    return true
  }

  const refreshHandleVisibility = (): void => {
    if (isCreatingState()) {
      // Poignées inertes pendant le tracé : la géométrie n'a pas encore de
      // capacités à représenter (pas d'item avant l'attache). Remplissage +
      // bordure tiretée distincts : sinon un tracé de quelques pixels (voire
      // 0×0 à l'amorce) passe inaperçu derrière le seul contour 1px partagé
      // avec la sélection régulière.
      for (const [, handle] of handleNodes) handle.style.display = 'none'
      needleLine.style.display = 'none'
      needleTip.style.display = 'none'
      pivotNode.style.display = 'none'
      csRoot.style.cursor = 'crosshair'
      csRoot.style.borderStyle = 'dashed'
      csRoot.style.background = 'rgba(74, 144, 217, 0.15)'
      return
    }
    csRoot.style.borderStyle = 'solid'
    csRoot.style.background = ''
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
    csRoot.style.pointerEvents = isCreatingState() ? 'none' : context.csActive ? 'auto' : 'none'
    if (elementNode !== null) {
      elementNode.style.visibility = context.elementVisible ? '' : 'hidden'
    }
    refreshHandleVisibility()
    refreshGabarit()
    refreshCreationSurface()
  }

  const positionCs = (): void => {
    if (elementNode === null) return
    pose = captureOverlayPose(elementNode)
    const m = pose.rotationMatrix
    csRoot.style.width = `${pose.frameWidth}px`
    csRoot.style.height = `${pose.frameHeight}px`
    csRoot.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, 0, 0)`
    csRoot.style.translate = '0px 0px'
    // Must be visible BEFORE calibrating: calibrateGhostToWorldSnapshot measures
    // via getBoundingClientRect, which a display:none element always reports as
    // an all-zero rect — the correction loop then "corrects" against that
    // phantom zero every iteration, landing at ~5× the intended position (1
    // initial + 4 loop iterations). applyMachineState(), called right after
    // positionCs() by every caller, corrects this back to 'none' if the cs
    // should truly stay hidden (suspended, below minSizePx, etc.) — this first
    // attach (and the create-mode attachItem handoff, which goes through this
    // same path) must not calibrate while still hidden from a prior state.
    csRoot.style.display = ''
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

    // Base structure from the artifact's inlineStyle, then override with the
    // REAL container's resolved templates when the browser provides them —
    // irregular tracks stay exactly aligned, never a theoretical template.
    gabaritRoot.style.display = 'grid'
    gabaritRoot.style.gridTemplateRows = `repeat(${rows}, 1fr)`
    gabaritRoot.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
    for (const [key, value] of Object.entries(containerGrid.inlineStyle)) {
      gabaritRoot.style[key as never] = String(value) as never
    }
    if (containerNode !== null) {
      const win = containerNode.ownerDocument.defaultView
      const computed = win?.getComputedStyle(containerNode)
      if (computed !== undefined && measureGridTracks(containerNode) !== null) {
        gabaritRoot.style.gridTemplateColumns = computed.gridTemplateColumns
        gabaritRoot.style.gridTemplateRows = computed.gridTemplateRows
      }
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
    // Create mode in grid context reuses the same gabarit for track snapping
    // regardless of the 'positioning' capability (no preset applies yet —
    // there is no item to configure until attachItem).
    const active =
      (capabilityActive('positioning') || isCreatingState()) &&
      containerNode !== null &&
      containerGrid !== null &&
      !isSuspended()

    if (!active) {
      gabaritRoot.style.display = 'none'
      return
    }

    // Unlike the cs (which refuses scale in its transform to keep its handles
    // undeformed), the gabarit has no handles: it carries the FULL matrix
    // with the container's LOCAL dimensions, so the measured px templates
    // apply identically and the zones align exactly with the real cells.
    const containerPose = captureOverlayPose(containerNode!)
    const m = containerPose.matrix
    gabaritRoot.style.width = `${containerPose.localWidth}px`
    gabaritRoot.style.height = `${containerPose.localHeight}px`
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

  /**
   * Measured track geometry of the real container — resolved px templates
   * from computed styles (irregular tracks supported), with a uniform
   * fallback when no layout engine resolved them.
   */
  const containerTrackGeometry = (containerPose: OverlayPose): GridTrackGeometry | null => {
    if (containerNode === null || containerGrid === null) return null
    const measured = measureGridTracks(containerNode)
    if (measured !== null) return measured
    const gaps = gridGapsPx()
    return uniformTrackGeometry({
      rows: containerGrid.context.rows,
      cols: containerGrid.context.cols,
      localWidth: containerPose.localWidth,
      localHeight: containerPose.localHeight,
      columnGap: gaps.column,
      rowGap: gaps.row
    })
  }

  /**
   * Resolves the grid cell under one viewport point (1-based row/col). The
   * pointer is inverse-transformed into the container's LOCAL space through
   * its pose — no fraction is ever computed on the axis-aligned rect — and
   * the cell comes from a boundary walk over the MEASURED tracks.
   */
  const cellFromViewportPoint = (x: number, y: number): { row: number; col: number } | null => {
    if (containerNode === null || containerGrid === null) return null
    const containerPose = captureOverlayPose(containerNode)
    if (containerPose.localWidth < 1e-3 || containerPose.localHeight < 1e-3) return null
    const tracks = containerTrackGeometry(containerPose)
    if (tracks === null) return null
    const origin = localFractionToViewportPoint(containerPose, 0, 0)
    const local = worldDeltaToLocalDelta(containerPose.matrix, x - origin.x, y - origin.y)
    return {
      row: trackIndexAtPx(tracks.rows, tracks.rowGap, local.y),
      col: trackIndexAtPx(tracks.cols, tracks.columnGap, local.x)
    }
  }

  let highlightedZone: HTMLElement | null = null
  const highlightZoneNode = (zone: HTMLElement | null): void => {
    if (highlightedZone !== null) {
      highlightedZone.style.background = ''
      highlightedZone = null
    }
    if (zone !== null) {
      zone.style.background = 'rgba(74, 144, 217, 0.25)'
      highlightedZone = zone
    }
  }

  type ZoneHit = { row: number; col: number; node: HTMLElement | null }

  /**
   * pointAt: the drawn zone under the pointer is the reference — resolved by
   * elementsFromPoint on the gabarit zones, so highlight, clone anchoring and
   * drop all derive from the same node the author actually sees. The measured
   * track math is only the fallback (dense grids drawn at a 10 step, pointer
   * outside the zones).
   */
  const zoneAtPoint = (x: number, y: number): ZoneHit | null => {
    if (typeof doc.elementsFromPoint === 'function') {
      for (const element of doc.elementsFromPoint(x, y)) {
        if (element instanceof HTMLElement && gabaritRoot.contains(element) && element.hasAttribute('data-cs-zone')) {
          const key = element.getAttribute('data-cs-zone')!.split(':')
          const row = Number.parseInt(key[0] ?? '', 10)
          const col = Number.parseInt(key[1] ?? '', 10)
          if (Number.isFinite(row) && Number.isFinite(col)) {
            return { row, col, node: element }
          }
        }
      }
    }
    const computed = cellFromViewportPoint(x, y)
    if (computed === null) return null
    return { ...computed, node: zoneNodes.get(`${computed.row}:${computed.col}`) ?? null }
  }

  type CellArea = { row: number; col: number; rowSpan: number; colSpan: number }

  /**
   * Measures the element's cell footprint (origin + spans) on its LAYOUT box:
   * the visual corner is projected into the container's local space, then the
   * own-transform displacement (d = t + (I − M)·O) is subtracted — an element
   * offset by a translate still belongs to its layout cells.
   */
  /**
   * A position:absolute grid item still uses grid-row/grid-column as its
   * placement reference, but its rendered size never derives from a span (it
   * doesn't participate in track sizing) — unlike a normal grid-flow item,
   * whose size IS its span. Created-in-libre items are absolutely positioned
   * for exactly this reason (see the grid demo): re-deriving a span from
   * their measured size would be meaningless and desyncs the drag ghost from
   * the actual (fixed) rendered size.
   */
  const isSizeIndependentOfGrid = (node: Element): boolean => {
    const win = node.ownerDocument.defaultView
    return win?.getComputedStyle(node).position === 'absolute'
  }

  const measureElementFootprint = (): CellArea | null => {
    if (pose === null || elementNode === null || containerNode === null || containerGrid === null) return null
    const containerPose = captureOverlayPose(containerNode)
    const tracks = containerTrackGeometry(containerPose)
    if (tracks === null) return null

    const containerOrigin = localFractionToViewportPoint(containerPose, 0, 0)
    const visualCorner = localFractionToViewportPoint(pose, 0, 0)
    const cornerLocal = worldDeltaToLocalDelta(
      containerPose.matrix,
      visualCorner.x - containerOrigin.x,
      visualCorner.y - containerOrigin.y
    )
    const own = captureOwnTransformComponents(elementNode, pose.localWidth, pose.localHeight)
    const displacement = ownCornerDisplacement(own, own.originX, own.originY)
    const layoutX = cornerLocal.x - displacement.x
    const layoutY = cornerLocal.y - displacement.y

    // +1px inset so a corner sitting exactly on a boundary resolves inward.
    const row = trackIndexAtPx(tracks.rows, tracks.rowGap, layoutY + 1)
    const col = trackIndexAtPx(tracks.cols, tracks.columnGap, layoutX + 1)
    if (isSizeIndependentOfGrid(elementNode)) {
      return { row, col, rowSpan: 1, colSpan: 1 }
    }
    return {
      row,
      col,
      // Layout dimensions (untransformed) resolve the spans.
      rowSpan: nearestTrackSpan(tracks.rows, tracks.rowGap, row, pose.localHeight),
      colSpan: nearestTrackSpan(tracks.cols, tracks.columnGap, col, pose.localWidth)
    }
  }

  /** Container-local coordinates of one viewport point (affine). */
  const viewportToContainerLocal = (x: number, y: number): { x: number; y: number } | null => {
    if (containerNode === null) return null
    const containerPose = captureOverlayPose(containerNode)
    const containerOrigin = localFractionToViewportPoint(containerPose, 0, 0)
    return worldDeltaToLocalDelta(containerPose.matrix, x - containerOrigin.x, y - containerOrigin.y)
  }

  /**
   * Measures the multi-cell grab context at gesture start: the element's
   * footprint, and which of its OWN cells sits under the pointer. The grab
   * cell is resolved in the element's LOCAL box (pointer inverse-transformed,
   * fraction × spans) — rotation-proof: grabbing the visual bottom-right
   * quadrant of a rotated element always designates its local bottom-right
   * cell. Mixing the visual pointer cell with the layout origin would inject
   * a spurious rotation offset (wrong placements, gestures without effect).
   */
  const captureGridDragContext = (
    pointerX: number,
    pointerY: number
  ): { grabRowOffset: number; grabColOffset: number; rowSpan: number; colSpan: number } | null => {
    const footprint = measureElementFootprint()
    if (footprint === null || pose === null) return null

    const elementOrigin = localFractionToViewportPoint(pose, 0, 0)
    const local = worldDeltaToLocalDelta(pose.matrix, pointerX - elementOrigin.x, pointerY - elementOrigin.y)
    const fractionX = pose.localWidth > 1e-6 ? local.x / pose.localWidth : 0
    const fractionY = pose.localHeight > 1e-6 ? local.y / pose.localHeight : 0

    return {
      grabRowOffset: Math.max(0, Math.min(footprint.rowSpan - 1, Math.floor(fractionY * footprint.rowSpan))),
      grabColOffset: Math.max(0, Math.min(footprint.colSpan - 1, Math.floor(fractionX * footprint.colSpan))),
      rowSpan: footprint.rowSpan,
      colSpan: footprint.colSpan
    }
  }

  /**
   * Resolves the target ORIGIN cell for one hovered cell: the hovered cell
   * receives the grabbed cell, and the footprint is clamped back inward from
   * the grid edges (spans preserved).
   */
  const resolveDropOrigin = (
    hit: { row: number; col: number },
    context: { grabRowOffset: number; grabColOffset: number; rowSpan: number; colSpan: number } | null
  ): { row: number; col: number } => {
    if (context === null || containerGrid === null) return { row: hit.row, col: hit.col }
    const { rows, cols } = containerGrid.context
    return {
      row: Math.min(Math.max(hit.row - context.grabRowOffset, 1), rows - context.rowSpan + 1),
      col: Math.min(Math.max(hit.col - context.grabColOffset, 1), cols - context.colSpan + 1)
    }
  }

  // ── creation (trace the cs into existence) ───────────────────────────────
  // Same devices as the regular cs: subscribeToNode-style container tracking,
  // overlay-world pose + calibration, measured track geometry. No separate
  // module — this IS selection-frame, per docs/plans/2026-07-03-selection-frame-variantes-plan.md.

  const minTraceSizePx = creation?.minTraceSizePx ?? 4

  /** Trace reference: the given container once resolved, or the scene root itself. */
  const creationReferenceNode = (): Element | null =>
    options.containerId !== undefined ? containerNode : options.sceneRoot

  const creationGridActive = (): boolean => {
    // Explicit editor choice, never auto-derived from the active preset:
    // 'libre' forces a free-rect trace even inside a grid container; 'grid'
    // (or unset) keeps the default — cell-area tracing whenever a grid
    // context is actually configured, falling back to libre otherwise.
    if (creation?.context === 'libre') return false
    return containerNode !== null && containerGrid !== null
  }

  /**
   * Positions csRoot directly from a container-local rect — no elementNode
   * involved. Mirrors positionCs()'s overlay-world pattern (rotation-only
   * matrix, calibrated left/top), using the reference node's pose instead of
   * an element's.
   */
  const positionCsFromLocalRect = (
    refPose: OverlayPose,
    rect: { x: number; y: number; width: number; height: number }
  ): void => {
    const m = refPose.rotationMatrix
    const corner = localFractionToViewportPoint(
      refPose,
      refPose.localWidth > 1e-6 ? rect.x / refPose.localWidth : 0,
      refPose.localHeight > 1e-6 ? rect.y / refPose.localHeight : 0
    )
    csRoot.style.width = `${Math.max(0, rect.width) * refPose.scaleX}px`
    csRoot.style.height = `${Math.max(0, rect.height) * refPose.scaleY}px`
    csRoot.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, 0, 0)`
    csRoot.style.translate = '0px 0px'
    calibrateGhostToWorldSnapshot(csRoot, { left: corner.x, top: corner.y })
  }

  /**
   * Same method as editing a real item: the origin zone is a REAL DOM node
   * laid out by the same grid engine a future real item would be — measuring
   * its pose (captureOverlayPose, like positionCs() does for an element)
   * gives the exact rendered corner, with none of the residual drift a
   * track-arithmetic reconstruction can accumulate (border/padding, subpixel
   * rounding). Falls back to arithmetic only when no zone node exists for
   * this cell (dense grids, sampled every DENSE_GRID_STEP).
   */
  const positionCsFromCellArea = (refPose: OverlayPose, tracks: GridTrackGeometry, area: CellArea): void => {
    const width = trackSpanPx(tracks.cols, tracks.columnGap, area.col, area.colSpan)
    const height = trackSpanPx(tracks.rows, tracks.rowGap, area.row, area.rowSpan)
    const originZone = zoneNodes.get(`${area.row}:${area.col}`)
    if (originZone !== null && originZone !== undefined) {
      const zonePose = captureOverlayPose(originZone)
      const m = zonePose.rotationMatrix
      csRoot.style.width = `${width * zonePose.scaleX}px`
      csRoot.style.height = `${height * zonePose.scaleY}px`
      csRoot.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, 0, 0)`
      csRoot.style.translate = '0px 0px'
      calibrateGhostToWorldSnapshot(csRoot, zonePose.rect)
      return
    }
    const anchorX = trackAnchorPx(tracks.cols, tracks.columnGap, area.col)
    const anchorY = trackAnchorPx(tracks.rows, tracks.rowGap, area.row)
    positionCsFromLocalRect(refPose, { x: anchorX, y: anchorY, width, height })
  }

  const refreshCreationSurface = (): void => {
    if (creationSurface === null) return
    if (!isCreatingState()) {
      creationSurface.style.display = 'none'
      creationSurface.style.pointerEvents = 'none'
      return
    }
    const referenceNode = creationReferenceNode()
    if (referenceNode === null) {
      creationSurface.style.display = 'none'
      creationSurface.style.pointerEvents = 'none'
      return
    }
    const refPose = captureOverlayPose(referenceNode)
    const m = refPose.rotationMatrix
    creationSurface.style.display = 'block'
    creationSurface.style.pointerEvents = 'auto'
    creationSurface.style.width = `${refPose.frameWidth}px`
    creationSurface.style.height = `${refPose.frameHeight}px`
    creationSurface.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, 0, 0)`
    calibrateGhostToWorldSnapshot(creationSurface, refPose.rect)
  }

  type TraceSession = {
    containerPose: OverlayPose
    tracks: GridTrackGeometry | null
    anchorLocal: { x: number; y: number }
    isGrid: boolean
    startCell: { row: number; col: number } | null
    current: CreationResult | null
  }

  const traceGesture =
    creationSurface !== null
      ? bindGestureSession<TraceSession>(creationSurface, {
          onStart: (event) => {
            if (creation === null || !actor.getSnapshot().matches('creating')) return null
            const referenceNode = creationReferenceNode()
            if (referenceNode === null) return null
            const refPose = captureOverlayPose(referenceNode)
            const isGrid = creationGridActive()
            const tracks = isGrid ? containerTrackGeometry(refPose) : null
            const origin = localFractionToViewportPoint(refPose, 0, 0)
            const anchorLocal = worldDeltaToLocalDelta(refPose.matrix, event.clientX - origin.x, event.clientY - origin.y)
            const startCell =
              isGrid && tracks !== null
                ? {
                    row: trackIndexAtPx(tracks.rows, tracks.rowGap, anchorLocal.y),
                    col: trackIndexAtPx(tracks.cols, tracks.columnGap, anchorLocal.x)
                  }
                : null

            actor.send({ type: 'TRACE_START' })
            if (!actor.getSnapshot().matches({ creating: 'tracing' })) return null
            event.preventDefault()
            creationHasGeometry = true
            // Must be visible BEFORE positioning: calibrateGhostToWorldSnapshot
            // measures via getBoundingClientRect, which a display:none element
            // always reports as an all-zero rect — the correction loop then
            // "corrects" against that phantom zero every iteration, landing far
            // off target. applyMachineState() below would set this anyway, but
            // only AFTER positioning runs.
            csRoot.style.display = ''

            let current: CreationResult
            if (isGrid && startCell !== null && tracks !== null) {
              const area = { row: startCell.row, col: startCell.col, rowSpan: 1, colSpan: 1 }
              positionCsFromCellArea(refPose, tracks, area)
              current = { kind: 'cell-area', area }
            } else {
              positionCsFromLocalRect(refPose, { x: anchorLocal.x, y: anchorLocal.y, width: 0, height: 0 })
              current = { kind: 'rect', rect: { x: anchorLocal.x, y: anchorLocal.y, width: 0, height: 0 } }
            }
            applyMachineState()
            return { containerPose: refPose, tracks, anchorLocal, isGrid, startCell, current }
          },
          onMove: (event, session) => {
            const origin = localFractionToViewportPoint(session.containerPose, 0, 0)
            const local = worldDeltaToLocalDelta(session.containerPose.matrix, event.clientX - origin.x, event.clientY - origin.y)

            if (session.isGrid && session.tracks !== null && session.startCell !== null) {
              const currentCell = {
                row: trackIndexAtPx(session.tracks.rows, session.tracks.rowGap, local.y),
                col: trackIndexAtPx(session.tracks.cols, session.tracks.columnGap, local.x)
              }
              const area = {
                row: Math.min(session.startCell.row, currentCell.row),
                col: Math.min(session.startCell.col, currentCell.col),
                rowSpan: Math.abs(currentCell.row - session.startCell.row) + 1,
                colSpan: Math.abs(currentCell.col - session.startCell.col) + 1
              }
              session.current = { kind: 'cell-area', area }
              positionCsFromCellArea(session.containerPose, session.tracks, area)
              return
            }

            let width = local.x - session.anchorLocal.x
            let height = local.y - session.anchorLocal.y
            if (event.shiftKey) {
              const side = Math.max(Math.abs(width), Math.abs(height))
              width = width < 0 ? -side : side
              height = height < 0 ? -side : side
            }
            const rect = {
              x: Math.min(session.anchorLocal.x, session.anchorLocal.x + width),
              y: Math.min(session.anchorLocal.y, session.anchorLocal.y + height),
              width: Math.abs(width),
              height: Math.abs(height)
            }
            session.current = { kind: 'rect', rect }

            // Same method as editing: left/top were calibrated ONCE at the
            // anchor in onStart and are never touched again — recalibrating
            // on every move (positionCsFromLocalRect) is what let the origin
            // corner visibly drift with the pointer. Growth, including past
            // the anchor in the negative direction, is expressed with
            // translate + width/height only.
            //
            // translate composes LAST (outermost, same space as the raw
            // viewport deltas the regular body-drag assigns directly to
            // translate) — NOT before the cs's own rotation. A local-space
            // overshoot must therefore be converted to viewport space via the
            // FULL matrix (rotation AND scale) before being assigned, exactly
            // like localFractionToViewportPoint does for a point; using
            // scaleX/scaleY alone (no rotation) is what made the anchor drift
            // on a rotated container when dragging past it.
            const m = session.containerPose.matrix
            const overshootLocalX = Math.min(0, width)
            const overshootLocalY = Math.min(0, height)
            const translateX = m.a * overshootLocalX + m.c * overshootLocalY
            const translateY = m.b * overshootLocalX + m.d * overshootLocalY
            csRoot.style.translate = `${translateX}px ${translateY}px`
            csRoot.style.width = `${Math.abs(width) * session.containerPose.scaleX}px`
            csRoot.style.height = `${Math.abs(height) * session.containerPose.scaleY}px`
          },
          onEnd: (session, apply) => {
            const result = session.current
            const meetsMinimum =
              apply &&
              result !== null &&
              (result.kind === 'cell-area' || (result.rect.width >= minTraceSizePx && result.rect.height >= minTraceSizePx))

            if (!meetsMinimum || result === null) {
              actor.send({ type: 'TRACE_ABORT' })
              applyMachineState()
              return
            }

            actor.send({ type: 'TRACE_END' })
            const rounded: CreationResult =
              result.kind === 'rect'
                ? {
                    kind: 'rect',
                    rect: {
                      x: Math.round(result.rect.x),
                      y: Math.round(result.rect.y),
                      width: Math.round(result.rect.width),
                      height: Math.round(result.rect.height)
                    }
                  }
                : result
            applyMachineState()
            creation!.onCreate(rounded)
          }
        })
      : null

  // ── Alt+click cycle (item stacked underneath) ────────────────────────────

  /**
   * Every real player-mounted item's own persoId stacked at this viewport point, topmost first —
   * the runtime's own convention of `node.id === perso.id` (`applyNodeId`, `dom.ts`/
   * `dom-component-adapter.ts`) makes this a direct read, no separate node→persoId registry
   * needed. Any node inside the shared overlay layer (this cs's own body/handles/gabarit, or
   * another module's — the layer is shared across the whole package) is excluded: only real scene
   * nodes are candidates.
   */
  const resolveAltClickCandidates = (x: number, y: number): string[] => {
    if (typeof doc.elementsFromPoint !== 'function') return []
    const candidates: string[] = []
    for (const element of doc.elementsFromPoint(x, y)) {
      if (!(element instanceof HTMLElement)) continue
      if (overlayLayer.contains(element)) continue
      if (element.id.length > 0) candidates.push(element.id)
    }
    return candidates
  }

  // ── drag (cs body) ───────────────────────────────────────────────────────

  type DragSession = {
    /** Conversion space frozen at session start. */
    parentMatrix: Matrix2D
    /** Element viewport anchor at session start — baseline for measured correction. */
    startRectLeft: number
    startRectTop: number
    startX: number
    startY: number
    emittedX: number
    emittedY: number
    axisLock: 'x' | 'y' | null
    /** Grid libre mode: element stays put, a temporary clone previews the snap. */
    gridClone: HTMLElement | null
    /**
     * Multi-cell grab context: which cell of the element's footprint was
     * grabbed, and the measured spans — the hovered cell receives the grabbed
     * cell, the footprint is preserved (a 2×2 stays a 2×2).
     */
    gridContext: { grabRowOffset: number; grabColOffset: number; rowSpan: number; colSpan: number } | null
    /** Last resolved target ORIGIN cell — the single source of truth for the drop. */
    lastCell: { row: number; col: number } | null
    /** Key of the zone the clone is currently animating towards. */
    lastZoneKey: string | null
    /** In-flight clone projection (cancelled on retarget and on release). */
    cloneAnimation: WAAPIAnimation | null
    lastLocalX: number
    lastLocalY: number
  }

  const dragGesture = bindGestureSession<DragSession>(csRoot, {
    onStart: (event) => {
      if (event.target !== csRoot || pose === null) return null

      // Alt-click: resolve the stacked candidates and hand off to the editor, no gesture starts —
      // same "instantaneous action, not a drag" pattern as the handles' own alt-click toggle. Same
      // machine guard as every other gesture start: a cycle must not fire while another gesture is
      // already in flight (dragging/resizing/rotating) — `isSuspended()` alone only screens out
      // suspended/idle. Found missing during a systematic pass over the package's own machine
      // guards, 2026-07-10 (same fix applied to zone-editor.ts's own alt-click).
      if (event.altKey) {
        if (options.onAltClickCycle !== undefined && actor.getSnapshot().matches({ active: 'still' })) {
          options.onAltClickCycle(resolveAltClickCandidates(event.clientX, event.clientY), event.shiftKey)
        }
        event.preventDefault()
        event.stopPropagation()
        return null
      }

      actor.send({ type: 'DRAG_START' })
      if (!actor.getSnapshot().matches({ active: 'dragging' })) return null

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
          // Visual matrix of the element (container rotation included): the
          // preview must show the element as it will render. Rotation around
          // the local origin keeps the left/top anchor on the cell corner.
          // The cloned inline individual properties are cleared first — the
          // pose matrix already carries them, keeping them would double-apply.
          clone.style.translate = ''
          clone.style.rotate = ''
          clone.style.scale = ''
          const m = pose.rotationMatrix
          clone.style.transformOrigin = '0px 0px'
          clone.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, 0, 0)`
          // Initial anchor: the element's LOCAL-ORIGIN corner (affine mapping),
          // never the AABB corner — they differ on a rotated element, and an
          // AABB anchor breaks the projection's initial trajectory.
          const cornerPoint = localFractionToViewportPoint(pose, 0, 0)
          clone.style.left = `${cornerPoint.x}px`
          clone.style.top = `${cornerPoint.y}px`
          overlayLayer.appendChild(clone)
          gridClone = clone
        }
      }

      event.preventDefault()
      const gridContext = gridClone !== null ? captureGridDragContext(event.clientX, event.clientY) : null
      return {
        parentMatrix: pose.parentMatrix,
        startRectLeft: pose.rect.left,
        startRectTop: pose.rect.top,
        startX: event.clientX,
        startY: event.clientY,
        emittedX: 0,
        emittedY: 0,
        axisLock: null,
        gridClone,
        gridContext,
        lastCell: null,
        lastZoneKey: null,
        cloneAnimation: null,
        lastLocalX: 0,
        lastLocalY: 0
      }
    },
    onMove: (event, session) => {
      let viewportDx = event.clientX - session.startX
      let viewportDy = event.clientY - session.startY

      if (event.shiftKey) {
        if (session.axisLock === null && (Math.abs(viewportDx) > 2 || Math.abs(viewportDy) > 2)) {
          session.axisLock = Math.abs(viewportDx) >= Math.abs(viewportDy) ? 'x' : 'y'
        }
        if (session.axisLock === 'x') viewportDy = 0
        if (session.axisLock === 'y') viewportDx = 0
      } else {
        session.axisLock = null
      }

      // The cs follows the raw pointer.
      csRoot.style.translate = `${viewportDx}px ${viewportDy}px`

      // CSS `translate` on the element operates in the PARENT's space: convert
      // through the parent matrix, not the element matrix (which would apply
      // the element's own rotation twice).
      const local = worldDeltaToLocalDelta(session.parentMatrix, viewportDx, viewportDy)
      session.lastLocalX = local.x
      session.lastLocalY = local.y

      if (session.gridClone !== null) {
        // Grid libre: the element stays put until validation; the drawn zone
        // under the pointer (pointAt) drives highlight, clone and drop alike.
        // Multi-cell: the hovered cell receives the GRABBED cell — the clone
        // previews the full footprint at the resolved origin.
        const hit = zoneAtPoint(event.clientX, event.clientY)
        highlightZoneNode(hit?.node ?? null)
        if (hit !== null) {
          const origin = resolveDropOrigin(hit, session.gridContext)
          session.lastCell = origin
          const zoneKey = `${origin.row}:${origin.col}`
          if (zoneKey !== session.lastZoneKey && containerNode !== null && elementNode !== null && pose !== null) {
            session.lastZoneKey = zoneKey
            // Faithful preview: the ghost shows the FINAL render — layout
            // corner at the target footprint plus the element's own-transform
            // displacement, recomputed at the target dimensions (percent
            // origins follow the box, whose size changes with the destination
            // tracks). Ghost and final placement coincide by construction.
            const containerPose = captureOverlayPose(containerNode)
            const tracks = containerTrackGeometry(containerPose)
            if (tracks !== null && containerPose.localWidth > 1e-3 && containerPose.localHeight > 1e-3) {
              const rowSpan = session.gridContext?.rowSpan ?? 1
              const colSpan = session.gridContext?.colSpan ?? 1
              const futureLocalW = trackSpanPx(tracks.cols, tracks.columnGap, origin.col, colSpan)
              const futureLocalH = trackSpanPx(tracks.rows, tracks.rowGap, origin.row, rowSpan)

              // A position:absolute item's size never derives from a span —
              // it doesn't depend on the grid at all, only its anchor does.
              // Project the displacement (and render the ghost) at the
              // item's OWN unchanging dimensions instead of the target
              // cell's span size; only the corner (position) animates.
              const sizeIndependent = isSizeIndependentOfGrid(elementNode)
              const targetLocalW = sizeIndependent ? pose.localWidth : futureLocalW
              const targetLocalH = sizeIndependent ? pose.localHeight : futureLocalH

              const own = captureOwnTransformComponents(elementNode, pose.localWidth, pose.localHeight)
              const originFx = pose.localWidth > 1e-6 ? own.originX / pose.localWidth : 0.5
              const originFy = pose.localHeight > 1e-6 ? own.originY / pose.localHeight : 0.5
              const displacement = ownCornerDisplacement(own, originFx * targetLocalW, originFy * targetLocalH)

              const cornerLocalX = trackAnchorPx(tracks.cols, tracks.columnGap, origin.col) + displacement.x
              const cornerLocalY = trackAnchorPx(tracks.rows, tracks.rowGap, origin.row) + displacement.y
              const corner = localFractionToViewportPoint(
                containerPose,
                cornerLocalX / containerPose.localWidth,
                cornerLocalY / containerPose.localHeight
              )

              // Future rendered size = future layout size × current visual scale.
              const scaleRatioX = pose.localWidth > 1e-6 ? pose.frameWidth / pose.localWidth : 1
              const scaleRatioY = pose.localHeight > 1e-6 ? pose.frameHeight / pose.localHeight : 1
              const renderedW = sizeIndependent ? pose.frameWidth : futureLocalW * scaleRatioX
              const renderedH = sizeIndependent ? pose.frameHeight : futureLocalH * scaleRatioY

              session.cloneAnimation?.cancel()
              session.cloneAnimation = waapi.animate(session.gridClone, {
                left: `${corner.x}px`,
                top: `${corner.y}px`,
                width: `${renderedW}px`,
                height: `${renderedH}px`,
                duration: 500,
                ease: 'outQuad'
              })
            }
          }
        }
        return
      }

      // Libre: continuous incremental emission, exact accumulation on rounded totals.
      const targetX = Math.round(local.x)
      const targetY = Math.round(local.y)
      const dx = targetX - session.emittedX
      const dy = targetY - session.emittedY
      if (dx === 0 && dy === 0) return
      session.emittedX = targetX
      session.emittedY = targetY
      adapter?.applyMove({ dx, dy })
      actor.send({ type: 'DRAG_MOVE' })

      // Measured correction before repaint: the element is the truth. Any
      // layout interference (auto margins, min/max constraints, unforeseen
      // properties) deflects it from the theoretical delta — measure where it
      // actually landed (world-anchor seam) and glue the cs to it.
      if (elementNode !== null) {
        const measured = measureWorldRect(elementNode)
        csRoot.style.translate = `${measured.left - session.startRectLeft}px ${measured.top - session.startRectTop}px`
      }
    },
    onEnd: (session, apply, event) => {
      actor.send({ type: 'DRAG_END' })

      if (session.gridClone !== null) {
        session.cloneAnimation?.cancel()
        session.gridClone.remove()
        highlightZoneNode(null)
        if (apply) {
          // Drop contract: the element lands exactly where the author saw it.
          // The target is resolved at the RELEASE point (pointermove events are
          // frame-coalesced, pointerup is not) through the same pointAt zone
          // reference and grab-offset resolution as the preview.
          const releaseHit = event !== null ? zoneAtPoint(event.clientX, event.clientY) : null
          const dropOrigin = releaseHit !== null ? resolveDropOrigin(releaseHit, session.gridContext) : session.lastCell
          if (adapter?.applyCellDrop !== undefined && dropOrigin !== null) {
            adapter.applyCellDrop(dropOrigin)
          } else {
            adapter?.applyMove({ dx: Math.round(session.lastLocalX), dy: Math.round(session.lastLocalY) })
          }
        }
      }

      csRoot.style.translate = '0px 0px'
      sync()
    }
  })

  // ── resize / scale (handles) ─────────────────────────────────────────────

  type ResizeSession = {
    handleId: HandleId
    mode: 'resize' | 'scale'
    /** Corner ratio policy resolved from the preset at session start. */
    ratioPolicy: 'locked' | 'free'
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
    /** Grid context: footprint at gesture start — the resize emits atomic cell areas. */
    gridArea: CellArea | null
    /** Last emitted area key, to emit only on change. */
    lastAreaKey: string | null
    emittedW: number
    emittedH: number
    emittedFx: number
    emittedFy: number
  }

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

  const resolveHandleBehavior = (
    id: HandleId
  ): { mode: 'resize' | 'scale'; allowSwap: boolean; ratio: 'locked' | 'free' } => {
    const group = isCorner(id) ? 'corners' : 'sides'
    const specific = presetHandles?.[id]
    const groupConfig = presetHandles?.[group]
    const resizeAllowed = capabilityActive('resize')
    const scaleAllowed = capabilityActive('scale')
    return {
      mode: specific?.mode ?? groupConfig?.mode ?? (resizeAllowed ? 'resize' : 'scale'),
      allowSwap: specific?.allowSwap ?? groupConfig?.allowSwap ?? (resizeAllowed && scaleAllowed),
      ratio: specific?.ratio ?? groupConfig?.ratio ?? 'locked'
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
      adapter?.applyMove({ dx, dy })
    }
  }

  const resizeGestures = new Map<HandleId, ReturnType<typeof bindGestureSession<ResizeSession>>>()

  for (const [handleId, handle] of handleNodes) {
    const gesture = bindGestureSession<ResizeSession>(handle, {
      onStart: (event) => {
        if (pose === null) return null

        // Alt-click: toggle the handle's persistent mode, no gesture starts.
        if (event.altKey) {
          toggleHandleMode(handleId)
          event.preventDefault()
          event.stopPropagation()
          return null
        }

        actor.send({ type: 'RESIZE_START' })
        if (!actor.getSnapshot().matches({ active: 'resizing' })) return null
        const anchorPoint = CHARACTERISTIC_POINTS[OPPOSITE_POINT[handleId]]
        const anchorStart = localFractionToViewportPoint(pose, anchorPoint.fx, anchorPoint.fy)
        event.preventDefault()
        event.stopPropagation()
        return {
          handleId,
          mode: currentHandleMode(handleId),
          ratioPolicy: resolveHandleBehavior(handleId).ratio,
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
          gridArea: gridDragActive() && adapter?.applyCellArea !== undefined ? measureElementFootprint() : null,
          lastAreaKey: null,
          emittedW: 0,
          emittedH: 0,
          emittedFx: 1,
          emittedFy: 1
        }
      },
      onMove: (event, session) => {
        const factors = handleFactors[session.handleId]

        // Grid context: the dragged edge follows the pointer to the measured
        // track containing it; the opposite edge stays fixed. North/west handles
        // MOVE THE ORIGIN — a span alone only extends down/right, which is why
        // the pixel path (applyResize + anchor lock) misfired on top handles.
        if (session.gridArea !== null && adapter?.applyCellArea !== undefined && containerGrid !== null) {
          const local = viewportToContainerLocal(event.clientX, event.clientY)
          const containerPoseNow = containerNode !== null ? captureOverlayPose(containerNode) : null
          const tracks = containerPoseNow !== null ? containerTrackGeometry(containerPoseNow) : null
          if (local !== null && tracks !== null) {
            const start = session.gridArea
            let { row, col, rowSpan, colSpan } = start
            if (factors.h !== 0) {
              const pointerRow = trackIndexAtPx(tracks.rows, tracks.rowGap, local.y)
              if (factors.h < 0) {
                const bottom = start.row + start.rowSpan - 1
                const top = Math.min(pointerRow, bottom)
                row = top
                rowSpan = bottom - top + 1
              } else {
                const bottom = Math.max(pointerRow, start.row)
                rowSpan = bottom - start.row + 1
              }
            }
            if (factors.w !== 0) {
              const pointerCol = trackIndexAtPx(tracks.cols, tracks.columnGap, local.x)
              if (factors.w < 0) {
                const right = start.col + start.colSpan - 1
                const left = Math.min(pointerCol, right)
                col = left
                colSpan = right - left + 1
              } else {
                const right = Math.max(pointerCol, start.col)
                colSpan = right - start.col + 1
              }
            }
            const areaKey = `${row}:${col}:${rowSpan}:${colSpan}`
            if (areaKey !== session.lastAreaKey) {
              session.lastAreaKey = areaKey
              adapter.applyCellArea({ row, col, rowSpan, colSpan })
              positionCs()
            }
          }
          return
        }

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

        // Corner ratio constraint — policy-driven (HandleBehavior.ratio), never a
        // context-specific branch: 'locked' = maintained, Shift lifts; 'free' =
        // free gesture, Shift locks. The dominant axis drives, the other follows
        // the session-start ratio.
        const ratioActive = session.ratioPolicy === 'free' ? event.shiftKey : !event.shiftKey
        if (isCorner(session.handleId) && ratioActive && session.startLocalWidth > 1e-6 && session.startLocalHeight > 1e-6) {
          const relW = Math.abs(localW) / session.startLocalWidth
          const relH = Math.abs(localH) / session.startLocalHeight
          if (relW >= relH) {
            localH = localW * (session.startLocalHeight / session.startLocalWidth)
          } else {
            localW = localH * (session.startLocalWidth / session.startLocalHeight)
          }
        }

        if (session.mode === 'scale') {
          // Scale: multiplicative factors; corner uniformity follows the same
          // ratio policy as resize. The cs itself is not rescaled — it re-captures
          // the element after emission.
          let targetFx = session.startLocalWidth > 1e-3 ? (session.startLocalWidth + localW) / session.startLocalWidth : 1
          let targetFy = session.startLocalHeight > 1e-3 ? (session.startLocalHeight + localH) / session.startLocalHeight : 1
          if (factors.w === 0) targetFx = event.shiftKey ? 1 : targetFy
          if (factors.h === 0) targetFy = event.shiftKey ? 1 : targetFx
          if (isCorner(session.handleId) && ratioActive) {
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
          adapter?.applyScale({ fx, fy })
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
        adapter?.applyResize({ dw, dh })

        // Only the dragged handle moves: lock the anchor by measurement, then
        // re-capture so the cs keeps tracking the element.
        lockAnchor(session)
        positionCs()
      },
      onEnd: () => {
        actor.send({ type: 'RESIZE_END' })
        sync()
      }
    })
    resizeGestures.set(handleId, gesture)
  }

  // ── rotation (needle tip) + pivot placement ──────────────────────────────

  type RotateSession = {
    startPointerAngleDeg: number
    /** Pivot frozen in viewport space at session start. */
    pivotX: number
    pivotY: number
    emittedDeg: number
  }

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

  const rotateGesture = bindGestureSession<RotateSession>(needleTip, {
    onStart: (event) => {
      if (pose === null) return null
      actor.send({ type: 'ROTATE_START' })
      if (!actor.getSnapshot().matches({ active: 'rotating' })) return null
      const pivot = pivotViewportPoint()
      if (pivot === null) return null
      event.preventDefault()
      event.stopPropagation()
      return {
        startPointerAngleDeg: (Math.atan2(event.clientY - pivot.y, event.clientX - pivot.x) * 180) / Math.PI,
        pivotX: pivot.x,
        pivotY: pivot.y,
        emittedDeg: 0
      }
    },
    onMove: (event, session) => {
      // Emission: physical rotation described by the pointer around the pivot
      // frozen at gesture start (the pivot IS the rotation center — it does
      // not move during the gesture).
      const pointerAngle = (Math.atan2(event.clientY - session.pivotY, event.clientX - session.pivotX) * 180) / Math.PI
      let deltaDeg = pointerAngle - session.startPointerAngleDeg
      if (event.shiftKey) {
        deltaDeg = Math.round(deltaDeg / ROTATE_STEP_DEG) * ROTATE_STEP_DEG
      }

      const target = Math.round(deltaDeg)
      const dr = target - session.emittedDeg
      if (dr !== 0) {
        session.emittedDeg = target
        adapter?.applyRotate({ dr, origin: { fx: pivotFraction.fx, fy: pivotFraction.fy } })
        // The element rotated live: re-capture so the cs keeps tracking it.
        positionCs()
      }

      // Visual: the needle tip stays glued to the pointer and elongates with
      // the drag, using the pose refreshed by the emission above.
      followPointerWithNeedle(event)
    },
    onEnd: () => {
      actor.send({ type: 'ROTATE_END' })
      // The needle retracts to its resting length once the gesture ends.
      needleLengthPx = NEEDLE_LENGTH_PX
      sync()
    }
  })

  type PivotDragSession = Record<string, never>

  const pivotGesture = bindGestureSession<PivotDragSession>(pivotNode, {
    onStart: (event) => {
      if (!capabilityActive('rotation-origin')) return null
      event.preventDefault()
      event.stopPropagation()
      return {}
    },
    onMove: (event) => {
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
    },
    onEnd: () => {
      // Nothing to commit or roll back — the pivot fraction already holds the
      // live position throughout the gesture.
    }
  })

  // Double-click on the rotation axis: back to its default position (center).
  // Independent of the drag gesture session — not a pointer gesture itself.
  pivotNode.addEventListener('dblclick', (event: MouseEvent) => {
    if (!capabilityActive('rotation-origin')) return
    pivotFraction = { fx: 0.5, fy: 0.5 }
    pivotMagnetTarget = null
    positionNeedle()
    refreshHandleVisibility()
    event.preventDefault()
    event.stopPropagation()
  })

  // ── node lifecycle ───────────────────────────────────────────────────────

  let resizeObserver: ResizeObserver | null = null

  const observeElement = (node: HTMLElement): void => {
    if (typeof globalThis.ResizeObserver === 'undefined') return
    resizeObserver?.disconnect()
    resizeObserver = new globalThis.ResizeObserver(() => {
      const anyResizeActive = Array.from(resizeGestures.values()).some((gesture) => gesture.isActive())
      if (!dragGesture.isActive() && !anyResizeActive && !rotateGesture.isActive()) {
        sync()
      }
    })
    resizeObserver.observe(node)
  }

  const handleElementNode = (node: Element | null): void => {
    if (destroyed) return
    if (node instanceof HTMLElement) {
      elementNode = node
      actor.send({ type: 'NODE_APPEARED' })
      // Reposition/observe only once the shared anchor confirms the node is
      // actually connected — never on the raw presence alone. codplay's own
      // render pass routinely notifies with a not-yet-connected node (see
      // `tracked-nodes.ts`); acting on it here is exactly the race this
      // migration closes (`2026-07-16-gesture-rebuild-ordering-plan.md`
      // §1.2-1.3 — `positionCs()` used to run unconditionally on this same
      // premature notification). The corrective notification that always
      // follows (once the tree is attached) re-enters this same branch with
      // `canAct()` true and positions it then — nothing is lost, only
      // deferred by the one tick codplay itself needs.
      if (anchor?.canAct() ?? false) {
        positionCs()
        observeElement(node)
      }
    } else {
      elementNode = null
      pose = null
      resizeObserver?.disconnect()
      actor.send({ type: 'NODE_DISAPPEARED' })
    }
    applyMachineState()
  }

  let anchor: TrackedTarget | null = null
  let ownsAnchor = false
  let unsubscribeAnchor: (() => void) | null = null

  /**
   * Builds (or reuses a caller-shared) anchor for `itemId` and wires
   * `handleElementNode` to it — replaces the direct
   * `authorApi.subscribeToNode(itemId, handleElementNode)` this file used to
   * open on its own. Used both at construction and by `attachItem` (create
   * mode's handoff to a real item never has an externally-shared anchor to
   * reuse — nothing else is watching this itemId yet at that point).
   */
  const attachAnchor = (itemId: string, shared?: TrackedTarget): (() => void) => {
    ownsAnchor = shared === undefined
    anchor = shared ?? createMinimalAnchor({ authorApi: options.authorApi, persoIds: [itemId] })
    unsubscribeAnchor = anchor.subscribe(() => handleElementNode(anchor!.getNode(itemId)))
    return () => {
      unsubscribeAnchor?.()
      if (ownsAnchor) anchor?.destroy()
      anchor = null
    }
  }

  // In create mode there is no itemId yet — the anchor/subscription starts
  // only once attachItem hands off a real one.
  let unsubscribeElement: (() => void) | null =
    options.itemId !== undefined ? attachAnchor(options.itemId, options.anchor) : null

  // Mirrors csMachine's own gesture sub-state onto the shared anchor's gesture session, when it IS
  // one (`isTrackedSession`) — a separate concern from csMachine itself, which stays exactly as it
  // is, governing only this module's own rendering/capabilities (Étape 2's precedent). This lets a
  // caller that constructed a shared session (`scene-player-bridge.ts`, gating a rebuild on "is a
  // gesture active") observe it without csMachine needing to be replaced or exposed
  // (`2026-07-16-rebuild-ordering-execution-plan.md` §2, Option B). A no-op when the anchor is a
  // plain `TrackedTarget` (`createMinimalAnchor`, e.g. every existing standalone/test usage).
  const GESTURE_KIND_BY_ACTIVE_SUBSTATE = { dragging: 'move', resizing: 'resize', rotating: 'rotate' } as const
  let mirroredGestureKind: 'move' | 'resize' | 'rotate' | null = null
  actor.subscribe((snapshot) => {
    if (anchor === null || !isTrackedSession(anchor)) return
    const nextKind = snapshot.matches({ active: 'dragging' })
      ? GESTURE_KIND_BY_ACTIVE_SUBSTATE.dragging
      : snapshot.matches({ active: 'resizing' })
        ? GESTURE_KIND_BY_ACTIVE_SUBSTATE.resizing
        : snapshot.matches({ active: 'rotating' })
          ? GESTURE_KIND_BY_ACTIVE_SUBSTATE.rotating
          : null
    if (nextKind === mirroredGestureKind) return
    if (mirroredGestureKind !== null) anchor.endGesture(mirroredGestureKind)
    if (nextKind !== null) anchor.startGesture(nextKind)
    mirroredGestureKind = nextKind
  })

  const unsubscribeContainer =
    options.containerId !== undefined
      ? options.authorApi.subscribeToNode(options.containerId, (node) => {
          if (destroyed) return
          containerNode = node instanceof HTMLElement ? node : null
          refreshGabarit()
          refreshCreationSurface()
        })
      : null

  if (creation !== null) {
    actor.send({ type: 'CREATE_ARMED' })
  }
  applyMachineState()

  // ── handle ───────────────────────────────────────────────────────────────

  function sync(): void {
    if (destroyed) return
    if (elementNode !== null) {
      positionCs()
    }
    refreshCreationSurface()
    applyMachineState()
  }

  return {
    destroy(): void {
      if (destroyed) return
      destroyed = true
      unsubscribeElement?.()
      unsubscribeContainer?.()
      resizeObserver?.disconnect()
      dragGesture.unbind()
      for (const gesture of resizeGestures.values()) gesture.unbind()
      rotateGesture.unbind()
      pivotGesture.unbind()
      traceGesture?.unbind()
      creationSurface?.remove()
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
    },

    applyCreationGeometry(geometry: CreationGeometry): void {
      if (creation === null) return
      const referenceNode = creationReferenceNode()
      if (referenceNode === null) return
      const refPose = captureOverlayPose(referenceNode)
      creationHasGeometry = true
      // See onStart: must be visible before positioning, or calibration
      // measures against a phantom all-zero display:none rect.
      csRoot.style.display = ''

      if ('cellArea' in geometry) {
        if (containerGrid === null) return
        const tracks = containerTrackGeometry(refPose)
        if (tracks === null) return
        const { rows, cols } = containerGrid.context
        // Negative row/col/span extend from the grid's far edge (-1 = last
        // track / to the last track) — only this documented case is exercised.
        const row = geometry.cellArea.row < 0 ? rows + geometry.cellArea.row + 1 : geometry.cellArea.row
        const col = geometry.cellArea.col < 0 ? cols + geometry.cellArea.col + 1 : geometry.cellArea.col
        const rowSpan = geometry.cellArea.rowSpan < 0 ? rows - row + 1 : geometry.cellArea.rowSpan
        const colSpan = geometry.cellArea.colSpan < 0 ? cols - col + 1 : geometry.cellArea.colSpan
        const area = { row, col, rowSpan, colSpan }
        positionCsFromCellArea(refPose, tracks, area)
        actor.send({ type: 'CREATION_GEOMETRY_APPLIED' })
        applyMachineState()
        creation.onCreate({ kind: 'cell-area', area })
        return
      }

      const rect = {
        x: geometry.rect.fx * refPose.localWidth,
        y: geometry.rect.fy * refPose.localHeight,
        width: geometry.rect.fw * refPose.localWidth,
        height: geometry.rect.fh * refPose.localHeight
      }
      positionCsFromLocalRect(refPose, rect)
      actor.send({ type: 'CREATION_GEOMETRY_APPLIED' })
      applyMachineState()
      creation.onCreate({
        kind: 'rect',
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      })
    },

    attachItem(input: { itemId: string; adapter: CsValueAdapter }): void {
      if (destroyed || creation === null) return
      adapter = input.adapter
      creation = null
      csRoot.setAttribute('data-selection-frame', input.itemId)
      traceGesture?.unbind()
      creationSurface?.remove()
      creationSurface = null
      actor.send({ type: 'ITEM_ATTACHED' })
      applyMachineState()
      // Always a freshly built anchor: nothing else is watching this itemId
      // yet at the moment create mode hands off (unlike the constructor
      // path, which may receive one shared by the caller).
      unsubscribeElement = attachAnchor(input.itemId)
    }
  }
}
