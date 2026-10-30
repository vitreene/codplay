import type { SlotReplace } from '../../components/slot'
import type { SlotReplaceProfile } from '../../components'
import {
  isReplaceMaskShape,
  isReplaceStaggerPattern,
  isReplaceSlotTransition,
} from '../replace-presets'
import {
  isFiniteNonNegativeNumber,
  isFinitePositiveNumber,
  isPlainRecord,
  isPositiveInteger,
  isReplaceDirection,
} from '../replace-presets/replace-value-validation'

/** Parses one authored slot profile while preserving only its explicit fields. */
export function parseSlotReplaceProfile(value: unknown): SlotReplace | undefined {
  if (typeof value === 'string') {
    return isReplaceSlotTransition(value) ? value : undefined
  }
  if (!isPlainRecord(value) || !isReplaceSlotTransition(value.transition)) return undefined

  const duration = value.duration
  if (duration !== undefined && !isFiniteNonNegativeNumber(duration)) return undefined

  const split = value.split
  if (split !== undefined && !isSlotReplaceSplit(split)) return undefined

  const shape = value.shape
  if (shape !== undefined
    && ((value.transition !== 'mask-reveal' && split !== 'cells') || !isReplaceMaskShape(shape))) return undefined

  const stagger = value.stagger
  if (stagger !== undefined && !isFiniteNonNegativeNumber(stagger)) return undefined

  const direction = value.direction
  if (direction !== undefined && !isReplaceDirection(direction)) return undefined

  const staggerPattern = value.staggerPattern
  if (staggerPattern !== undefined
    && (split !== 'cells'
      || !isReplaceStaggerPattern(staggerPattern)
      || (staggerPattern !== 'manhattan' && direction !== undefined))) return undefined

  const cellX = value.cellX
  if (cellX !== undefined && !isPositiveInteger(cellX)) return undefined

  const cellY = value.cellY
  if (cellY !== undefined && !isPositiveInteger(cellY)) return undefined

  const cellSize = value.cellSize
  if (cellSize !== undefined && (split !== 'cells' || !isFinitePositiveNumber(cellSize))) return undefined

  const hasGridSettings = [stagger, direction, staggerPattern, cellX, cellY, cellSize]
    .some((setting) => setting !== undefined)
  if (hasGridSettings && split !== 'cells') return undefined

  return {
    transition: value.transition,
    ...(duration === undefined ? {} : { duration }),
    ...(shape === undefined ? {} : { shape }),
    ...(split === undefined ? {} : { split }),
    ...(stagger === undefined ? {} : { stagger }),
    ...(staggerPattern === undefined ? {} : { staggerPattern }),
    ...(direction === undefined ? {} : { direction }),
    ...(cellX === undefined ? {} : { cellX }),
    ...(cellY === undefined ? {} : { cellY }),
    ...(cellSize === undefined ? {} : { cellSize }),
  }
}

/** Checks the accepted legacy split names and shared mask-grid mode. */
function isSlotReplaceSplit(value: unknown): value is NonNullable<SlotReplaceProfile['split']> {
  return value === 'letter' || value === 'word' || value === 'line' || value === 'cells'
}

