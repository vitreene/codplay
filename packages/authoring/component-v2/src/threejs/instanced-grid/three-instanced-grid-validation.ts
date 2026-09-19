import type { ValidationFunction } from 'codplay'
import { isComponentRecord, reportInvalidComponentValue } from 'codplay/runtime/components/component-validation'
import { validateThreeNumber } from '../core/threejs-validation'

/** Validates one instanced-grid initial or action payload. */
export const validateThreeInstancedGrid: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_THREE_GRID_INVALID', 'Three.js instanced grid state must be a plain object.')
    return
  }
  for (const property of [
    'gridSize',
    'cellSize',
    'expansion',
    'delayMaxMs',
    'durationMs',
    'holdMs',
    'rotationPeriodMs',
    'rotationXPeriodMs',
    'opacity',
  ]) validateThreeNumber(value, property, context)
  if (value.animate !== undefined && typeof value.animate !== 'boolean') {
    reportInvalidComponentValue(context, 'AUTHOR_THREE_GRID_ANIMATE_INVALID', 'animate must be a boolean.', 'animate')
  }
}

/** Adds explicit defaults for the specialized procedural grid. */
export function sanitizeThreeInstancedGridInitial(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return {
    ...value,
    gridSize: value.gridSize ?? 4,
    cellSize: value.cellSize ?? 0.5,
    expansion: value.expansion ?? 4,
    delayMaxMs: value.delayMaxMs ?? 500,
    durationMs: value.durationMs ?? 2_000,
    holdMs: value.holdMs ?? 500,
    rotationPeriodMs: value.rotationPeriodMs ?? 9_000,
    rotationXPeriodMs: value.rotationXPeriodMs ?? 12_000,
    opacity: value.opacity ?? 0.35,
  }
}
