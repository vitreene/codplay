import {
  POSITION_KEYBOARD_NAVIGATION_EVENT,
  POSITION_KEYBOARD_TOGGLE_EVENT,
  POSITION_LIVE_SOURCE_RELEASED_EVENT,
  POSITION_LIVE_SOURCE_SETTLED_EVENT,
  POSITION_LIVE_TARGET_RELEASED_EVENT,
  POSITION_LIVE_TARGET_SETTLED_EVENT,
  POSITION_NAMESPACE,
  POSITION_PATH_CAPTURE_EVENT,
  POSITION_STORY_PAUSED_EVENT,
  POSITION_STORY_RESUMED_EVENT,
  POSITION_TWEEN_STOP_EVENT,
  VIEW_COUNT,
} from './constants'
import { CAROUSEL_EVENTS } from './carousel'
import { planStoryAnimation } from './story-animation'
import { createAnchorCommitStrap, createLiveBounceStrap } from './story-four'
import { createPathCaptureTransform, createPathCommitStrap } from './story-three'
import { clamp, readFinite, readRecord } from './shared'
import type { PositionListenRule, ViewIndex } from './types'
import type { StrapFunction, StrapReturnValue } from 'codplay/runtime/player'

const KEYBOARD_NAVIGATION_STRAP = `${POSITION_NAMESPACE}:keyboard:navigate`
const KEYBOARD_TOGGLE_STRAP = `${POSITION_NAMESPACE}:keyboard:toggle`
const PATH_COMMIT_STRAP = `${POSITION_NAMESPACE}:path:commit`
const LIVE_SOURCE_COMMIT_STRAP = `${POSITION_NAMESPACE}:live:source:commit`
const LIVE_TARGET_COMMIT_STRAP = `${POSITION_NAMESPACE}:live:target:commit`
const LIVE_BOUNCE_STRAP = `${POSITION_NAMESPACE}:live:bounce:calculate`

/** Names the remember strap associated with one generated carousel view. */
function viewRememberStrap(index: number): string {
  return `${POSITION_NAMESPACE}:view:${index + 1}:remember`
}

/** Builds the straps owned by the one position story. */
export function createPositionStraps(): Readonly<Record<string, StrapFunction>> {
  const straps: Record<string, StrapFunction> = {
    [KEYBOARD_NAVIGATION_STRAP]: createNavigationStrap(),
    [KEYBOARD_TOGGLE_STRAP]: createStoryToggleStrap(),
    [PATH_COMMIT_STRAP]: createPathCommitStrap(),
    [LIVE_SOURCE_COMMIT_STRAP]: createAnchorCommitStrap('source'),
    [LIVE_TARGET_COMMIT_STRAP]: createAnchorCommitStrap('target'),
    [LIVE_BOUNCE_STRAP]: createLiveBounceStrap(),
  }
  for (let index = 0; index < VIEW_COUNT; index += 1) {
    straps[viewRememberStrap(index)] = createRememberViewStrap(index)
  }
  return straps
}

/** Moves the exclusive carousel selection in response to a keyboard event. */
function createNavigationStrap(): StrapFunction {
  return ({ event, state, context }) => {
    const current = clamp(Math.round(readFinite(state.currentView, 0)), 0, VIEW_COUNT - 1)
    const direction = readRecord(event.data)?.direction
    const next = direction === 'previous'
      ? Math.max(0, current - 1)
      : Math.min(VIEW_COUNT - 1, current + 1)
    if (next === current) return { update: { currentView: current } }
    const output: readonly StrapReturnValue[] = [
      {
        update: { currentView: next },
        events: [
          { name: POSITION_TWEEN_STOP_EVENT },
          { name: CAROUSEL_EVENTS[current].outro },
          { name: CAROUSEL_EVENTS[next].intro },
        ],
      },
      planStoryAnimation(next as ViewIndex, context.planned, state),
    ]
    return output
  }
}

/** Toggles the current view animation by emitting story-local events. */
function createStoryToggleStrap(): StrapFunction {
  return ({ state, context }) => {
    const current = clamp(Math.round(readFinite(state.currentView, 0)), 0, VIEW_COUNT - 1)
    const paused = state.storyPaused === true
    if (paused) {
      const output: readonly StrapReturnValue[] = [
        {
          update: { storyPaused: false },
          events: [{ name: POSITION_STORY_RESUMED_EVENT }],
        },
        planStoryAnimation(current as ViewIndex, context.planned, state),
      ]
      return output
    }
    return {
      update: { storyPaused: true },
      events: [
        { name: POSITION_TWEEN_STOP_EVENT },
        { name: POSITION_STORY_PAUSED_EVENT },
      ],
    }
  }
}

/** Remembers the view selected by a generated carousel intro event. */
function createRememberViewStrap(index: number): StrapFunction {
  return () => ({ update: { currentView: index } })
}

/** Creates the listen rules that connect scene-native inputs to story straps. */
export function createPositionListenRules(): readonly PositionListenRule[] {
  const rules: PositionListenRule[] = [
    { on: POSITION_KEYBOARD_NAVIGATION_EVENT, straps: [KEYBOARD_NAVIGATION_STRAP] },
    { on: POSITION_KEYBOARD_TOGGLE_EVENT, straps: [KEYBOARD_TOGGLE_STRAP] },
    {
      on: POSITION_PATH_CAPTURE_EVENT,
      transform: [createPathCaptureTransform()],
      straps: [PATH_COMMIT_STRAP],
    },
    { on: POSITION_LIVE_SOURCE_RELEASED_EVENT, straps: [LIVE_SOURCE_COMMIT_STRAP] },
    { on: POSITION_LIVE_TARGET_RELEASED_EVENT, straps: [LIVE_TARGET_COMMIT_STRAP] },
  ]

  for (let index = 0; index < VIEW_COUNT; index += 1) {
    rules.push({
      on: CAROUSEL_EVENTS[index].intro,
      straps: [viewRememberStrap(index)],
    })
  }
  rules.push(
    { on: POSITION_LIVE_SOURCE_SETTLED_EVENT, straps: [LIVE_BOUNCE_STRAP] },
    { on: POSITION_LIVE_TARGET_SETTLED_EVENT, straps: [LIVE_BOUNCE_STRAP] },
  )
  return rules
}
