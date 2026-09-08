import {
  RUNTIME_STATE_UPDATE_EVENT,
  TRACK_EVENT_ACTIVATE,
  TRACK_EVENT_DEACTIVATE,
  TRACK_EVENT_TOGGLE,
} from '../../config/track-events'
import { STRAP_SCOPE_SCENE, STRAP_SCOPE_STORY, type StrapScope } from '../../config/strap-scope'
import { TRACK_GLOBAL_ID } from '../../config/track'
import type { RuntimeEventInsertMode } from '../../config/event-insertion'
import { isPlainRecord } from '../../../shared'
import type { CompiledEventime, CompiledListenRule, CompiledRecord, CompiledScene } from '../../../scene/compiled'
import { buildTrackRegistry, createStrapTrackId, type MaterializedTrackRegistry } from './tracks'
import type { StrapEvent, StrapExecutionResult } from './strap-executor'

/** One event appended to a declared runtime track. */
export type RuntimeTrackEvent = Readonly<{
  eventId: string
  eventSeq: number
  trackId: string
  name: string
  applyAtMs: number
  storyId?: string
  /** Internal provenance of the story isolation period that produced the fact. */
  activationId?: string
  data?: CompiledRecord
  update?: CompiledRecord
  stateScope?: StrapScope
  /** Marks a scene-level event that must be visible while materializing every story. */
  cascade?: boolean
  /** Opaque event context preserved in the journal for runtime consumers. */
  context?: Readonly<Record<string, unknown>>
  /** Opaque runtime metadata preserved in the journal for diagnostics. */
  meta?: Readonly<Record<string, unknown>>
  /** Controls whether the fact enters the current presentation at insertion. */
  mode?: RuntimeEventInsertMode
  /** Named visibility retained for public event observation. */
  visibility?: CompiledEventime['visibility']
}>

/** One story reset boundary retained by the runtime journal. */
export type RuntimeStoryResetBoundary = Readonly<{
  applyAtMs: number
  eventSeq: number
}>

/** Input used to append one live event without creating a track. */
export type AppendRuntimeTrackEventInput = Readonly<{
  eventId: string
  trackId: string
  name: string
  applyAtMs: number
  storyId?: string
  /** Internal transition applied atomically with this source event. */
  storyIsolation?: RuntimeStoryIsolationAction
  data?: CompiledRecord
  update?: CompiledRecord
  stateScope?: StrapScope
  cascade?: boolean
  context?: Readonly<Record<string, unknown>>
  meta?: Readonly<Record<string, unknown>>
  mode?: RuntimeEventInsertMode
  visibility?: CompiledEventime['visibility']
}>

/** One declarative story isolation transition applied by the journal. */
export type RuntimeStoryIsolationAction = 'activate' | 'deactivate'

/** Input used to anchor a portable relative eventime tree at runtime. */
export type AppendAnchoredEventimesInput = Readonly<{
  trackId: string
  storyId?: string
  anchorMs: number
  eventimes: readonly CompiledEventime[]
  cascade?: boolean
  mode?: RuntimeEventInsertMode
  context?: Readonly<Record<string, unknown>>
  meta?: Readonly<Record<string, unknown>>
}>

/** Result returned by a runtime track command. */
export type TrackCommandResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; code: string; message: string }>

/** Result of one track activation command. */
export type TrackActivationResult = Readonly<{
  activated: readonly string[]
  deactivated: readonly string[]
  ignored: readonly string[]
}>

/** Result returned after anchoring a relative eventime tree. */
export type AnchoredEventimesResult = Readonly<{
  appendedCount: number
  events: readonly RuntimeTrackEvent[]
}>

/** Input used to persist one strap's immediate and planned event outputs. */
export type AppendStrapOutputInput = Readonly<{
  scope: StrapScope
  storyId?: string
  strapName: string
  anchorMs: number
  output: StrapExecutionResult
  mode?: RuntimeEventInsertMode
}>

/** Result of persisting event-bearing strap output. */
export type StrapOutputAppendResult = Readonly<{
  trackId: string
  events: readonly RuntimeTrackEvent[]
  immediateEvents: readonly RuntimeTrackEvent[]
  isolationClosedStoryIds: readonly string[]
  materializedUpdateCount: number
}>

