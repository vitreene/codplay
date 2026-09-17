import type { SceneListenRule } from 'codplay/scene/types'
import type { StrapEvent, StrapFunction } from 'codplay/runtime/player'
import {
  EVENTS_FRAME_EVENTS,
  EVENTS_FRAME_STORY_IDS,
  EVENTS_KEYBOARD_NAVIGATION_EVENT,
  EVENTS_KEYBOARD_NAVIGATION_STRAP,
  EVENTS_TWEEN_STOP_EVENT,
} from './constants'

type EventsDirection = 'next' | 'previous'

/** Reads a finite current-view index from the scene state. */
function readCurrentView(state: Readonly<Record<string, unknown>>): number {
  const value = state.currentView
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
}

/** Keeps one frame index inside the four-frame navigation range. */
function clampFrameIndex(index: number): number {
  return Math.max(0, Math.min(EVENTS_FRAME_STORY_IDS.length - 1, index))
}

/** Reads the optional direction carried by a keyboard event. */
function readDirection(data: unknown): EventsDirection {
  if (typeof data !== 'object' || data === null) return 'next'
  const direction = (data as { direction?: unknown }).direction
  return direction === 'previous' ? 'previous' : 'next'
}

/** Creates one story-targeted event emitted by the navigation strap. */
function storyEvent(storyId: string, name: string): Readonly<{
  name: string
  storyId: string
  visibility: 'story'
}> {
  return { name, storyId, visibility: 'story' }
}

/** Creates one scene event used to reset the current frame's projection. */
function sceneEvent(name: string): Readonly<{ name: string; visibility: 'scene' }> {
  return { name, visibility: 'scene' }
}

/** Builds the scene strap that changes the visible explanatory frame. */
export function createEventsNavigationStrap(): StrapFunction {
  return ({ event, state }) => {
    const currentIndex = clampFrameIndex(readCurrentView(state))
    const direction = readDirection(event.data)
    const nextIndex = direction === 'previous'
      ? Math.max(0, currentIndex - 1)
      : Math.min(EVENTS_FRAME_STORY_IDS.length - 1, currentIndex + 1)
    if (nextIndex === currentIndex) return { update: { currentView: currentIndex } }

    const currentStoryId = EVENTS_FRAME_STORY_IDS[currentIndex]!
    const nextStoryId = EVENTS_FRAME_STORY_IDS[nextIndex]!
    const currentEvents = EVENTS_FRAME_EVENTS[currentStoryId]
    const nextEvents = EVENTS_FRAME_EVENTS[nextStoryId]

    const output: readonly StrapEvent[] = [
      sceneEvent(EVENTS_TWEEN_STOP_EVENT),
      storyEvent(currentStoryId, currentEvents.leave),
      sceneEvent(currentEvents.reset),
      sceneEvent(currentEvents.outro),
      storyEvent(nextStoryId, nextEvents.enter),
      sceneEvent(nextEvents.intro),
    ]

    return {
      update: { currentView: nextIndex },
      events: output,
    }
  }
}

/** Creates the scene strap collection owned by the events scene. */
export function createEventsSceneStraps(): Readonly<Record<string, StrapFunction>> {
  return {
    [EVENTS_KEYBOARD_NAVIGATION_STRAP]: createEventsNavigationStrap(),
  }
}

/** Connects keyboard navigation and frame intros to their scene straps. */
export function createEventsSceneListenRules(): readonly SceneListenRule[] {
  return [
    {
      on: EVENTS_KEYBOARD_NAVIGATION_EVENT,
      straps: [EVENTS_KEYBOARD_NAVIGATION_STRAP],
    },
    ...EVENTS_FRAME_STORY_IDS.map((storyId) => ({
      on: EVENTS_FRAME_EVENTS[storyId].intro,
      straps: [`${storyId}:remember`],
    })),
  ]
}

/** Creates the small state strap used to remember the current frame on intro. */
export function createEventsRememberStraps(): Readonly<Record<string, StrapFunction>> {
  return Object.fromEntries(EVENTS_FRAME_STORY_IDS.map((storyId, index) => [
    `${storyId}:remember`,
    () => ({ update: { currentView: index } }),
  ]))
}
