import {
  buildHelperTickContext,
  isValidHelperDelayMs,
  isValidHelperRepeatOptions,
  isValidHelperStaggerOptions,
  planStaggerItems,
  resolveHelperItemsAtOffset
} from './helper-finite-core'
import { hasEventLoopStop, normalizeLoopStopConditions, resolvePlannableLoopTimes } from './helper-loop-core'
import { TimeTicker, type TickerOptions } from '../core/time/ticker'
import { resolveEventInput } from './helper-input'
import { resolveHelperMode } from './helper-mode'
import type {
  DeepReadonly,
  EventInput,
  HelperHandle,
  HelperMode,
  HelperTickContext,
  LoopOptions,
  LoopStopCondition,
  RepeatOptions,
  StaggerOptions,
  StoryEvent,
  WaitOptions
} from './helper-types'
import { PLAYER_SCHEDULE_ERROR_CODE } from './schedule-constants'
import { createRuntimeEventPolicy, type ResolvedRuntimeEventPolicy, type RuntimeEventPolicy } from './runtime-policy'

export type {
  EventFactory,
  EventInput,
  EventResult,
  HelperHandle,
  HelperMode,
  HelperTickContext,
  LoopOptions,
  LoopStopCondition,
  RepeatOptions,
  StoryEvent,
  StaggerOptions,
  WaitOptions
} from './helper-types'

export type StrapHelpers = {
  wait: (ms: number, input: EventInput, options?: WaitOptions) => HelperHandle
  delay: (ms: number, input: EventInput, options?: WaitOptions) => HelperHandle
  repeat: (
    options: RepeatOptions,
    input: EventInput
  ) => HelperHandle
  loop: (options: LoopOptions, factory: (context: HelperTickContext) => StoryEvent[]) => HelperHandle
  stagger: (options: StaggerOptions, input: EventInput) => HelperHandle[]
}

type ScheduleJob = {
  id: string
  order: number
  dueAtMs: number
  kind: 'delay' | 'repeat' | 'loop'
  index: number
  cancelled: boolean
  startedAtMs: number
  everyMs?: number
  timesRemaining?: number
  input?: EventInput
  loopUntil?: LoopStopCondition[]
  factory?: (context: HelperTickContext) => StoryEvent[]
}

type ScheduledEmission = {
  job: ScheduleJob
  event: StoryEvent
  eventIndex: number
  dueAtMs: number
  order: number
}

type EmitEvent = (event: StoryEvent, context: HelperTickContext) => Promise<void>
type EmitWarning = (warning: string) => void

/**
 * Runs one deterministic helper scheduler for the public player facade.
 */
export class PlayerScheduleFacade implements StrapHelpers {
  private readonly ticker: TimeTicker
  private readonly emitEvent: EmitEvent
  private readonly emitWarning?: EmitWarning
  private readonly resolveState: () => DeepReadonly<Record<string, unknown>>
  private readonly onIdle?: () => void
  private readonly jobs = new Map<string, ScheduleJob>()
  private policy: ResolvedRuntimeEventPolicy

  private running = false
  private virtualNowMs = 0
  private _rate = 1
  private nextJobId = 1
  private nextJobOrder = 1

  /**
   * Configures one helper scheduler with one event emitter and one ticker.
   */
  constructor(options: {
    emitEvent: EmitEvent
    emitWarning?: EmitWarning
    resolveState?: () => DeepReadonly<Record<string, unknown>>
    onIdle?: () => void
    tickerOptions?: TickerOptions
    policy?: RuntimeEventPolicy
  }) {
    this.emitEvent = options.emitEvent
    this.emitWarning = options.emitWarning
    this.resolveState = options.resolveState ?? (() => ({}))
    this.onIdle = options.onIdle
    this.ticker = new TimeTicker(options.tickerOptions)
    this.policy = createRuntimeEventPolicy(options.policy)
  }

  /**
   * Updates the active runtime policy.
   */
  configurePolicy(policy: RuntimeEventPolicy): void {
    this.policy = createRuntimeEventPolicy(policy)
  }

  /**
   * Resets all helper jobs and the virtual runtime clock.
   */
  reset(): void {
    this.pause()
    this.jobs.clear()
    this.virtualNowMs = 0
  }

