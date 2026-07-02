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

export type SelectionFrameOptions = {
  /** Editor item id (= persoId in the player). */
  itemId: string
  /** Author-mode access surface to the player (v1-author-api-spec). */
  authorApi: AuthorApi
  /** Scene mount container — reference for the overlay layer. */
  sceneRoot: Element
  /** Transposition of raw deltas into CSS mutations. */
  adapter: CsValueAdapter
  /** persoId of the parent container (capsule) — resolved via subscribeToNode. */
  containerId?: string
  /** Below this rendered size the cs auto-hides. */
  minSizePx?: number
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
}
