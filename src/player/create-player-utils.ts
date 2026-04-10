import type { AnimationAction, AnimationResolvedAction } from '../animation/types'
import { sortRuntimeEvents } from '../core/events/sort'
import type { EventListener, RuntimeEventSource, TimelineEvent, TrackMeta } from '../core/events/types'
import type { StoryDoc } from '../runtime/types'
import type { RuntimeCommit } from '../renderer/types'
import type { SceneDoc } from './types'

export type PlayerRuntimePlan = {
  story: StoryDoc
  listeners: EventListener<AnimationAction>[]
  sortedEvents: TimelineEvent[]
}

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
   * Resolves the story used as active runtime story for one scene.
   */
  resolveActiveStory(scene: SceneDoc): StoryDoc | null {
    if (scene.initialStoryId) {
      return scene.stories[scene.initialStoryId] ?? null
    }

    const firstStory = Object.values(scene.stories)[0]
    return firstStory ?? null
  }

  /**
   * Builds one sanitized runtime plan used by critical playback paths.
   */
  createRuntimePlan(scene: SceneDoc, story: StoryDoc): PlayerRuntimePlan {
    const trackMeta = this.resolveTrackMeta(scene)
    const timelineEvents = this.resolveTimelineEvents(scene, story)

    return {
      story,
      listeners: this.resolveActionListeners(story),
      sortedEvents: sortRuntimeEvents(timelineEvents, trackMeta)
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
   * Resolves runtime listeners from story items and action maps.
   */
  private resolveActionListeners(story: StoryDoc): EventListener<AnimationAction>[] {
    return Object.values(story.items).map((item) => ({
      listenerId: item.id,
      actionsByEventName: item.actions
    }))
  }

  /**
   * Resolves track ordering metadata from scene tracks payload.
   */
  private resolveTrackMeta(scene: SceneDoc): Record<string, TrackMeta> {
    const result: Record<string, TrackMeta> = {}
    const tracks = scene.tracks
    if (typeof tracks !== 'object' || tracks === null) {
      return result
    }

    for (const [trackId, rawTrack] of Object.entries(tracks)) {
      if (typeof rawTrack !== 'object' || rawTrack === null) {
        continue
      }

      const track = rawTrack as Record<string, unknown>
      result[trackId] = {
        order: Number.isFinite(track.order) ? Number(track.order) : 0,
        source: this.sanitizeEventSource(track.source)
      }
    }

    return result
  }

  /**
   * Resolves and sanitizes timeline events from scene tracks or story fallback.
   */
  private resolveTimelineEvents(scene: SceneDoc, story: StoryDoc): TimelineEvent[] {
    const trackEvents = this.resolveTrackTimelineEvents(scene)
    if (trackEvents.length > 0) {
      return trackEvents
    }

    return this.resolveStoryTimelineEvents(story)
  }

  /**
   * Resolves timeline events from scene tracks payload.
   */
  private resolveTrackTimelineEvents(scene: SceneDoc): TimelineEvent[] {
    const timelineEvents: TimelineEvent[] = []
    let fallbackIndex = 0
    const tracks = scene.tracks

    if (typeof tracks !== 'object' || tracks === null) {
      return timelineEvents
    }

    for (const [trackId, rawTrack] of Object.entries(tracks)) {
      if (typeof rawTrack !== 'object' || rawTrack === null) {
        continue
      }

      const track = rawTrack as Record<string, unknown>
      const rawEvents = Array.isArray(track.events) ? track.events : []
      for (const rawEvent of rawEvents) {
        if (typeof rawEvent !== 'object' || rawEvent === null) {
          continue
        }

        const event = rawEvent as Record<string, unknown>
        const normalizedEvent = this.normalizeTimelineEvent(event, fallbackIndex, trackId)
        if (normalizedEvent === null) {
          continue
        }

        timelineEvents.push(normalizedEvent)
        fallbackIndex += 1
      }
    }

    return timelineEvents
  }

  /**
   * Resolves timeline events from story fallback payload.
   */
  private resolveStoryTimelineEvents(story: StoryDoc): TimelineEvent[] {
    const timelineEvents: TimelineEvent[] = []
    let fallbackIndex = 0
    const rawStory = story as unknown as { events?: unknown }
    const storyEvents = Array.isArray(rawStory.events) ? rawStory.events : []

    for (const rawEvent of storyEvents) {
      if (typeof rawEvent !== 'object' || rawEvent === null) {
        continue
      }

      const event = rawEvent as Record<string, unknown>
      const trackId = typeof event.trackId === 'string' ? event.trackId : undefined
      const normalizedEvent = this.normalizeTimelineEvent(event, fallbackIndex, trackId)
      if (normalizedEvent === null) {
        continue
      }

      timelineEvents.push(normalizedEvent)
      fallbackIndex += 1
    }

    return timelineEvents
  }

  /**
   * Converts one raw event payload into one sanitized timeline event.
   */
  private normalizeTimelineEvent(
    event: Record<string, unknown>,
    fallbackIndex: number,
    trackId?: string
  ): TimelineEvent | null {
    const eventName = typeof event.name === 'string' ? event.name : ''
    if (eventName.length === 0) {
      return null
    }

    const rawMs = Number.isFinite(event.ms) ? Number(event.ms) : 0
    const ms = this.clampTimelineMs(rawMs)
    const index = Number.isFinite(event.index) ? Number(event.index) : fallbackIndex
    const id = typeof event.id === 'string' ? event.id : `evt-${ms}-${fallbackIndex}`
    const payload = typeof event.payload === 'object' && event.payload !== null
      ? (event.payload as Record<string, unknown>)
      : undefined

    return {
      id,
      ms,
      name: eventName,
      payload,
      index,
      source: this.sanitizeEventSource(event.source),
      trackId
    }
  }

  /**
   * Sanitizes one runtime event source value.
   */
  private sanitizeEventSource(rawSource: unknown): RuntimeEventSource {
    if (rawSource === 'user' || rawSource === 'system') {
      return rawSource
    }

    return 'story'
  }
}
