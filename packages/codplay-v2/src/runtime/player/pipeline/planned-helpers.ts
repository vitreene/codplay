import type { PlannedStrapOccurrence, StrapStep } from './strap-executor'

/** Context passed to a finite planned step factory. */
export type PlannedStepContext = Readonly<{
  index: number
  elapsedMs: number
  currentTimeMs: number
  startedAtMs: number
}>

/** Direct or computed strap step accepted by planned helpers. */
export type PlannedStepInput = StrapStep | readonly StrapStep[] | ((context: PlannedStepContext) => StrapStep | readonly StrapStep[] | void)

/** Finite helpers exposed to V2 straps through `context.planned`. */
export type PlannedStrapHelpers = Readonly<{
  wait: (offsetMs: number, input: PlannedStepInput) => readonly PlannedStrapOccurrence[]
  delay: (offsetMs: number, input: PlannedStepInput) => readonly PlannedStrapOccurrence[]
  repeat: (options: Readonly<{ eachMs: number; times: number }>, input: PlannedStepInput) => readonly PlannedStrapOccurrence[]
  loop: (options: Readonly<{ eachMs: number; times?: number; durationMs?: number }>, input: PlannedStepInput) => readonly PlannedStrapOccurrence[]
  stagger: (options: Readonly<{ stepMs: number; count?: number }>, input: PlannedStepInput) => readonly PlannedStrapOccurrence[]
  sequence: (steps: readonly Readonly<{ step: StrapStep; durationMs?: number; startAt?: number }>[]) => readonly PlannedStrapOccurrence[]
}>

/** Creates the finite planned helper surface without any runtime scheduler. */
export function createPlannedStrapHelpers(): PlannedStrapHelpers {
  return {
    wait: (offsetMs, input) => createAtOffset(offsetMs, input, 0),
    delay: (offsetMs, input) => createAtOffset(offsetMs, input, 0),
    repeat: (options, input) => {
      assertNonNegativeOffset(options.eachMs, 'repeat eachMs')
      assertCount(options.times)
      return Array.from({ length: options.times }, (_, index) => createAtOffset(options.eachMs * index, input, index)).flat()
    },
    loop: (options, input) => {
      assertPositiveInterval(options.eachMs, 'loop eachMs')
      const hasTimes = options.times !== undefined
      const hasDuration = options.durationMs !== undefined
      if (hasTimes === hasDuration) throw new Error('planned loop requires exactly one finite bound.')
      const count = hasTimes
        ? validateCount(options.times as number)
        : Math.floor(validateDuration(options.durationMs as number) / options.eachMs) + 1
      return Array.from({ length: count }, (_, index) => createAtOffset(options.eachMs * index, input, index)).flat()
    },
    stagger: (options, input) => {
      assertNonNegativeOffset(options.stepMs, 'stagger stepMs')
      const count = options.count ?? (Array.isArray(input) ? input.length : 1)
      assertCount(count)
      return Array.from({ length: count }, (_, index) => {
        const item = Array.isArray(input) ? input[index] : input
        return item === undefined ? [] : createAtOffset(options.stepMs * index, item, index)
      }).flat()
    },
    sequence: (steps) => {
      let cursorMs = 0
      const occurrences: PlannedStrapOccurrence[] = []
      for (const entry of steps) {
        const offsetMs = entry.startAt ?? cursorMs
        assertNonNegativeOffset(offsetMs, 'sequence startAt')
        occurrences.push({ offsetMs, step: entry.step })
        cursorMs = offsetMs + (entry.durationMs ?? 0)
      }
      return occurrences
    },
  }
}

/** Resolves one direct or factory input at one finite offset. */
function createAtOffset(offsetMs: number, input: PlannedStepInput, index: number): readonly PlannedStrapOccurrence[] {
  assertNonNegativeOffset(offsetMs, 'planned offsetMs')
  const resolved = typeof input === 'function'
    ? input({ index, elapsedMs: offsetMs, currentTimeMs: offsetMs, startedAtMs: 0 })
    : input
  if (resolved === undefined) return []
  const steps = Array.isArray(resolved) ? resolved : [resolved]
  return steps.map((step) => ({ offsetMs, step }))
}

/** Validates one planned non-negative offset. */
function assertNonNegativeOffset(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative.`)
}

/** Validates one finite non-negative occurrence count. */
function assertCount(value: number): void {
  if (!Number.isInteger(value) || value < 0) throw new Error('planned count must be a finite non-negative integer.')
}

/** Validates one positive loop interval. */
function assertPositiveInterval(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be finite and positive.`)
}

/** Validates and returns one finite non-negative occurrence count. */
function validateCount(value: number): number {
  assertCount(value)
  return value
}

/** Validates and returns one finite non-negative loop duration. */
function validateDuration(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('loop durationMs must be finite and non-negative.')
  return value
}
