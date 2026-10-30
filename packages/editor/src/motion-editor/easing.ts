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
  if (typeof easing !== 'string') {
    const sample = (value: number, start: number, end: number): number => {
      const inverse = 1 - value
      return 3 * inverse * inverse * value * start + 3 * inverse * value * value * end + value * value * value
    }
    const input = Math.min(1, Math.max(0, progress))
    let low = 0
    let high = 1
    for (let iteration = 0; iteration < 32; iteration += 1) {
      const parameter = (low + high) / 2
      if (sample(parameter, easing.p1x, easing.p2x) < input) low = parameter
      else high = parameter
    }
    return sample((low + high) / 2, easing.p1y, easing.p2y)
  }
  return parseEase(normalizeMotionEasing(easing))(progress)
}