/** Runtime journal layered over the immutable compiled track registry. */
export class RuntimeTrackJournal {
  private readonly scene: CompiledScene
  readonly registry: MaterializedTrackRegistry
  private readonly activeTrackIds: Map<string, boolean>
  private readonly eventsByTrack = new Map<string, RuntimeTrackEvent[]>()
  private readonly isolatedStoryIds: ReadonlySet<string>
  private readonly activationPeriodsByStory = new Map<string, MutableStoryActivationPeriod[]>()
  private currentIsolation: MutableStoryActivationPeriod | undefined
  private readonly eventIds = new Set<string>()
  private nextEventSeq = 0
  private nextActivationId = 0
  private nextGeneratedEventId = 0
  private revision = 0

  /** Creates a mutable live journal from one immutable compiled scene. */
  constructor(scene: CompiledScene) {
    this.scene = scene
    this.registry = buildTrackRegistry(scene)
    this.activeTrackIds = new Map(
      Object.values(this.registry.tracks).map((track) => [track.id, track.active]),
    )
    this.isolatedStoryIds = new Set(
      Object.values(scene.scene.stories)
        .filter((story) => story.listen.some((rule) => rule.active !== undefined))
        .map((story) => story.id),
    )
  }

  /** Returns whether one declared track currently accepts materialization. */
  isTrackActive(trackId: string): boolean {
    return this.activeTrackIds.get(trackId) === true
  }

  /** Appends one live event to an already declared track. */
  appendLiveEvent(input: AppendRuntimeTrackEventInput): TrackCommandResult<RuntimeTrackEvent> {
    if (!this.registry.tracks[input.trackId]) {
      return { ok: false, code: 'RUNTIME_TRACK_UNKNOWN', message: `Track is not declared: ${input.trackId}` }
    }
    if (this.eventIds.has(input.eventId)) {
      return { ok: false, code: 'RUNTIME_EVENT_DUPLICATE', message: `Event is already appended: ${input.eventId}` }
    }
    if (!Number.isFinite(input.applyAtMs)) {
      return { ok: false, code: 'RUNTIME_EVENT_TIME_INVALID', message: 'Runtime event time must be finite.' }
    }

    if (input.storyIsolation !== undefined
      && (input.storyId === undefined || !this.isolatedStoryIds.has(input.storyId))) {
      return {
        ok: false,
        code: 'RUNTIME_STORY_ISOLATION_TARGET_INVALID',
        message: 'Story isolation transitions require an isolated declared story target.',
      }
    }

    if (input.storyId !== undefined && this.isStoryIsolationEnabled(input.storyId)) {
      this.reconcileStoryIsolationAt(input.applyAtMs)
    }
    const eventSeq = this.nextEventSeq
    const activationId = this.applyStoryIsolationTransition(
      input.storyId,
      input.storyIsolation,
      input.applyAtMs,
      eventSeq,
    )
    const { storyIsolation: _storyIsolation, ...eventInput } = input
    const event: RuntimeTrackEvent = {
      ...eventInput,
      eventSeq,
      ...(activationId === undefined ? {} : { activationId }),
    }
    this.nextEventSeq += 1
    this.eventIds.add(input.eventId)
    const events = this.eventsByTrack.get(input.trackId) ?? []
    events.push(event)
    events.sort((left, right) => left.applyAtMs - right.applyAtMs || left.eventSeq - right.eventSeq)
    this.eventsByTrack.set(input.trackId, events)
    this.revision += 1
    return { ok: true, data: event }
  }

