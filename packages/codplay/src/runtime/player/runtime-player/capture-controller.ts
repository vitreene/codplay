import type { CompiledFunctionCollection, CompiledRecord, CompiledScene } from '../../../scene/compiled'
import type { RuntimeComponentRuntime } from '../../components'
import {
  RuntimeCaptureSession,
  resolveCompiledCaptureDeclaration,
  type RuntimeCaptureBeginInput,
  type RuntimeCaptureBeginResult,
  type RuntimeCaptureFailure,
  type RuntimeCapturePlayerEndResult,
  type RuntimeCaptureSample,
  type RuntimeCaptureState,
  type RuntimeCaptureTrackResult,
  type RuntimeCompiledCaptureBeginInput,
  type RuntimeCaptureAction,
} from '../../capture'
import {
  EVENT_INSERT_MODE_PERSIST_ONLY,
} from '../../config/event-insertion'
import { STRAP_SCOPE_SCENE, STRAP_SCOPE_STORY } from '../../config/strap-scope'
import type {
  RuntimeEventDispatchResult,
  RuntimeStateStore,
  SolvedScene,
} from '../pipeline'
import {
  applyCaptureStateUpdate,
  applyLiveCaptureActions,
  cancelActiveCaptures,
  indexCompiledCaptureActionTargets,
  type ActiveCaptureAction,
  type CaptureActionTarget,
  type RuntimeCaptureSessionEntry,
  type RuntimePlayerEmitInput,
} from '../capture'

/** Dependencies required to coordinate live capture without owning playback. */
export type RuntimePlayerCaptureControllerContext = Readonly<{
  compiledScene: CompiledScene
  functions: CompiledFunctionCollection
  getStateStore: () => RuntimeStateStore
  componentRuntime: RuntimeComponentRuntime | undefined
  getCurrentTimeMs: () => number
  getSolvedScene: () => SolvedScene | undefined
  synchronizeState: () => void
  requireCaptureState: () => void
  emitEvent: (
    input: RuntimePlayerEmitInput,
    includePersistOnlyOverride?: boolean,
  ) => Promise<RuntimeEventDispatchResult>
}>

/** Owns source capture sessions and their transient component-facing state. */
export class RuntimePlayerCaptureController {
  readonly captureSessions = new Map<string, RuntimeCaptureSessionEntry>()
  readonly liveCaptureStateUpdates = new Map<string, CompiledRecord>()
  private readonly activeCaptureActions = new Map<string, ActiveCaptureAction>()
  private readonly compiledCaptureActionTargets: ReadonlyMap<string, readonly CaptureActionTarget[]>
  private readonly context: RuntimePlayerCaptureControllerContext
  private liveCapturePersoKeys = new Set<string>()

  /** Creates the capture boundary for one player instance. */
  constructor(context: RuntimePlayerCaptureControllerContext) {
    this.context = context
    this.compiledCaptureActionTargets = indexCompiledCaptureActionTargets(context.compiledScene)
  }

