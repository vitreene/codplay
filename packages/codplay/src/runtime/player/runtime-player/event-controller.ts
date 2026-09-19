import type { DiagnosticOutput } from '../../../diagnostics'
import { DiagnosticCollector } from '../../../diagnostics'
import type { CompiledFunctionCollection, CompiledScene } from '../../../scene/compiled'
import type { EngineFrame, RuntimeModuleServiceInstance } from '../../engine'
import {
  PLAYER_LIFECYCLE_PLAYING,
  type PlayerLifecycleState,
} from '../../config/player-lifecycle'
import { EVENT_INSERT_MODE_PERSIST_ONLY } from '../../config/event-insertion'
import { TRACK_GLOBAL_ID } from '../../config/track'
import { diffSolvedScenes } from '../../move'
import type { RuntimeIdleMonitor } from '../../idle'
import {
  notifyModuleMoveDeltas,
  notifyModulePlaybackState,
  resolveModuleTimeline,
} from '../modules'
import type { RuntimePlayerEmitInput } from '../capture'
import {
  resolveStoryTrackId,
  RuntimeEventDispatcher,
  type RuntimeEventDispatchResult,
  type RuntimeStateStore,
  type RuntimeTrackEvent,
  type RuntimeTrackJournal,
  type StrapCollections,
} from '../pipeline'
import type {
  RuntimePlayerEventime,
  RuntimePlayerEventimeResult,
  RuntimePlayerEventimeTarget,
} from '../eventime'
import {
  isImmediateTrackControlEvent,
  normalizeRuntimeEventime,
  resolveEventimeTarget,
  shouldDispatchImmediateStoryEventime,
} from './eventime-routing'
import {
  collectSequenceEndOccurrences,
  compareSequenceEndOccurrences,
  isSequenceEndInRange,
  RUNTIME_SEQUENCE_END_EVENT_NAME,
  type RuntimeSequenceEndOccurrence,
} from './sequence-end'
import type { RuntimePlayerCaptureController } from './capture-controller'
import type { RuntimePlayerPresentation } from './presentation'
import type { RuntimePlayerSceneState } from './scene-state'
import type { RuntimePlayerState } from './player-state'

/** Dependencies used by the player event and frame boundary. */
export type RuntimePlayerEventControllerContext = Readonly<{
  state: RuntimePlayerState
  compiledScene: CompiledScene
  strapCollections: StrapCollections | undefined
  trackJournal: RuntimeTrackJournal
  functions: CompiledFunctionCollection
  stateStore: RuntimeStateStore
  sceneState: RuntimePlayerSceneState
  presentation: RuntimePlayerPresentation
  renderSync: {
    tick(nowMs: number, timelineMs: number, rate: number): void
    pause(): void
  }
  moduleServiceInstances: Map<string, RuntimeModuleServiceInstance>
  captureController: RuntimePlayerCaptureController
  idleMonitor: RuntimeIdleMonitor
  diagnosticOutput: DiagnosticOutput | undefined
  publicEventListener: ((event: RuntimeTrackEvent) => void) | undefined
  traceEventListener: ((event: RuntimeTrackEvent) => void) | undefined
  journalChangeListener: (() => void) | undefined
  notifyTransportObservers: () => void
  requireState: (...allowed: PlayerLifecycleState[]) => void
  requireSequenceActive: (operation: string) => void
  invokeSceneLifecycleHook: (
    hookName: 'init' | 'onStart' | 'onSequenceEnd',
    diagnostics?: DiagnosticCollector,
  ) => boolean
}>

/** Owns live events, reached eventimes, frame progression and terminal cleanup. */
export class RuntimePlayerEventController {
  private readonly context: RuntimePlayerEventControllerContext
  private nextRuntimeEventId = 0
  private readonly observedPublicEventIds = new Set<string>()

  /** Creates the event boundary for one player instance. */
  constructor(context: RuntimePlayerEventControllerContext) {
    this.context = context
  }

  /** Resets public-event observation when playback is rebuilt from time zero. */
  resetForReplay(): void {
    this.observedPublicEventIds.clear()
  }

