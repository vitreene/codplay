import { isPlainRecord } from '../../../shared'
import type { CompiledFunctionCollection } from '../../../scene/compiled'
import type { CompiledListenRule, CompiledRecord } from '../../../scene/compiled'

/** Event input consumed by one story-level listen pipeline. */
export type ListenEventInput = Readonly<{
  eventId: string
  eventSeq?: number
  name: string
  applyAtMs: number
  trackId: string
  storyId: string
  data?: CompiledRecord
}>

/** Event emitted by a listen rule after transforms and declaration filtering. */
export type ListenEventOutput = Readonly<ListenEventInput>

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
    let data = input.data
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
      try {
        const transformed = fn({ ...input, data })
        if (transformed === undefined) {
          data = undefined
        } else if (isPlainRecord(transformed)) {
          data = transformed as CompiledRecord
        } else {
          issues.push({
            code: 'RUNTIME_LISTEN_TRANSFORM_INVALID',
            message: `Listen transform must return a record or undefined: ${transform.ref}`,
            ruleName: rule.on,
            functionRef: transform.ref,
          })
        }
      } catch (error) {
        issues.push({
          code: 'RUNTIME_LISTEN_TRANSFORM_FAILED',
          message: error instanceof Error ? error.message : `Listen transform failed: ${transform.ref}`,
          ruleName: rule.on,
          functionRef: transform.ref,
        })
      }
    }

    pendingStraps.push(...(rule.straps ?? []))
    if (rule.emit === undefined) {
      events.push({ ...input, data })
      continue
    }
    for (const emission of rule.emit) {
      events.push({
        ...input,
        name: typeof emission.name === 'string' ? emission.name : input.name,
        data: isPlainRecord(emission.data) ? emission.data as CompiledRecord : data,
      })
    }
  }

  return {
    events: matched ? events : [],
    pendingStraps,
    issues,
  }
}
