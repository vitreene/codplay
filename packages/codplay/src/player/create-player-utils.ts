import type { AnimationAction } from '../animation/types'
import type { EventListener, RuntimeEventSource, TimelineEvent } from '../core/events/types'
import type { ActionDoc, ItemDoc, MoveValue, RuntimePersos } from '../runtime/types'
import { RUNTIME_EVENT_SOURCE } from '../core/events/constants'
import type { TrackAuthorMeta } from '../track-manager/types'
import type { RuntimeTimelinePlan } from '../director/types'
import type { InputActionDoc } from '../runtime/components/input-component'
import type {
  PersoDoc,
  PlayerSceneLifecycleOptions,
  SceneStoryDoc,
  StrictSceneDoc
} from './types'
import { resolveInputStandardActions } from '../runtime/components/input-component'
import { buildActionSequenceContinuationEventName, isActionSequence } from './action-sequence'

export type PlayerRuntimePlan = {
  runtimePersos: RuntimePersos
  timelinePlan: RuntimeTimelinePlan
}

const RUNTIME_PERSOS_ID_FALLBACK = 'scene-runtime'
const PLAYER_TRACK_GLOBAL_ID = 'global'
const PLAYER_STRAP_TRACK_PREFIX = 'strap'
export const PLAYER_TRACK_CONTROL_EVENTS = {
  activate: 'track:activate',
  deactivate: 'track:deactivate',
  toggle: 'track:toggle'
} as const

/**
 * Sanitizes scene/runtime data and prepares deterministic player runtime plans.
 */
export class PlayerRuntimePlanner {
  /**
   * Clamps timeline values into a non-negative domain.
   */
  clampTimelineMs(value: number): number {
    if (value < 0) {
      return 0
    }

    return value
  }

  /**
   * Resolves one monotonic timestamp for timeline computations.
   */
  resolveNowMs(): number {
    if (typeof globalThis.performance !== 'undefined') {
      return globalThis.performance.now()
    }

    return Date.now()
  }

  /**
   * Resolves one story by identifier or direct story reference.
   */
  resolveStory(scene: StrictSceneDoc, story: string | SceneStoryDoc): SceneStoryDoc | null {
    if (typeof story === 'string') {
      return scene.stories[story] ?? null
    }

    return scene.stories[story.id] ?? story
  }

  /**
   * Resolves one deterministic timeline end from events and action durations.
   */
  resolveTimelineEndMsFromPlan(plan: RuntimeTimelinePlan): number {
    if (plan.sortedEvents.length === 0) {
      return Number.POSITIVE_INFINITY
    }

    const actionDurationByEventName = new Map<string, number>()

    for (const listener of plan.listeners) {
      for (const [eventName, action] of Object.entries(listener.actionsByEventName)) {
        const currentDurationMs = actionDurationByEventName.get(eventName) ?? 0
        const nextDurationMs = this.resolveActionDurationMs(action as Record<string, unknown> | null)
        actionDurationByEventName.set(eventName, Math.max(currentDurationMs, nextDurationMs))
      }
    }

    let timelineEndMs = 0
    for (const event of plan.sortedEvents) {
      const actionDurationMs = actionDurationByEventName.get(event.name) ?? 0
      timelineEndMs = Math.max(timelineEndMs, this.clampTimelineMs(event.ms) + actionDurationMs)
    }

    return this.clampTimelineMs(timelineEndMs)
  }