  /** Anchors and appends a relative eventime tree without creating a track. */
  appendAnchoredEventimes(
    input: AppendAnchoredEventimesInput,
  ): TrackCommandResult<AnchoredEventimesResult> {
    if (!this.registry.tracks[input.trackId]) {
      return { ok: false, code: 'RUNTIME_TRACK_UNKNOWN', message: `Track is not declared: ${input.trackId}` }
    }
    if (!Number.isFinite(input.anchorMs)) {
      return { ok: false, code: 'RUNTIME_EVENT_ANCHOR_INVALID', message: 'Eventime anchor must be finite.' }
    }

    const flattened = flattenAnchoredEventimes(input.eventimes, input.anchorMs)
    const appended: RuntimeTrackEvent[] = []
    for (const event of flattened) {
      const result = this.appendLiveEvent({
        eventId: this.createGeneratedEventId(input.trackId, input.storyId),
        trackId: input.trackId,
        storyId: input.storyId,
        name: event.name,
        applyAtMs: event.applyAtMs,
        data: event.data,
        cascade: input.cascade,
        context: input.context,
        meta: input.meta,
        mode: input.mode,
        visibility: event.visibility,
      })
      if (!result.ok) return result
      appended.push(result.data)
    }
    return { ok: true, data: { appendedCount: appended.length, events: appended } }
  }

  /** Persists strap events on the already declared dedicated strap track. */
  appendStrapOutput(input: AppendStrapOutputInput): TrackCommandResult<StrapOutputAppendResult> {
    if (input.scope === STRAP_SCOPE_STORY && input.storyId === undefined) {
      return { ok: false, code: 'RUNTIME_STRAP_STORY_ID_MISSING', message: 'Story strap output requires storyId.' }
    }
    if (!Number.isFinite(input.anchorMs)) {
      return { ok: false, code: 'RUNTIME_EVENT_ANCHOR_INVALID', message: 'Strap output anchor must be finite.' }
    }
    const trackId = createStrapTrackId(
      input.scope === STRAP_SCOPE_STORY ? input.storyId : undefined,
      input.strapName,
    )
    if (!this.registry.tracks[trackId]) {
      return { ok: false, code: 'RUNTIME_STRAP_TRACK_UNKNOWN', message: `Strap track is not declared: ${trackId}` }
    }
    for (const occurrence of input.output.planned) {
      if (!Number.isFinite(occurrence.offsetMs) || occurrence.offsetMs < 0) {
        return { ok: false, code: 'RUNTIME_STRAP_OFFSET_INVALID', message: 'Planned strap offset must be finite and non-negative.' }
      }
    }

    const events: RuntimeTrackEvent[] = []
    const immediateEvents: RuntimeTrackEvent[] = []
    const isolationClosedStoryIds: string[] = []
    const storyId = input.storyId
    for (const event of input.output.events) {
      const targetStoryId = event.storyId ?? storyId
      const storyIsolation = this.resolveStoryIsolationAction(targetStoryId, event.name)
      const previousIsolationOwner = this.currentIsolation?.storyId
      const appended = this.appendStrapEvent(
        event,
        trackId,
        storyId,
        input.scope === STRAP_SCOPE_SCENE,
        input.anchorMs,
        input.mode,
        storyIsolation,
      )
      if (!appended.ok) return appended
      events.push(appended.data)
      immediateEvents.push(appended.data)
      if (storyIsolation !== undefined
        && previousIsolationOwner !== undefined
        && (storyIsolation === 'activate' || previousIsolationOwner === targetStoryId)) {
        isolationClosedStoryIds.push(previousIsolationOwner)
      }
    }
    for (const update of input.output.updates) {
      const appended = this.appendStateUpdate(update, trackId, input.scope, input.storyId, input.anchorMs, input.mode)
      if (!appended.ok) return appended
      events.push(appended.data)
    }
    for (const occurrence of input.output.planned) {
      if (occurrence.step.event !== undefined) {
        const appended = this.appendStrapEvent(
          occurrence.step.event,
          trackId,
          storyId,
          input.scope === STRAP_SCOPE_SCENE,
          input.anchorMs + occurrence.offsetMs,
          input.mode,
        )
        if (!appended.ok) return appended
        events.push(appended.data)
      }
      if (occurrence.step.update !== undefined) {
        const appended = this.appendStateUpdate(
          occurrence.step.update,
          trackId,
          input.scope,
          input.storyId,
          input.anchorMs + occurrence.offsetMs,
          input.mode,
        )
        if (!appended.ok) return appended
        events.push(appended.data)
      }
    }
    return {
      ok: true,
      data: {
        trackId,
        events,
        immediateEvents,
        isolationClosedStoryIds: Object.freeze([...new Set(isolationClosedStoryIds)]),
        materializedUpdateCount: input.output.updates.length + input.output.planned.filter((occurrence) => occurrence.step.update !== undefined).length,
      },
    }
  }