  /** Routes one public live event through the player journal. */
  async emit(input: RuntimePlayerEmitInput): Promise<RuntimeEventDispatchResult> {
    return this.emitEvent(input)
  }

  /** Integrates one external relative eventime into the player journal. */
  async emitEventime(
    eventime: RuntimePlayerEventime,
    target: RuntimePlayerEventimeTarget,
  ): Promise<RuntimePlayerEventimeResult> {
    const { state } = this.context
    this.context.requireState('ready', 'playing', 'paused')
    this.context.requireSequenceActive('emitEventime')
    const normalized = normalizeRuntimeEventime(eventime, true)
    const resolvedTarget = resolveEventimeTarget(this.context.compiledScene, target)
    if (shouldDispatchImmediateStoryEventime(this.context.compiledScene, eventime, target)
      || isImmediateTrackControlEvent(eventime)) {
      const dispatched = await this.emitEvent({
        name: eventime.name,
        applyAtMs: state.currentTimeMs,
        trackId: resolvedTarget.trackId,
        storyId: resolvedTarget.storyId,
        visibility: normalized.eventime.visibility,
        data: normalized.eventime.data,
        mode: normalized.mode,
      })
      if (!dispatched.ok) {
        throw new Error(dispatched.issues.map((issue) => issue.message).join(' '))
      }
      return { events: dispatched.events }
    }

    const appended = this.context.trackJournal.appendAnchoredEventimes({
      trackId: resolvedTarget.trackId,
      storyId: resolvedTarget.storyId,
      anchorMs: state.currentTimeMs,
      eventimes: [normalized.eventime],
      mode: normalized.mode,
    })
    if (!appended.ok) {
      throw new Error(appended.message)
    }
    this.context.idleMonitor.reset()
    state.includePersistOnlyInCurrent = normalized.mode !== EVENT_INSERT_MODE_PERSIST_ONLY
    if (normalized.mode === EVENT_INSERT_MODE_PERSIST_ONLY) {
      this.context.sceneState.synchronize(state.currentTimeMs, false)
    }
    this.notifyTraceEvents(appended.data.events)
    this.context.journalChangeListener?.()
    const resetStoryIds = normalized.mode === EVENT_INSERT_MODE_PERSIST_ONLY
      ? []
      : this.resolvePresentedResetStoryIds(appended.data.events)
    if (resetStoryIds.length > 0 && state.solvedScene !== undefined) {
      const previousSolvedScene = state.solvedScene
      const nextSolvedScene = this.context.sceneState.reconstruct(
        state.currentTimeMs,
        state.includePersistOnlyInCurrent,
        state.snapshotContribution,
      )
      const moveDeltas = diffSolvedScenes(previousSolvedScene, nextSolvedScene)
      this.context.sceneState.synchronizeFromScene(nextSolvedScene)
      notifyModuleMoveDeltas(
        this.context.moduleServiceInstances,
        previousSolvedScene,
        nextSolvedScene,
        new Set(),
        moveDeltas,
      )
      state.solvedScene = nextSolvedScene
      this.context.presentation.present(nextSolvedScene, {
        previousScene: previousSolvedScene,
        moveDeltas,
        resetStoryIds,
      })
      this.context.notifyTransportObservers()
    }
    return appended.data
  }

