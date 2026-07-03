import type { AutoCapsuleChildPlacementInput, AutoCapsuleGridArtifact } from '@codplay/capsule-automation'
import type { GridTrackGeometry } from '../grid-geometry'
import { nearestTrackAnchor, nearestTrackSpan, trackAnchorPx, trackSpanPx } from '../grid-geometry'
import type { CsRawMoveDiff, CsRawSizeDiff, CsValueAdapter } from '../types'

export type GridPlacementAdapterOptions = {
  /** Grid structure of the parent container — source of truth: capsule-automation. */
  grid: AutoCapsuleGridArtifact
  /**
   * Measured track geometry of the real container (resolved px track sizes
   * and gaps) — no uniform-cell assumption; irregular tracks are supported.
   */
  getTrackGeometry: () => GridTrackGeometry
  /** Placement of the child before the gesture starts. */
  initialPlacement: { row: number; col: number; rowSpan?: number; colSpan?: number }
  /** Receives every placement change; the editor applies it to the child definition. */
  onPlacement: (placement: AutoCapsuleChildPlacementInput) => void
}

export type GridPlacementAdapter = CsValueAdapter & {
  /** Resets delta accumulation to the given placement (e.g. on gesture start). */
  resetTo: (placement: { row: number; col: number; rowSpan?: number; colSpan?: number }) => void
  getPlacement: () => Required<Pick<AutoCapsuleChildPlacementInput, 'row' | 'col' | 'rowSpan' | 'colSpan'>>
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Converts raw pixel deltas into grid cell placement
 * (AutoCapsuleChildPlacementInput). Accumulates sub-cell movement, then
 * resolves the NEAREST track (anchor for moves, extent for spans) against the
 * measured geometry — correct for irregular track sizes. Emits only when the
 * placement changes.
 */
export function createGridPlacementAdapter(options: GridPlacementAdapterOptions): GridPlacementAdapter {
  const { rows, cols } = options.grid.context
  let placement = {
    row: options.initialPlacement.row,
    col: options.initialPlacement.col,
    rowSpan: options.initialPlacement.rowSpan ?? 1,
    colSpan: options.initialPlacement.colSpan ?? 1
  }
  let accumulatedX = 0
  let accumulatedY = 0
  let accumulatedW = 0
  let accumulatedH = 0

  const emitIfChanged = (next: typeof placement): void => {
    if (
      next.row === placement.row &&
      next.col === placement.col &&
      next.rowSpan === placement.rowSpan &&
      next.colSpan === placement.colSpan
    ) {
      return
    }
    placement = next
    options.onPlacement({ ...next })
  }

  return {
    applyMove(raw: CsRawMoveDiff): void {
      accumulatedX += raw.dx
      accumulatedY += raw.dy
      const tracks = options.getTrackGeometry()

      const targetX = trackAnchorPx(tracks.cols, tracks.columnGap, placement.col) + accumulatedX
      const targetY = trackAnchorPx(tracks.rows, tracks.rowGap, placement.row) + accumulatedY
      const nextCol = nearestTrackAnchor(tracks.cols, tracks.columnGap, targetX, cols - placement.colSpan + 1)
      const nextRow = nearestTrackAnchor(tracks.rows, tracks.rowGap, targetY, rows - placement.rowSpan + 1)
      if (nextCol === placement.col && nextRow === placement.row) return

      accumulatedX -= trackAnchorPx(tracks.cols, tracks.columnGap, nextCol) - trackAnchorPx(tracks.cols, tracks.columnGap, placement.col)
      accumulatedY -= trackAnchorPx(tracks.rows, tracks.rowGap, nextRow) - trackAnchorPx(tracks.rows, tracks.rowGap, placement.row)

      emitIfChanged({ ...placement, row: nextRow, col: nextCol })
    },

    applyResize(raw: CsRawSizeDiff): void {
      // Continuous emission sends small increments: accumulate them, then
      // resolve the span whose measured extent is nearest to the target size.
      accumulatedW += raw.dw
      accumulatedH += raw.dh
      const tracks = options.getTrackGeometry()

      const targetW = trackSpanPx(tracks.cols, tracks.columnGap, placement.col, placement.colSpan) + accumulatedW
      const targetH = trackSpanPx(tracks.rows, tracks.rowGap, placement.row, placement.rowSpan) + accumulatedH
      const nextColSpan = nearestTrackSpan(tracks.cols, tracks.columnGap, placement.col, targetW)
      const nextRowSpan = nearestTrackSpan(tracks.rows, tracks.rowGap, placement.row, targetH)
      if (nextColSpan === placement.colSpan && nextRowSpan === placement.rowSpan) return

      accumulatedW -=
        trackSpanPx(tracks.cols, tracks.columnGap, placement.col, nextColSpan) -
        trackSpanPx(tracks.cols, tracks.columnGap, placement.col, placement.colSpan)
      accumulatedH -=
        trackSpanPx(tracks.rows, tracks.rowGap, placement.row, nextRowSpan) -
        trackSpanPx(tracks.rows, tracks.rowGap, placement.row, placement.rowSpan)

      emitIfChanged({ ...placement, colSpan: nextColSpan, rowSpan: nextRowSpan })
    },

    applyRotate(): void {
      // Rotation carries no meaning for grid placement.
    },

    applyScale(): void {
      // Scale carries no meaning for grid placement; spans go through applyResize.
    },

    applyCellDrop(cell: { row: number; col: number }): void {
      // Drop contract: land exactly on the previewed cell — no pixel math.
      accumulatedX = 0
      accumulatedY = 0
      emitIfChanged({
        ...placement,
        row: clamp(cell.row, 1, rows - placement.rowSpan + 1),
        col: clamp(cell.col, 1, cols - placement.colSpan + 1)
      })
    },

    applyCellArea(area: { row: number; col: number; rowSpan: number; colSpan: number }): void {
      // Atomic footprint from a handle gesture (north/west handles move the
      // origin) — resolved by the cs against the measured tracks, no pixel math.
      accumulatedX = 0
      accumulatedY = 0
      accumulatedW = 0
      accumulatedH = 0
      const rowSpan = clamp(area.rowSpan, 1, rows)
      const colSpan = clamp(area.colSpan, 1, cols)
      emitIfChanged({
        row: clamp(area.row, 1, rows - rowSpan + 1),
        col: clamp(area.col, 1, cols - colSpan + 1),
        rowSpan,
        colSpan
      })
    },

    resetTo(next): void {
      placement = {
        row: next.row,
        col: next.col,
        rowSpan: next.rowSpan ?? 1,
        colSpan: next.colSpan ?? 1
      }
      accumulatedX = 0
      accumulatedY = 0
      accumulatedW = 0
      accumulatedH = 0
    },

    getPlacement(): Required<Pick<AutoCapsuleChildPlacementInput, 'row' | 'col' | 'rowSpan' | 'colSpan'>> {
      return { ...placement }
    }
  }
}
