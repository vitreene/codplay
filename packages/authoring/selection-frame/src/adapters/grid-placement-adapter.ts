import type { AutoCapsuleChildPlacementInput, AutoCapsuleGridArtifact } from '@codplay/capsule-automation'
import type { CsRawMoveDiff, CsRawSizeDiff, CsValueAdapter } from '../types'

export type GridPlacementAdapterOptions = {
  /** Grid structure of the parent container — source of truth: capsule-automation. */
  grid: AutoCapsuleGridArtifact
  /** Container content box in the same pixel space as the cs deltas. */
  getContainerSize: () => { width: number; height: number }
  /** Gap sizes in pixels, when known by the editor. */
  gaps?: { column: number; row: number }
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
 * (AutoCapsuleChildPlacementInput). Accumulates sub-cell movement so slow
 * drags still cross cell boundaries; emits only when the placement changes.
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

  const cellSize = (): { width: number; height: number } => {
    const container = options.getContainerSize()
    const columnGap = options.gaps?.column ?? 0
    const rowGap = options.gaps?.row ?? 0
    return {
      width: Math.max(1e-3, (container.width - columnGap * (cols - 1)) / cols),
      height: Math.max(1e-3, (container.height - rowGap * (rows - 1)) / rows)
    }
  }

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
      const cell = cellSize()
      const colOffset = Math.round(accumulatedX / (cell.width + (options.gaps?.column ?? 0)))
      const rowOffset = Math.round(accumulatedY / (cell.height + (options.gaps?.row ?? 0)))
      if (colOffset === 0 && rowOffset === 0) return

      accumulatedX -= colOffset * (cell.width + (options.gaps?.column ?? 0))
      accumulatedY -= rowOffset * (cell.height + (options.gaps?.row ?? 0))

      emitIfChanged({
        ...placement,
        row: clamp(placement.row + rowOffset, 1, rows - placement.rowSpan + 1),
        col: clamp(placement.col + colOffset, 1, cols - placement.colSpan + 1)
      })
    },

    applyResize(raw: CsRawSizeDiff): void {
      // Continuous emission sends small increments: accumulate them (like
      // applyMove) — rounding each increment alone would never cross a cell.
      accumulatedW += raw.dw
      accumulatedH += raw.dh
      const cell = cellSize()
      const strideX = cell.width + (options.gaps?.column ?? 0)
      const strideY = cell.height + (options.gaps?.row ?? 0)
      const colSpanOffset = Math.round(accumulatedW / strideX)
      const rowSpanOffset = Math.round(accumulatedH / strideY)
      if (colSpanOffset === 0 && rowSpanOffset === 0) return

      accumulatedW -= colSpanOffset * strideX
      accumulatedH -= rowSpanOffset * strideY

      emitIfChanged({
        ...placement,
        colSpan: clamp(placement.colSpan + colSpanOffset, 1, cols - placement.col + 1),
        rowSpan: clamp(placement.rowSpan + rowSpanOffset, 1, rows - placement.row + 1)
      })
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

    applyRotate(): void {
      // Rotation carries no meaning for grid placement.
    },

    applyScale(): void {
      // Scale carries no meaning for grid placement; spans go through applyResize.
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
