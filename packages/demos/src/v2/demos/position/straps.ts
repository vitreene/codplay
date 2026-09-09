import {
  POSITION_KEYBOARD_NAVIGATION_EVENT,
  POSITION_KEYBOARD_NAVIGATION_STRAP,
  POSITION_KEYBOARD_TOGGLE_EVENT,
  POSITION_KEYBOARD_TOGGLE_STRAP,
  POSITION_LIVE_INITIALIZE_EVENT,
  POSITION_NAMESPACE,
  POSITION_STORY_PAUSED_EVENT,
  POSITION_STORY_RESUMED_EVENT,
  POSITION_STORY_FIVE_ID,
  POSITION_TWEEN_STOP_EVENT,
  POSITION_VIEW_STORY_IDS,
  POSITION_VIEW_FIVE_INITIALIZE_EVENT,
  POSITION_STORY_FOUR_ID,
  VIEW_COUNT,
} from './constants'
import { CAROUSEL_EVENTS } from './carousel'
import { planStoryAnimation } from './story-animation'
import { clamp, readFinite, readRecord } from './shared'
import type { SceneListenRule } from 'codplay/scene/types'
import type { PlannedStrapHelpers, StrapFunction, StrapReturnValue } from 'codplay/runtime/player'

/** Starts one position story through its own story-scoped event circuit. */
function planSelectedStory(
  storyId: typeof POSITION_VIEW_STORY_IDS[number],
  planned: Pick<PlannedStrapHelpers, 'wait' | 'repeat'>,
  state: Readonly<Record<string, unknown>>,
): StrapReturnValue {
  if (storyId === POSITION_STORY_FOUR_ID) {
    return {
      events: [{
        name: POSITION_LIVE_INITIALIZE_EVENT,
        storyId,
        visibility: 'story',
      }],
    }
  }
  if (storyId === POSITION_STORY_FIVE_ID) {
    return {
      events: [{
        name: POSITION_VIEW_FIVE_INITIALIZE_EVENT,
        storyId,
        visibility: 'story',
      }],
    }
  }
  return planStoryAnimation(storyId, planned, state)
}

/** Names the scene strap that records the currently visible carousel story. */
function viewRememberStrap(index: number): string {
  return `${POSITION_NAMESPACE}:view:${index + 1}:remember`
}

/** Builds the straps that own only the position scene's global carousel state. */
export function createPositionSceneStraps(): Readonly<Record<string, StrapFunction>> {
  const straps: Record<string, StrapFunction> = {
    [POSITION_KEYBOARD_NAVIGATION_STRAP]: ({ event, state, context }) => {
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
              { name: POSITION_TWEEN_STOP_EVENT, visibility: 'scene' },
              {
                name: CAROUSEL_EVENTS[current].leave,
                storyId: POSITION_VIEW_STORY_IDS[current],
                visibility: 'story',
              },
              { name: CAROUSEL_EVENTS[current].reset, visibility: 'scene' },
              { name: CAROUSEL_EVENTS[current].outro, visibility: 'scene' },
              {
                name: CAROUSEL_EVENTS[next].enter,
                storyId: POSITION_VIEW_STORY_IDS[next],
                visibility: 'story',
              },
              { name: CAROUSEL_EVENTS[next].intro, visibility: 'scene' },
          ],
        },
          planSelectedStory(POSITION_VIEW_STORY_IDS[next], context.planned, state),
      ]
      return output
    },
    [POSITION_KEYBOARD_TOGGLE_STRAP]: ({ state, context }) => {
      const current = clamp(Math.round(readFinite(state.currentView, 0)), 0, VIEW_COUNT - 1)
      const paused = state.storyPaused === true
      if (paused) {
        const storyId = POSITION_VIEW_STORY_IDS[current]
        const initialize = storyId === POSITION_STORY_FOUR_ID
          ? {
              name: POSITION_LIVE_INITIALIZE_EVENT,
              storyId,
              visibility: 'story' as const,
            }
          : storyId === POSITION_STORY_FIVE_ID
            ? {
                name: POSITION_VIEW_FIVE_INITIALIZE_EVENT,
                storyId,
                visibility: 'story' as const,
              }
            : undefined
        const output: readonly StrapReturnValue[] = [
          {
            update: { storyPaused: false },
            events: [
              { name: POSITION_STORY_RESUMED_EVENT, visibility: 'scene' },
              ...(initialize === undefined ? [] : [initialize]),
            ],
          },
          ...(initialize === undefined ? [planStoryAnimation(storyId, context.planned, state)] : []),
        ]
        return output
      }
      return {
        update: { storyPaused: true },
        events: [
          { name: POSITION_TWEEN_STOP_EVENT, visibility: 'scene' },
          { name: POSITION_STORY_PAUSED_EVENT, visibility: 'scene' },
        ],
      }
    },
  }

  for (let index = 0; index < VIEW_COUNT; index += 1) {
    straps[viewRememberStrap(index)] = () => ({ update: { currentView: index } })
  }
  return straps
}

/** Connects scene-level keyboard and carousel events to their global straps. */
export function createPositionSceneListenRules(): readonly SceneListenRule[] {
  const rules: SceneListenRule[] = [
    { on: POSITION_KEYBOARD_NAVIGATION_EVENT, straps: [POSITION_KEYBOARD_NAVIGATION_STRAP] },
    { on: POSITION_KEYBOARD_TOGGLE_EVENT, straps: [POSITION_KEYBOARD_TOGGLE_STRAP] },
  ]

  for (let index = 0; index < VIEW_COUNT; index += 1) {
    rules.push({
      on: CAROUSEL_EVENTS[index].intro,
      straps: [viewRememberStrap(index)],
    })
  }
  return rules
}
