import type { AnimationAction, AnimationResolvedAction } from '../animation/types'
import type { EventListener, RuntimeEventSource, TimelineEvent } from '../core/events/types'
import type { RuntimeCommit } from '../renderer/types'
import type { ItemDoc, StoryDoc as RuntimeStoryDoc } from '../runtime/types'
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
   * Resolves one deterministic root story id for fallback flows.
   */
  resolveRootStoryId(scene: StrictSceneDoc): string | null {
    return scene.rootStories[0] ?? Object.keys(scene.stories)[0] ?? null
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
  createRuntimePlan(scene: StrictSceneDoc, storyId: string, sortedEvents: TimelineEvent[]): PlayerRuntimePlan {
    const story = scene.stories[storyId]
    const runtimeStory = this.createRuntimeStory(story)

    return {
      story: runtimeStory,
      listeners: this.resolveActionListeners(runtimeStory),
      sortedEvents
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
      items[perso.id] = this.createRuntimeItem(perso)
    }

    return {
      id: story.id,
      items
    }
  }

  /**
   * Creates one runtime item from one strict perso definition.
   */
  private createRuntimeItem(perso: PersoDoc): ItemDoc {
    return {
      id: perso.id,
      type: perso.type,
      module: perso.module,
      initial: perso.initial,
      emit: perso.emit,
      children: perso.children,
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
      actionsByEventName: item.actions
    }))
  }
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
  if (rawSource === 'user' || rawSource === 'system') {
    return rawSource
  }

  return 'story'
}
