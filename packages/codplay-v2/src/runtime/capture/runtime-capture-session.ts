import { cloneRecord, isPlainRecord } from '../../shared'
import type { CompiledValue } from '../../scene/compiled'
import {
  EVENT_INSERT_MODE_APPLY_NOW,
  EVENT_INSERT_MODE_PERSIST_ONLY,
} from '../config/event-insertion'
import type {
  RuntimeCaptureAction,
  RuntimeCaptureDeclaration,
  RuntimeCaptureEndDurationMode,
  RuntimeCaptureEndEvent,
  RuntimeCaptureEndResult,
  RuntimeCaptureEvent,
  RuntimeCaptureFailure,
  RuntimeCaptureOpenResult,
  RuntimeCaptureSample,
  RuntimeCaptureState,
  RuntimeCaptureStatus,
  RuntimeCaptureTrackResult,
} from './capture-types'

/** Options used to open one source-agnostic capture session. */
export type RuntimeCaptureSessionOptions = Readonly<{
  declaration: RuntimeCaptureDeclaration
  state: RuntimeCaptureState
  startedAtMs?: number
}>

/** Default duration used when `endCapture` delegates its anchoring to runtime. */
export const DEFAULT_CAPTURE_DURATION_MS = 200

/** Owns ephemeral samples and state until one capture is ended or cancelled. */
export class RuntimeCaptureSession {
  private readonly declaration: RuntimeCaptureDeclaration
  private readonly startedAtMs: number
  private readonly samples: RuntimeCaptureSample[] = []
  private captureState: RuntimeCaptureState
  private status: RuntimeCaptureStatus = 'active'

  /** Creates one session after its optional initialization function has run. */
  private constructor(
    declaration: RuntimeCaptureDeclaration,
    captureState: RuntimeCaptureState,
    startedAtMs: number,
  ) {
    this.declaration = declaration
    this.startedAtMs = startedAtMs
    this.captureState = cloneRecord(captureState)
  }

  /** Opens a session and runs its initialization exactly once. */
  static open(options: RuntimeCaptureSessionOptions): RuntimeCaptureOpenResult {
    const initialState = cloneRecord(options.state)
    let captureState: RuntimeCaptureState = {}
    if (options.declaration.initCaptureState !== undefined) {
      try {
        const initialized = options.declaration.initCaptureState({ state: freezeRecord(initialState) })
        if (initialized === false) {
          return {
            ok: false,
            code: 'RUNTIME_CAPTURE_REJECTED',
            message: 'Capture initialization rejected the session.',
          }
        }
        captureState = cloneRecord(initialized)
      } catch (error) {
        return {
          ok: false,
          code: 'RUNTIME_CAPTURE_INIT_FAILED',
          message: error instanceof Error ? error.message : 'Capture initialization failed.',
        }
      }
    }
    return {
      ok: true,
      session: new RuntimeCaptureSession(options.declaration, captureState, options.startedAtMs ?? 0),
    }
  }

  /** Returns the current session lifecycle. */
  getStatus(): RuntimeCaptureStatus {
    return this.status
  }

  /** Returns a detached snapshot of the ephemeral capture state. */
  getCaptureState(): RuntimeCaptureState {
    return freezeRecord(cloneRecord(this.captureState))
  }

  /** Returns the samples accumulated so far without exposing the mutable array. */
  getSamples(): readonly RuntimeCaptureSample[] {
    return [...this.samples]
  }

  /** Runs one live capture command without appending an event to any journal. */
  track(sample: RuntimeCaptureSample): RuntimeCaptureTrackResult {
    if (this.status !== 'active') {
      return this.failure('RUNTIME_CAPTURE_CLOSED', 'Capture session is no longer active.')
    }
    this.samples.push(sample)
    const command = this.declaration.trackCommand
    if (command === undefined) {
      return {
        ok: true,
        updateState: undefined,
        captureState: this.getCaptureState(),
        sampleCount: this.samples.length,
      }
    }

    try {
      const output = command({
        sample,
        samples: this.getSamples(),
        captureState: this.getCaptureState(),
      })
      if (output?.captureState !== undefined) this.captureState = cloneRecord(output.captureState)
      return {
        ok: true,
        action: output?.action === undefined ? undefined : cloneAction(output.action),
        updateState: output?.updateState === undefined ? undefined : cloneRecord(output.updateState),
        captureState: this.getCaptureState(),
        sampleCount: this.samples.length,
      }
    } catch (error) {
      return this.failure(
        'RUNTIME_CAPTURE_TRACK_FAILED',
        error instanceof Error ? error.message : 'Capture tracking failed.',
      )
    }
  }

