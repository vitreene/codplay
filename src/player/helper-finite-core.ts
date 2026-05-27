import type { DeepReadonly, HelperTickContext } from './helper-types'

type ResolveHelperState = () => DeepReadonly<Record<string, unknown>>

type ResolveHelperItems<TInput, TItem> = (input: TInput, context: HelperTickContext) => TItem[]

export type PlannedHelperItem<TItem> = {
  offsetMs: number
  item: TItem
  itemIndex: number
  context: HelperTickContext
}

/**
 * Builds one helper callback context from timing data and a state resolver.
 */
export function buildHelperTickContext(input: {
  currentTimeMs: number
  startedAtMs: number
  index: number
  resolveState: ResolveHelperState
}): HelperTickContext {
  return {
    currentTimeMs: input.currentTimeMs,
    startedAtMs: input.startedAtMs,
    elapsedMs: Math.max(0, input.currentTimeMs - input.startedAtMs),
    index: input.index,
    state: input.resolveState()
  }
}

/**
 * Resolves one helper input at one occurrence offset.
 */
export function resolveHelperItemsAtOffset<TInput, TItem>(input: {
  offsetMs: number
  startedAtMs: number
  index: number
  helperInput: TInput
  resolveState: ResolveHelperState
  resolveItems: ResolveHelperItems<TInput, TItem>
}): PlannedHelperItem<TItem>[] {
  const context = buildHelperTickContext({
    currentTimeMs: input.startedAtMs + input.offsetMs,
    startedAtMs: input.startedAtMs,
    index: input.index,
    resolveState: input.resolveState
  })

  return input.resolveItems(input.helperInput, context).map((item, itemIndex) => ({
    offsetMs: input.offsetMs + itemIndex,
    item,
    itemIndex,
    context
  }))
}

/**
 * Resolves one wait/delay helper into planned occurrences.
 */
export function planWaitItems<TInput, TItem>(input: {
  ms: number
  startedAtMs: number
  helperInput: TInput
  resolveState: ResolveHelperState
  resolveItems: ResolveHelperItems<TInput, TItem>
}): PlannedHelperItem<TItem>[] {
  return resolveHelperItemsAtOffset({
    offsetMs: input.ms,
    startedAtMs: input.startedAtMs,
    index: 0,
    helperInput: input.helperInput,
    resolveState: input.resolveState,
    resolveItems: input.resolveItems
  })
}

/**
 * Resolves one repeat helper into planned occurrences.
 */
export function planRepeatItems<TInput, TItem>(input: {
  eachMs: number
  times: number
  startedAtMs: number
  helperInput: TInput
  resolveState: ResolveHelperState
  resolveItems: ResolveHelperItems<TInput, TItem>
}): PlannedHelperItem<TItem>[] {
  const occurrences: PlannedHelperItem<TItem>[] = []

  for (let index = 0; index < input.times; index += 1) {
    occurrences.push(
      ...resolveHelperItemsAtOffset({
        offsetMs: index * input.eachMs,
        startedAtMs: input.startedAtMs,
        index,
        helperInput: input.helperInput,
        resolveState: input.resolveState,
        resolveItems: input.resolveItems
      })
    )
  }

  return occurrences
}

/**
 * Resolves one stagger helper into planned item offsets.
 */
export function planStaggerItems<TItem>(input: { stepMs: number; items: TItem[] }): Array<{ offsetMs: number; item: TItem }> {
  return input.items.map((item, index) => ({
    offsetMs: index * input.stepMs,
    item
  }))
}

/**
 * Returns true when one helper delay value is valid.
 */
export function isValidHelperDelayMs(ms: number): boolean {
  return Number.isFinite(ms) && ms >= 0
}

/**
 * Returns true when one helper repeat option bag is valid.
 */
export function isValidHelperRepeatOptions(options: { everyMs: number; times: number }): boolean {
  return Number.isFinite(options.everyMs) && options.everyMs > 0 && Number.isInteger(options.times) && options.times >= 1
}

/**
 * Returns true when one helper stagger option bag is valid.
 */
export function isValidHelperStaggerOptions(options: { stepMs: number }): boolean {
  return Number.isFinite(options.stepMs) && options.stepMs >= 0
}
