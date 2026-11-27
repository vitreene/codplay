import type { ComponentActionOccurrence } from '../../components'

/**
 * Identifies one replace occurrence independently of its position in the
 * perso action list, which loses older actions when a tween stops or a
 * sequence step is superseded. Same rule as move occurrences.
 */
export function createReplaceOccurrenceKey(occurrence: ComponentActionOccurrence): string {
  return `${occurrence.eventId ?? occurrence.name}:${occurrence.startAt}:${occurrence.declarationPath?.join('.') ?? ''}`
}