  /** Applies one scene-level track control without creating a track. */
  applyControlEvent(name: string, data: CompiledRecord | undefined): TrackCommandResult<TrackActivationResult> {
    const trackIds = readTrackIds(data)
    if (trackIds === null) {
      return { ok: false, code: 'RUNTIME_TRACK_CONTROL_INVALID', message: 'Track control requires data.trackIds.' }
    }
    if (name === TRACK_EVENT_ACTIVATE) return this.setTrackActivity(trackIds, true)
    if (name === TRACK_EVENT_DEACTIVATE) return this.setTrackActivity(trackIds, false)
    if (name === TRACK_EVENT_TOGGLE) {
      const activated: string[] = []
      const deactivated: string[] = []
      const ignored: string[] = []
      for (const trackId of trackIds) {
        const current = this.activeTrackIds.get(trackId)
        if (current === undefined) {
          ignored.push(trackId)
        } else if (current) {
          this.activeTrackIds.set(trackId, false)
          deactivated.push(trackId)
        } else {
          this.activeTrackIds.set(trackId, true)
          activated.push(trackId)
        }
      }
      if (activated.length > 0 || deactivated.length > 0) this.revision += 1
      return { ok: true, data: { activated, deactivated, ignored } }
    }
    return { ok: false, code: 'RUNTIME_TRACK_CONTROL_UNKNOWN', message: `Unknown track control: ${name}` }
  }

  /** Returns live events for one track in deterministic journal order. */
  getEvents(trackId: string): readonly RuntimeTrackEvent[] {
    return this.eventsByTrack.get(trackId) ?? []
  }

  /** Returns live events visible to one story; callers apply track activity. */
  getEventsForStory(
    storyId: string,
    timeMs?: number,
    includeBoundary = true,
  ): readonly RuntimeTrackEvent[] {
    return this.getAllEvents().filter(
      (event) => (
        (event.storyId === storyId
          && (timeMs === undefined
            ? this.isStoryEventEligible(storyId, event)
            : this.isStoryEventEligibleAt(storyId, event, timeMs, includeBoundary)))
        || event.cascade === true
        || event.trackId === TRACK_GLOBAL_ID
      ),
    )
  }

  /** Returns whether one story has opted into declarative isolation. */
  isStoryIsolationEnabled(storyId: string): boolean {
    return this.isolatedStoryIds.has(storyId)
  }

  /** Returns whether one story currently owns the exclusive isolation period. */
  isStoryIsolationActive(storyId: string): boolean {
    return this.currentIsolation?.storyId === storyId
  }

  /** Returns the story that currently owns the exclusive isolation period. */
  getActiveStoryIsolationStoryId(): string | undefined {
    return this.currentIsolation?.storyId
  }

  /** Reconciles the live owner with the historical activation at one timeline time. */
  reconcileStoryIsolationAt(timeMs: number): void {
    if (!Number.isFinite(timeMs)) return
    let owner: MutableStoryActivationPeriod | undefined
    for (const periods of this.activationPeriodsByStory.values()) {
      for (const period of periods) {
        if (period.openedAt.applyAtMs > timeMs) continue
        if (period.closedAt !== undefined && period.closedAt.applyAtMs <= timeMs) continue
        if (owner === undefined || compareStoryBoundary(period.openedAt, owner.openedAt) > 0) {
          owner = period
        }
      }
    }
    this.currentIsolation = owner
  }

  /** Reports whether one story-targeted fact belongs to an open historical period. */
  isStoryEventEligible(storyId: string, event: RuntimeTrackEvent): boolean {
    if (event.storyId !== storyId || !this.isStoryIsolationEnabled(storyId)) return true
    if (event.activationId === undefined) return false
    const period = this.activationPeriodsByStory.get(storyId)
      ?.find((candidate) => candidate.activationId === event.activationId)
    if (period === undefined) return false
    const boundary = { applyAtMs: event.applyAtMs, eventSeq: event.eventSeq }
    return compareStoryBoundary(boundary, period.openedAt) >= 0
      && (period.closedAt === undefined || compareStoryBoundary(boundary, period.closedAt) <= 0)
  }