  setRate(rate: number): void {
    this._rate = rate
  }

  /**
   * Starts helper ticking when the player is active.
   */
  resume(): void {
    if (this.running) {
      return
    }

    this.running = true
    this.ticker.start((payload) => {
      this.virtualNowMs += payload.deltaMs * this._rate
      this.processDueJobs()
    })
    this.processDueJobs()
  }

  /**
   * Freezes helper ticking without clearing pending jobs.
   */
  pause(): void {
    if (!this.running) {
      return
    }

    this.ticker.stop()
    this.running = false
  }

  /**
   * Cancels all helper jobs and resets the virtual clock.
   */
  stop(): void {
    this.pause()
    this.jobs.clear()
    this.virtualNowMs = 0
  }

  /**
   * Cancels all helper jobs and releases ticker resources.
   */
  destroy(): void {
    this.stop()
  }

  /**
   * Notifies one routed runtime event so event-driven loops can stop.
   */
  notifyEvent(eventName: string): void {
    if (eventName === 'sequence:end') {
      for (const [jobId, job] of this.jobs.entries()) {
        if (job.kind === 'loop') {
          this.jobs.delete(jobId)
        }
      }
      this.notifyIdleIfNeeded()
      return
    }

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.kind !== 'loop') {
        continue
      }

      if (job.loopUntil?.some((condition) => condition.type === 'event' && condition.name === eventName)) {
        this.jobs.delete(jobId)
      }
    }

    this.notifyIdleIfNeeded()
  }

  /**
   * Schedules one event batch once after a relative delay.
   */
  wait(ms: number, input: EventInput, options: WaitOptions = {}): HelperHandle {
    this.assertValidDelay(ms, input)
    const mode = this.resolveFiniteHelperMode('wait', options.mode, 'planned')

    const job = this.createJob({
      kind: 'delay',
      dueAtMs: this.virtualNowMs + ms,
      startedAtMs: this.virtualNowMs,
      index: 0,
        input
    })

    void mode

    this.jobs.set(job.id, job)
    if (this.running) {
      this.processDueJobs()
    }
    return this.createHandle(job.id)
  }

  /**
   * Schedules one event batch once after a relative delay.
   */
  delay(ms: number, input: EventInput, options: WaitOptions = {}): HelperHandle {
    return this.wait(ms, input, options)
  }

  /**
   * Schedules one finite repeated series of events.
   */
  repeat(
    options: RepeatOptions,
    input: EventInput
  ): HelperHandle {
    this.assertValidRepeat(options, input)
    const mode = this.resolveFiniteHelperMode('repeat', options.mode, 'planned')

    const job = this.createJob({
      kind: 'repeat',
      dueAtMs: this.virtualNowMs,
      startedAtMs: this.virtualNowMs,
      everyMs: Math.max(1, options.everyMs),
      timesRemaining: options.times,
      index: 0,
      input
    })

    void mode

    this.jobs.set(job.id, job)
    if (this.running) {
      this.processDueJobs()
    }
    return this.createHandle(job.id)
  }

  /**
   * Schedules one unbounded repeated series of events.
   */
  loop(options: LoopOptions, factory: (context: HelperTickContext) => StoryEvent[]): HelperHandle {
    this.assertValidLoop(options)
    const plannedTimes = resolvePlannableLoopTimes(options)
    const modeResolution = resolveHelperMode({
      helperName: 'loop',
      requestedMode: options.mode,
      defaultMode: 'jit',
      compatibleModes: hasEventLoopStop(options) ? ['jit'] : ['planned', 'jit'],
      fallbackMode: 'jit',
      reason: hasEventLoopStop(options) ? 'until.event requires jit' : undefined
    })
    this.emitWarnings(modeResolution.warnings)

    if (modeResolution.mode === 'planned' && plannedTimes !== null) {
      return this.repeat({ everyMs: options.eachMs, times: plannedTimes, mode: 'planned' }, (context) => factory(context))
    }

    const loopUntil = normalizeLoopStopConditions(options.until)

    const job = this.createJob({
      kind: 'loop',
      dueAtMs: this.virtualNowMs,
      startedAtMs: this.virtualNowMs,
      everyMs: options.eachMs,
      index: 0,
      loopUntil,
      factory
    })

    this.jobs.set(job.id, job)
    if (this.running) {
      this.processDueJobs()
    }
    return this.createHandle(job.id)
  }

  /**
   * Schedules one staggered batch of events and returns one handle per event.
   */
  stagger(options: StaggerOptions, input: EventInput): HelperHandle[] {
    this.assertValidStagger(options, input)
    const mode = this.resolveFiniteHelperMode('stagger', options.mode, 'planned')

    void mode
    const items = resolveEventInput(input, buildHelperTickContext({
      currentTimeMs: this.virtualNowMs,
      startedAtMs: this.virtualNowMs,
      index: 0,
      resolveState: this.resolveState
    }))
    this.assertValidResolvedEvents(items, 'stagger')
    return planStaggerItems({ stepMs: options.stepMs, items }).map(({ offsetMs, item }) => this.delay(offsetMs, item, { mode: options.mode }))
  }

  /**
   * Resolves one finite helper mode and emits warnings when needed.
   */
  private resolveFiniteHelperMode(helperName: string, requestedMode: HelperMode | undefined, defaultMode: HelperMode): HelperMode {
    const resolution = resolveHelperMode({
      helperName,
      requestedMode,
      defaultMode,
      compatibleModes: ['planned', 'jit']
    })
    this.emitWarnings(resolution.warnings)
    return resolution.mode
  }

  /**
   * Forwards helper warnings to the configured observer.
   */
  private emitWarnings(warnings: string[]): void {
    for (const warning of warnings) {
      this.emitWarning?.(warning)
    }
  }

  /**
   * Builds one new runtime job with deterministic ordering.
   */
  private createJob(job: Omit<ScheduleJob, 'id' | 'order' | 'cancelled'>): ScheduleJob {
    return {
      ...job,
      id: `schedule-${this.nextJobId++}`,
      order: this.nextJobOrder++,
      cancelled: false
    }
  }

  /**
   * Creates one public cancellation handle.
   */
  private createHandle(jobId: string): HelperHandle {
    return {
      id: jobId,
      cancel: () => {
        const job = this.jobs.get(jobId)
        if (!job) {
          return
        }

        job.cancelled = true
        this.jobs.delete(jobId)
        this.notifyIdleIfNeeded()
      }
    }
  }

  /**
   * Calls the idle hook when no helper job remains.
   */
  private notifyIdleIfNeeded(): void {
    if (this.jobs.size === 0) {
      this.onIdle?.()
    }
  }

  /**
   * Emits all due helper jobs in deterministic order.
   */
  private processDueJobs(): void {
    let guard = 0
    const maxEventsPerTick = this.policy.maxEventsPerTick
    let emittedCount = 0

    while (guard < 1000) {
      guard += 1

      const dueJobs = [...this.jobs.values()]
        .filter((job) => !job.cancelled && job.dueAtMs <= this.virtualNowMs)
        .sort((left, right) => left.dueAtMs - right.dueAtMs || left.order - right.order)

      if (dueJobs.length === 0) {
        return
      }

      const batchDueAtMs = dueJobs[0]?.dueAtMs
      if (batchDueAtMs === undefined) {
        return
      }

      const batchJobs = dueJobs.filter((job) => job.dueAtMs === batchDueAtMs)
      const batchEmissions = this.collectBatchEmissions(batchJobs, batchDueAtMs)
      if (batchEmissions.current.length === 0 && batchEmissions.deferred.length === 0) {
        return
      }

      const remainingBudget = maxEventsPerTick === undefined ? Number.POSITIVE_INFINITY : maxEventsPerTick - emittedCount
      if (remainingBudget <= 0) {
        return
      }

      const currentEmissions = batchEmissions.current.slice(0, remainingBudget)
      const overflowEmissions = batchEmissions.current.slice(currentEmissions.length)

      if (currentEmissions.length === 0 && overflowEmissions.length === 0 && batchEmissions.deferred.length === 0) {
        return
      }

      for (const emission of currentEmissions) {
        void this.emitEvent(this.normalizeEvent(emission.event), this.createTickContext(emission.job, emission.dueAtMs))
        emittedCount += 1
      }

      for (const emission of [...batchEmissions.deferred, ...overflowEmissions]) {
        const deferredJob = this.createJob({
          kind: 'delay',
          dueAtMs: batchDueAtMs + 1,
          startedAtMs: batchDueAtMs,
          index: 0,
          input: emission.event
        })
        this.jobs.set(deferredJob.id, deferredJob)
      }

      for (const job of batchJobs) {
        this.advanceJobAfterBatch(job)
      }
    }
  }

  /**
   * Collects one due-time batch and applies same-tick policy.
   */
  private collectBatchEmissions(batchJobs: ScheduleJob[], dueAtMs: number): {
    current: ScheduledEmission[]
    deferred: ScheduledEmission[]
  } {
    const rawEmissions: ScheduledEmission[] = []

    for (const job of batchJobs) {
      const context = this.createTickContext(job, dueAtMs)
      const events = job.kind === 'loop'
        ? job.factory?.(context) ?? []
        : resolveHelperItemsAtOffset({
            offsetMs: dueAtMs - job.startedAtMs,
            startedAtMs: job.startedAtMs,
            index: job.index,
            helperInput: job.input ?? [],
            resolveState: this.resolveState,
            resolveItems: resolveEventInput
          }).map(({ item }) => item)
      this.assertValidResolvedEvents(events)
      for (const [eventIndex, event] of events.entries()) {
        rawEmissions.push({
          job,
          event,
          eventIndex,
          dueAtMs,
          order: job.order
        })
      }
    }

    const sameTickHandling = this.policy.sameTickHandling ?? { mode: 'keep-all' }
    if (sameTickHandling.mode === 'keep-all') {
      return { current: rawEmissions, deferred: [] }
    }

    const handledEventNames = sameTickHandling.eventNames
    const matchesPolicy = (eventName: string): boolean => {
      if (!handledEventNames || handledEventNames.length === 0) {
        return true
      }

      return handledEventNames.includes(eventName)
    }

    const makeKey = (event: StoryEvent): string => {
      if (sameTickHandling.key === 'name+data') {
        return `${event.name}:${this.stableStringify(event.data ?? {})}`
      }

      return event.name
    }

    const policyIndexesByKey = new Map<string, number[]>()
    for (let index = 0; index < rawEmissions.length; index += 1) {
      const emission = rawEmissions[index]
      if (!matchesPolicy(emission.event.name)) {
        continue
      }

      const key = makeKey(emission.event)
      const indexes = policyIndexesByKey.get(key) ?? []
      indexes.push(index)
      policyIndexesByKey.set(key, indexes)
    }

    const keepIndexes = new Set<number>()
    const deferredIndexes = new Set<number>()

    for (const indexes of policyIndexesByKey.values()) {
      if (indexes.length === 0) {
        continue
      }

      if (sameTickHandling.mode === 'coalesce-last') {
        keepIndexes.add(indexes[indexes.length - 1] as number)
        continue
      }

      keepIndexes.add(indexes[0] as number)
      for (let index = 1; index < indexes.length; index += 1) {
        const emissionIndex = indexes[index]
        if (emissionIndex !== undefined) {
          deferredIndexes.add(emissionIndex)
        }
      }
    }

    const current: ScheduledEmission[] = []
    const deferred: ScheduledEmission[] = []

    for (let index = 0; index < rawEmissions.length; index += 1) {
      const emission = rawEmissions[index]
      if (deferredIndexes.has(index)) {
        deferred.push(emission)
        continue
      }

      if (policyIndexesByKey.size > 0 && matchesPolicy(emission.event.name)) {
        if (!keepIndexes.has(index)) {
          continue
        }
      }

      current.push(emission)
    }

    return { current, deferred }
  }

  /**
   * Builds one helper callback context from the current runtime clock.
   */
  private createTickContext(job: ScheduleJob, currentTimeMs: number): HelperTickContext {
    return buildHelperTickContext({
      currentTimeMs,
      startedAtMs: job.startedAtMs,
      index: job.index,
      resolveState: this.resolveState
    })
  }

  /**
   * Advances one batch job after its due-time has been processed.
   */
  private advanceJobAfterBatch(job: ScheduleJob): void {
    if (job.cancelled) {
      this.jobs.delete(job.id)
      this.notifyIdleIfNeeded()
      return
    }

    if (job.kind === 'delay') {
      this.jobs.delete(job.id)
      this.notifyIdleIfNeeded()
      return
    }

    job.index += 1
    if (job.kind === 'repeat') {
      job.timesRemaining = Math.max(0, (job.timesRemaining ?? 0) - 1)
      if (job.timesRemaining === 0) {
        this.jobs.delete(job.id)
        this.notifyIdleIfNeeded()
        return
      }
    }

    if (job.kind === 'loop' && this.shouldStopLoop(job)) {
      this.jobs.delete(job.id)
      this.notifyIdleIfNeeded()
      return
    }

    job.dueAtMs += job.everyMs ?? 1
  }

  /**
   * Returns true when one loop reached one terminal condition.
   */
  private shouldStopLoop(job: ScheduleJob): boolean {
    const loopUntil = job.loopUntil ?? []
    const nextOccurrenceElapsedMs = job.index * (job.everyMs ?? 1)

    return loopUntil.some((condition) => {
      if (condition.type === 'times') {
        return job.index >= condition.max
      }

      if (condition.type === 'duration') {
        return nextOccurrenceElapsedMs > condition.maxMs
      }

      return false
    })
  }

  /**
   * Serializes one value into a stable JSON-like string.
   */
  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value)
    }

    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableStringify(entry)).join(',')}]`
    }

    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`)
      .join(',')}}`
  }

  /**
   * Normalizes one helper event to the public player emit shape.
   */
  private normalizeEvent(event: StoryEvent): StoryEvent {
    return {
      name: event.name,
      data: event.data,
      cascade: event.cascade ?? false
    }
  }

  /**
   * Rejects invalid delay arguments.
   */
  private assertValidDelay(ms: number, input: EventInput): void {
    if (!isValidHelperDelayMs(ms)) {
      throw this.createValidationError('delay')
    }

    this.assertValidStaticInput('delay', input)
  }

  /**
   * Rejects invalid repeat arguments.
   */
  private assertValidRepeat(options: { everyMs: number; times: number }, input: EventInput): void {
    if (!isValidHelperRepeatOptions(options)) {
      throw this.createValidationError('repeat')
    }

    this.assertValidStaticInput('repeat', input)
  }

  /**
   * Rejects invalid loop arguments.
   */
  private assertValidLoop(options: LoopOptions): void {
    if (!Number.isFinite(options.eachMs) || options.eachMs <= 0) {
      throw this.createValidationError('loop')
    }

    const loopUntil = Array.isArray(options.until) ? options.until : [options.until]
    if (loopUntil.length === 0) {
      throw this.createValidationError('loop')
    }

    for (const condition of loopUntil) {
      if (condition.type === 'times' && (!Number.isInteger(condition.max) || condition.max < 1)) {
        throw this.createValidationError('loop')
      }

      if (condition.type === 'duration' && (!Number.isFinite(condition.maxMs) || condition.maxMs < 0)) {
        throw this.createValidationError('loop')
      }

      if (condition.type === 'event' && condition.name.length === 0) {
        throw this.createValidationError('loop')
      }
    }
  }

  /**
   * Rejects invalid stagger arguments.
   */
  private assertValidStagger(options: { stepMs: number }, input: EventInput): void {
    if (!isValidHelperStaggerOptions(options)) {
      throw this.createValidationError('stagger')
    }

    this.assertValidStaticInput('stagger', input)
  }

  /**
   * Rejects invalid static helper inputs when they are authorable upfront.
   */
  private assertValidStaticInput(helperName: string, input: EventInput): void {
    if (typeof input === 'function') {
      return
    }

    this.assertValidResolvedEvents(Array.isArray(input) ? input : [input], helperName)
  }

  /**
   * Rejects invalid resolved helper events.
   */
  private assertValidResolvedEvents(events: StoryEvent[], helperName = 'helper'): void {
    if (events.some((event) => event.name.length === 0)) {
      throw this.createValidationError(helperName)
    }
  }

  /**
   * Builds one explicit helper validation error.
   */
  private createValidationError(helperName: string): Error & { code: string } {
    const error = new Error(`Invalid helper arguments for ${helperName}`) as Error & { code: string }
    error.code = PLAYER_SCHEDULE_ERROR_CODE.helperInvalidArg
    return error
  }
}
