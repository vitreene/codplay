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
import type { CompiledEventime, CompiledRecord, CompiledScene } from '../../../scene/compiled'
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
}>

/** Input used to append one live event without creating a track. */
export type AppendRuntimeTrackEventInput = Readonly<{
  eventId: string
  trackId: string
  name: string
  applyAtMs: number
  storyId?: string
  data?: CompiledRecord
  update?: CompiledRecord
  stateScope?: StrapScope
  cascade?: boolean
  context?: Readonly<Record<string, unknown>>
  meta?: Readonly<Record<string, unknown>>
  mode?: RuntimeEventInsertMode
}>

/** Input used to anchor a portable relative eventime tree at runtime. */
export type AppendAnchoredEventimesInput = Readonly<{
  trackId: string
  storyId: string
  anchorMs: number
  eventimes: readonly CompiledEventime[]
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
  materializedUpdateCount: number
}>

/** Runtime journal layered over the immutable compiled track registry. */
export class RuntimeTrackJournal {
  readonly registry: MaterializedTrackRegistry
  private readonly activeTrackIds: Map<string, boolean>
  private readonly eventsByTrack = new Map<string, RuntimeTrackEvent[]>()
  private readonly eventIds = new Set<string>()
  private nextEventSeq = 0
  private nextGeneratedEventId = 0

  /** Creates a mutable live journal from one immutable compiled scene. */
  constructor(scene: CompiledScene) {
    this.registry = buildTrackRegistry(scene)
    this.activeTrackIds = new Map(
      Object.values(this.registry.tracks).map((track) => [track.id, track.active]),
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

    const event: RuntimeTrackEvent = {
      ...input,
      eventSeq: this.nextEventSeq,
    }
    this.nextEventSeq += 1
    this.eventIds.add(input.eventId)
    const events = this.eventsByTrack.get(input.trackId) ?? []
    events.push(event)
    events.sort((left, right) => left.applyAtMs - right.applyAtMs || left.eventSeq - right.eventSeq)
    this.eventsByTrack.set(input.trackId, events)
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
    const storyId = input.storyId
    for (const event of input.output.events) {
      const appended = this.appendStrapEvent(
        event,
        trackId,
        storyId,
        input.scope === STRAP_SCOPE_SCENE,
        input.anchorMs,
        input.mode,
      )
      if (!appended.ok) return appended
      events.push(appended.data)
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
    return { ok: true, data: { trackId, events, materializedUpdateCount: input.output.updates.length + input.output.planned.filter((occurrence) => occurrence.step.update !== undefined).length } }
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
      return { ok: true, data: { activated, deactivated, ignored } }
    }
    return { ok: false, code: 'RUNTIME_TRACK_CONTROL_UNKNOWN', message: `Unknown track control: ${name}` }
  }

  /** Returns live events for one track in deterministic journal order. */
  getEvents(trackId: string): readonly RuntimeTrackEvent[] {
    return this.eventsByTrack.get(trackId) ?? []
  }

  /** Returns live events scoped to one story across its active tracks. */
  getEventsForStory(storyId: string): readonly RuntimeTrackEvent[] {
    return [...this.eventsByTrack.values()].flatMap((events) => events.filter(
      (event) => event.storyId === storyId
        || event.cascade === true
        || event.trackId === TRACK_GLOBAL_ID,
    ))
  }

  /** Returns replayable state patches in deterministic timeline order. */
  getStateUpdates(
    scope: StrapScope,
    storyId: string | undefined,
    timeMs: number,
    includeBoundary = true,
    includePersistOnly = true,
  ): readonly RuntimeTrackEvent[] {
    return [...this.eventsByTrack.values()]
      .flatMap((events) => events)
      .filter((event) => event.update !== undefined
        && event.stateScope === scope
        && (includePersistOnly || event.mode !== 'persist-only')
        && this.isTrackActive(event.trackId)
        && (event.applyAtMs < timeMs || (includeBoundary && event.applyAtMs === timeMs))
        && (scope !== STRAP_SCOPE_STORY || event.storyId === storyId))
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
    return {
      ok: true,
      data: active
        ? { activated: changed, deactivated: [], ignored }
        : { activated: [], deactivated: changed, ignored },
    }
  }

  /** Creates a deterministic identifier for one anchored runtime occurrence. */
  private createGeneratedEventId(trackId: string, storyId: string): string {
    const index = this.nextGeneratedEventId
    this.nextGeneratedEventId += 1
    return `runtime-event:${trackId}:${storyId}:${index}`
  }

  /** Appends one strap event with a generated runtime identity. */
  private appendStrapEvent(
    event: StrapEvent,
    trackId: string,
    storyId: string | undefined,
    cascade: boolean,
    applyAtMs: number,
    mode?: RuntimeEventInsertMode,
  ): TrackCommandResult<RuntimeTrackEvent> {
    return this.appendLiveEvent({
      eventId: this.createGeneratedEventId(trackId, storyId ?? STRAP_SCOPE_SCENE),
      trackId,
      storyId,
      name: event.name,
      applyAtMs,
      data: event.data,
      cascade,
      mode,
    })
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

/** Flattens relative runtime eventimes against one absolute anchor. */
function flattenAnchoredEventimes(
  eventimes: readonly CompiledEventime[],
  parentStartAt: number,
): readonly Readonly<{ name: string; applyAtMs: number; data?: CompiledRecord }>[] {
  return eventimes.flatMap((eventime) => {
    const applyAtMs = parentStartAt + eventime.startAt
    return [
      { name: eventime.name, applyAtMs, data: eventime.data },
      ...flattenAnchoredEventimes(eventime.events ?? [], applyAtMs),
    ]
  })
}

/** Reads the canonical track control payload without accepting a second shape. */
function readTrackIds(data: CompiledRecord | undefined): readonly string[] | null {
  if (!isPlainRecord(data) || !Array.isArray(data.trackIds)) return null
  return data.trackIds.every((trackId) => typeof trackId === 'string') ? data.trackIds : null
}
