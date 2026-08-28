import type { LoopOptions, LoopStopCondition } from './helper-types'

/**
 * Normalizes one loop stop condition bag into one list.
 */
export function normalizeLoopStopConditions(until: LoopOptions['until']): LoopStopCondition[] {
  return Array.isArray(until) ? until : [until]
}

/**
 * Returns true when one loop depends on one future event stop.
 */
export function hasEventLoopStop(options: LoopOptions): boolean {
  return normalizeLoopStopConditions(options.until).some((condition) => condition.type === 'event')
}

/**
 * Resolves the finite occurrence count for one plannable loop.
 */
export function resolvePlannableLoopTimes(options: LoopOptions): number | null {
  const stopConditions = normalizeLoopStopConditions(options.until)
  if (stopConditions.some((condition) => condition.type === 'event')) {
    return null
  }

  const counts = stopConditions.map((condition) => {
    if (condition.type === 'times') {
      return condition.max
    }

    if (condition.type === 'duration') {
      return Math.floor(condition.maxMs / options.eachMs) + 1
    }

    return 0
  })

  if (counts.length === 0) {
    return null
  }

  return Math.min(...counts)
}
