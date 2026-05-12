import { TimeTicker, type TickerOptions } from '../core/time/ticker'
import { PLAYER_SCHEDULE_ERROR_CODE } from './schedule-constants'
import { createRuntimeEventPolicy, type ResolvedRuntimeEventPolicy, type RuntimeEventPolicy } from './runtime-policy'

export type StoryEvent = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
}

export type HelperHandle = {
  id: string
  cancel: () => void
}

export type StrapHelpers = {
  delay: (ms: number, event: StoryEvent) => HelperHandle
  repeat: (
    options: { everyMs: number; times: number },
    factory: (index: number) => StoryEvent[]
  ) => HelperHandle
  loop: (options: { everyMs: number }, factory: (index: number) => StoryEvent[]) => HelperHandle
  stagger: (options: { stepMs: number }, events: StoryEvent[]) => HelperHandle[]
}

type ScheduleJob = {
  id: string
  order: number
  dueAtMs: number
  kind: 'delay' | 'repeat' | 'loop'
  index: number
  cancelled: boolean
  everyMs?: number
  timesRemaining?: number
  factory?: (index: number) => StoryEvent[]
  events?: StoryEvent[]
}

type ScheduledEmission = {
  job: ScheduleJob
  event: StoryEvent
  eventIndex: number
  dueAtMs: number
  order: number
}

type EmitEvent = (event: StoryEvent) => Promise<void>

/**
 * Runs one deterministic helper scheduler for the public player facade.
 */
export class PlayerScheduleFacade implements StrapHelpers {
  private readonly ticker: TimeTicker
  private readonly emitEvent: EmitEvent
  private readonly jobs = new Map<string, ScheduleJob>()
  private policy: ResolvedRuntimeEventPolicy

  private running = false
  private virtualNowMs = 0
  private nextJobId = 1
  private nextJobOrder = 1

  /**
   * Configures one helper scheduler with one event emitter and one ticker.
   */
  constructor(options: { emitEvent: EmitEvent; tickerOptions?: TickerOptions; policy?: RuntimeEventPolicy }) {
    this.emitEvent = options.emitEvent
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

  /**
   * Starts helper ticking when the player is active.
   */
  resume(): void {
    if (this.running) {
      return
    }

    this.running = true
    this.ticker.start((payload) => {
      this.virtualNowMs += payload.deltaMs
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
   * Schedules one event once after a relative delay.
   */
  delay(ms: number, event: StoryEvent): HelperHandle {
    this.assertValidDelay(ms, event)

    const job = this.createJob({
      kind: 'delay',
      dueAtMs: this.virtualNowMs + ms,
      index: 0,
      events: [event]
    })

    this.jobs.set(job.id, job)
    if (this.running) {
      this.processDueJobs()
    }
    return this.createHandle(job.id)
  }

  /**
   * Schedules one finite repeated series of events.
   */
  repeat(
    options: { everyMs: number; times: number },
    factory: (index: number) => StoryEvent[]
  ): HelperHandle {
    this.assertValidRepeat(options)

    const job = this.createJob({
      kind: 'repeat',
      dueAtMs: this.virtualNowMs,
      everyMs: Math.max(1, options.everyMs),
      timesRemaining: options.times,
      index: 0,
      factory
    })

    this.jobs.set(job.id, job)
    if (this.running) {
      this.processDueJobs()
    }
    return this.createHandle(job.id)
  }

  /**
   * Schedules one unbounded repeated series of events.
   */
  loop(options: { everyMs: number }, factory: (index: number) => StoryEvent[]): HelperHandle {
    this.assertValidLoop(options)

    const job = this.createJob({
      kind: 'loop',
      dueAtMs: this.virtualNowMs,
      everyMs: Math.max(1, options.everyMs),
      index: 0,
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
  stagger(options: { stepMs: number }, events: StoryEvent[]): HelperHandle[] {
    this.assertValidStagger(options, events)

    return events.map((event, index) => this.delay(index * options.stepMs, event))
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
      }
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
        void this.emitEvent(this.normalizeEvent(emission.event))
        emittedCount += 1
      }

      for (const emission of [...batchEmissions.deferred, ...overflowEmissions]) {
        const deferredJob = this.createJob({
          kind: 'delay',
          dueAtMs: batchDueAtMs + 1,
          index: 0,
          events: [emission.event]
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
      const events = job.kind === 'delay' ? job.events ?? [] : job.factory?.(job.index) ?? []
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
   * Advances one batch job after its due-time has been processed.
   */
  private advanceJobAfterBatch(job: ScheduleJob): void {
    if (job.cancelled) {
      this.jobs.delete(job.id)
      return
    }

    if (job.kind === 'delay') {
      this.jobs.delete(job.id)
      return
    }

    job.index += 1
    if (job.kind === 'repeat') {
      job.timesRemaining = Math.max(0, (job.timesRemaining ?? 0) - 1)
      if (job.timesRemaining === 0) {
        this.jobs.delete(job.id)
        return
      }
    }

    job.dueAtMs += job.everyMs ?? 1
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
  private assertValidDelay(ms: number, event: StoryEvent): void {
    if (!Number.isFinite(ms) || ms < 0 || event.name.length === 0) {
      throw this.createValidationError('delay')
    }
  }

  /**
   * Rejects invalid repeat arguments.
   */
  private assertValidRepeat(options: { everyMs: number; times: number }): void {
    if (!Number.isFinite(options.everyMs) || options.everyMs < 0 || !Number.isInteger(options.times) || options.times < 1) {
      throw this.createValidationError('repeat')
    }
  }

  /**
   * Rejects invalid loop arguments.
   */
  private assertValidLoop(options: { everyMs: number }): void {
    if (!Number.isFinite(options.everyMs) || options.everyMs < 0) {
      throw this.createValidationError('loop')
    }
  }

  /**
   * Rejects invalid stagger arguments.
   */
  private assertValidStagger(options: { stepMs: number }, events: StoryEvent[]): void {
    if (!Number.isFinite(options.stepMs) || options.stepMs < 0 || events.some((event) => event.name.length === 0)) {
      throw this.createValidationError('stagger')
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