  /**
   * Resolves one timeline end that also accounts for master tracks and master media segments.
   */
  resolveTimelineEndMsFromRuntimePlan(input: {
    runtimePlan: PlayerRuntimePlan
    getTrackMeta: (trackId: string) => { role?: string } | null
    getMediaDurationMs: (runtimeItemId: string) => number | null
  }): number {
    const { runtimePlan } = input
    const hasMasterTracks = runtimePlan.timelinePlan.sortedEvents.some((event) => {
      const trackMeta = event.trackId ? input.getTrackMeta(event.trackId) : null
      return trackMeta?.role === 'master'
    })

    const actionDurationByEventName = new Map<string, number>()
    for (const listener of runtimePlan.timelinePlan.listeners) {
      for (const [eventName, action] of Object.entries(listener.actionsByEventName)) {
        const currentDurationMs = actionDurationByEventName.get(eventName) ?? 0
        const nextDurationMs = this.resolveActionDurationMs(action as Record<string, unknown> | null)
        actionDurationByEventName.set(eventName, Math.max(currentDurationMs, nextDurationMs))
      }
    }

    const contributesToDuration = (trackId: string | undefined): boolean => {
      if (!hasMasterTracks) {
        return true
      }

      if (!trackId) {
        return false
      }

      return input.getTrackMeta(trackId)?.role === 'master'
    }

    let timelineEndMs = 0
    let hasContributingSource = false
    for (const event of runtimePlan.timelinePlan.sortedEvents) {
      if (!contributesToDuration(event.trackId)) {
        continue
      }

      hasContributingSource = true
      const actionDurationMs = actionDurationByEventName.get(event.name) ?? 0
      timelineEndMs = Math.max(timelineEndMs, this.clampTimelineMs(event.ms) + actionDurationMs)
    }

    for (const event of runtimePlan.timelinePlan.sortedEvents) {
      if (!contributesToDuration(event.trackId)) {
        continue
      }

      for (const listener of runtimePlan.timelinePlan.listeners) {
        if (event.scopeStoryId !== undefined && listener.scopeStoryId !== event.scopeStoryId) {
          continue
        }

        const item = runtimePlan.runtimePersos.persos[listener.listenerId]
        if (!item || item.type !== 'media' || item.initial.master !== true) {
          continue
        }

        const action = listener.actionsByEventName[event.name] as Record<string, unknown> | undefined
        const broadcast = typeof action?.broadcast === 'object' && action.broadcast !== null
          ? (action.broadcast as { type?: unknown; startAt?: unknown; endAt?: unknown })
          : null
        if (!broadcast || broadcast.type !== 'START') {
          continue
        }

        const mediaDurationMs = input.getMediaDurationMs(item.id)
        const startAtMs = Number.isFinite(broadcast.startAt) ? Math.max(0, Number(broadcast.startAt)) : 0
        const endAtMs = Number.isFinite(broadcast.endAt) ? Math.max(startAtMs, Number(broadcast.endAt)) : null
        const effectiveDurationMs = endAtMs !== null
          ? endAtMs - startAtMs
          : mediaDurationMs !== null
            ? Math.max(0, mediaDurationMs - startAtMs)
            : null

        if (effectiveDurationMs === null) {
          continue
        }

        hasContributingSource = true
        timelineEndMs = Math.max(timelineEndMs, this.clampTimelineMs(event.ms) + effectiveDurationMs)
      }
    }

    if (!hasContributingSource) {
      return Number.POSITIVE_INFINITY
    }

    return this.clampTimelineMs(timelineEndMs)
  }

  /**
   * Resolves the max action duration associated with one event name.
   */
  resolveEventDurationMsFromTimelinePlan(plan: RuntimeTimelinePlan, eventName: string): number {
    let durationMs = 0

    for (const listener of plan.listeners) {
      const action = listener.actionsByEventName[eventName]
      durationMs = Math.max(durationMs, this.resolveActionDurationMs(action as Record<string, unknown> | null))
    }

    return this.clampTimelineMs(durationMs)
  }

  /**
   * Builds one sanitized runtime plan used by critical playback paths.
   */
  createRuntimePlan(scene: StrictSceneDoc, mountedStoryIds: string[], sortedEvents: TimelineEvent[]): PlayerRuntimePlan {
    const runtimePersos = this.createRuntimePersos(scene, mountedStoryIds)
    const timelinePlan = this.createTimelinePlan(runtimePersos, sortedEvents)

    return {
      runtimePersos,
      timelinePlan
    }
  }

  /**
   * Composes one runtime perso graph from all mounted authored stories.
   */
  createRuntimePersos(scene: StrictSceneDoc, mountedStoryIds: string[]): RuntimePersos {
    const persos: Record<string, ItemDoc> = {}
    const storyMovesByStoryId: Record<string, MoveValue> = {}

    for (const storyId of mountedStoryIds) {
      const story = scene.stories[storyId]
      if (story === undefined) {
        continue
      }

      const storyInitial = story.initial as Record<string, unknown> | undefined
      const storyMove = storyInitial?.move
      if (storyMove !== undefined) {
        storyMovesByStoryId[story.id] = storyMove as MoveValue
      }

      for (const perso of story.persos) {
        persos[perso.id] = this.createRuntimeItem(story.id, story.trackId ?? story.id, perso) as ItemDoc
      }
    }

    return {
      id: scene.id || RUNTIME_PERSOS_ID_FALLBACK,
      persos,
      storyMovesByStoryId
    }
  }

  /**
   * Builds one timeline plan from one runtime perso graph and sorted events.
   */
  createTimelinePlan(runtimePersos: RuntimePersos, sortedEvents: TimelineEvent[]): RuntimeTimelinePlan {
    return {
      listeners: this.resolveActionListeners(runtimePersos),
      sortedEvents
    }
  }

