/**
 * Linear interpolation between two values.
 * progress is expected in [0, 1].
 */
export function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}
