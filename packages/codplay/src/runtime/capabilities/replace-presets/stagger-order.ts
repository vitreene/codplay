import type { ReplaceStaggerPattern } from '../../components/component-surface-types'
import type { ReplaceDirection } from './replace-preset-config'

type ReplaceStaggerGridInput = Readonly<{
  cols: number
  rows: number
  totalStaggerMs: number
  staggerPattern?: ReplaceStaggerPattern
  direction?: ReplaceDirection
}>

export type ReplaceStaggerTiming = Readonly<{
  delays: number[]
  totalDurationMs: number
}>

/** Computes one total-envelope delay per item using its selected propagation order. */
export function computeReplaceStaggerDelays(input: ReplaceStaggerGridInput): number[] {
  const { cols, rows, totalStaggerMs, staggerPattern, direction } = input
  const count = cols * rows
  if (count === 0) return []
  switch (staggerPattern) {
    case 'row-wave':
      return computeSequentialDelays(cols, rows, totalStaggerMs, 'row-wave')
    case 'column-wave':
      return computeSequentialDelays(cols, rows, totalStaggerMs, 'column-wave')
    case 'manhattan':
    case undefined:
      break
  }

  const middleColumn = (cols - 1) / 2
  const middleRow = (rows - 1) / 2
  const origin = resolveOrigin(direction, cols, rows, middleColumn, middleRow)
  const distances: number[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      distances.push(Math.abs(col - origin.col) + Math.abs(row - origin.row))
    }
  }

  const maximum = getMaximum(distances)
  const orderedDistances = direction === 'edges'
    ? distances.map((distance) => maximum - distance)
    : distances
  const finalMaximum = getMaximum(orderedDistances)
  return orderedDistances.map((distance) => (
    finalMaximum === 0 ? 0 : Math.round((distance / finalMaximum) * totalStaggerMs)
  ))
}

/** Computes one sequential row- or column-wave across the row-major grid data. */
function computeSequentialDelays(
  cols: number,
  rows: number,
  totalStaggerMs: number,
  pattern: 'row-wave' | 'column-wave',
): number[] {
  const count = cols * rows
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / cols)
    const column = index % cols
    const sequenceIndex = pattern === 'row-wave' ? index : column * rows + row
    return count === 1 ? 0 : Math.round((sequenceIndex / (count - 1)) * totalStaggerMs)
  })
}

/** Computes a grid's per-item delays and the matching end duration together. */
export function computeReplaceStaggerTiming(input: ReplaceStaggerGridInput & Readonly<{
  durationMs: number
}>): ReplaceStaggerTiming {
  const delays = computeReplaceStaggerDelays(input)
  const latestDelay = getMaximum(delays)
  return {
    delays,
    totalDurationMs: input.durationMs + latestDelay,
  }
}

/** Returns the greatest non-negative delay or distance without spreading an array. */
function getMaximum(values: readonly number[]): number {
  return values.reduce((maximum, value) => Math.max(maximum, value), 0)
}

/** Resolves the origin coordinate shared by V1's Manhattan propagation order. */
function resolveOrigin(
  direction: ReplaceDirection | undefined,
  cols: number,
  rows: number,
  middleColumn: number,
  middleRow: number,
): Readonly<{ col: number; row: number }> {
  switch (direction) {
    case 'left': return { col: 0, row: middleRow }
    case 'right': return { col: cols - 1, row: middleRow }
    case 'top': return { col: middleColumn, row: 0 }
    case 'bottom': return { col: middleColumn, row: rows - 1 }
    case 'left-top': return { col: 0, row: 0 }
    case 'right-top': return { col: cols - 1, row: 0 }
    case 'left-bottom': return { col: 0, row: rows - 1 }
    case 'right-bottom': return { col: cols - 1, row: rows - 1 }
    case 'center':
    case 'edges':
    default: return { col: middleColumn, row: middleRow }
  }
}