  /** Closes the session and normalizes both independent end outputs. */
  end(
    state: RuntimeCaptureState,
    meta: Readonly<Record<string, unknown>> = {},
    endedAtMs = this.startedAtMs,
    captureStateOverride?: RuntimeCaptureState,
  ): RuntimeCaptureEndResult | RuntimeCaptureFailure {
    if (this.status !== 'active') {
      return this.failure('RUNTIME_CAPTURE_CLOSED', 'Capture session is no longer active.')
    }
    if (!Number.isFinite(endedAtMs) || endedAtMs < this.startedAtMs) {
      return this.failure('RUNTIME_CAPTURE_END_TIME_INVALID', 'Capture end time must not precede its start time.')
    }
    this.status = 'ended'
    const snapshotState = freezeRecord(cloneRecord(state))
    const snapshotCaptureState = freezeRecord(cloneRecord(captureStateOverride ?? this.captureState))
    const snapshotSamples = this.getSamples()
    let endCaptureEvents: readonly RuntimeCaptureEvent[] = []
    let duration: number | undefined
    let durationMode: RuntimeCaptureEndDurationMode | undefined
    if (this.declaration.endCapture !== undefined) {
      let output: ReturnType<NonNullable<RuntimeCaptureDeclaration['endCapture']>>
      try {
        output = this.declaration.endCapture({
          samples: snapshotSamples,
          captureState: snapshotCaptureState,
          state: snapshotState,
          meta,
        })
      } catch (error) {
        return this.failure(
          'RUNTIME_CAPTURE_END_FAILED',
          error instanceof Error ? error.message : 'Capture end failed.',
        )
      }
      endCaptureEvents = output?.events ?? []
      duration = output?.duration
      durationMode = output?.durationMode
    }

    const resolvedDurationMs = resolveEndDuration(
      durationMode,
      duration,
      this.startedAtMs,
      endedAtMs,
    )
    const endCaptureApplyAtMs = endedAtMs - resolvedDurationMs
    const normalizedEndCaptureEvents = endCaptureEvents.map((event) => normalizeEndCaptureEvent(
      event,
      endCaptureApplyAtMs,
      durationMode !== 'value' ? resolvedDurationMs : undefined,
    ))
    const endEmitEvent = this.declaration.endEmit === undefined
      ? undefined
      : normalizeEndEmitEvent(this.declaration.endEmit, snapshotCaptureState, endedAtMs)
    const events: RuntimeCaptureEndEvent[] = [
      ...normalizedEndCaptureEvents,
      ...(endEmitEvent === undefined ? [] : [endEmitEvent]),
    ]
    return {
      ok: true,
      events,
      endCaptureEvents: normalizedEndCaptureEvents,
      endEmitEvent,
      samples: snapshotSamples,
      captureState: snapshotCaptureState,
      startedAtMs: this.startedAtMs,
      endedAtMs,
      resolvedDurationMs,
      endCaptureApplyAtMs: normalizedEndCaptureEvents.length === 0 ? undefined : endCaptureApplyAtMs,
      warnings: normalizedEndCaptureEvents.length > 0 || endEmitEvent !== undefined
        ? []
        : [{
            code: 'CAPTURE_REPLAY_NOT_IDENTICAL',
            message: 'Capture has no persistent end event; replay and seek may differ.',
          }],
    }
  }

  /** Cancels the session without producing an event or a journal entry. */
  cancel(): void {
    if (this.status === 'active') this.status = 'cancelled'
  }

