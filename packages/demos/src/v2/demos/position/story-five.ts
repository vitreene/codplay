import type { StoryDoc } from 'codplay'
import type { PlannedStrapHelpers, PlannedStrapOccurrence, StrapFunction } from 'codplay/runtime/player'
import {
  POSITION_NAMESPACE,
  POSITION_MOVE_DURATION_MS,
  POSITION_STORY_END_EVENT,
  POSITION_STORY_FIVE_ID,
  POSITION_VIEW_FIVE_INITIALIZE_EVENT,
  POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
} from './constants'
import { CAROUSEL_EVENTS_BY_STORY_ID, createViewRoot } from './carousel'

const SOURCE_CONTAINER = 'position:view-five:source'
const TARGET_CONTAINER = 'position:view-five:target'
const STAGE_TARGET = 'position:view-five:stage'
const Q_CONTAINER = 'position:view-five:q'
const K_CONTAINER = 'position:view-five:k'
const SOURCE_VERTICAL_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:source:shift`
const TARGET_VERTICAL_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:target:shift`
const Q_ANIMATION_EVENT = `${POSITION_NAMESPACE}:view:5:q:animate`
const K_ANIMATION_EVENT = `${POSITION_NAMESPACE}:view:5:k:animate`
const STORY_FIVE_START_STRAP = `${POSITION_NAMESPACE}:view:5:start`
const STORY_FIVE_ANIMATION_START_OFFSET_MS = 450
const STORY_FIVE_PHASE_STEP_MS = 500
const STORY_FIVE_SOURCE_VERTICAL_SHIFT_OFFSET_MS = STORY_FIVE_ANIMATION_START_OFFSET_MS
const STORY_FIVE_TARGET_VERTICAL_SHIFT_OFFSET_MS = STORY_FIVE_ANIMATION_START_OFFSET_MS + STORY_FIVE_PHASE_STEP_MS
const STORY_FIVE_Q_OSCILLATION_START_OFFSET_MS = STORY_FIVE_ANIMATION_START_OFFSET_MS + STORY_FIVE_PHASE_STEP_MS * 2
const STORY_FIVE_K_OSCILLATION_START_OFFSET_MS = STORY_FIVE_ANIMATION_START_OFFSET_MS + STORY_FIVE_PHASE_STEP_MS * 3
const STORY_FIVE_VERTICAL_SHIFT = 15
const STORY_FIVE_VERTICAL_SHIFT_DURATION_MS = 3_650
const STORY_FIVE_OSCILLATION_DURATION_MS = 4_000
const STORY_FIVE_OSCILLATION_REPEAT_COUNT = 20
const STORY_FIVE_OSCILLATION_LEG_DURATION_MS = STORY_FIVE_OSCILLATION_DURATION_MS / 2
const STORY_FIVE_OSCILLATION_LOOP_COUNT = STORY_FIVE_OSCILLATION_REPEAT_COUNT * 2 - 1
const STORY_FIVE_ITEM_MOVE_OFFSET_MS = STORY_FIVE_ANIMATION_START_OFFSET_MS + STORY_FIVE_PHASE_STEP_MS * 4
const STORY_FIVE_ITEM_MOVE_INTERVAL_MS = POSITION_MOVE_DURATION_MS
const STORY_FIVE_END_OFFSET_MS = STORY_FIVE_K_OSCILLATION_START_OFFSET_MS
  + STORY_FIVE_OSCILLATION_DURATION_MS * STORY_FIVE_OSCILLATION_REPEAT_COUNT

