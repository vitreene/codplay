import { TRACK_EVENT_ACTIVATE, TRACK_EVENT_DEACTIVATE, TRACK_EVENT_TOGGLE } from '../../config/track-events'
import { isPlainRecord } from '../../../shared'
import type { CompiledEventime, CompiledRecord, CompiledScene } from '../../../scene/compiled'
import { buildTrackRegistry, type MaterializedTrackRegistry } from './tracks'

/** One event appended to a declared runtime track. */
export type RuntimeTrackEvent = Readonly<{
  eventId: string
  eventSeq: number
  trackId: string
  name: string
  applyAtMs: number
  storyId?: string
  data?: CompiledRecord
}>

/** Input used to append one live event without creating a track. */
export type AppendRuntimeTrackEventInput = Readonly<{
  eventId: string
  trackId: string
  name: string
  applyAtMs: number
  storyId?: string
  data?: CompiledRecord
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
    if (!Number.isFinite(input.applyAtMs) || input.applyAtMs < 0) {
      return { ok: false, code: 'RUNTIME_EVENT_TIME_INVALID', message: 'Runtime event time must be finite and non-negative.' }
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
    if (!Number.isFinite(input.anchorMs) || input.anchorMs < 0) {
      return { ok: false, code: 'RUNTIME_EVENT_ANCHOR_INVALID', message: 'Eventime anchor must be finite and non-negative.' }
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
