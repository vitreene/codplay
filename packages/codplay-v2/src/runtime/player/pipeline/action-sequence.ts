import { isPlainRecord } from '../../../shared'
import type {
  CompiledFunctionReference,
  CompiledRecord,
  CompiledValue,
} from '../../../scene/compiled'

/** One compiled step in a perso-level ActionSequence. */
export type CompiledActionSequenceStep = Readonly<{
  action: CompiledRecord
  durationMs?: number
  startAt?: number
}>

/** One prepared sequence step with its absolute offset from the trigger. */
export type PlannedActionSequenceStep = Readonly<{
  offsetMs: number
  action: CompiledRecord
}>

/** Compiled TweenAction shape whose function is held in the build collection. */
export type CompiledTweenAction = CompiledRecord & Readonly<{
  duration: number
  fn: CompiledFunctionReference
  ease?: string
}>

/** Identifies a valid compiled ActionSequence without interpreting its actions. */
export function isActionSequence(value: CompiledValue | undefined): value is readonly CompiledActionSequenceStep[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every(isActionSequenceStep)
}

/** Identifies one valid sequence step. */
function isActionSequenceStep(value: CompiledValue): value is CompiledActionSequenceStep {
  if (!isPlainRecord(value)) return false
  const record = value as CompiledRecord
  if (!isPlainRecord(record.action)) return false
  return (record.durationMs === undefined || isNonNegativeFinite(record.durationMs))
    && (record.startAt === undefined || isNonNegativeFinite(record.startAt))
}

/** Identifies one compiled TweenAction backed by a function reference. */
export function isTweenAction(value: CompiledValue | undefined): value is CompiledTweenAction {
  if (!isPlainRecord(value)) return false
  const record = value as CompiledRecord
  return isPositiveFinite(record.duration) && isFunctionReference(record.fn)
}

/** Plans heterogeneous steps without reading runtime state or creating events. */
export function planActionSequenceSteps(
  steps: readonly CompiledActionSequenceStep[],
): readonly PlannedActionSequenceStep[] {
  const planned: PlannedActionSequenceStep[] = []
  let chainMs = 0
  for (const step of steps) {
    const offsetMs = step.startAt ?? chainMs
    planned.push({ offsetMs, action: step.action })
    const implicitDuration = isTweenAction(step.action) ? step.action.duration : 0
    chainMs = offsetMs + (step.durationMs ?? implicitDuration)
  }
  return planned
}

/** Checks a non-negative finite duration or offset. */
function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Checks a strictly positive finite TweenAction duration. */
function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Checks the serializable function-reference shape emitted by the builder. */
function isFunctionReference(value: unknown): value is CompiledFunctionReference {
  return isPlainRecord(value) && typeof value.ref === 'string' && value.ref.length > 0
}
