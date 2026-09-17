/** Namespace used by the standalone events demonstration. */
export const EVENTS_NAMESPACE = 'events:demo'

/** Stable identities used by the events scene and its stories. */
export const EVENTS_SCENE_ID = 'events-v2-scene'
export const EVENTS_MAIN_STORY_ID = 'main'
export const EVENTS_FRAME_ONE_ID = 'events-frame-one'
export const EVENTS_FRAME_TWO_ID = 'events-frame-two'
export const EVENTS_FRAME_THREE_ID = 'events-frame-three'
export const EVENTS_FRAME_FOUR_ID = 'events-frame-four'

/** Ordered frame stories used by the keyboard navigation circuit. */
export const EVENTS_FRAME_STORY_IDS = [
  EVENTS_FRAME_ONE_ID,
  EVENTS_FRAME_TWO_ID,
  EVENTS_FRAME_THREE_ID,
  EVENTS_FRAME_FOUR_ID,
] as const

/** Story identity accepted by the events frame helpers. */
export type EventsFrameStoryId = typeof EVENTS_FRAME_STORY_IDS[number]

/** Names the animation commands owned by one frame-specific animation context. */
export type EventsAnimationEventNames = Readonly<{
  up: string
  down: string
  changing: string
  barrierShow: string
  signalShow: string
  signalHide: string
}>

/** Identifies one frame-specific animation context. */
export type EventsAnimationContext = Readonly<{
  frameId: EventsFrameStoryId
  index: number
  events: EventsAnimationEventNames
}>

/** Complete set of frame-specific animation contexts used by the scene. */
export type EventsAnimationContexts = Readonly<Record<EventsFrameStoryId, EventsAnimationContext>>

/** Creates one isolated animation context for every explanatory frame. */
export function createEventsAnimationContexts(): EventsAnimationContexts {
  return EVENTS_FRAME_STORY_IDS.reduce((contexts, frameId, frameIndex) => {
    const index = frameIndex + 1
    const suffix = String(index)
    contexts[frameId] = {
      frameId,
      index,
      events: {
        up: `up${suffix}`,
        down: `down${suffix}`,
        changing: `changing${suffix}`,
        barrierShow: `barrier-show${suffix}`,
        signalShow: `signal-show${suffix}`,
        signalHide: `signal-hide${suffix}`,
      },
    }
    return contexts
  }, {} as Record<EventsFrameStoryId, EventsAnimationContext>)
}

/** Shared placement targets published by the main stage layout. */
export const EVENTS_FRAME_TARGET = `${EVENTS_NAMESPACE}:frame`
export const EVENTS_BARRIER_TARGET = `${EVENTS_NAMESPACE}:barrier`
export const EVENTS_SIGNAL_TARGET = `${EVENTS_NAMESPACE}:signal`
export const EVENTS_KEYBOARD_TARGET = `${EVENTS_NAMESPACE}:keyboard`

/** User-facing event names carried by the scene controls. */
export const EVENTS_UP = 'up'
export const EVENTS_DOWN = 'down'

/** Internal event used by the delayed traffic-light transition. */
export const EVENTS_CHANGING = 'changing'

/** Keyboard input and navigation events. */
export const EVENTS_KEYBOARD_NAVIGATION_EVENT = `${EVENTS_NAMESPACE}:keyboard:navigate`
export const EVENTS_KEYBOARD_NAVIGATION_STRAP = `${EVENTS_NAMESPACE}:keyboard:navigate`
export const EVENTS_TWEEN_STOP_EVENT = 'tween:stop'

/** Frame lifecycle events and the frame-local explanation events. */
export type EventsFrameEventNames = Readonly<{
  enter: string
  leave: string
  reset: string
  intro: string
  outro: string
  end: string
  eventMessage: string
  arrowBarrier: string
  arrowSignal: string
  actionBarrier: string
  actionSignal: string
}>

/** Creates the stable event names owned by one frame story. */
export function createEventsFrameEventNames(storyId: EventsFrameStoryId): EventsFrameEventNames {
  const prefix = `${EVENTS_NAMESPACE}:${storyId}`
  return {
    enter: `${prefix}:enter`,
    leave: `${prefix}:leave`,
    reset: `${prefix}:reset`,
    intro: `${prefix}:intro`,
    outro: `${prefix}:outro`,
    end: `${prefix}:end`,
    eventMessage: `${prefix}:message:event`,
    arrowBarrier: `${prefix}:arrow:barrier`,
    arrowSignal: `${prefix}:arrow:signal`,
    actionBarrier: `${prefix}:action:barrier`,
    actionSignal: `${prefix}:action:signal`,
  }
}

/** Frame lifecycle names indexed by their stable story identity. */
export const EVENTS_FRAME_EVENTS: Readonly<Record<EventsFrameStoryId, EventsFrameEventNames>> =
  EVENTS_FRAME_STORY_IDS.reduce((events, storyId) => {
    events[storyId] = createEventsFrameEventNames(storyId)
    return events
  }, {} as Record<EventsFrameStoryId, EventsFrameEventNames>)

/** Finite offsets used by the explanatory event plan. */
export const EVENTS_EVENT_OFFSET_MS = 1_000
export const EVENTS_MESSAGE_STEP_MS = 800
export const EVENTS_ARROW_OFFSET_MS = EVENTS_EVENT_OFFSET_MS + EVENTS_MESSAGE_STEP_MS
export const EVENTS_ACTION_OFFSET_MS = EVENTS_ARROW_OFFSET_MS + EVENTS_MESSAGE_STEP_MS
export const EVENTS_ANIMATION_OFFSET_MS = EVENTS_ACTION_OFFSET_MS + EVENTS_MESSAGE_STEP_MS
export const EVENTS_FRAME_DURATION_MS = 5_500
export const EVENTS_LIGHT_DELAY_MS = 1_000
export const EVENTS_BARRIER_ROTATION_DURATION_MS = 1_500

/** Number shown in the heading of each explanatory frame. */
export const EVENTS_FRAME_NUMBERS: Readonly<Record<EventsFrameStoryId, string>> = {
  [EVENTS_FRAME_ONE_ID]: '01',
  [EVENTS_FRAME_TWO_ID]: '02',
  [EVENTS_FRAME_THREE_ID]: '03',
  [EVENTS_FRAME_FOUR_ID]: '04',
}