  /** Reports whether one story fact belongs to a period still active at a projection time. */
  isStoryEventEligibleAt(
    storyId: string,
    event: RuntimeTrackEvent,
    timeMs: number,
    includeBoundary = true,
  ): boolean {
    if (!this.isStoryEventEligible(storyId, event)) return false
    if (event.storyId !== storyId || !this.isStoryIsolationEnabled(storyId)) return true
    const period = this.findStoryActivationPeriod(storyId, event.activationId)
    if (period === undefined || period.openedAt.applyAtMs > timeMs) return false
    if (period.closedAt === undefined || period.closedAt.applyAtMs > timeMs) return true
    if (period.closedAt.applyAtMs < timeMs) return false
    return !includeBoundary
  }

  /** Reports whether one journal event is the reset capability of a story. */
  isStoryResetEvent(storyId: string, event: RuntimeTrackEvent): boolean {
    const addressedToStory = event.storyId === storyId
      || (event.storyId === undefined && event.visibility === 'scene')
    return addressedToStory
      && (event.storyId !== storyId || this.isStoryEventEligible(storyId, event))
      && isStoryResetEvent(this.scene.scene.stories[storyId]?.listen ?? [], event)
  }

  /** Returns the latest reset intercepted by one story before a logical time. */
  getLatestStoryReset(
    storyId: string,
    timeMs: number,
    includeBoundary = true,
    includePersistOnly = true,
  ): RuntimeStoryResetBoundary | undefined {
    const boundaries = this.getStoryResetBoundaries(storyId, includePersistOnly, timeMs, includeBoundary)
      .filter((boundary) => boundary.applyAtMs < timeMs
        || (includeBoundary && boundary.applyAtMs === timeMs))
    return boundaries.at(-1)
  }

  /** Returns every active reset boundary retained for one story. */
  getStoryResetBoundaries(
    storyId: string,
    includePersistOnly = true,
    projectionTimeMs?: number,
    includeBoundary = true,
  ): readonly RuntimeStoryResetBoundary[] {
    const story = this.scene.scene.stories[storyId]
    if (story === undefined || !story.listen.some((rule) => rule.reset === true)) return []
    return this.getAllEvents()
      .filter((event) => this.isStoryResetEvent(storyId, event))
      .filter((event) => includePersistOnly || event.mode !== 'persist-only')
      .filter((event) => this.isTrackActive(event.trackId))
      .filter((event) => projectionTimeMs === undefined
        || this.isStoryEventEligibleAt(storyId, event, projectionTimeMs, includeBoundary))
      .sort((left, right) => left.applyAtMs - right.applyAtMs || left.eventSeq - right.eventSeq)
      .map((event) => ({ applyAtMs: event.applyAtMs, eventSeq: event.eventSeq }))
  }

  /** Returns every runtime event exactly once in journal storage order. */
  getAllEvents(): readonly RuntimeTrackEvent[] {
    return [...this.eventsByTrack.values()].flatMap((events) => events)
  }

  /** Returns the monotonic revision used by structural and motion consumers. */
  getRevision(): number {
    return this.revision
  }

  /** Returns every runtime event boundary in deterministic chronological order. */
  getEventTimes(): readonly number[] {
    return [...new Set(this.getAllEvents()
      .filter((event) => event.storyId === undefined || this.isStoryEventEligible(event.storyId, event))
      .map((event) => event.applyAtMs))].sort((left, right) => left - right)
  }