  /** Opens one source-agnostic capture session against the current player state. */
  begin(input: RuntimeCaptureBeginInput): RuntimeCaptureBeginResult {
    this.context.requireCaptureState()
    if (input.captureId.trim().length === 0) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_ID_INVALID',
        message: 'Capture id must not be empty.',
      }
    }
    if (this.captureSessions.has(input.captureId)) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_DUPLICATE',
        message: `Capture session is already open: ${input.captureId}`,
      }
    }
    const stateScope = input.declaration.stateScope ?? 'story'
    const stateStore = this.context.getStateStore()
    const state = stateScope === 'scene'
      ? stateStore.snapshot(STRAP_SCOPE_SCENE)
      : stateStore.snapshot(STRAP_SCOPE_STORY, input.storyId)
    const opened = RuntimeCaptureSession.open({
      declaration: input.declaration,
      state,
      startedAtMs: this.context.getCurrentTimeMs(),
    })
    if (!opened.ok) return opened
    this.captureSessions.set(input.captureId, {
      storyId: input.storyId,
      stateScope,
      session: opened.session,
    })
    return {
      ok: true,
      captureId: input.captureId,
      captureState: opened.session.getCaptureState(),
    }
  }

  /** Resolves a compiled capture declaration before opening its runtime session. */
  beginCompiled(input: RuntimeCompiledCaptureBeginInput): RuntimeCaptureBeginResult {
    let declaration: RuntimeCaptureBeginInput['declaration']
    try {
      declaration = resolveCompiledCaptureDeclaration(input.declaration, this.context.functions)
    } catch (error) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_FUNCTION_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Capture function is not available.',
      }
    }
    return this.begin({
      captureId: input.captureId,
      storyId: input.storyId,
      declaration,
    })
  }

  /** Forwards one source sample and reapplies the resulting live component state. */
  track(captureId: string, sample: RuntimeCaptureSample): RuntimeCaptureTrackResult {
    const entry = this.captureSessions.get(captureId)
    if (entry === undefined) return unknownCapture(captureId)
    const tracked = entry.session.track(sample)
    if (!tracked.ok) return tracked
    this.updateActiveAction(captureId, tracked.action)
    if (tracked.updateState !== undefined) {
      const previous = this.liveCaptureStateUpdates.get(captureId) ?? {}
      const merged = { ...previous, ...tracked.updateState }
      this.liveCaptureStateUpdates.set(captureId, merged)
      applyCaptureStateUpdate(this.context.getStateStore(), entry, tracked.updateState)
    }
    try {
      this.applyLiveCaptureActions()
    } catch (error) {
      return {
        ok: false,
        code: 'RUNTIME_CAPTURE_LIVE_APPLY_FAILED',
        message: error instanceof Error ? error.message : 'Live capture application failed.',
      }
    }
    return tracked
  }

  /** Closes one capture and routes its declared end events through the player. */
  async end(
    captureId: string,
    meta: Readonly<Record<string, unknown>> = {},
    captureStateOverride?: RuntimeCaptureState,
  ): Promise<RuntimeCapturePlayerEndResult | RuntimeCaptureFailure> {
    const entry = this.captureSessions.get(captureId)
    if (entry === undefined) return unknownCapture(captureId)
    const stateStore = this.context.getStateStore()
    const state = entry.stateScope === 'scene'
      ? stateStore.snapshot(STRAP_SCOPE_SCENE)
      : stateStore.snapshot(STRAP_SCOPE_STORY, entry.storyId)
    const ended = entry.session.end(
      state,
      meta,
      this.context.getCurrentTimeMs(),
      captureStateOverride,
    )
    this.activeCaptureActions.delete(captureId)
    if (!ended.ok) {
      this.removeCapture(captureId)
      this.context.synchronizeState()
      return ended
    }

    const dispatchResults: RuntimeEventDispatchResult[] = []
    const hasPersistOnlyEndCaptureEvents = ended.endCaptureEvents.length > 0
    try {
      for (const event of ended.endCaptureEvents) {
        dispatchResults.push(await this.context.emitEvent({
          name: event.name,
          applyAtMs: event.applyAtMs,
          storyId: event.cascade === true ? undefined : entry.storyId,
          data: event.data,
          mode: event.mode,
          meta,
        }, false))
      }
      if (ended.endEmitEvent !== undefined) {
        const event = ended.endEmitEvent
        dispatchResults.push(await this.context.emitEvent({
          name: event.name,
          applyAtMs: event.applyAtMs,
          storyId: event.cascade === true ? undefined : entry.storyId,
          data: event.data,
          mode: event.mode,
          meta,
        }, hasPersistOnlyEndCaptureEvents || event.mode === EVENT_INSERT_MODE_PERSIST_ONLY
          ? false
          : undefined))
      }
    } finally {
      this.removeCapture(captureId)
      this.context.synchronizeState()
    }
    return { ...ended, dispatchResults }
  }

  /** Cancels one open capture without producing a journal event. */
  cancel(captureId: string): Readonly<{ ok: true } | RuntimeCaptureFailure> {
    const entry = this.captureSessions.get(captureId)
    if (entry === undefined) return unknownCapture(captureId)
    entry.session.cancel()
    this.removeCapture(captureId)
    this.context.synchronizeState()
    this.applyLiveCaptureActions()
    return { ok: true }
  }

  /** Cancels every open capture before seek, reset, terminal stop or destroy. */
  cancelAll(): void {
    cancelActiveCaptures(
      this.captureSessions,
      this.activeCaptureActions,
      this.liveCaptureStateUpdates,
    )
    this.liveCapturePersoKeys = new Set()
  }

  /** Reapplies currently active capture actions through the component runtime. */
  applyLiveCaptureActions(scene?: SolvedScene): void {
    this.liveCapturePersoKeys = applyLiveCaptureActions(
      scene ?? this.context.getSolvedScene(),
      this.context.componentRuntime,
      this.activeCaptureActions,
      this.liveCapturePersoKeys,
      this.context.functions,
    )
  }

  /** Updates the resolved component targets for one tracked action. */
  private updateActiveAction(captureId: string, action: RuntimeCaptureAction | undefined): void {
    if (action === undefined) {
      this.activeCaptureActions.delete(captureId)
      return
    }
    const previous = this.activeCaptureActions.get(captureId)
    const targets = previous !== undefined && previous.action.actionName === action.actionName
      ? previous.targets
      : this.compiledCaptureActionTargets.get(action.actionName) ?? []
    this.activeCaptureActions.set(captureId, { action, targets })
  }

  /** Removes every transient value associated with one capture id. */
  private removeCapture(captureId: string): void {
    this.captureSessions.delete(captureId)
    this.activeCaptureActions.delete(captureId)
    this.liveCaptureStateUpdates.delete(captureId)
  }
}

/** Creates the stable failure returned for an unknown capture id. */
function unknownCapture(captureId: string): RuntimeCaptureFailure {
  return {
    ok: false,
    code: 'RUNTIME_CAPTURE_UNKNOWN',
    message: `Capture session is not open: ${captureId}`,
  }
}
