import { isPlainRecord } from '../../../shared'
import type { CompiledEventime, CompiledFunctionCollection, CompiledRecord } from '../../../scene/compiled'
import type { CompiledListenRule } from '../../../scene/compiled'
import { executeStrapsSequentially, type StrapCollection, type StrapExecutionResult } from './strap-executor'

/** Event input consumed by one story-level listen pipeline. */
export type ListenEventInput = Readonly<{
  eventId: string
  eventSeq?: number
  name: string
  applyAtMs: number
  trackId: string
  storyId?: string
  data?: CompiledRecord
  /** Sends this event to scene-level rules and all story materializations. */
  cascade?: boolean
  /** Opaque event context preserved across the runtime pipeline. */
  context?: Readonly<Record<string, unknown>>
  /** Opaque runtime metadata preserved across the runtime pipeline. */
  meta?: Readonly<Record<string, unknown>>
  /** Named visibility retained when the event is observed outside the scene. */
  visibility?: CompiledEventime['visibility']
}>

/** Event emitted by a listen rule after transforms and declaration filtering. */
export type ListenEventOutput = Readonly<ListenEventInput>

/** One event descriptor returned by a V1-compatible listen transform. */
export type ListenTransformEvent = Readonly<{
  name: string
  data?: CompiledRecord
  visibility?: CompiledEventime['visibility']
}>

/** Result accepted from one listen transform, preserving ordered fan-out. */
export type ListenTransformResult = readonly ListenTransformEvent[] | undefined

/** One non-fatal issue found while resolving a listen rule. */
export type ListenPipelineIssue = Readonly<{
  code: string
  message: string
  ruleName?: string
  functionRef?: string
}>

/** Output of the synchronous listen/transform/emit stage. */
export type ListenPipelineResult = Readonly<{
  events: readonly ListenEventOutput[]
  pendingStraps: readonly string[]
  issues: readonly ListenPipelineIssue[]
}>

/** Input for the ordered asynchronous listen pipeline. */
export type ListenPipelineExecutionInput = Readonly<{
  rules: readonly CompiledListenRule[]
  event: ListenEventInput
  functions?: CompiledFunctionCollection
  straps?: StrapCollection
  state?: Readonly<Record<string, unknown>>
  meta?: Readonly<Record<string, unknown>>
  context?: Readonly<Record<string, unknown>>
}>

/** One strap result associated with a listen rule execution. */
export type ListenStrapExecution = Readonly<{
  ruleName: string
  strapNames: readonly string[]
  result: StrapExecutionResult
}>

/** Output of transform -> straps -> emit execution. */
export type ListenPipelineExecutionResult = Readonly<{
  events: readonly ListenEventOutput[]
  straps: readonly ListenStrapExecution[]
  issues: readonly ListenPipelineIssue[]
}>

/** Applies exact-name listen rules, transforms, and declared emissions. */
export function propagateListenEvent(
  rules: readonly CompiledListenRule[],
  input: ListenEventInput,
  functions: CompiledFunctionCollection = {},
): ListenPipelineResult {
  if (rules.length === 0) return { events: [input], pendingStraps: [], issues: [] }

  const events: ListenEventOutput[] = []
  const pendingStraps: string[] = []
  const issues: ListenPipelineIssue[] = []
  let matched = false

  for (const rule of rules) {
    if (rule.on !== input.name) continue
    matched = true
    const transformed = evaluateListenTransforms(rule, input, functions)
    events.push(...transformed.events)
    issues.push(...transformed.issues)
    pendingStraps.push(...(rule.straps ?? []))
    if (rule.emit === undefined && rule.transform === undefined) {
      events.push({ ...input, data: input.data })
    }
    events.push(...createDeclaredEvents(rule, input))
  }

  return {
    events: matched ? events : [],
    pendingStraps,
    issues,
  }
}

