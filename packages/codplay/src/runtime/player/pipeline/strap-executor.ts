import type { CompiledRecord } from '../../../scene/compiled'
import { createPlannedStrapHelpers, type PlannedStrapHelpers } from './planned-helpers'

/** Event emitted by a strap and eligible for track materialization. */
export type StrapEvent = Readonly<{
  name: string
  data?: CompiledRecord
  eventId?: string
  eventSeq?: number
  applyAtMs?: number
  cascade?: boolean
  visibility?: 'story' | 'scene' | 'public'
}>

/** One immediate or planned strap step. */
export type StrapStep = Readonly<{
  event?: StrapEvent
  update?: CompiledRecord
}>

/** One planned strap occurrence relative to the triggering event. */
export type PlannedStrapOccurrence = Readonly<{
  offsetMs: number
  step: StrapStep
}>

/** Immediate strap output that can later be written to the runtime journal. */
export type StrapRuntimeOutput = Readonly<{
  events?: readonly StrapEvent[]
  warnings?: readonly string[]
  update?: CompiledRecord
}>

/** Read-only input given to one stateless strap function. */
export type StrapExecutionInput = Readonly<{
  strapName: string
  event: StrapEvent
  state: Readonly<Record<string, unknown>>
  meta: Readonly<Record<string, unknown>>
  context: Readonly<Record<string, unknown>> & { planned: PlannedStrapHelpers }
}>

/** Strap output may contain nested arrays of immediate or planned chunks. */
export type StrapReturnValue = StrapRuntimeOutput | readonly PlannedStrapOccurrence[] | readonly StrapReturnValue[] | void

/** Injected stateless strap implementation. */
export type StrapFunction = (input: StrapExecutionInput) => Promise<StrapReturnValue> | StrapReturnValue

/** Collection of named straps available to one execution scope. */
export type StrapCollection = Readonly<Record<string, StrapFunction>>

/** One non-fatal issue collected while executing a strap chain. */
export type StrapExecutionIssue = Readonly<{
  code: string
  message: string
  strapName: string
}>

/** Flattened output of one sequential strap execution. */
export type StrapExecutionResult = Readonly<{
  events: readonly StrapEvent[]
  updates: readonly CompiledRecord[]
  planned: readonly PlannedStrapOccurrence[]
  warnings: readonly string[]
  issues: readonly StrapExecutionIssue[]
}>

/** Executes named straps sequentially and flattens their nested return values. */
export async function executeStrapsSequentially(
  names: readonly string[],
  collection: StrapCollection,
  input: Omit<StrapExecutionInput, 'strapName' | 'context'> & { context?: Readonly<Record<string, unknown>> },
): Promise<StrapExecutionResult> {
  const events: StrapEvent[] = []
  const updates: CompiledRecord[] = []
  const planned: PlannedStrapOccurrence[] = []
  const warnings: string[] = []
  const issues: StrapExecutionIssue[] = []
  const context = { ...(input.context ?? {}), planned: createPlannedStrapHelpers() }

  for (const strapName of names) {
    const strap = collection[strapName]
    if (strap === undefined) {
      issues.push({
        code: 'RUNTIME_STRAP_MISSING',
        message: `Strap is not available: ${strapName}`,
        strapName,
      })
      continue
    }

    try {
      const result = await strap({ ...input, context, strapName })
      collectStrapValue(result, events, updates, planned, warnings)
    } catch (error) {
      issues.push({
        code: 'RUNTIME_STRAP_FAILED',
        message: error instanceof Error ? error.message : `Strap failed: ${strapName}`,
        strapName,
      })
    }
  }

  return { events, updates, planned, warnings, issues }
}

/** Recursively flattens one strap return value while preserving declaration order. */
function collectStrapValue(
  value: StrapReturnValue,
  events: StrapEvent[],
  updates: CompiledRecord[],
  planned: PlannedStrapOccurrence[],
  warnings: string[],
): void {
  if (value === undefined) return
  if (Array.isArray(value)) {
    for (const item of value) collectStrapValue(item as StrapReturnValue, events, updates, planned, warnings)
    return
  }
  const chunk = value as StrapRuntimeOutput | PlannedStrapOccurrence
  if (isPlannedOccurrence(chunk)) {
    planned.push(chunk)
    return
  }
  if (Array.isArray(chunk.events)) events.push(...chunk.events)
  if (chunk.update !== undefined) updates.push(chunk.update)
  if (Array.isArray(chunk.warnings)) warnings.push(...chunk.warnings)
}

/** Identifies one planned occurrence before treating a record as immediate output. */
function isPlannedOccurrence(value: StrapRuntimeOutput | PlannedStrapOccurrence): value is PlannedStrapOccurrence {
  return typeof value === 'object'
    && value !== null
    && 'offsetMs' in value
    && typeof value.offsetMs === 'number'
    && 'step' in value
}
