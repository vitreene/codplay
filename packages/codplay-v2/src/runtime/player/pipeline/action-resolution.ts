import { isPlainRecord } from '../../../shared'
import type { CompiledRecord, CompiledValue } from '../../../scene/compiled'
import { isActionSequence, type CompiledActionSequenceStep } from './action-sequence'

/** Action value selected from the immutable compiled action table. */
export type RuntimeActionDefinition = CompiledRecord | readonly CompiledActionSequenceStep[] | null

/** Resolves the authored action and applies the event payload with V1 shallow policy. */
export function resolveActionDefinition(
  actionValue: CompiledValue | undefined,
  eventData: CompiledRecord | undefined,
): RuntimeActionDefinition {
  if (isActionSequence(actionValue)) return actionValue
  if (isPlainRecord(actionValue)) {
    return eventData === undefined ? actionValue : { ...actionValue, ...eventData }
  }
  if ((actionValue === null || actionValue === true) && eventData !== undefined) return eventData
  return null
}