  /** Returns replayable state patches in deterministic timeline order. */
  getStateUpdates(
    scope: StrapScope,
    storyId: string | undefined,
    timeMs: number,
    includeBoundary = true,
    includePersistOnly = true,
  ): readonly RuntimeTrackEvent[] {
    const reset = scope === STRAP_SCOPE_STORY && storyId !== undefined
      ? this.getLatestStoryReset(storyId, timeMs, includeBoundary, includePersistOnly)
      : undefined
    return this.getAllEvents()
      .filter((event) => event.update !== undefined
        && event.stateScope === scope
        && (includePersistOnly || event.mode !== 'persist-only')
        && this.isTrackActive(event.trackId)
        && (scope !== STRAP_SCOPE_STORY
          || storyId === undefined
          || this.isStoryEventEligibleAt(storyId, event, timeMs, includeBoundary))
        && (event.applyAtMs < timeMs || (includeBoundary && event.applyAtMs === timeMs))
        && (scope !== STRAP_SCOPE_STORY || event.storyId === storyId))
      .filter((event) => reset === undefined || isAfterStoryReset(event, reset))
      .sort((left, right) => left.applyAtMs - right.applyAtMs || left.eventSeq - right.eventSeq)
  }

  /** Changes the active flag of declared tracks and reports unknown ids. */
  private setTrackActivity(trackIds: readonly string[], active: boolean): TrackCommandResult<TrackActivationResult> {
    const changed: string[] = []
    const ignored: string[] = []
    for (const trackId of trackIds) {
      if (!this.activeTrackIds.has(trackId)) {
        ignored.push(trackId)
        continue
      }
      this.activeTrackIds.set(trackId, active)
      changed.push(trackId)
    }
    if (changed.length > 0) this.revision += 1
    return {
      ok: true,
      data: active
        ? { activated: changed, deactivated: [], ignored }
        : { activated: [], deactivated: changed, ignored },
    }
  }

  /** Applies one story transition and returns the provenance for its source event. */
  private applyStoryIsolationTransition(
    storyId: string | undefined,
    action: RuntimeStoryIsolationAction | undefined,
    applyAtMs: number,
    eventSeq: number,
  ): string | undefined {
    if (storyId === undefined || !this.isStoryIsolationEnabled(storyId)) return undefined
    const boundary = { applyAtMs, eventSeq }
    if (action === 'activate') {
      this.closeCurrentIsolation(boundary)
      const period: MutableStoryActivationPeriod = {
        storyId,
        activationId: this.createActivationId(storyId),
        openedAt: boundary,
      }
      const periods = this.activationPeriodsByStory.get(storyId) ?? []
      periods.push(period)
      this.activationPeriodsByStory.set(storyId, periods)
      this.currentIsolation = period
      return period.activationId
    }

    const current = this.currentIsolation
    if (action === 'deactivate') {
      if (current?.storyId !== storyId) return undefined
      current.closedAt = boundary
      this.currentIsolation = undefined
      return current.activationId
    }

    return this.currentIsolation?.storyId === storyId
      ? this.currentIsolation.activationId
      : undefined
  }

  /** Closes the currently active period before another story is activated. */
  private closeCurrentIsolation(boundary: StoryActivationBoundary): void {
    if (this.currentIsolation === undefined) return
    this.currentIsolation.closedAt = boundary
    this.currentIsolation = undefined
  }

  /** Allocates an identity that cannot be reused by a later activation. */
  private createActivationId(storyId: string): string {
    const index = this.nextActivationId
    this.nextActivationId += 1
    return `story-isolation:${storyId}:${index}`
  }

  /** Finds one activation period without exposing mutable journal state. */
  private findStoryActivationPeriod(
    storyId: string,
    activationId: string | undefined,
  ): MutableStoryActivationPeriod | undefined {
    if (activationId === undefined) return undefined
    return this.activationPeriodsByStory.get(storyId)
      ?.find((candidate) => candidate.activationId === activationId)
  }

  /** Creates a deterministic identifier for one anchored runtime occurrence. */
  private createGeneratedEventId(trackId: string, storyId: string | undefined): string {
    const index = this.nextGeneratedEventId
    this.nextGeneratedEventId += 1
    return `runtime-event:${trackId}:${storyId ?? 'scene'}:${index}`
  }