  /** Creates one standardized failure result. */
  private failure(code: string, message: string): RuntimeCaptureFailure {
    return { ok: false, code, message }
  }
}

/** Opens one capture session through the public factory. */
export function openRuntimeCaptureSession(options: RuntimeCaptureSessionOptions): RuntimeCaptureOpenResult {
  return RuntimeCaptureSession.open(options)
}

/** Normalizes one event returned by `endCapture` at the resolved persist-only boundary. */
function normalizeEndCaptureEvent(
  event: RuntimeCaptureEvent,
  applyAtMs: number,
  duration: number | undefined,
): RuntimeCaptureEndEvent {
  const cloned = cloneEvent(event)
  return {
    ...cloned,
    data: duration === undefined ? cloned.data : propagateDuration(cloned.data, duration),
    source: 'endCapture',
    applyAtMs,
    mode: EVENT_INSERT_MODE_PERSIST_ONLY,
  }
}

/** Adds the complete capture state and normalizes the ordinary `endEmit`. */
function normalizeEndEmitEvent(
  event: RuntimeCaptureEvent,
  captureState: RuntimeCaptureState,
  applyAtMs: number,
): RuntimeCaptureEndEvent {
  // Keep the V1 shallow-action payload usable when `endEmit.data` is absent,
  // while always exposing the reserved V2 snapshot for straps and consumers.
  const data: Record<string, CompiledValue> = event.data === undefined
    ? cloneRecord(captureState)
    : { ...cloneRecord(event.data) }
  data.captureState = cloneRecord(captureState)
  return {
    ...event,
    data,
    source: 'endEmit',
    applyAtMs,
    mode: event.mode ?? EVENT_INSERT_MODE_APPLY_NOW,
  }
}

/** Copies one capture event without retaining mutable authored records. */
function cloneEvent(event: RuntimeCaptureEvent): RuntimeCaptureEvent {
  return {
    ...event,
    data: event.data === undefined ? undefined : cloneRecord(event.data),
  }
}

/** Copies one logical live action and its optional payload. */
function cloneAction(action: RuntimeCaptureAction): RuntimeCaptureAction {
  return {
    actionName: action.actionName,
    data: action.data === undefined ? undefined : cloneRecord(action.data),
  }
}

/** Resolves the end-event duration without exposing timing to author functions. */
function resolveEndDuration(
  durationMode: RuntimeCaptureEndDurationMode | undefined,
  authoredDuration: number | undefined,
  startedAtMs: number,
  endedAtMs: number,
): number {
  if (durationMode === 'value') return authoredDuration ?? DEFAULT_CAPTURE_DURATION_MS
  if (durationMode === 'capture') {
    // ACE transitions require a strictly positive duration. A pointer can
    // legally open and close in the same clock tick, so keep that valid
    // capture representable as the smallest effective transition.
    return Math.max(1, endedAtMs - startedAtMs)
  }
  return DEFAULT_CAPTURE_DURATION_MS
}

/** Propagates a runtime duration to transition-shaped style values. */
function propagateDuration(
  data: RuntimeCaptureEvent['data'],
  duration: number,
): RuntimeCaptureEvent['data'] {
  const style = data?.style
  if (!isPlainRecord(style)) return data
  const patchedStyle: Record<string, CompiledValue> = {}
  for (const [property, rawValue] of Object.entries(style)) {
    const transition = isPlainRecord(rawValue)
      && 'to' in rawValue
      && !('duration' in rawValue)
    patchedStyle[property] = (transition ? { ...rawValue, duration } : rawValue) as CompiledValue
  }
  return { ...data, style: patchedStyle }
}

/** Freezes one record snapshot before giving it to author functions. */
function freezeRecord(record: RuntimeCaptureState): RuntimeCaptureState {
  for (const value of Object.values(record)) freezeValue(value)
  return Object.freeze(record)
}

/** Freezes nested records and arrays in one capture snapshot. */
function freezeValue(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) freezeValue(item)
    Object.freeze(value)
    return
  }
  if (isPlainRecord(value)) {
    for (const item of Object.values(value)) freezeValue(item)
    Object.freeze(value)
  }
}