/** Executes one listen pipeline while keeping emit after sequential strap completion. */
export async function executeListenPipeline(
  input: ListenPipelineExecutionInput,
): Promise<ListenPipelineExecutionResult> {
  if (input.rules.length === 0) return { events: [input.event], straps: [], issues: [] }

  const events: ListenEventOutput[] = []
  const straps: ListenStrapExecution[] = []
  const issues: ListenPipelineIssue[] = []
  let matched = false

  for (const rule of input.rules) {
    if (rule.on !== input.event.name) continue
    matched = true
    const transformed = evaluateListenTransforms(rule, input.event, input.functions ?? {})
    issues.push(...transformed.issues)
    const strapNames = rule.straps ?? []
    if (strapNames.length === 0) {
      straps.push({
        ruleName: rule.on,
        strapNames: [],
        result: { events: [], updates: [], planned: [], warnings: [], issues: [] },
      })
    } else {
      for (const strapName of strapNames) {
        const strapResult = await executeStrapsSequentially(
          [strapName],
          input.straps ?? {},
          {
            event: {
              name: input.event.name,
              data: input.event.data,
              eventId: input.event.eventId,
              eventSeq: input.event.eventSeq,
              applyAtMs: input.event.applyAtMs,
              cascade: input.event.cascade,
            },
            state: input.state ?? {},
            meta: input.meta ?? {},
            context: input.context,
          },
        )
        straps.push({ ruleName: rule.on, strapNames: [strapName], result: strapResult })
      }
    }

    events.push(...transformed.events)
    events.push(...createDeclaredEvents(rule, input.event))
  }

  return { events: matched ? events : [], straps, issues }
}

/** Evaluates every transform against the source event and preserves fan-out order. */
function evaluateListenTransforms(
  rule: CompiledListenRule,
  input: ListenEventInput,
  functions: CompiledFunctionCollection,
): { events: readonly ListenEventOutput[]; issues: readonly ListenPipelineIssue[] } {
  const events: ListenEventOutput[] = []
  const issues: ListenPipelineIssue[] = []

  for (const transform of rule.transform ?? []) {
    const fn = functions[transform.ref]
    if (fn === undefined) {
      issues.push({
        code: 'RUNTIME_LISTEN_FUNCTION_MISSING',
        message: `Listen transform function is not available: ${transform.ref}`,
        ruleName: rule.on,
        functionRef: transform.ref,
      })
      continue
    }

    let transformed: unknown
    try {
      transformed = fn({ ...input })
    } catch (error) {
      issues.push({
        code: 'RUNTIME_LISTEN_TRANSFORM_FAILED',
        message: error instanceof Error ? error.message : `Listen transform failed: ${transform.ref}`,
        ruleName: rule.on,
        functionRef: transform.ref,
      })
      continue
    }

    if (transformed === undefined) continue
    if (!Array.isArray(transformed)) {
      issues.push({
        code: 'RUNTIME_LISTEN_TRANSFORM_INVALID',
        message: `Listen transform must return an array of events or undefined: ${transform.ref}`,
        ruleName: rule.on,
        functionRef: transform.ref,
      })
      continue
    }

    for (let index = 0; index < transformed.length; index += 1) {
      const candidate = transformed[index]
      if (!isPlainRecord(candidate) || typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
        issues.push({
          code: 'RUNTIME_LISTEN_TRANSFORM_EVENT_INVALID',
          message: `Listen transform event at index ${index} must contain a non-empty name: ${transform.ref}`,
          ruleName: rule.on,
          functionRef: transform.ref,
        })
        continue
      }
      if (candidate.data !== undefined && !isPlainRecord(candidate.data)) {
        issues.push({
          code: 'RUNTIME_LISTEN_TRANSFORM_EVENT_INVALID',
          message: `Listen transform event data at index ${index} must be a record: ${transform.ref}`,
          ruleName: rule.on,
          functionRef: transform.ref,
        })
        continue
      }
      events.push({
        ...input,
        name: candidate.name,
        data: candidate.data as CompiledRecord | undefined,
        visibility: isEventVisibility(candidate.visibility) ? candidate.visibility : input.visibility,
      })
    }
  }

  return { events, issues }
}

/** Creates declared listen emissions after transforms and straps, using source data by default. */
function createDeclaredEvents(
  rule: CompiledListenRule,
  input: ListenEventInput,
): readonly ListenEventOutput[] {
  return (rule.emit ?? []).map((emission) => ({
    ...input,
    name: typeof emission.name === 'string' ? emission.name : input.name,
    data: isPlainRecord(emission.data) ? emission.data as CompiledRecord : input.data,
    cascade: typeof emission.cascade === 'boolean' ? emission.cascade : input.cascade,
    visibility: isEventVisibility(emission.visibility) ? emission.visibility : input.visibility,
  }))
}

/** Checks the named V2 event visibility carried by a listen emission. */
function isEventVisibility(value: unknown): value is CompiledEventime['visibility'] {
  return value === 'story' || value === 'scene' || value === 'public'
}
