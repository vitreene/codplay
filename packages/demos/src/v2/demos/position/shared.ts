import { prepareSvgPath, type Path } from 'ace'
import type { CompiledRecord } from 'codplay'
import { POSITION_MOVE_DURATION_MS } from './constants'
import type { PositionPoint } from './types'

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

/** Formats one path number without locale-dependent or unnecessary precision. */
function formatPathNumber(value: number): string {
  return Number(value.toFixed(4)).toString()
}

/** Computes the circumcircle through three points in the canonical path frame. */
function circumcircle(
  source: PositionPoint,
  control: PositionPoint,
  target: PositionPoint,
): Readonly<{ center: PositionPoint; radius: number }> | undefined {
  const determinant = 2 * (
    source.x * (control.y - target.y)
    + control.x * (target.y - source.y)
    + target.x * (source.y - control.y)
  )
  if (Math.abs(determinant) <= 1e-8) return undefined

  const sourceSquared = source.x * source.x + source.y * source.y
  const controlSquared = control.x * control.x + control.y * control.y
  const targetSquared = target.x * target.x + target.y * target.y
  const center = {
    x: (
      sourceSquared * (control.y - target.y)
      + controlSquared * (target.y - source.y)
      + targetSquared * (source.y - control.y)
    ) / determinant,
    y: (
      sourceSquared * (target.x - control.x)
      + controlSquared * (source.x - target.x)
      + targetSquared * (control.x - source.x)
    ) / determinant,
  }
  return {
    center,
    radius: Math.hypot(center.x - source.x, center.y - source.y),
  }
}

/** Builds a normalized circular arc from a captured control point. */
export function createCircularArcPath(controlX: number, controlY: number): string {
  const source = { x: 0, y: 0 }
  const control = { x: controlX, y: controlY }
  const target = { x: 1, y: 0 }
  const circle = circumcircle(source, control, target)
  if (circle === undefined || !Number.isFinite(circle.radius)) return 'M 0 0 L 1 0'

  // Keep the minor arc on the side of the captured control point.
  const sweep = control.y > 0 ? 0 : 1
  return `M 0 0 A ${formatPathNumber(circle.radius)} ${formatPathNumber(circle.radius)} 0 0 ${sweep} 1 0`
}

/** Prepares one scene path for transport through an event payload. */
export function preparePositionPath(controlX: number, controlY: number): Path {
  return prepareSvgPath(createCircularArcPath(controlX, controlY), {
    precision: 2,
  })
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
): CompiledRecord {
  if (path === undefined) {
    return {
      move: {
        target,
        ...(presentation === 'overlay' ? { flipMode: 'overlay-world' } : {}),
        transition: {
          duration: POSITION_MOVE_DURATION_MS,
          ease: 'inOutCubic',
        },
      },
    }
  }

  return {
    move: {
      target,
      ...(presentation === 'overlay' ? { flipMode: 'overlay-world' } : {}),
      transition: {
        duration: POSITION_MOVE_DURATION_MS,
        ease: 'inOutCubic',
        path: typeof path === 'string' ? prepareAuthoredPositionPath(path) : path,
        ...(presentation === 'local' ? { pathAnchor: 'center' } : {}),
      },
    },
  }
}