  /**
   * Converts one strict story payload into the runtime perso graph shape.
   */
  createRuntimePersosFromStory(story: SceneStoryDoc): RuntimePersos {
    const persos: Record<string, ItemDoc> = {}

    for (const perso of story.persos) {
      persos[perso.id] = this.createRuntimeItem(story.id, story.trackId ?? story.id, perso) as ItemDoc
    }

    return {
      id: story.id,
      persos,
      storyMovesByStoryId:
        story.initial === undefined || (story.initial as Record<string, unknown>).move === undefined
          ? undefined
          : { [story.id]: (story.initial as Record<string, unknown>).move as MoveValue }
    }
  }

  /**
   * Creates one runtime item from one strict perso definition.
   */
  private createRuntimeItem(storyId: string, trackId: string, perso: PersoDoc): ItemDoc {
    const authoredActions = perso.actions as Record<string, ActionDoc> | undefined

    const resolvedActions =
      perso.type === 'input'
        ? resolveInputStandardActions((authoredActions ?? {}) as Record<string, InputActionDoc>) as Record<string, ActionDoc>
        : (authoredActions ?? {})

    const TWEEN_STOP_ACTION = 'tween:stop'
    if (!(TWEEN_STOP_ACTION in resolvedActions)) {
      (resolvedActions as Record<string, unknown>)[TWEEN_STOP_ACTION] = 'stop'
    }

    // Reserve one auto-reference continuation key per statically-declared
    // ActionSequence (perso.actions[key] = ActionSequenceStep[]), so the
    // sequence's steps after the first can be delivered later to this exact
    // perso — the dispatch system has no per-perso targeting otherwise (see
    // v1-action-sequence-spec.md).
    for (const actionKey of Object.keys(resolvedActions)) {
      if (isActionSequence(resolvedActions[actionKey])) {
        const continuationEventName = buildActionSequenceContinuationEventName(perso.id, actionKey)
        if (!(continuationEventName in resolvedActions)) {
          (resolvedActions as Record<string, unknown>)[continuationEventName] = null
        }
      }
    }

    return {
      id: perso.id,
      name: perso.name,
      storyId,
      trackId,
      type: perso.type,
      module: perso.module,
      initial: perso.initial,
      emit: perso.emit,
      list: perso.list,
      actions: resolvedActions,
    } as ItemDoc
  }

  /**
   * Resolves max transition duration from one action payload style block.
   */
  private resolveActionDurationMs(action: Record<string, unknown> | null): number {
    if (typeof action !== 'object' || action === null) {
      return 0
    }

    let maxDurationMs = Math.max(
      this.resolveMoveDurationMs(action.move),
      this.resolveMorphDurationMs(action.morph),
    )
    const style = action.style
    if (typeof style !== 'object' || style === null) {
      return maxDurationMs
    }

    for (const styleValue of Object.values(style as Record<string, unknown>)) {
      if (typeof styleValue !== 'object' || styleValue === null) {
        continue
      }

      const styleTransition = styleValue as Record<string, unknown>
      const ignoreDuration = styleTransition.ignoreDuration === true
      if (ignoreDuration) {
        continue
      }

      const duration = Number.isFinite(styleTransition.duration) ? Number(styleTransition.duration) : 0
      const delay = Number.isFinite(styleTransition.delay) ? Number(styleTransition.delay) : 0
      maxDurationMs = Math.max(maxDurationMs, this.clampTimelineMs(duration + delay))
    }

    return maxDurationMs
  }

  /**
   * Resolves one authored move animation duration when FLIP is enabled.
   */
  private resolveMoveDurationMs(rawMove: unknown): number {
    if (typeof rawMove !== 'object' || rawMove === null) {
      return 0
    }

    const move = rawMove as Record<string, unknown>
    if (move.flip === false) {
      return 0
    }

    const duration = move.duration
    return typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? this.clampTimelineMs(duration)
      : 0
  }

  /**
   * Resolves one authored Anime SVG morph duration when explicitly declared.
   */
  private resolveMorphDurationMs(rawMorph: unknown): number {
    if (typeof rawMorph !== 'object' || rawMorph === null) {
      return 0
    }

    const morph = rawMorph as Record<string, unknown>
    const duration = morph.duration
    const delay = morph.delayMs ?? morph.delay
    const durationMs = typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? duration
      : 0
    const delayMs = typeof delay === 'number' && Number.isFinite(delay) && delay > 0
      ? delay
      : 0

    return this.clampTimelineMs(durationMs + delayMs)
  }

  /**
   * Resolves runtime listeners from story persos and action maps.
   */
  private resolveActionListeners(runtimePersos: RuntimePersos): EventListener<AnimationAction>[] {
    return Object.values(runtimePersos.persos).map((item) => ({
      listenerId: item.id,
      scopeStoryId: item.storyId,
      actionsByEventName: item.actions as Record<string, AnimationAction>
    }))
  }
}

/**
 * Builds one frozen scene-level track registry with defaults and story contributions.
 */