  /** Routes one event and optionally advances the current presentation boundary. */
  async emitEvent(
    input: RuntimePlayerEmitInput,
    includePersistOnlyOverride?: boolean,
    resetIdle = true,
    existingEvent?: RuntimeTrackEvent,
    frame?: EngineFrame,
    publicEventPreviousTimeMs?: number,
  ): Promise<RuntimeEventDispatchResult> {
    const { state } = this.context
    this.context.requireState('ready', 'playing', 'paused')
    this.context.requireSequenceActive('emit')
    const dispatchInput = {
      ...input,
      applyAtMs: input.applyAtMs ?? state.currentTimeMs,
    }
    const waitsForTerminalDispatch = state.lifecycle === PLAYER_LIFECYCLE_PLAYING
      && dispatchInput.mode !== EVENT_INSERT_MODE_PERSIST_ONLY
      && dispatchInput.name === RUNTIME_SEQUENCE_END_EVENT_NAME
    if (waitsForTerminalDispatch) {
      state.sequenceEndPending = true
    }
    this.context.sceneState.synchronize(
      state.currentTimeMs,
      state.includePersistOnlyInCurrent,
    )
    const dispatcher = new RuntimeEventDispatcher({
      scene: this.context.compiledScene,
      journal: this.context.trackJournal,
      strapCollections: this.context.strapCollections,
      functions: this.context.functions,
      stateStore: this.context.stateStore,
      eventIdFactory: () => this.createRuntimeEventId(),
    })
    try {
      const result = await dispatcher.dispatch(dispatchInput, existingEvent)
      this.notifyTraceEvents(existingEvent === undefined
        ? result.events
        : result.events.filter((event) => event.eventId !== existingEvent.eventId))
      if (resetIdle && result.events.length > 0) {
        this.context.idleMonitor.reset()
      }
      if (includePersistOnlyOverride !== undefined) {
        state.includePersistOnlyInCurrent = includePersistOnlyOverride
      } else if (dispatchInput.mode === EVENT_INSERT_MODE_PERSIST_ONLY) {
        state.includePersistOnlyInCurrent = false
      }
      this.context.sceneState.synchronize(
        state.currentTimeMs,
        state.includePersistOnlyInCurrent,
      )
      if (dispatchInput.mode === EVENT_INSERT_MODE_PERSIST_ONLY) {
        state.sequenceEndPending = false
        return result
      }

      const sequenceEndTime = this.resolveSequenceEndEventTime(result.events, state.currentTimeMs)
      if (state.lifecycle === PLAYER_LIFECYCLE_PLAYING && sequenceEndTime !== undefined) {
        state.currentTimeMs = Math.min(state.currentTimeMs, sequenceEndTime)
      }
      const nextSolvedScene = this.context.sceneState.reconstruct(
        state.currentTimeMs,
        state.includePersistOnlyInCurrent,
        state.snapshotContribution,
      )
      const previousSolvedScene = state.solvedScene
      const moveDeltas = previousSolvedScene === undefined
        ? []
        : diffSolvedScenes(previousSolvedScene, nextSolvedScene)
      const resetStoryIds = this.resolvePresentedResetStoryIds(result.events)
      const isolationClosedStoryIds = result.isolationClosedStoryIds ?? []
      notifyModuleMoveDeltas(
        this.context.moduleServiceInstances,
        previousSolvedScene,
        nextSolvedScene,
        new Set(),
        moveDeltas,
      )
      state.solvedScene = nextSolvedScene
      this.context.presentation.present(nextSolvedScene, {
        previousScene: previousSolvedScene,
        moveDeltas,
        ...(resetStoryIds.length === 0 ? {} : { resetStoryIds }),
        ...(isolationClosedStoryIds.length === 0 ? {} : { isolationClosedStoryIds }),
      })
      if (frame !== undefined) {
        this.context.renderSync.tick(frame.nowMs, state.currentTimeMs, state.rate)
      }
      this.context.notifyTransportObservers()
      if (state.lifecycle === PLAYER_LIFECYCLE_PLAYING && sequenceEndTime !== undefined) {
        this.notifyPublicEvents(
          publicEventPreviousTimeMs ?? state.currentTimeMs,
          state.currentTimeMs,
        )
        this.finalizeSequenceEnd(sequenceEndTime)
      } else {
        state.sequenceEndPending = false
      }
      return result
    } catch (error) {
      state.sequenceEndPending = false
      throw error
    }
  }

