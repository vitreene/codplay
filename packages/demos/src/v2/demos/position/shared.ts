import { preparePath, prepareSvgPath, type Path } from 'ace'
import type { CompiledRecord } from 'codplay'
import { POSITION_MOVE_DURATION_MS } from './constants'

/** Returns a finite numeric value or the supplied fallback. */
export function readFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Reads one plain record from an unknown event or state value. */
export function readRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as Readonly<Record<string, unknown>>
}

/** Restricts a number to one closed interval. */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** Keeps a captured displacement in the pixel unit used by pointer samples. */
export function createPixelPositionStyle(x: number, y: number): Record<string, string> {
  return {
    x: `${Number(x.toFixed(2))}px`,
    y: `${Number(y.toFixed(2))}px`,
  }
}

/** Prepares one quadratic trajectory with a single normalized control point. */
export function prepareQuadraticPositionPath(controlX: number, controlY: number): Path {
  return preparePath({ control: [controlX, controlY] }, { traversal: 'arc-length' })
}

/** Prepares an authored SVG path for transport through a runtime move event. */
export function prepareAuthoredPositionPath(path: string): Path {
  return prepareSvgPath(path, {
    precision: 2,
  })
}

/** Creates the complete move payload shared by all item reparentings. */
export function createPositionMoveData(
  target: string,
  path?: string | Path,
  presentation: 'local' | 'overlay' = 'local',
  ease: string = 'inOutCubic',
): CompiledRecord {
  if (path === undefined) {
    return {
      move: {
        target,
        ...(presentation === 'overlay' ? { reparent: true } : {}),
        transition: {
          duration: POSITION_MOVE_DURATION_MS,
          ease,
        },
      },
    }
  }

  return {
    move: {
      target,
      ...(presentation === 'overlay' ? { reparent: true } : {}),
      transition: {
        duration: POSITION_MOVE_DURATION_MS,
        ease,
        path: typeof path === 'string' ? prepareAuthoredPositionPath(path) : path,
      },
    },
  }
}