export function consolidateSceneTracks(scene: StrictSceneDoc): Record<string, unknown> {
  const consolidatedTracks: Record<string, unknown> = {
    [PLAYER_TRACK_GLOBAL_ID]: {
      active: true
    }
  }

  for (const story of Object.values(scene.stories)) {
    consolidatedTracks[story.id] = mergeTrackMeta(consolidatedTracks[story.id], {
      active: true
    })

    if (story.trackId) {
      consolidatedTracks[story.trackId] = mergeTrackMeta(consolidatedTracks[story.trackId], {
        active: true
      })
    }
  }

  for (const [trackId, defaultTrack] of Object.entries(resolveDeclaredStrapTracks(scene))) {
    consolidatedTracks[trackId] = mergeTrackMeta(consolidatedTracks[trackId], defaultTrack)
  }

  for (const [trackId, rawTrack] of Object.entries(scene.tracks)) {
    consolidatedTracks[trackId] = mergeTrackMeta(consolidatedTracks[trackId], rawTrack)
  }

  for (const story of Object.values(scene.stories)) {
    for (const [trackId, rawTrack] of Object.entries(story.tracks ?? {})) {
      consolidatedTracks[trackId] = mergeTrackMeta(consolidatedTracks[trackId], rawTrack)
    }
  }

  return consolidatedTracks
}

/**
 * Merges one raw track declaration onto one existing scene-level track meta.
 */
export function mergeTrackMeta(existingTrack: unknown, nextTrack: unknown): TrackAuthorMeta {
  const baseTrack = typeof existingTrack === 'object' && existingTrack !== null
    ? (existingTrack as TrackAuthorMeta)
    : {}
  const incomingTrack = typeof nextTrack === 'object' && nextTrack !== null
    ? (nextTrack as TrackAuthorMeta)
    : {}

  return {
    ...baseTrack,
    ...incomingTrack,
    ...(incomingTrack.active !== undefined ? { active: incomingTrack.active } : {})
  }
}

/**
 * Builds one deterministic strap track id from its declaration scope.
 */
export function createStrapTrackId(scopeStoryId: string | undefined, strapName: string): string {
  const scopeKey = scopeStoryId ?? 'scene'
  return `${PLAYER_STRAP_TRACK_PREFIX}-${scopeKey}-${strapName}`
}

/**
 * Returns the default event track for one story according to V1 track rules.
 */
export function resolveDefaultStoryTrackId(story: Pick<SceneStoryDoc, 'id' | 'trackId'>): string {
  return story.trackId ?? story.id
}

/**
 * Collects the statically declared strap tracks required at scene init.
 */
export function resolveDeclaredStrapTracks(scene: StrictSceneDoc): Record<string, TrackAuthorMeta> {
  const strapTracks: Record<string, TrackAuthorMeta> = {}

  for (const rule of scene.listen) {
    for (const strapName of rule.straps ?? []) {
      const trackId = createStrapTrackId(undefined, strapName)
      strapTracks[trackId] = mergeTrackMeta(strapTracks[trackId], { active: true })
    }
  }

  for (const story of Object.values(scene.stories)) {
    for (const rule of story.listen) {
      for (const strapName of rule.straps ?? []) {
        const trackId = createStrapTrackId(story.id, strapName)
        strapTracks[trackId] = mergeTrackMeta(strapTracks[trackId], { active: true })
      }
    }
  }

  return strapTracks
}

/**
 * Reads one track-control payload into one normalized track id list.
 */
export function readTrackControlIds(payload: Record<string, unknown> | undefined): string[] {
  const trackIds = payload?.trackIds
  if (!Array.isArray(trackIds)) {
    return []
  }

  return trackIds.filter((trackId): trackId is string => typeof trackId === 'string' && trackId.length > 0)
}

/**
 * Checks whether one event name belongs to the track-control policy.
 */
export function isTrackControlEventName(eventName: string): boolean {
  return (
    eventName === PLAYER_TRACK_CONTROL_EVENTS.activate ||
    eventName === PLAYER_TRACK_CONTROL_EVENTS.deactivate ||
    eventName === PLAYER_TRACK_CONTROL_EVENTS.toggle
  )
}

/**
 * Creates one scene lifecycle options object from callbacks.
 */
export function createSceneLifecycleOptions(options: PlayerSceneLifecycleOptions): PlayerSceneLifecycleOptions {
  return options
}

/**
 * Normalizes raw event source values into the runtime source domain.
 */
export function sanitizeRuntimeEventSource(rawSource: unknown): RuntimeEventSource {
  if (rawSource === RUNTIME_EVENT_SOURCE.user || rawSource === RUNTIME_EVENT_SOURCE.system) {
    return rawSource
  }

  return RUNTIME_EVENT_SOURCE.story
}
