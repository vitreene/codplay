import type { EventInput, HelperTickContext, StoryEvent } from './helper-types'
import type { StrapStep, StrapStepInput } from './strap-types'

/**
 * Resolves one helper event input into one flat event list.
 */
export function resolveEventInput(input: EventInput, context: HelperTickContext): StoryEvent[] {
  const result = typeof input === 'function' ? input(context) : input
  if (result === undefined) {
    return []
  }

  return Array.isArray(result) ? result : [result]
}

/**
 * Resolves one helper strap-step input into one flat step list.
 */
export function resolveStrapStepInput(input: StrapStepInput, context: HelperTickContext): StrapStep[] {
  const result = typeof input === 'function' ? input(context) : input
  if (result === undefined) {
    return []
  }

  return Array.isArray(result) ? result : [result]
}
