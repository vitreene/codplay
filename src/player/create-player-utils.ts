import type { AnimationAction, AnimationResolvedAction } from '../animation/types'
import type { EventListener, RuntimeEventSource, TimelineEvent } from '../core/events/types'
import type { RuntimeCommit } from '../renderer/types'
import type { ItemDoc, StoryDoc as RuntimeStoryDoc } from '../runtime/types'
import { RUNTIME_EVENT_SOURCE } from '../core/events/constants'
import type { TrackAuthorMeta } from '../track-manager/types'
import type {
  PersoDoc,
  PlayerSceneLifecycleOptions,
  SceneStoryDoc,
  StrictSceneDoc
} from './types'

export type PlayerRuntimePlan = {
  story: RuntimeStoryDoc
  listeners: EventListener<AnimationAction>[]
  sortedEvents: TimelineEvent[]
}

const COMPOSED_RUNTIME_STORY_ID_FALLBACK = 'scene-runtime'
const PLAYER_TRACK_GLOBAL_ID = 'global'
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
  resolveTimelineEndMsFromPlan(plan: PlayerRuntimePlan): number {
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
   * Builds one sanitized runtime plan used by critical playback paths.
   */
  createRuntimePlan(scene: StrictSceneDoc, mountedStoryIds: string[], sortedEvents: TimelineEvent[]): PlayerRuntimePlan {
    const runtimeStory = this.createComposedRuntimeStory(scene, mountedStoryIds)

    return {
      story: runtimeStory,
      listeners: this.resolveActionListeners(runtimeStory),
      sortedEvents
    }
  }

  /**
   * Composes one runtime story from all mounted authored stories.
   */
  private createComposedRuntimeStory(scene: StrictSceneDoc, mountedStoryIds: string[]): RuntimeStoryDoc {
    const items: Record<string, ItemDoc> = {}

    for (const storyId of mountedStoryIds) {
      const story = scene.stories[storyId]
      if (story === undefined) {
        continue
      }

      for (const perso of story.persos) {
        items[perso.id] = this.createRuntimeItem(story.id, perso)
      }
    }

    return {
      id: scene.id || COMPOSED_RUNTIME_STORY_ID_FALLBACK,
      items
    }
  }

  /**
   * Creates one renderer commit from one resolved action.
   */
  createRuntimeCommit(
    storyId: string,
    event: TimelineEvent,
    resolvedAction: AnimationResolvedAction,
    commitSeq: number
  ): RuntimeCommit {
    return {
      commitSeq,
      applyAtMs: event.ms,
      target: {
        storyInstanceId: storyId,
        itemId: resolvedAction.listenerId,
        targetId: resolvedAction.action.targetId
      },
      operations: [resolvedAction],
      causeEventId: event.id
    }
  }

  /**
   * Converts one strict story payload into the renderer/runtime item shape.
   */
  createRuntimeStory(story: SceneStoryDoc): RuntimeStoryDoc {
    const items: Record<string, ItemDoc> = {}

    for (const perso of story.persos) {
      items[perso.id] = this.createRuntimeItem(story.id, perso)
    }

    return {
      id: story.id,
      items
    }
  }

  /**
   * Creates one runtime item from one strict perso definition.
   */
  private createRuntimeItem(storyId: string, perso: PersoDoc): ItemDoc {
    return {
      id: perso.id,
      name: perso.name,
      storyId,
      type: perso.type,
      module: perso.module,
      initial: perso.initial,
      emit: perso.emit,
      list: perso.list,
      actions: perso.actions as ItemDoc['actions']
    }
  }

  /**
   * Resolves max transition duration from one action payload style block.
   */
  private resolveActionDurationMs(action: Record<string, unknown> | null): number {
    if (typeof action !== 'object' || action === null) {
      return 0
    }

    const style = action.style
    if (typeof style !== 'object' || style === null) {
      return 0
    }

    let maxDurationMs = 0
    for (const styleValue of Object.values(style as Record<string, unknown>)) {
      if (typeof styleValue !== 'object' || styleValue === null) {
        continue
      }

      const styleTransition = styleValue as Record<string, unknown>
      const duration = Number.isFinite(styleTransition.duration) ? Number(styleTransition.duration) : 0
      const delay = Number.isFinite(styleTransition.delay) ? Number(styleTransition.delay) : 0
      maxDurationMs = Math.max(maxDurationMs, this.clampTimelineMs(duration + delay))
    }

    return maxDurationMs
  }

  /**
   * Resolves runtime listeners from story persos and action maps.
   */
  private resolveActionListeners(story: RuntimeStoryDoc): EventListener<AnimationAction>[] {
    return Object.values(story.items).map((item) => ({
      listenerId: item.id,
      scopeStoryId: item.storyId,
      actionsByEventName: item.actions
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
    consolidatedTracks[story.id] = {
      active: true
    }
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
