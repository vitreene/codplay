import type {
  CompiledCaptureDeclaration,
  CompiledCaptureEvent,
  CompiledEmitRule,
  CompiledScene,
} from '../../scene/compiled'
import type { RuntimeEventDispatchResult, RuntimeEventInput } from '../player/pipeline'
import type {
  RuntimeCaptureBeginResult,
  RuntimeCaptureFailure,
  RuntimeCapturePlayerEndResult,
  RuntimeCaptureSample,
  RuntimeCaptureState,
  RuntimeCaptureTrackResult,
  RuntimeCompiledCaptureBeginInput,
} from './capture-types'
import { resolveCaptureEventTarget } from './capture-event-target'

type CaptureRule = Readonly<{
  storyId: string
  persoId: string
  source: string
  event: CompiledCaptureEvent
  declaration: CompiledCaptureDeclaration
}>

/** Player operations used by one shared source-to-capture circuit. */
export type RuntimeCaptureSourcePlayerPort = Readonly<{
  getCurrentTimeMs: () => number
  emit: (input: Omit<RuntimeEventInput, 'applyAtMs'> & Readonly<{ applyAtMs?: number }>) => Promise<RuntimeEventDispatchResult>
  beginCompiledCapture: (input: RuntimeCompiledCaptureBeginInput) => RuntimeCaptureBeginResult
  trackCapture: (captureId: string, sample: RuntimeCaptureSample) => RuntimeCaptureTrackResult
  endCapture: (
    captureId: string,
    meta?: Readonly<Record<string, unknown>>,
    captureStateOverride?: RuntimeCaptureState,
  ) => Promise<RuntimeCapturePlayerEndResult | RuntimeCaptureFailure>
  cancelCapture: (captureId: string) => Readonly<{ ok: true } | RuntimeCaptureFailure>
}>

/** Identity and source used to select compiled capture rules in one scene. */
export type RuntimeCaptureSourceInput = Readonly<{
  storyId: string
  persoId: string
  source: string
  eventContext?: Readonly<Record<string, unknown>>
}>

/** Result of one completed source sample. */
export type RuntimeCaptureSourceTrack = Readonly<{
  captureId: string
  storyId: string
  persoId: string
  sample: RuntimeCaptureSample
  captureState: RuntimeCaptureState
}>

/** Result of one source session closing or being cancelled. */
export type RuntimeCaptureSourceClose = Readonly<{
  captureId: string
  storyId: string
  persoId: string
  completed: boolean
}>

/** Optional source-local observers for tracking and close integration. */
export type RuntimeCaptureSourceCallbacks = Readonly<{
  onTrack?: (input: RuntimeCaptureSourceTrack) => void
  onClose?: (input: RuntimeCaptureSourceClose) => void
}>

/** One source-facing handle for a compiled capture rule. */
export type RuntimeCaptureSourceSession = Readonly<{
  captureId: string
  getCaptureState: () => RuntimeCaptureState | undefined
  track: (sample: RuntimeCaptureSample) => void
  /** Routes a native event through the compiled trackOn/endOn boundaries. */
  route: (input: RuntimeCaptureSourceRouteInput) => void
  end: (
    meta?: Readonly<Record<string, unknown>>,
    resolveCaptureState?: (captureState: RuntimeCaptureState) => RuntimeCaptureState | undefined,
  ) => Promise<RuntimeCapturePlayerEndResult | RuntimeCaptureFailure | undefined>
  cancel: () => void
}>

/** Source-specific native event data accepted by a session route. */
export type RuntimeCaptureSourceRouteInput = Readonly<{
  eventType: string
  sample?: RuntimeCaptureSample
  meta?: Readonly<Record<string, unknown>>
  resolveCaptureState?: (captureState: RuntimeCaptureState) => RuntimeCaptureState | undefined
}>

/** Bounded operations shared by player-owned browser sources and components. */
export type RuntimeCaptureSourcePort = Readonly<{
  open: (
    input: RuntimeCaptureSourceInput,
    callbacks?: RuntimeCaptureSourceCallbacks,
  ) => readonly RuntimeCaptureSourceSession[]
  resolveIdentity: (persoKey: string) => Readonly<{ storyId: string; persoId: string }> | undefined
  hasRules: (input: Pick<RuntimeCaptureSourceInput, 'storyId' | 'persoId' | 'source'>) => boolean
  getEventTypes: (source: string) => readonly string[]
  cancelAll: () => void
  suspend: () => void
  resume: () => void
  destroy: () => void
}>

