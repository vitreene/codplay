import type { AutoCapsuleGridArtifact } from '@codplay/capsule-automation'
import type { AuthorApi } from './author-api'

/**
 * Raw move delta emitted by the cs, in local element space, rounded to whole pixels.
 * The cs never decides the target CSS property — see CsValueAdapter.
 */
export type CsRawMoveDiff = { dx: number; dy: number }

/**
 * Raw size delta emitted by the cs, in local element space, rounded to whole pixels.
 */
export type CsRawSizeDiff = { dw: number; dh: number }

/**
 * Raw rotation delta emitted by the cs, in whole degrees (incremental).
 * The rotation origin (pivot placed via the needle) travels with each diff,
 * as fractions of the element box (0..1); no separate pivot channel exists.
 */
export type CsRawRotateDiff = {
  dr: number
  origin?: { fx: number; fy: number }
}

/**
 * Raw scale delta emitted by the cs, as multiplicative factors (1 = unchanged),
 * emitted with a 0.01 precision.
 */
export type CsRawScaleDiff = { fx: number; fy: number }

/**
 * Transposes raw cs deltas into editor-owned mutations (translate, top/left,
 * flex alignment, grid placement). Instantiated and swapped by the editor.
 * Adapters for which rotation/scale carry no meaning implement them as no-op.
 */
export interface CsValueAdapter {
  applyMove(raw: CsRawMoveDiff): void
  applyResize(raw: CsRawSizeDiff): void
  applyRotate(raw: CsRawRotateDiff): void
  applyScale(raw: CsRawScaleDiff): void
  /**
   * Grid context, drop contract: the element lands exactly where the author
   * saw it — the highlighted cell is the single source of truth. When the
   * adapter exposes this channel, the cs calls it at release with the last
   * highlighted cell instead of emitting a pixel delta.
   */
  applyCellDrop?(cell: { row: number; col: number }): void
  /**
   * Grid context, handle resize: one atomic cell footprint. North/west
   * handles move the origin (a span alone only extends down/right); the cs
   * emits the full area resolved against the measured tracks instead of
   * pixel deltas.
   */
  applyCellArea?(area: { row: number; col: number; rowSpan: number; colSpan: number }): void
}

export type CsCapability =
  | 'move'
  | 'rotate'
  | 'rotation-origin'
  | 'resize'
  | 'scale'
  | 'positioning'

export type CsHandleId = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'

/**
 * Editor-configurable behavior of one handle (or handle group). Defaults:
 * mode follows the active capabilities (resize when allowed, else scale),
 * swap allowed when both capabilities are active.
 */
export type HandleBehavior = {
  /** Fixed function assigned to the handle. */
  mode?: 'resize' | 'scale'
  /** Whether alt-click may toggle the handle between resize and scale. */
  allowSwap?: boolean
  /**
   * Corner ratio policy — configuration, never a context-specific branch:
   * 'locked' (default): w/h ratio maintained, Shift lifts it (free placement).
   * 'free': free gesture, Shift locks the ratio (grid context).
   */
  ratio?: 'locked' | 'free'
}

/**
 * Named set of active cs capabilities, applied by the editor per edit context.
 * Per-handle resolution: specific handle id > group ('corners'/'sides') > defaults.
 */
export type CapabilityPreset = {
  name: string
  capabilities: CsCapability[]
  handles?: Partial<Record<'corners' | 'sides' | CsHandleId, HandleBehavior>>
}

/**
 * Result of one create-mode trace, handed to the editor at release (or at
 * applyCreationGeometry). In grid context the cs snaps to measured tracks and
 * emits a cell area; in free context it emits a local pixel rect (rounded).
 */
export type CreationResult =
  | { kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
  | { kind: 'cell-area'; area: { row: number; col: number; rowSpan: number; colSpan: number } }

/**
 * Geometry supplied by the editor instead of a trace — the "card" notion is
 * an editor-owned catalog of pre-built geometries (e.g. title/body/footer);
 * the module only ever receives one resolved geometry, never the catalog.
 * Negative row/col/span values count from the grid's far edge (-1 = last
 * track / to the last track) — only the -1 case is exercised today.
 */
export type CreationGeometry =
  | { rect: { fx: number; fy: number; fw: number; fh: number } }
  | { cellArea: { row: number; col: number; rowSpan: number; colSpan: number } }

export type SelectionFrameCreationOptions = {
  /** Emitted once: at trace release, or at applyCreationGeometry. */
  onCreate: (result: CreationResult) => void
  /** Below this local-px size on both axes, a free-mode trace is discarded. */
  minTraceSizePx?: number
  /**
   * Explicit trace context, decided by the editor — never auto-derived from
   * the active preset. Unset (default): grid if a containerGrid is set on
   * the frame, libre otherwise (unchanged from the original behavior).
   * 'libre': forces a free-rect trace even inside a grid container (the
   * resulting rect is still in container-local px; placing it as a grid
   * child with a translate relative to the home cell is the editor's job).
   * 'grid': forces cell-area tracing; falls back to libre if no grid
   * context is actually available.
   */
  context?: 'grid' | 'libre'
}

export type SelectionFrameOptions = {
  /**
   * Editor item id (= persoId in the player). Required unless `creation` is
   * provided — in create mode the item doesn't exist yet and arrives later
   * through `handle.attachItem`.
   */
  itemId?: string
  /** Author-mode access surface to the player (v1-author-api-spec). */
  authorApi: AuthorApi
  /** Scene mount container — reference for the overlay layer. */
  sceneRoot: Element
  /** Transposition of raw deltas into CSS mutations. Required unless `creation` is provided. */
  adapter?: CsValueAdapter
  /** persoId of the parent container (capsule) — resolved via subscribeToNode. */
  containerId?: string
  /** Below this rendered size the cs auto-hides. */
  minSizePx?: number
  /**
   * Activates create mode: the cs is traced into existence instead of
   * attaching to an existing item. See docs/plans/2026-07-03-selection-frame-variantes-plan.md.
   */
  creation?: SelectionFrameCreationOptions
}

export type MultiSelectionFrameOptions = {
  items: Array<{ itemId: string; adapter: CsValueAdapter }>
  authorApi: AuthorApi
  sceneRoot: Element
  minSizePx?: number
}

export type SelectionFramePart = 'element' | 'cs'

export type SelectionFrameHandle = {
  destroy: () => void
  setPartVisibility: (part: SelectionFramePart, visible: boolean) => void
  setPartActive: (part: 'cs', active: boolean) => void
  sync: () => void
  setOperationEnabled: (op: string, enabled: boolean) => void
  applyPreset: (preset: CapabilityPreset) => void
  setAdapter: (adapter: CsValueAdapter) => void
  setContainerGrid: (grid: AutoCapsuleGridArtifact | null) => void
  /**
   * Create mode only: applies an editor-supplied geometry (a "card") instead
   * of tracing. Inert (no-op) outside create mode.
   */
  applyCreationGeometry: (geometry: CreationGeometry) => void
  /**
   * Create mode only: binds the traced/applied geometry to a real item and
   * switches the SAME cs to regular selection (subscribeToNode takes over).
   * Inert (no-op) outside create mode.
   */
  attachItem: (input: { itemId: string; adapter: CsValueAdapter }) => void
}