  /** Applies one engine frame to the logical clock while playing. */
  onEngineFrame(frame: EngineFrame): void {
    const { state } = this.context
    if (state.lifecycle !== PLAYER_LIFECYCLE_PLAYING
      || state.sequenceEnded
      || state.sequenceEndPending) {
      return
    }
    if (state.skipNextDelta) {
      state.skipNextDelta = false
      this.context.renderSync.tick(frame.nowMs, state.currentTimeMs, state.rate)
      return
    }

    const previousTimeMs = state.currentTimeMs
    state.currentTimeMs += frame.deltaMs * state.rate
    if (this.context.idleMonitor.advance(frame.deltaMs)) {
      this.dispatchIdleEvent()
    }
    if (state.sequenceEndPending) {
      return
    }
    state.currentTimeMs = resolveModuleTimeline(
      this.context.moduleServiceInstances,
      state.currentTimeMs,
    )
    state.discoveredDurationMs = Math.max(
      state.discoveredDurationMs,
      state.currentTimeMs,
    )
    const sequenceEnd = this.findSequenceEndBetween(
      previousTimeMs,
      state.currentTimeMs,
    )
    if (sequenceEnd !== undefined) {
      state.currentTimeMs = sequenceEnd.applyAtMs
      state.discoveredDurationMs = Math.max(
        state.discoveredDurationMs,
        state.currentTimeMs,
      )
      void this.dispatchReachedSequenceEnd(sequenceEnd, frame, previousTimeMs).catch((error) => {
        this.reportAutomaticSequenceEndFailure(error)
      })
      return
    }

    const frameScene = this.context.sceneState.resolveFrame(
      previousTimeMs,
      state.currentTimeMs,
      state.includePersistOnlyInCurrent,
      state.solvedScene,
      state.snapshotContribution,
    )
    const nextSolvedScene = frameScene.scene
    const previousSolvedScene = state.solvedScene
    const moveDeltas = frameScene.reconstructed && previousSolvedScene !== undefined
      ? diffSolvedScenes(previousSolvedScene, nextSolvedScene)
      : []
    if (frameScene.reconstructed) {
      this.context.sceneState.synchronizeFromScene(nextSolvedScene)
      notifyModuleMoveDeltas(
        this.context.moduleServiceInstances,
        previousSolvedScene,
        nextSolvedScene,
        new Set(),
        moveDeltas,
      )
    }
    state.solvedScene = nextSolvedScene
    this.context.presentation.present(nextSolvedScene, {
      previousScene: previousSolvedScene,
      moveDeltas,
    })
    this.notifyPublicEvents(
      previousSolvedScene?.timeMs ?? state.currentTimeMs,
      state.currentTimeMs,
    )
    this.context.renderSync.tick(frame.nowMs, state.currentTimeMs, state.rate)
    this.context.notifyTransportObservers()
  }

  /** Finds a terminal occurrence at or before the current playback head. */
  findSequenceEndAt(currentTimeMs: number): RuntimeSequenceEndOccurrence | undefined {
    return this.findSequenceEndBetween(undefined, currentTimeMs)
  }

  /** Sends one reached sequence:end through the ordinary event circuit. */
  async dispatchReachedSequenceEnd(
    occurrence: RuntimeSequenceEndOccurrence,
    frame?: EngineFrame,
    publicEventPreviousTimeMs?: number,
  ): Promise<void> {
    const existingEvent = occurrence.kind === 'journal' ? occurrence.event : undefined
    const result = await this.emitEvent(
      occurrence.kind === 'journal'
        ? {
          name: occurrence.event.name,
          applyAtMs: occurrence.event.applyAtMs,
          eventId: occurrence.event.eventId,
          trackId: occurrence.event.trackId,
          storyId: occurrence.event.storyId,
          data: occurrence.event.data,
          visibility: occurrence.event.visibility,
          context: occurrence.event.context,
          meta: occurrence.event.meta,
          mode: occurrence.event.mode,
        }
        : {
          name: occurrence.event.name,
          applyAtMs: occurrence.applyAtMs,
          eventId: occurrence.eventId,
          trackId: occurrence.trackId,
          storyId: occurrence.storyId,
          data: occurrence.event.data,
          visibility: occurrence.event.visibility,
        },
      undefined,
      false,
      existingEvent,
      frame,
      publicEventPreviousTimeMs,
    )
    if (result.ok) {
      return
    }
    this.reportAutomaticSequenceEndFailure(
      new Error(
        result.issues.map((issue) => issue.message).join(' ')
          || 'Reached sequence:end was rejected.',
      ),
    )
  }