/** Reports one failure without coupling the source circuit to a host diagnostic API. */
export type RuntimeCaptureSourceErrorHandler = (input: Readonly<{
  error: unknown
  storyId: string
  persoId: string
  source: string
}>) => void

/** Owns compiled rule selection and every source-to-player capture transition. */
export class RuntimeCaptureSourceCircuit implements RuntimeCaptureSourcePort {
  private readonly player: RuntimeCaptureSourcePlayerPort
  private readonly rules = new Map<string, readonly CaptureRule[]>()
  private readonly identities = new Map<string, Readonly<{ storyId: string; persoId: string }>>()
  private readonly sessions = new Set<RuntimeCaptureSourceSessionImpl>()
  private readonly onError: RuntimeCaptureSourceErrorHandler | undefined
  private nextCaptureId = 0
  private accepting = true
  private destroyed = false

  /** Indexes each compiled capture rule by its owning perso and native source. */
  constructor(options: Readonly<{
    compiledScene: CompiledScene
    player: RuntimeCaptureSourcePlayerPort
    onError?: RuntimeCaptureSourceErrorHandler
  }>) {
    this.player = options.player
    this.onError = options.onError
    this.indexRules(options.compiledScene)
  }

  /** Opens every rule carried by the requested compiled perso and source. */
  open(
    input: RuntimeCaptureSourceInput,
    callbacks: RuntimeCaptureSourceCallbacks = {},
  ): readonly RuntimeCaptureSourceSession[] {
    if (!this.accepting || this.destroyed) return []
    const rules = this.rules.get(sourceRuleKey(input.storyId, input.persoId, input.source)) ?? []
    return rules.map((rule) => {
      const captureId = `${input.storyId}:${input.persoId}:${input.source}:${this.nextCaptureId++}`
      const session = new RuntimeCaptureSourceSessionImpl({
        captureId,
        rule,
        input,
        callbacks,
        player: this.player,
        reportError: (error) => this.reportError(error, rule),
        onClose: () => this.sessions.delete(session),
      })
      this.sessions.add(session)
      session.start()
      return session
    })
  }

  /** Lists native event types required to observe one compiled pointer source. */
  getEventTypes(source: string): readonly string[] {
    const eventTypes = new Set<string>()
    for (const rules of this.rules.values()) {
      for (const rule of rules) {
        if (rule.source !== source) continue
        eventTypes.add(source)
        for (const type of rule.declaration.trackOn ?? ['pointermove']) {
          if (type.startsWith('pointer')) eventTypes.add(type)
        }
        for (const type of rule.declaration.endOn ?? ['pointerup']) {
          if (type.startsWith('pointer')) eventTypes.add(type)
        }
      }
    }
    return [...eventTypes]
  }

  /** Resolves the canonical runner key to its compiled story and perso identity. */
  resolveIdentity(persoKey: string): Readonly<{ storyId: string; persoId: string }> | undefined {
    return this.identities.get(persoKey)
  }

  /** Checks whether one component source needs to install native listeners. */
  hasRules(input: Pick<RuntimeCaptureSourceInput, 'storyId' | 'persoId' | 'source'>): boolean {
    return (this.rules.get(sourceRuleKey(input.storyId, input.persoId, input.source))?.length ?? 0) > 0
  }

  /** Cancels every open and pending capture before a seek or terminal boundary. */
  cancelAll(): void {
    for (const session of [...this.sessions]) session.cancel()
  }

  /** Prevents new source captures until the host completes its lifecycle boundary. */
  suspend(): void {
    this.accepting = false
    this.cancelAll()
  }

  /** Re-enables source captures after a completed seek or reset. */
  resume(): void {
    if (!this.destroyed) this.accepting = true
  }

  /** Permanently cancels sessions and rejects future source openings. */
  destroy(): void {
    this.suspend()
    this.destroyed = true
  }

  /** Collects the immutable capture event and declaration pairs from compilation. */
  private indexRules(scene: CompiledScene): void {
    for (const [storyId, story] of Object.entries(scene.scene.stories)) {
      for (const perso of story.persos) {
        this.identities.set(`${storyId}:${perso.id}`, { storyId, persoId: perso.id })
        for (const [source, value] of Object.entries(perso.emit ?? {})) {
          const rules = normalizeRules(value).flatMap((rule) => rule.capture === undefined
            ? []
            : [{
              storyId,
              persoId: perso.id,
              source,
              event: rule.event as CompiledCaptureEvent,
              declaration: rule.capture,
            }])
          if (rules.length > 0) this.rules.set(sourceRuleKey(storyId, perso.id, source), rules)
        }
      }
    }
  }