  /** Appends one strap event with a generated runtime identity. */
  private appendStrapEvent(
    event: StrapEvent,
    trackId: string,
    storyId: string | undefined,
    cascade: boolean,
    applyAtMs: number,
    mode?: RuntimeEventInsertMode,
    storyIsolation?: RuntimeStoryIsolationAction,
  ): TrackCommandResult<RuntimeTrackEvent> {
    return this.appendLiveEvent({
      eventId: this.createGeneratedEventId(trackId, storyId ?? STRAP_SCOPE_SCENE),
      trackId,
      storyId: event.storyId ?? storyId,
      name: event.name,
      applyAtMs,
      data: event.data,
      // A scene strap may address one story explicitly. That target remains
      // isolated; only an unaddressed scene event may cascade to every story.
      cascade: event.cascade ?? (event.storyId === undefined ? cascade : false),
      visibility: event.visibility,
      mode,
      storyIsolation,
    })
  }

  /** Resolves the isolation transition declared by one immediate story event. */
  private resolveStoryIsolationAction(
    storyId: string | undefined,
    eventName: string,
  ): RuntimeStoryIsolationAction | undefined {
    if (storyId === undefined || !this.isStoryIsolationEnabled(storyId)) return undefined
    const rules = this.scene.scene.stories[storyId]?.listen ?? []
    if (rules.some((rule) => rule.on === eventName && rule.active === true)) return 'activate'
    if (rules.some((rule) => rule.on === eventName && rule.active === false)) return 'deactivate'
    return undefined
  }

  /** Appends one state patch as a replayable runtime event. */
  private appendStateUpdate(
    update: CompiledRecord,
    trackId: string,
    scope: StrapScope,
    storyId: string | undefined,
    applyAtMs: number,
    mode?: RuntimeEventInsertMode,
  ): TrackCommandResult<RuntimeTrackEvent> {
    return this.appendLiveEvent({
      eventId: this.createGeneratedEventId(trackId, storyId ?? scope),
      trackId,
      storyId: scope === STRAP_SCOPE_STORY ? storyId : undefined,
      name: RUNTIME_STATE_UPDATE_EVENT,
      applyAtMs,
      update,
      stateScope: scope,
      mode,
    })
  }
}

/** One ordered edge delimiting a story activation period. */
type StoryActivationBoundary = Readonly<{
  applyAtMs: number
  eventSeq: number
}>

/** Mutable journal representation of one historical story activation. */
type MutableStoryActivationPeriod = {
  storyId: string
  activationId: string
  openedAt: StoryActivationBoundary
  closedAt?: StoryActivationBoundary
}

/** Compares two journal boundaries without reducing equal-time events to one tick. */
function compareStoryBoundary(left: StoryActivationBoundary, right: StoryActivationBoundary): number {
  return left.applyAtMs - right.applyAtMs || left.eventSeq - right.eventSeq
}

/** Tests whether one journal event is a reset trigger for one story. */
function isStoryResetEvent(
  rules: readonly CompiledListenRule[],
  event: RuntimeTrackEvent,
): boolean {
  return rules.some((rule) => rule.reset === true && rule.on === event.name)
}

/** Tests whether one event belongs strictly after a reset boundary. */
function isAfterStoryReset(event: RuntimeTrackEvent, reset: RuntimeStoryResetBoundary): boolean {
  return event.applyAtMs > reset.applyAtMs
    || (event.applyAtMs === reset.applyAtMs && event.eventSeq > reset.eventSeq)
}

/** Flattens relative runtime eventimes against one absolute anchor. */
function flattenAnchoredEventimes(
  eventimes: readonly CompiledEventime[],
  parentStartAt: number,
): readonly Readonly<{
  name: string
  applyAtMs: number
  data?: CompiledRecord
  visibility?: CompiledEventime['visibility']
}>[] {
  return eventimes.flatMap((eventime) => {
    const applyAtMs = parentStartAt + eventime.startAt
    return [
      { name: eventime.name, applyAtMs, data: eventime.data, visibility: eventime.visibility },
      ...flattenAnchoredEventimes(eventime.events ?? [], applyAtMs),
    ]
  })
}

/** Reads the canonical track control payload without accepting a second shape. */
function readTrackIds(data: CompiledRecord | undefined): readonly string[] | null {
  if (!isPlainRecord(data) || !Array.isArray(data.trackIds)) return null
  return data.trackIds.every((trackId) => typeof trackId === 'string') ? data.trackIds : null
}