  /** Reports a failure while consuming an automatic sequence:end occurrence. */
  reportAutomaticSequenceEndFailure(error: unknown): void {
    const diagnostics = new DiagnosticCollector({ output: this.context.diagnosticOutput })
    diagnostics.error(
      'RUNTIME_SEQUENCE_END_FAILED',
      error instanceof Error ? error.message : 'Reached sequence:end failed.',
      {
        context: {
          eventName: RUNTIME_SEQUENCE_END_EVENT_NAME,
          source: 'playback',
        },
      },
    )
  }

  /** Completes terminal cleanup after the sequence:end event was presented. */
  private finalizeSequenceEnd(sequenceEndMs: number): void {
    const { state } = this.context
    if (state.sequenceEnded) {
      return
    }
    state.sequenceEndPending = false
    state.sequenceEnded = true
    this.context.captureController.cancelAll()
    this.context.idleMonitor.reset()
    state.currentTimeMs = Math.max(0, Math.min(state.currentTimeMs, sequenceEndMs))
    state.discoveredDurationMs = Math.max(
      state.discoveredDurationMs,
      state.currentTimeMs,
    )
    this.context.renderSync.pause()
    state.lifecycle = 'paused'
    notifyModulePlaybackState(
      this.context.moduleServiceInstances,
      'paused',
      state.currentTimeMs,
    )
    this.context.invokeSceneLifecycleHook('onSequenceEnd')
    this.context.notifyTransportObservers()
  }

  /** Emits the configured idle event through the ordinary event circuit. */
  private dispatchIdleEvent(): void {
    const event = this.context.idleMonitor.getEvent()
    if (event === undefined) {
      return
    }
    const { state } = this.context
    void this.emitEvent({
      name: event.name,
      applyAtMs: state.currentTimeMs,
      data: event.data,
      visibility: event.visibility,
      storyId: event.storyId,
      context: { source: 'idle' },
    }, undefined, false).then((result) => {
      if (result.ok) {
        return
      }
      const diagnostics = new DiagnosticCollector({
        output: this.context.diagnosticOutput,
      })
      diagnostics.error(
        'RUNTIME_IDLE_EVENT_FAILED',
        result.issues.map((issue) => issue.message).join(' ')
          || 'Configured idle event was rejected.',
        {
          context: {
            eventName: event.name,
            source: 'idle',
          },
        },
      )
    }).catch((error: unknown) => {
      const diagnostics = new DiagnosticCollector({
        output: this.context.diagnosticOutput,
      })
      diagnostics.error(
        'RUNTIME_IDLE_EVENT_FAILED',
        error instanceof Error ? error.message : 'Configured idle event failed.',
        {
          context: {
            eventName: event.name,
            source: 'idle',
          },
        },
      )
    })
  }