  /** Reports a failed compiled source rule through the configured host boundary. */
  private reportError(error: unknown, rule: CaptureRule): void {
    this.onError?.({ error, storyId: rule.storyId, persoId: rule.persoId, source: rule.source })
  }
}

type CaptureSourceSessionOptions = Readonly<{
  captureId: string
  rule: CaptureRule
  input: RuntimeCaptureSourceInput
  callbacks: RuntimeCaptureSourceCallbacks
  player: RuntimeCaptureSourcePlayerPort
  reportError: (error: unknown) => void
  onClose: () => void
}>

type CaptureStateResolver = (captureState: RuntimeCaptureState) => RuntimeCaptureState | undefined

/** Maintains one pending or active player capture behind a source-facing handle. */
class RuntimeCaptureSourceSessionImpl implements RuntimeCaptureSourceSession {
  readonly captureId: string
  private readonly rule: CaptureRule
  private readonly input: RuntimeCaptureSourceInput
  private readonly callbacks: RuntimeCaptureSourceCallbacks
  private readonly player: RuntimeCaptureSourcePlayerPort
  private readonly reportError: (error: unknown) => void
  private readonly onClose: () => void
  private readonly pendingSamples: RuntimeCaptureSample[] = []
  private captureState: RuntimeCaptureState | undefined
  private opening: Promise<void> | undefined
  private ending: Promise<RuntimeCapturePlayerEndResult | RuntimeCaptureFailure | undefined> | undefined
  private endResult: RuntimeCapturePlayerEndResult | RuntimeCaptureFailure | undefined
  private endMeta: Readonly<Record<string, unknown>> = {}
  private resolveCaptureState: CaptureStateResolver | undefined
  private endRequested = false
  private started = false
  private closed = false
  private cancelled = false

  /** Creates one capture handle whose event and declaration came from the same rule. */
  constructor(options: CaptureSourceSessionOptions) {
    this.captureId = options.captureId
    this.rule = options.rule
    this.input = options.input
    this.callbacks = options.callbacks
    this.player = options.player
    this.reportError = options.reportError
    this.onClose = options.onClose
  }

  /** Emits the rule's start event, opens its compiled capture, then drains queued samples. */
  start(): void {
    if (this.opening !== undefined || this.closed) return
    this.opening = this.openSession()
  }

  /** Returns the latest session state for source-specific final-state resolution. */
  getCaptureState(): RuntimeCaptureState | undefined {
    return this.captureState
  }

  /** Tracks now or queues a sample until the start event and capture are ready. */
  track(sample: RuntimeCaptureSample): void {
    if (this.closed || this.cancelled || this.endRequested) return
    if (!this.started) {
      this.pendingSamples.push(sample)
      return
    }
    this.trackNow(sample)
  }

  /** Applies the compiled trackOn/endOn policy to one native event. */
  route(input: RuntimeCaptureSourceRouteInput): void {
    if (this.closed || this.cancelled || this.endRequested) return
    const trackOn = this.rule.declaration.trackOn ?? ['pointermove']
    const endOn = this.rule.declaration.endOn ?? ['pointerup']
    if (endOn.includes(input.eventType)) {
      void this.end(input.meta, input.resolveCaptureState)
      return
    }
    if (trackOn.includes(input.eventType)) {
      if (input.sample === undefined) {
        this.fail(new Error(`Capture source event has no sample: ${input.eventType}`))
        return
      }
      this.track(input.sample)
    }
  }

  /** Ends after pending open and samples settle, applying a source-specific final state if given. */
  end(
    meta: Readonly<Record<string, unknown>> = {},
    resolveCaptureState?: CaptureStateResolver,
  ): Promise<RuntimeCapturePlayerEndResult | RuntimeCaptureFailure | undefined> {
    if (this.ending !== undefined) return this.ending
    if (this.closed || this.cancelled) return Promise.resolve(undefined)
    this.endRequested = true
    this.endMeta = meta
    this.resolveCaptureState = resolveCaptureState
    this.ending = (async () => {
      await this.opening
      if (this.closed) return this.endResult
      if (this.cancelled || !this.started) return undefined
      return this.endNow()
    })()
    return this.ending
  }

  /** Cancels a pending or active capture without running capture end outputs. */
  cancel(): void {
    if (this.closed || this.cancelled) return
    this.cancelled = true
    this.pendingSamples.length = 0
    if (this.started) {
      const result = this.player.cancelCapture(this.captureId)
      if (!result.ok && result.code !== 'RUNTIME_CAPTURE_UNKNOWN') {
        this.reportError(new Error(result.message))
      }
    }
    this.close(false)
  }