/** Creates story 5 with one fixed-parent K/Q container in each visible position card. */
export function createStoryFive(): StoryDoc {
  const storyEvents = CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_FIVE_ID]
  const view = createViewRoot(POSITION_STORY_FIVE_ID, `
    <section class="position-view__frame position-view__frame--lesson position-story-five-frame">
      <div class="position-two-node-stage" data-part="${STAGE_TARGET}">
        <div class="position-route position-route--straight" aria-hidden="true">
          <span class="position-route__line"></span>
        </div>
      </div>
      <div class="position-story-caption">
        <span class="position-story-caption__number">05</span>
        <p>Q et K glissent dans leur conteneur ; l’item passe de l’un à l’autre par reparenting.</p>
      </div>
    </section>
  `, 'position-story-five-frame')
  return {
    id: POSITION_STORY_FIVE_ID,
    straps: {
      [STORY_FIVE_START_STRAP]: createStoryFiveStartStrap(),
    },
    listen: [
      { on: storyEvents.enter, active: true, reset: true },
      { on: storyEvents.leave, active: false },
      { on: storyEvents.reset, reset: true },
      { on: POSITION_VIEW_FIVE_INITIALIZE_EVENT, straps: [STORY_FIVE_START_STRAP] },
    ],
    persos: [
      view,
      {
        id: 'position-view-five-source',
        type: 'layout',
        initial: {
          move: { target: STAGE_TARGET },
          className: 'position-node position-node--source',
          style: { translateY: 0 },
          markup: `<article data-part="${SOURCE_CONTAINER}"><strong>source</strong></article>`,
        },
        actions: {
          [SOURCE_VERTICAL_SHIFT_EVENT]: {
            style: {
              translateY: {
                from: 0,
                to: STORY_FIVE_VERTICAL_SHIFT,
                duration: STORY_FIVE_VERTICAL_SHIFT_DURATION_MS,
                ease: 'inOutSine',
              },
            },
          },
        },
      },
      {
        id: 'position-view-five-target',
        type: 'layout',
        initial: {
          move: { target: STAGE_TARGET },
          className: 'position-node position-node--target',
          style: { translateY: 0 },
          markup: `<article data-part="${TARGET_CONTAINER}"><strong>cible</strong></article>`,
        },
        actions: {
          [TARGET_VERTICAL_SHIFT_EVENT]: {
            style: {
              translateY: {
                from: 0,
                to: -STORY_FIVE_VERTICAL_SHIFT,
                duration: STORY_FIVE_VERTICAL_SHIFT_DURATION_MS,
                ease: 'inOutSine',
              },
            },
          },
        },
      },
      {
        id: 'position-view-five-source-container',
        type: 'layout',
        initial: {
          move: { target: SOURCE_CONTAINER },
          className: 'position-nested-container position-nested-container--k position-nested-container--flex-start',
          markup: `<div data-part="${K_CONTAINER}"></div>`,
        },
        actions: {
          // K remains in source; this style tween moves it horizontally in that parent.
          [K_ANIMATION_EVENT]: {
            style: {
              translateX: {
                from: '0%',
                to: '100%',
                duration: STORY_FIVE_OSCILLATION_LEG_DURATION_MS,
                loop: STORY_FIVE_OSCILLATION_LOOP_COUNT,
                alternate: true,
                ease: 'inOutSine',
              },
            },
          },
        },
      },
      {
        id: 'position-view-five-target-container',
        type: 'layout',
        initial: {
          move: { target: TARGET_CONTAINER },
          className: 'position-nested-container position-nested-container--q position-nested-container--flex-end',
          markup: `<div data-part="${Q_CONTAINER}"></div>`,
        },
        actions: {
          // Q remains in target; this style tween moves it horizontally in that parent.
          [Q_ANIMATION_EVENT]: {
            style: {
              translateX: {
                from: '0%',
                to: '-100%',
                duration: STORY_FIVE_OSCILLATION_LEG_DURATION_MS,
                loop: STORY_FIVE_OSCILLATION_LOOP_COUNT,
                alternate: true,
                ease: 'inOutSine',
              },
            },
          },
        },
      },
      {
        id: 'position-view-five-item',
        type: 'tag',
        initial: {
          tag: 'span',
          content: 'item',
          className: 'position-item position-item--rose',
          move: { target: K_CONTAINER },
        },
        actions: { [POSITION_VIEW_FIVE_ITEM_MOVE_EVENT]: true },
      },
    ],
  }
}

/** Starts the story-local finite timeline without creating one event per K/Q oscillation leg. */
function createStoryFiveStartStrap(): StrapFunction {
  return ({ context }) => planStoryFiveAnimation(context.planned)
}

/** Schedules the vertical shifts and four explicit X exchanges. */
export function planStoryFiveAnimation(
  planned: Pick<PlannedStrapHelpers, 'wait'>,
): readonly PlannedStrapOccurrence[] {
  return [
    ...planned.wait(STORY_FIVE_SOURCE_VERTICAL_SHIFT_OFFSET_MS, {
      event: { name: SOURCE_VERTICAL_SHIFT_EVENT, visibility: 'story' },
    }),
    ...planned.wait(STORY_FIVE_TARGET_VERTICAL_SHIFT_OFFSET_MS, {
      event: { name: TARGET_VERTICAL_SHIFT_EVENT, visibility: 'story' },
    }),
    ...planned.wait(STORY_FIVE_Q_OSCILLATION_START_OFFSET_MS, {
      event: { name: Q_ANIMATION_EVENT, visibility: 'story' },
    }),
    ...planned.wait(STORY_FIVE_K_OSCILLATION_START_OFFSET_MS, {
      event: { name: K_ANIMATION_EVENT, visibility: 'story' },
    }),
    ...planned.wait(STORY_FIVE_ITEM_MOVE_OFFSET_MS, {
      event: {
        name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
        visibility: 'story',
        data: {
          move: {
            target: Q_CONTAINER,
            reparent: true,
            transition: {
              duration: POSITION_MOVE_DURATION_MS,
              ease: 'inOutCubic',
            },
          },
        },
      },
    }),
    ...planned.wait(STORY_FIVE_ITEM_MOVE_OFFSET_MS + STORY_FIVE_ITEM_MOVE_INTERVAL_MS, {
      event: {
        name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
        visibility: 'story',
        data: {
          move: {
            target: K_CONTAINER,
            reparent: true,
            transition: {
              duration: POSITION_MOVE_DURATION_MS,
              ease: 'inOutCubic',
            },
          },
        },
      },
    }),
    ...planned.wait(STORY_FIVE_ITEM_MOVE_OFFSET_MS + STORY_FIVE_ITEM_MOVE_INTERVAL_MS * 2, {
      event: {
        name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
        visibility: 'story',
        data: {
          move: {
            target: Q_CONTAINER,
            reparent: true,
            transition: {
              duration: POSITION_MOVE_DURATION_MS,
              ease: 'inOutCubic',
            },
          },
        },
      },
    }),
    ...planned.wait(STORY_FIVE_ITEM_MOVE_OFFSET_MS + STORY_FIVE_ITEM_MOVE_INTERVAL_MS * 3, {
      event: {
        name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
        visibility: 'story',
        data: {
          move: {
            target: K_CONTAINER,
            reparent: true,
            transition: {
              duration: POSITION_MOVE_DURATION_MS,
              ease: 'inOutCubic',
            },
          },
        },
      },
    }),
    ...planned.wait(STORY_FIVE_END_OFFSET_MS, {
      event: { name: POSITION_STORY_END_EVENT, visibility: 'story' },
    }),
  ]
}
