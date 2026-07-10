/**
 * Éditeur de zones (`2026-07-03-selection-frame-variantes-plan.md` §Variante B). Un gabarit
 * ENRICHI du gabarit du cs (§Dispositifs communs) : même accrochage (`authorApi.subscribeToNode`),
 * même calibration overlay-world (`overlay-pose.ts`), même géométrie de pistes mesurée
 * (`grid-geometry.ts`), même mécanique de session de geste (`gesture-session.ts`, dont le docstring
 * cite déjà ce module).
 *
 * RENDU DE GRILLE — jamais un nœud DOM par cellule. Une première version en créait un par cellule
 * (voire un par macro-cellule au-delà du seuil de finesse) : à l'échelle visée par le plan
 * (« jusqu'à ~160×90 cellules »), même 1200 nœuds stylés (bordures pointillées, un repaint coûteux
 * par nœud) a suffi à geler le navigateur entier — pas juste ralentir, geler. Le fond de grille est
 * maintenant UN SEUL élément, dessiné par `repeating-linear-gradient` (coût de rendu constant,
 * indépendant du nombre de pistes — 4 ou 14400, aucune différence). Les ZONES restent de vrais
 * éléments (leur nombre reste faible par construction, ce n'est jamais elles le problème) mais
 * positionnées en POURCENTAGE (`row/rows*100%`), jamais via `grid-template-{rows,columns}` à la
 * résolution complète — poser un CSS Grid à des milliers de pistes explicites sur `zonesRoot` était
 * la seconde moitié du même bug. Quelle cellule est sous le pointeur se résout par calcul de piste
 * (`trackIndexAtPx`, déjà utilisé pour les gestes), jamais par hit-test DOM sur une cellule.
 *
 * Le survol pleine résolution (plan §Affichage de la grille) suit la même logique : plus de
 * macro-cellules DOM à écouter, un seul `pointermove` sur le fond de grille calcule la cellule fine
 * survolée et matérialise un feedback visuel LÉGER borné à un voisinage — jamais un lot de nœuds
 * par macro-cellule.
 */
import { createActor } from 'xstate'
import { worldDeltaToLocalDelta } from 'codplay/runtime/modules/list-flip/engine/dom-matrix'
import type { AuthorApi } from './author-api'
import { calibrateGhostToWorldSnapshot, captureOverlayPose, ensureOverlayLayer, localFractionToViewportPoint } from './overlay-pose'
import { measureGridTracks, trackIndexAtPx, uniformTrackGeometry } from './grid-geometry'
import type { GridTrackGeometry } from './grid-geometry'
import { bindGestureSession } from './gesture-session'
import { CHARACTERISTIC_POINTS, createHandleNode } from './handle-geometry'
import type { HandleId } from './handle-geometry'
import { zoneMachine } from './zone-machine'
import * as zoneModel from './zone-model'
import type { ZoneDef, ZoneEditorState, ZoneGridModel } from './zone-model'

/**
 * NEUTRALIZED for now (2026-07-09) — the background-gradient rewrite made the previous per-regime
 * cell rendering obsolete, but what this threshold should drive next (rendering is still being
 * tuned — grid legibility at real scale, notably) isn't decided. `ZoneEditorOptions.fineDisplayThreshold`
 * stays in the API (the plan lists it explicitly) but is currently READ AND IGNORED, not wired to
 * anything — never silently repurposed without saying so.
 */
const DEFAULT_FINE_DISPLAY_THRESHOLD = 40

/**
 * Below this rendered cell size (in local px, at the grid's own scale), cell placement itself is
 * disabled — plan's own "grille ultra-fine = mode zone imposé" ("un seuil en px, configurable —
 * même esprit que minSizePx du cs"). Not enforced by rendering — surfaced through
 * `isCellPlacementAvailable()` for the editor's own UI, per the plan's own wording.
 */
const DEFAULT_MIN_CELL_SIZE_PX = 6

export type ZoneEditorOptions = {
  authorApi: AuthorApi
  sceneRoot: Element
  /** persoId of the capsule being edited — this module's own container accrochage. */
  containerId: string
  initialState: ZoneEditorState
  onZonesChange: (state: ZoneEditorState) => void
  onSelectionChange: (names: string[]) => void
  fineDisplayThreshold?: number
  minCellSizePx?: number
}

export type ZoneEditorHandle = {
  destroy(): void
  sync(): void
  setState(state: ZoneEditorState): void
  setGrid(grid: ZoneGridModel): void
  addZone(area: { row: number; col: number; rowSpan: number; colSpan: number }, name?: string): string
  removeZone(name: string): void
  renameZone(name: string, next: string): void
  getSplitOptions(name: string): { rows: number[]; cols: number[] }
  splitZone(name: string, div: { rows?: number; cols?: number; gapUnits?: number }): string[]
  mergeZones(names: string[], name?: string): string
  select(names: string[]): void
  getState(): ZoneEditorState
  setPartVisibility(part: 'grid' | 'zones', visible: boolean): void
  /** Whether the grid is currently fine enough that per-cell placement should be offered. */
  isCellPlacementAvailable(): boolean
}