  /** Opens through the shared event dispatcher and player capture controller. */
  private async openSession(): Promise<void> {
    try {
      const event = this.rule.event
      const emitted = await this.player.emit({
        name: event.name,
        applyAtMs: this.player.getCurrentTimeMs(),
        ...resolveCaptureEventTarget(event, this.rule.storyId),
        data: event.data,
        mode: event.mode,
        context: this.input.eventContext,
      })
      if (!emitted.ok) {
        throw new Error(`Capture start event was rejected: ${event.name}`)
      }
      if (this.cancelled || this.closed) return
      const opened = this.player.beginCompiledCapture({
        captureId: this.captureId,
        storyId: this.rule.storyId,
        declaration: this.rule.declaration,
      })
      if (!opened.ok) {
        throw new Error(opened.message)
      }
      this.started = true
      this.captureState = opened.captureState
      this.flushPendingSamples()
      if (this.endRequested && !this.closed && !this.cancelled) await this.endNow()
    } catch (error) {
      this.fail(error)
    }
  }

  /** Flushes ordered samples that arrived while the start event was pending. */
  private flushPendingSamples(): void {
    while (this.pendingSamples.length > 0 && !this.closed && !this.cancelled) {
      const sample = this.pendingSamples.shift()
      if (sample !== undefined) this.trackNow(sample)
    }
  }

  /** Tracks one active sample and publishes the resulting state to source callbacks. */
  private trackNow(sample: RuntimeCaptureSample): void {
    const result = this.player.trackCapture(this.captureId, sample)
    if (!result.ok) {
      this.fail(new Error(result.message))
      return
    }
    this.captureState = result.captureState
    try {
      this.callbacks.onTrack?.({
        captureId: this.captureId,
        storyId: this.rule.storyId,
        persoId: this.rule.persoId,
        sample,
        captureState: result.captureState,
      })
    } catch (error) {
      this.reportError(error)
    }
  }

  /** Resolves the final source state, then closes through RuntimePlayer.endCapture(). */
  private async endNow(): Promise<RuntimeCapturePlayerEndResult | RuntimeCaptureFailure | undefined> {
    if (this.closed || this.cancelled || !this.started) return undefined
    let captureState = this.captureState
    if (captureState === undefined) {
      this.fail(new Error(`Capture state is unavailable: ${this.captureId}`))
      return undefined
    }
    try {
      captureState = this.resolveCaptureState?.(captureState) ?? captureState
    } catch (error) {
      this.fail(error)
      return undefined
    }
    this.closed = true
    try {
      const result = await this.player.endCapture(this.captureId, this.endMeta, captureState)
      if (!result.ok) this.reportError(new Error(result.message))
      this.endResult = result
      this.notifyClose(result.ok)
      return result
    } catch (error) {
      this.reportError(error)
      this.endResult = undefined
      this.notifyClose(false)
      return undefined
    }
  }

  /** Reports a source failure, cancels its player session, and closes its handle. */
  private fail(error: unknown): void {
    if (this.closed || this.cancelled) return
    this.reportError(error)
    if (this.started) {
      const result = this.player.cancelCapture(this.captureId)
      if (!result.ok && result.code !== 'RUNTIME_CAPTURE_UNKNOWN') {
        this.reportError(new Error(result.message))
      }
    }
    this.close(false)
  }

  /** Marks one handle closed and notifies its source once. */
  private close(completed: boolean): void {
    if (this.closed) return
    this.closed = true
    this.notifyClose(completed)
  }

  /** Releases the circuit index entry and invokes the optional source callback. */
  private notifyClose(completed: boolean): void {
    this.onClose()
    try {
      this.callbacks.onClose?.({
        captureId: this.captureId,
        storyId: this.rule.storyId,
        persoId: this.rule.persoId,
        completed,
      })
    } catch (error) {
      this.reportError(error)
    }
  }
}

/** Converts one compiled source declaration to an ordered list of event rules. */
function normalizeRules(value: CompiledEmitRule | readonly CompiledEmitRule[] | unknown): readonly CompiledEmitRule[] {
  if (value === undefined) return []
  if (Array.isArray(value)) return value as readonly CompiledEmitRule[]
  if (!isRecord(value) || !('event' in value)) return []
  return [value as unknown as CompiledEmitRule]
}

/** Builds one collision-safe identity key for a source declaration. */
function sourceRuleKey(storyId: string, persoId: string, source: string): string {
  return JSON.stringify([storyId, persoId, source])
}

/** Checks a compiled value before narrowing it to a record. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
