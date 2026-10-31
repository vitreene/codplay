import { parseEase } from 'ace'

export type MotionEasing = string | Readonly<{
  kind: 'cubic-bezier'
  p1x: number
  p1y: number
  p2x: number
  p2y: number
}>

/** Converts the editor transition names to the ACE easing vocabulary used by the scene builder. */
export function normalizeMotionEasing(easing: MotionEasing): string {
  if (typeof easing !== 'string') {
    return `cubic-bezier(${easing.p1x},${easing.p1y},${easing.p2x},${easing.p2y})`
  }
  return {
    linear: 'linear',
    'ease-in': 'in',
    'ease-out': 'out',
    'ease-in-out': 'inOut',
  }[easing] ?? easing
}

/** Applies the scene builder's easing curve to one normalized timeline progress. */
export function resolveMotionEaseProgress(easing: MotionEasing, progress: number): number {
  return parseEase(normalizeMotionEasing(easing))(progress)
}