  /** Finds the earliest active terminal event crossed by one frame. */
  private findSequenceEndBetween(
    previousTimeMs: number | undefined,
    currentTimeMs: number,
  ): RuntimeSequenceEndOccurrence | undefined {
    const candidates: RuntimeSequenceEndOccurrence[] = []
    const { compiledScene, trackJournal } = this.context
    if (trackJournal.isTrackActive(TRACK_GLOBAL_ID)) {
      for (const occurrence of collectSequenceEndOccurrences(
        compiledScene.scene.eventimes ?? [],
        'scene',
        TRACK_GLOBAL_ID,
        undefined,
      )) {
        if (occurrence.kind !== 'compiled') {
          continue
        }
        if (trackJournal.getEvents(occurrence.trackId)
          .some((event) => event.eventId === occurrence.eventId)) {
          continue
        }
        if (isSequenceEndInRange(occurrence.applyAtMs, previousTimeMs, currentTimeMs)) {
          candidates.push(occurrence)
        }
      }
    }
    for (const story of Object.values(compiledScene.scene.stories)) {
      const trackId = resolveStoryTrackId(story)
      if (!trackJournal.isTrackActive(trackId)) {
        continue
      }
      for (const occurrence of collectSequenceEndOccurrences(
        story.eventimes ?? [],
        'story',
        trackId,
        story.id,
      )) {
        if (occurrence.kind !== 'compiled') {
          continue
        }
        if (trackJournal.getEvents(occurrence.trackId)
          .some((event) => event.eventId === occurrence.eventId)) {
          continue
        }
        if (isSequenceEndInRange(occurrence.applyAtMs, previousTimeMs, currentTimeMs)) {
          candidates.push(occurrence)
        }
      }
    }
    for (const event of trackJournal.getAllEvents()) {
      if (event.name !== RUNTIME_SEQUENCE_END_EVENT_NAME
        || event.mode === EVENT_INSERT_MODE_PERSIST_ONLY
        || !trackJournal.isTrackActive(event.trackId)) {
        continue
      }
      if (isSequenceEndInRange(event.applyAtMs, previousTimeMs, currentTimeMs)) {
        candidates.push({ kind: 'journal', event, applyAtMs: event.applyAtMs })
      }
    }
    if (candidates.length === 0) {
      return undefined
    }
    return candidates.sort(compareSequenceEndOccurrences)[0]
  }

  /** Finds a terminal event accepted by one live dispatch at the current head. */
  private resolveSequenceEndEventTime(
    events: readonly RuntimeTrackEvent[],
    currentTimeMs: number,
  ): number | undefined {
    const candidates = events
      .filter((event) => event.name === RUNTIME_SEQUENCE_END_EVENT_NAME
        && event.mode !== EVENT_INSERT_MODE_PERSIST_ONLY
        && event.applyAtMs <= currentTimeMs
        && this.context.trackJournal.isTrackActive(event.trackId))
      .map((event) => event.applyAtMs)
    if (candidates.length === 0) {
      return undefined
    }
    return Math.min(...candidates)
  }

  /** Selects reset boundaries effective at the current presentation head. */
  private resolvePresentedResetStoryIds(events: readonly RuntimeTrackEvent[]): readonly string[] {
    const { state, compiledScene, trackJournal } = this.context
    const storyIds = new Set<string>()
    for (const event of events) {
      if (event.applyAtMs > state.currentTimeMs
        || event.mode === EVENT_INSERT_MODE_PERSIST_ONLY
        || !trackJournal.isTrackActive(event.trackId)) {
        continue
      }
      for (const storyId of Object.keys(compiledScene.scene.stories)) {
        if (trackJournal.isStoryResetEvent(storyId, event)) {
          storyIds.add(storyId)
        }
      }
    }
    return [...storyIds]
  }

  /** Forwards successfully journaled live events without affecting playback. */
  private notifyTraceEvents(events: readonly RuntimeTrackEvent[]): void {
    if (this.context.traceEventListener === undefined) {
      return
    }
    for (const event of events) {
      try {
        this.context.traceEventListener(event)
      } catch {
        // Trace observers are diagnostic consumers and must not break dispatch.
      }
    }
  }

  /** Publishes newly reached public eventime occurrences without replaying seeks. */
  private notifyPublicEvents(previousTimeMs: number, currentTimeMs: number): void {
    const listener = this.context.publicEventListener
    if (listener === undefined) {
      return
    }
    for (const event of this.context.trackJournal.getAllEvents()) {
      if (event.visibility !== 'public'
        || event.applyAtMs > currentTimeMs
        || event.applyAtMs < previousTimeMs
        || this.observedPublicEventIds.has(event.eventId)) {
        continue
      }
      this.observedPublicEventIds.add(event.eventId)
      listener(event)
    }
  }

  /** Allocates one player-scoped identity for every live event dispatch. */
  private createRuntimeEventId(): string {
    const index = this.nextRuntimeEventId
    this.nextRuntimeEventId += 1
    return `runtime-dispatch:${this.context.compiledScene.scene.id}:${index}`
  }
}