export function createZoneEditor(options: ZoneEditorOptions): ZoneEditorHandle {
  const doc = options.sceneRoot.ownerDocument
  const overlayLayer = ensureOverlayLayer(options.sceneRoot)
  // NEUTRALIZED (see DEFAULT_FINE_DISPLAY_THRESHOLD's own doc) — read for API compatibility, not
  // wired to anything in the current rendering. Referencing the option itself (not just the
  // default) keeps `options.fineDisplayThreshold` a real, type-checked field rather than dead API
  // surface that could silently rot.
  void (options.fineDisplayThreshold ?? DEFAULT_FINE_DISPLAY_THRESHOLD)
  const minCellSizePx = options.minCellSizePx ?? DEFAULT_MIN_CELL_SIZE_PX

  let state = options.initialState
  let containerNode: HTMLElement | null = null
  let destroyed = false
  let gridVisible = true
  let zonesVisible = true
  let selectedNames: string[] = []

  const actor = createActor(zoneMachine)
  actor.start()

  const isSuspended = (): boolean => actor.getSnapshot().matches('suspended') || actor.getSnapshot().matches('idle')

  // ── DOM ────────────────────────────────────────────────────────────────────

  const editorRoot = doc.createElement('div')
  editorRoot.setAttribute('data-zone-editor', options.containerId)
  editorRoot.style.position = 'fixed'
  editorRoot.style.boxSizing = 'border-box'
  editorRoot.style.transformOrigin = '0px 0px'
  editorRoot.style.display = 'none'
  editorRoot.style.pointerEvents = 'none'
  overlayLayer.appendChild(editorRoot)

  /**
   * The grid background — ONE element, ONE `repeating-linear-gradient` per axis, no matter how
   * fine the grid is. This is what a hit-test/drag session reacts on (`pointerdown`/`pointermove`
   * target it directly) — never a per-cell node.
   */
  const gridBackground = doc.createElement('div')
  gridBackground.setAttribute('data-zone-editor-grid-background', '')
  gridBackground.style.position = 'absolute'
  gridBackground.style.inset = '0'
  gridBackground.style.pointerEvents = 'auto'
  gridBackground.style.touchAction = 'none'
  editorRoot.appendChild(gridBackground)

  /**
   * Single lightweight highlight for the hovered fine cell (plan's own "survol pleine résolution")
   * — one node, repositioned via inline style on every `pointermove`, never created/destroyed per
   * cell like the previous macro-cell-detail approach did.
   */
  const hoverHighlight = doc.createElement('div')
  hoverHighlight.setAttribute('data-zone-editor-hover-cell', '')
  hoverHighlight.style.position = 'absolute'
  hoverHighlight.style.border = '1px solid rgba(74, 144, 217, 0.9)'
  hoverHighlight.style.boxSizing = 'border-box'
  hoverHighlight.style.pointerEvents = 'none'
  hoverHighlight.style.display = 'none'
  editorRoot.appendChild(hoverHighlight)

  const zonesRoot = doc.createElement('div')
  zonesRoot.setAttribute('data-zone-editor-zones', '')
  zonesRoot.style.position = 'absolute'
  zonesRoot.style.inset = '0'
  // Transparent to hit-testing by itself — an empty (or sparsely populated) absolutely
  // positioned div covering the full surface otherwise steals every pointerdown from
  // gridBackground underneath, even where no zone actually is. Only its CHILDREN (zone nodes,
  // the trace preview) opt back in via their own `pointerEvents: 'auto'` — this is the actual
  // cause of the very first trace never starting: `event.target` resolved to this empty div,
  // never to `gridBackground`, so `traceGesture`'s own `event.target !== gridBackground` guard
  // silently rejected it.
  zonesRoot.style.pointerEvents = 'none'
  editorRoot.appendChild(zonesRoot)

  const zoneNodes = new Map<string, HTMLElement>()
  const handleNodesByZone = new Map<string, Map<HandleId, HTMLElement>>()

  // ── mutation (le SEUL chemin d'écriture — gestes ET commandes) ──────────────

  /**
   * Every mutation (gesture or command) goes through here — one write, one `onZonesChange`
   * emission, never duplicated logic between a geste and its command equivalent (plan
   * §Commandes programmatiques: "les commandes passent par le même chemin de mutation que les
   * gestes").
   */
  function applyState(next: ZoneEditorState): void {
    state = next
    refresh()
    options.onZonesChange(state)
  }

  function applySelection(names: string[]): void {
    selectedNames = names
    actor.send({ type: 'SELECTION_CHANGED', names })
    zonesRoot.replaceChildren()
    zoneNodes.clear()
    handleNodesByZone.clear()
    renderZones()
    options.onSelectionChange(selectedNames)
  }

  // ── grid rendering — un seul dégradé, jamais un nœud par cellule ────────────

  /**
   * Renders the grid lines as a repeating gradient — one pair of `repeating-linear-gradient`
   * layers, each with a step of `100%/tracks` on its own axis. Cost is O(1) regardless of the
   * track count: this is the entire fix for the freeze (a per-cell/per-macro-cell DOM node was
   * the actual cause, not the number of CSS tracks itself).
   */
  /** Every Nth line drawn heavier — a fine grid (100+ tracks) is illegible with every line the same weight. */
  const MAJOR_LINE_EVERY = 10

  function renderGridBackground(): void {
    const rowPct = 100 / state.grid.rows
    const colPct = 100 / state.grid.cols
    const lineColor = 'rgba(74, 144, 217, 0.35)'
    const majorLineColor = 'rgba(74, 144, 217, 0.85)'
    const majorRowPct = rowPct * MAJOR_LINE_EVERY
    const majorColPct = colPct * MAJOR_LINE_EVERY
    gridBackground.style.backgroundImage = [
      // Major lines painted LAST (on top): every Nth track boundary, heavier weight.
      `repeating-linear-gradient(to bottom, ${lineColor} 0, ${lineColor} 1px, transparent 1px, transparent ${rowPct}%)`,
      `repeating-linear-gradient(to right, ${lineColor} 0, ${lineColor} 1px, transparent 1px, transparent ${colPct}%)`,
      `repeating-linear-gradient(to bottom, ${majorLineColor} 0, ${majorLineColor} 2px, transparent 2px, transparent ${majorRowPct}%)`,
      `repeating-linear-gradient(to right, ${majorLineColor} 0, ${majorLineColor} 2px, transparent 2px, transparent ${majorColPct}%)`
    ].join(', ')
  }

  /** Resolves which fine cell (1-based row/col) a container-local point falls into. */
  function cellAtLocalPoint(local: { x: number; y: number }, tracks: GridTrackGeometry): { row: number; col: number } {
    return {
      row: trackIndexAtPx(tracks.rows, tracks.rowGap, local.y),
      col: trackIndexAtPx(tracks.cols, tracks.columnGap, local.x)
    }
  }

  function positionHoverHighlight(cell: { row: number; col: number }): void {
    const rowPct = 100 / state.grid.rows
    const colPct = 100 / state.grid.cols
    hoverHighlight.style.display = ''
    hoverHighlight.style.top = `${(cell.row - 1) * rowPct}%`
    hoverHighlight.style.left = `${(cell.col - 1) * colPct}%`
    hoverHighlight.style.width = `${colPct}%`
    hoverHighlight.style.height = `${rowPct}%`
  }

  gridBackground.addEventListener('pointermove', (event) => {
    if (isSuspended()) return
    const tracks = containerTrackGeometry()
    const local = viewportToContainerLocal(event.clientX, event.clientY)
    if (tracks === null || local === null) {
      hoverHighlight.style.display = 'none'
      return
    }
    positionHoverHighlight(cellAtLocalPoint(local, tracks))
  })
  gridBackground.addEventListener('pointerleave', () => {
    hoverHighlight.style.display = 'none'
  })

  function renderZoneHandles(zone: ZoneDef, zoneNode: HTMLElement): void {
    const handles = new Map<HandleId, HTMLElement>()
    for (const id of Object.keys(CHARACTERISTIC_POINTS) as HandleId[]) {
      const handle = createHandleNode({ doc, id, attributeName: 'data-zone-editor-handle', borderColor: 'rgba(217, 74, 74, 0.85)', pointerEventsAuto: true })
      zoneNode.appendChild(handle)
      handles.set(id, handle)
      bindResizeHandle(handle, id, zone.name)
    }
    handleNodesByZone.set(zone.name, handles)
  }

  /**
   * Positions one zone node in PERCENT of the grid — never grid-row/grid-column at full
   * resolution. Applied on every `onMove` of an active move/resize gesture, exactly like the cs's
   * own `positionCs()` re-measures and re-applies the resolved geometry on every move of its own
   * resize gesture (`selection-frame.ts`) — no separate CSS preview mechanism (an earlier
   * `previewZoneTransform`, using `translate()`/`scale()`, was removed: this repo's own precedents
   * — the cs's `positionCs()`/`lockAnchor`, and `multi-selection-frame.ts`'s own "measured
   * correction before repaint" — always apply the real resolved geometry directly, never a
   * separate transform preview).
   */
  function positionZoneNode(node: HTMLElement, zone: { row: number; col: number; rowSpan: number; colSpan: number }): void {
    const rowPct = 100 / state.grid.rows
    const colPct = 100 / state.grid.cols
    node.style.top = `${(zone.row - 1) * rowPct}%`
    node.style.left = `${(zone.col - 1) * colPct}%`
    node.style.width = `${zone.colSpan * colPct}%`
    node.style.height = `${zone.rowSpan * rowPct}%`
  }

  function renderZones(): void {
    for (const zone of state.zones) {
      const node = doc.createElement('div')
      node.setAttribute('data-zone-editor-zone', zone.name)
      node.style.position = 'absolute'
      positionZoneNode(node, zone)
      const selected = selectedNames.includes(zone.name)
      node.style.border = selected ? '2px solid rgba(217, 74, 74, 0.95)' : '2px solid rgba(217, 74, 74, 0.5)'
      node.style.background = selected ? 'rgba(217, 74, 74, 0.1)' : ''
      node.style.boxSizing = 'border-box'
      node.style.pointerEvents = 'auto'
      node.style.touchAction = 'none'
      node.style.cursor = 'move'
      zonesRoot.appendChild(node)
      zoneNodes.set(zone.name, node)
      bindZoneSelectAndMove(node, zone.name)
      if (selected) renderZoneHandles(zone, node)
    }
  }

  function renderAll(): void {
    renderGridBackground()
    zonesRoot.replaceChildren()
    zoneNodes.clear()
    handleNodesByZone.clear()
    renderZones()
    gridBackground.style.display = gridVisible ? '' : 'none'
    zonesRoot.style.display = zonesVisible ? '' : 'none'
  }

  // ── accrochage + calibration (mêmes dispositifs que le gabarit du cs) ───────

  function refresh(): void {
    const active = containerNode !== null && !destroyed
    if (!active) {
      editorRoot.style.display = 'none'
      return
    }

    const containerPose = captureOverlayPose(containerNode!)
    const m = containerPose.matrix
    editorRoot.style.display = ''
    editorRoot.style.width = `${containerPose.localWidth}px`
    editorRoot.style.height = `${containerPose.localHeight}px`
    editorRoot.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, 0, 0)`
    renderAll()
    calibrateGhostToWorldSnapshot(editorRoot, containerPose.rect)
  }

  const unsubscribeContainer = options.authorApi.subscribeToNode(options.containerId, (node) => {
    if (destroyed) return
    const appeared = node !== null && containerNode === null
    const disappeared = node === null && containerNode !== null
    containerNode = node instanceof HTMLElement ? node : null
    if (appeared) actor.send({ type: 'NODE_APPEARED' })
    if (disappeared) actor.send({ type: 'NODE_DISAPPEARED' })
    refresh()
  })

  refresh()

  // ── géométrie de pistes du conteneur (repli uniforme si non mesurable, jsdom) ─

  function containerTrackGeometry(): GridTrackGeometry | null {
    if (containerNode === null) return null
    const measured = measureGridTracks(containerNode)
    if (measured !== null) return measured
    // Same fallback discipline as the cs's own gridDragActive path (jsdom never resolves
    // gridTemplateColumns/Rows to px, so gestures still need SOME geometry to react against in
    // tests) — and the SAME helper, `uniformTrackGeometry`, rather than a hand-rolled equivalent
    // (found duplicated during the consolidation audit, 2026-07-10: the earlier version ignored
    // `state.grid.gap` entirely, always returning 0, unlike the cs's own repli which reads real
    // gaps via `gridGapsPx()`).
    const pose = captureOverlayPose(containerNode)
    if (pose.localWidth <= 0 || pose.localHeight <= 0) return null
    return uniformTrackGeometry({
      rows: state.grid.rows,
      cols: state.grid.cols,
      localWidth: pose.localWidth,
      localHeight: pose.localHeight,
      columnGap: state.grid.gap?.col ?? 0,
      rowGap: state.grid.gap?.row ?? 0
    })
  }

  /**
   * Container-local coordinates of one viewport point (affine) — same formula as the cs's own
   * helper (`selection-frame.ts`), via the full matrix rather than `scaleX`/`scaleY` alone.
   * Corrected during the consolidation audit (2026-07-10): the earlier version, scaling by axis
   * alone, was explicitly self-documented as covering only the non-rotated case — a rotated
   * container (a legitimate zone-editor use case, same as the cs's own containers) would have
   * resolved the wrong cell under the pointer.
   */
  function viewportToContainerLocal(x: number, y: number): { x: number; y: number } | null {
    if (containerNode === null) return null
    const containerPose = captureOverlayPose(containerNode)
    const containerOrigin = localFractionToViewportPoint(containerPose, 0, 0)
    return worldDeltaToLocalDelta(containerPose.matrix, x - containerOrigin.x, y - containerOrigin.y)
  }

  // ── geste : tracer une zone (drag sur le fond de grille, même pattern que le tracé grid du cs) ─

  type TraceSession = {
    tracks: GridTrackGeometry
    startCell: { row: number; col: number }
    currentArea: { row: number; col: number; rowSpan: number; colSpan: number } | null
    previewNode: HTMLElement
  }

  const traceGesture = bindGestureSession<TraceSession>(gridBackground, {
    onStart: (event) => {
      if (isSuspended() || event.target !== gridBackground) return null
      const tracks = containerTrackGeometry()
      if (tracks === null) return null
      const local = viewportToContainerLocal(event.clientX, event.clientY)
      if (local === null) return null

      actor.send({ type: 'TRACE_START' })
      if (!actor.getSnapshot().matches({ active: 'tracing' })) return null
      event.preventDefault()

      const startCell = cellAtLocalPoint(local, tracks)

      const previewNode = doc.createElement('div')
      previewNode.setAttribute('data-zone-editor-trace-preview', '')
      previewNode.style.position = 'absolute'
      previewNode.style.border = '2px dashed rgba(74, 144, 217, 0.9)'
      previewNode.style.background = 'rgba(74, 144, 217, 0.15)'
      previewNode.style.boxSizing = 'border-box'
      // Purely visual — must never intercept pointer events.
      previewNode.style.pointerEvents = 'none'
      positionZoneNode(previewNode, { row: startCell.row, col: startCell.col, rowSpan: 1, colSpan: 1 })
      zonesRoot.appendChild(previewNode)

      return { tracks, startCell, currentArea: { row: startCell.row, col: startCell.col, rowSpan: 1, colSpan: 1 }, previewNode }
    },
    onMove: (event, session) => {
      const local = viewportToContainerLocal(event.clientX, event.clientY)
      if (local === null) return
      const currentCell = cellAtLocalPoint(local, session.tracks)
      const area = {
        row: Math.min(session.startCell.row, currentCell.row),
        col: Math.min(session.startCell.col, currentCell.col),
        rowSpan: Math.abs(currentCell.row - session.startCell.row) + 1,
        colSpan: Math.abs(currentCell.col - session.startCell.col) + 1
      }
      session.currentArea = area
      positionZoneNode(session.previewNode, area)
    },
    onEnd: (session, apply) => {
      session.previewNode.remove()
      if (!apply || session.currentArea === null) {
        actor.send({ type: 'TRACE_ABORT' })
        return
      }
      actor.send({ type: 'TRACE_END' })
      const next = zoneModel.addZone(state, session.currentArea)
      const name = next.zones.at(-1)!.name
      applyState(next)
      actor.send({ type: 'ZONE_ADDED', name })
      applySelection([name])
    }
  })

  // ── geste : sélectionner (clic / Shift+clic multi-sélection) + déplacer ─────

  type MoveSession = {
    zoneName: string
    tracks: GridTrackGeometry
    startArea: { row: number; col: number; rowSpan: number; colSpan: number }
    grabRowOffset: number
    grabColOffset: number
    currentArea: { row: number; col: number; rowSpan: number; colSpan: number }
    /**
     * Every OTHER selected zone's own starting geometry — dragging one zone that's part of a
     * multi-selection moves the whole group by the same delta (plan's own multi-selection intent,
     * mirrors the cs's own `createMultiSelectionFrame`: one drag broadcasts the same diff to every
     * selected target). Empty when `zoneName` isn't part of a multi-selection, or is the only
     * member of it — a plain single-zone move.
     */
    otherSelectedStartAreas: Map<string, { row: number; col: number; rowSpan: number; colSpan: number }>
    moved: boolean
  }

  /** Every zone (in `state.zones` order) whose own footprint contains this row/col — zones may overlap by design. */
  function zonesContainingCell(cell: { row: number; col: number }): ZoneDef[] {
    return state.zones.filter(
      (z) => cell.row >= z.row && cell.row < z.row + z.rowSpan && cell.col >= z.col && cell.col < z.col + z.colSpan
    )
  }

  /**
   * Alt+click / Alt+Shift+click (plan-adjacent request, 2026-07-10): cycle through OVERLAPPING
   * zones at this exact point — a click alone only ever resolves to the topmost zone node
   * (normal DOM hit-testing), so reaching a zone stacked underneath needs an explicit way in.
   * `topmostName` is the zone the click actually landed on (always the topmost — that's what DOM
   * hit-testing resolves regardless of which repeated Alt+click this is). The cycle itself
   * advances from whichever CANDIDATE is currently selected (so a second Alt+click continues
   * where the first left off), falling back to the topmost when none of the candidates is
   * selected yet (the very first Alt+click at this point). Cycle order is `state.zones`'s own
   * array order among every zone containing this cell, wrapping around. `additive:false` (Alt)
   * replaces the selection with just the next zone; `additive:true` (Alt+Shift) adds it to the
   * current selection without touching what's already selected.
   */
  function cycleOverlappingZoneSelection(cell: { row: number; col: number }, topmostName: string, additive: boolean): void {
    const candidates = zonesContainingCell(cell)
    if (candidates.length === 0) return
    const currentlySelectedIndex = candidates.findIndex((z) => selectedNames.includes(z.name))
    const currentIndex = currentlySelectedIndex !== -1 ? currentlySelectedIndex : candidates.findIndex((z) => z.name === topmostName)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % candidates.length
    const nextName = candidates[nextIndex]!.name
    applySelection(additive ? [...selectedNames.filter((n) => n !== nextName), nextName] : [nextName])
  }

  function bindZoneSelectAndMove(zoneNode: HTMLElement, zoneName: string): void {
    bindGestureSession<MoveSession>(zoneNode, {
      onStart: (event) => {
        if (isSuspended()) return null
        // A handle sits on top of the zone node too (pointer-events:auto) —
        // its own gesture session handles resize; this session must not also
        // start a move for the same pointerdown.
        if (event.target !== zoneNode) return null

        if (event.altKey) {
          // Same machine guard as every other gesture start: a cycle must not fire while another
          // gesture is already in flight elsewhere on this editor (capture held on a different
          // node) — `isSuspended()` alone (checked above) only screens out suspended/idle, not
          // tracing/resizing/moving. Found missing during a systematic pass over this file's own
          // machine guards, 2026-07-10.
          if (!actor.getSnapshot().matches({ active: 'still' })) return null
          const tracksForCycle = containerTrackGeometry()
          const localForCycle = tracksForCycle !== null ? viewportToContainerLocal(event.clientX, event.clientY) : null
          if (tracksForCycle !== null && localForCycle !== null) {
            cycleOverlappingZoneSelection(cellAtLocalPoint(localForCycle, tracksForCycle), zoneName, event.shiftKey)
          }
          event.preventDefault()
          event.stopPropagation()
          return null
        }

        const zone = state.zones.find((z) => z.name === zoneName)
        const tracks = containerTrackGeometry()
        if (zone === undefined || tracks === null) return null

        const local = viewportToContainerLocal(event.clientX, event.clientY)
        if (local === null) return null
        const cell = cellAtLocalPoint(local, tracks)

        actor.send({ type: 'MOVE_START' })
        if (!actor.getSnapshot().matches({ active: 'moving' })) return null
        event.preventDefault()

        const otherSelectedStartAreas = new Map<string, { row: number; col: number; rowSpan: number; colSpan: number }>()
        if (selectedNames.includes(zoneName)) {
          for (const otherName of selectedNames) {
            if (otherName === zoneName) continue
            const otherZone = state.zones.find((z) => z.name === otherName)
            if (otherZone !== undefined) {
              otherSelectedStartAreas.set(otherName, { row: otherZone.row, col: otherZone.col, rowSpan: otherZone.rowSpan, colSpan: otherZone.colSpan })
            }
          }
        }

        return {
          zoneName,
          tracks,
          startArea: { row: zone.row, col: zone.col, rowSpan: zone.rowSpan, colSpan: zone.colSpan },
          grabRowOffset: Math.max(0, Math.min(zone.rowSpan - 1, cell.row - zone.row)),
          grabColOffset: Math.max(0, Math.min(zone.colSpan - 1, cell.col - zone.col)),
          currentArea: { row: zone.row, col: zone.col, rowSpan: zone.rowSpan, colSpan: zone.colSpan },
          otherSelectedStartAreas,
          moved: false
        }
      },
      onMove: (event, session) => {
        const local = viewportToContainerLocal(event.clientX, event.clientY)
        if (local === null) return
        const cell = cellAtLocalPoint(local, session.tracks)
        const row = Math.min(Math.max(cell.row - session.grabRowOffset, 1), state.grid.rows - session.startArea.rowSpan + 1)
        const col = Math.min(Math.max(cell.col - session.grabColOffset, 1), state.grid.cols - session.startArea.colSpan + 1)
        if (row === session.currentArea.row && col === session.currentArea.col) return
        session.moved = true
        session.currentArea = { ...session.startArea, row, col }
        const node = zoneNodes.get(session.zoneName)
        // Real layout write on every move — same discipline as the resize gesture
        // (bindResizeHandle's own onMove): apply the exact resolved geometry directly, no
        // separate CSS preview mechanism. `gesture-session.ts`'s own `lostpointercapture`
        // handling always applies the gesture at its last-known point now (never guesses an
        // abort), so a relayout on the capturing node itself is no longer the risk it once was.
        if (node !== undefined) positionZoneNode(node, session.currentArea)

        // Broadcast the SAME delta to every other selected zone — clamped individually (each
        // zone keeps its own spans and its own grid-edge limits, exactly like the primary zone).
        const deltaRow = row - session.startArea.row
        const deltaCol = col - session.startArea.col
        for (const [otherName, otherStart] of session.otherSelectedStartAreas) {
          const otherRow = Math.min(Math.max(otherStart.row + deltaRow, 1), state.grid.rows - otherStart.rowSpan + 1)
          const otherCol = Math.min(Math.max(otherStart.col + deltaCol, 1), state.grid.cols - otherStart.colSpan + 1)
          const otherNode = zoneNodes.get(otherName)
          if (otherNode !== undefined) positionZoneNode(otherNode, { ...otherStart, row: otherRow, col: otherCol })
        }
      },
      onEnd: (session, apply, event) => {
        actor.send({ type: 'MOVE_END' })
        if (!apply || !session.moved) {
          // A click without a drag is a SELECTION, not a no-op move — mirrors
          // the plan's own "sélectionner : clic sur une zone ; Shift+clic pour
          // la multi-sélection".
          if (apply && event !== null) {
            const next = event.shiftKey
              ? selectedNames.includes(session.zoneName)
                ? selectedNames.filter((n) => n !== session.zoneName)
                : [...selectedNames, session.zoneName]
              : [session.zoneName]
            applySelection(next)
          } else {
            // Abort: restore every dragged node (the primary zone AND every other selected zone
            // moved alongside it) to its own pre-drag placement.
            const node = zoneNodes.get(session.zoneName)
            if (node !== undefined) positionZoneNode(node, session.startArea)
            for (const [otherName, otherStart] of session.otherSelectedStartAreas) {
              const otherNode = zoneNodes.get(otherName)
              if (otherNode !== undefined) positionZoneNode(otherNode, otherStart)
            }
          }
          return
        }
        const deltaRow = session.currentArea.row - session.startArea.row
        const deltaCol = session.currentArea.col - session.startArea.col
        const nextZones = state.zones.map((z) => {
          if (z.name === session.zoneName) return { ...z, ...session.currentArea }
          const otherStart = session.otherSelectedStartAreas.get(z.name)
          if (otherStart === undefined) return z
          const row = Math.min(Math.max(otherStart.row + deltaRow, 1), state.grid.rows - otherStart.rowSpan + 1)
          const col = Math.min(Math.max(otherStart.col + deltaCol, 1), state.grid.cols - otherStart.colSpan + 1)
          return { ...z, row, col }
        })
        applyState({ ...state, zones: nextZones })
        if (!selectedNames.includes(session.zoneName)) applySelection([session.zoneName])
      }
    })
  }

  // ── geste : redimensionner (poignées, même contrat que applyCellArea du cs) ─

  type ResizeSession = {
    zoneName: string
    tracks: GridTrackGeometry
    handleId: HandleId
    startArea: { row: number; col: number; rowSpan: number; colSpan: number }
    /** Set on the first `onMove`; a resize ended without ever moving has nothing to apply. */
    lastArea: { row: number; col: number; rowSpan: number; colSpan: number } | null
  }

  function resolveResizedArea(
    handleId: HandleId,
    startArea: { row: number; col: number; rowSpan: number; colSpan: number },
    pointerCell: { row: number; col: number },
    gridRows: number,
    gridCols: number
  ): { row: number; col: number; rowSpan: number; colSpan: number } {
    const startRowEnd = startArea.row + startArea.rowSpan - 1
    const startColEnd = startArea.col + startArea.colSpan - 1

    const movesNorth = handleId === 'nw' || handleId === 'n' || handleId === 'ne'
    const movesSouth = handleId === 'sw' || handleId === 's' || handleId === 'se'
    const movesWest = handleId === 'nw' || handleId === 'w' || handleId === 'sw'
    const movesEast = handleId === 'ne' || handleId === 'e' || handleId === 'se'

    const row = movesNorth ? Math.min(pointerCell.row, startRowEnd) : startArea.row
    const rowEnd = movesSouth ? Math.max(pointerCell.row, startArea.row) : startRowEnd
    const col = movesWest ? Math.min(pointerCell.col, startColEnd) : startArea.col
    const colEnd = movesEast ? Math.max(pointerCell.col, startArea.col) : startColEnd

    const clampedRow = Math.max(1, row)
    const clampedCol = Math.max(1, col)
    const clampedRowEnd = Math.min(gridRows, rowEnd)
    const clampedColEnd = Math.min(gridCols, colEnd)

    return {
      row: clampedRow,
      col: clampedCol,
      rowSpan: Math.max(1, clampedRowEnd - clampedRow + 1),
      colSpan: Math.max(1, clampedColEnd - clampedCol + 1)
    }
  }

  function bindResizeHandle(handleNode: HTMLElement, handleId: HandleId, zoneName: string): void {
    bindGestureSession<ResizeSession>(handleNode, {
      onStart: (event) => {
        if (isSuspended()) return null
        const zone = state.zones.find((z) => z.name === zoneName)
        const tracks = containerTrackGeometry()
        if (zone === undefined || tracks === null) return null

        actor.send({ type: 'RESIZE_START' })
        if (!actor.getSnapshot().matches({ active: 'resizing' })) return null
        event.preventDefault()
        event.stopPropagation()

        return { zoneName, tracks, handleId, startArea: { row: zone.row, col: zone.col, rowSpan: zone.rowSpan, colSpan: zone.colSpan }, lastArea: null }
      },
      onMove: (event, session) => {
        const local = viewportToContainerLocal(event.clientX, event.clientY)
        if (local === null) return
        const pointerCell = cellAtLocalPoint(local, session.tracks)
        const area = resolveResizedArea(session.handleId, session.startArea, pointerCell, state.grid.rows, state.grid.cols)
        const node = zoneNodes.get(session.zoneName)
        // Real layout write on every move — same discipline as the cs's own positionCs() during
        // its resize gesture (selection-frame.ts): pointer capture lives on `handleNode`
        // (bindGestureSession is bound to it, never to the zone node), so a layout write on the
        // zone node here doesn't touch the node that actually holds capture. No CSS scale()
        // preview — resolveResizedArea already computes the exact final geometry per move,
        // exactly like the cs's own grid resize path (applyCellArea) does.
        if (node !== undefined) positionZoneNode(node, area)
        session.lastArea = area
      },
      onEnd: (session, apply) => {
        actor.send({ type: 'RESIZE_END' })
        const lastArea = session.lastArea
        if (!apply || lastArea === null) {
          const node = zoneNodes.get(session.zoneName)
          if (node !== undefined) positionZoneNode(node, session.startArea)
          return
        }
        const nextZones = state.zones.map((z) => (z.name === session.zoneName ? { ...z, ...lastArea } : z))
        applyState({ ...state, zones: nextZones })
      }
    })
  }

  return {
    destroy(): void {
      if (destroyed) return
      destroyed = true
      unsubscribeContainer()
      traceGesture.unbind()
      actor.stop()
      editorRoot.remove()
    },

    sync(): void {
      if (destroyed) return
      refresh()
    },

    setState(next: ZoneEditorState): void {
      selectedNames = selectedNames.filter((name) => next.zones.some((z) => z.name === name))
      applyState(next)
      actor.send({ type: 'STATE_REPLACED' })
    },

    setGrid(grid: ZoneGridModel): void {
      applyState({ ...state, grid })
    },

    addZone(area, name): string {
      const next = zoneModel.addZone(state, area, name)
      const createdName = next.zones.at(-1)!.name
      applyState(next)
      actor.send({ type: 'ZONE_ADDED', name: createdName })
      return createdName
    },

    removeZone(name: string): void {
      applyState(zoneModel.removeZone(state, name))
      actor.send({ type: 'ZONE_REMOVED', name })
      if (selectedNames.includes(name)) applySelection(selectedNames.filter((n) => n !== name))
    },

    renameZone(name: string, next: string): void {
      applyState(zoneModel.renameZone(state, name, next))
      if (selectedNames.includes(name)) applySelection(selectedNames.map((n) => (n === name ? next : n)))
    },

    getSplitOptions(name: string): { rows: number[]; cols: number[] } {
      return zoneModel.getSplitOptions(state, name)
    },

    splitZone(name, div): string[] {
      const { state: next, createdNames } = zoneModel.splitZone(state, name, div)
      applyState(next)
      for (const created of createdNames) actor.send({ type: 'ZONE_ADDED', name: created })
      actor.send({ type: 'ZONE_REMOVED', name })
      if (selectedNames.includes(name)) applySelection(createdNames)
      return createdNames
    },

    mergeZones(names, name): string {
      const { state: next, mergedName } = zoneModel.mergeZones(state, names, name)
      applyState(next)
      for (const removed of names) if (removed !== mergedName) actor.send({ type: 'ZONE_REMOVED', name: removed })
      actor.send({ type: 'ZONE_ADDED', name: mergedName })
      applySelection([mergedName])
      return mergedName
    },

    select(names: string[]): void {
      applySelection(names)
    },

    getState(): ZoneEditorState {
      return state
    },

    setPartVisibility(part: 'grid' | 'zones', visible: boolean): void {
      if (part === 'grid') gridVisible = visible
      else zonesVisible = visible
      actor.send({ type: 'VISIBILITY_CHANGED', part, visible })
      gridBackground.style.display = gridVisible ? '' : 'none'
      zonesRoot.style.display = zonesVisible ? '' : 'none'
    },

    isCellPlacementAvailable(): boolean {
      if (containerNode === null) return true
      const tracks = measureGridTracks(containerNode)
      if (tracks === null) return true
      const cellWidth = (tracks.cols[0] ?? 0) - tracks.columnGap
      const cellHeight = (tracks.rows[0] ?? 0) - tracks.rowGap
      return cellWidth >= minCellSizePx && cellHeight >= minCellSizePx
    }
  }
}
