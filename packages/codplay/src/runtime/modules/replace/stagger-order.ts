import type { ReplaceDirection } from './normalize-replace'

/**
 * Resolves the origin (col, row) for one direction in a grid of cols × rows.
 * For 1D text, rows = 1 and row is always 0.
 */
function resolveOrigin(
  direction: ReplaceDirection | undefined,
  cols: number,
  rows: number
): { col: number; row: number } {
  const midCol = (cols - 1) / 2
  const midRow = (rows - 1) / 2

  switch (direction) {
    case 'left':       return { col: 0,      row: midRow }
    case 'right':      return { col: cols - 1, row: midRow }
    case 'top':        return { col: midCol,  row: 0 }
    case 'bottom':     return { col: midCol,  row: rows - 1 }
    case 'left-top':   return { col: 0,       row: 0 }
    case 'right-top':  return { col: cols - 1, row: 0 }
    case 'left-bottom': return { col: 0,      row: rows - 1 }
    case 'right-bottom': return { col: cols - 1, row: rows - 1 }
    case 'center':
    case 'edges':
    default:           return { col: midCol,  row: midRow }
  }
}

/**
 * Computes a stagger delay (ms) for each element in a 2D grid using Manhattan distance.
 * For 1D sequences (text), pass cols = count and rows = 1, indexing as (i, 0).
 *
 * direction "edges" inverts the order: elements farthest from center animate first.
 */
export function computeStaggerDelays(input: {
  cols: number
  rows: number
  totalStaggerMs: number
  direction?: ReplaceDirection
}): number[] {
  const { cols, rows, totalStaggerMs, direction } = input
  const count = cols * rows
  if (count === 0) return []

  const origin = resolveOrigin(direction, cols, rows)
  const distances: number[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      distances.push(Math.abs(col - origin.col) + Math.abs(row - origin.row))
    }
  }

  const maxDistance = Math.max(...distances, 0)

  const finalDistances = direction === 'edges'
    ? distances.map((d) => maxDistance - d)
    : distances

  const maxFinal = Math.max(...finalDistances, 0)

  return finalDistances.map((d) =>
    maxFinal === 0 ? 0 : Math.round((d / maxFinal) * totalStaggerMs)
  )
}
