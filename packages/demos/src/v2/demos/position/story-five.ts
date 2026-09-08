import type { StoryDoc } from 'codplay'
import type { PlannedStrapHelpers, PlannedStrapOccurrence } from 'codplay/runtime/player'
import {
  POSITION_NAMESPACE,
  POSITION_MOVE_DURATION_MS,
  POSITION_STORY_END_EVENT,
  POSITION_STORY_FIVE_ID,
  POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
} from './constants'
import { CAROUSEL_EVENTS, createViewRoot } from './carousel'

const SOURCE_CONTAINER = 'position:view-five:source'
const TARGET_CONTAINER = 'position:view-five:target'
const STAGE_TARGET = 'position:view-five:stage'
const Q_CONTAINER = 'position:view-five:q'
const K_CONTAINER = 'position:view-five:k'
const SOURCE_VERTICAL_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:source:shift`
const TARGET_VERTICAL_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:target:shift`
const Q_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:q:shift`
const Q_RETURN_EVENT = `${POSITION_NAMESPACE}:view:5:q:return`
const K_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:k:shift`
const K_RETURN_EVENT = `${POSITION_NAMESPACE}:view:5:k:return`
const STORY_FIVE_ANIMATION_START_OFFSET_MS = 450
const STORY_FIVE_PHASE_STEP_MS = 500
const STORY_FIVE_SOURCE_VERTICAL_SHIFT_OFFSET_MS = STORY_FIVE_ANIMATION_START_OFFSET_MS
const STORY_FIVE_TARGET_VERTICAL_SHIFT_OFFSET_MS = STORY_FIVE_ANIMATION_START_OFFSET_MS + STORY_FIVE_PHASE_STEP_MS
const STORY_FIVE_Q_OSCILLATION_START_OFFSET_MS = STORY_FIVE_ANIMATION_START_OFFSET_MS + STORY_FIVE_PHASE_STEP_MS * 2
const STORY_FIVE_K_OSCILLATION_START_OFFSET_MS = STORY_FIVE_ANIMATION_START_OFFSET_MS + STORY_FIVE_PHASE_STEP_MS * 3
const STORY_FIVE_VERTICAL_SHIFT = 15
const STORY_FIVE_VERTICAL_SHIFT_DURATION_MS = 3_650
const STORY_FIVE_OSCILLATION_DURATION_MS = 4_000
const STORY_FIVE_OSCILLATION_LEG_DURATION_MS = STORY_FIVE_OSCILLATION_DURATION_MS / 2
const STORY_FIVE_OSCILLATION_REPEAT_COUNT = 20
const STORY_FIVE_ITEM_MOVE_OFFSET_MS = STORY_FIVE_ANIMATION_START_OFFSET_MS + STORY_FIVE_PHASE_STEP_MS * 4
const STORY_FIVE_ITEM_MOVE_INTERVAL_MS = POSITION_MOVE_DURATION_MS
const STORY_FIVE_END_OFFSET_MS = STORY_FIVE_K_OSCILLATION_START_OFFSET_MS
  + STORY_FIVE_OSCILLATION_DURATION_MS * STORY_FIVE_OSCILLATION_REPEAT_COUNT

/** Creates story 5 with one Q/K container in each visible position card. */
export function createStoryFive(): StoryDoc {
  const view = createViewRoot(4, `
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
    listen: [{ on: CAROUSEL_EVENTS[4].reset, reset: true }],
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
          className: 'position-nested-container position-nested-container--q position-nested-container--flex-start',
          markup: `<div data-part="${Q_CONTAINER}"></div>`,
        },
        actions: {
          [Q_SHIFT_EVENT]: {
            move: {
              target: SOURCE_CONTAINER,
              transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
            },
            className: {
              add: 'position-nested-container--flex-end',
              remove: 'position-nested-container--flex-start',
            },
          },
          [Q_RETURN_EVENT]: {
            move: {
              target: SOURCE_CONTAINER,
              transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
            },
            className: {
              add: 'position-nested-container--flex-start',
              remove: 'position-nested-container--flex-end',
            },
          },
        },
      },
      {
        id: 'position-view-five-target-container',
        type: 'layout',
        initial: {
          move: { target: TARGET_CONTAINER },
          className: 'position-nested-container position-nested-container--k position-nested-container--flex-end',
          markup: `<div data-part="${K_CONTAINER}"></div>`,
        },
        actions: {
          [K_SHIFT_EVENT]: {
            move: {
              target: TARGET_CONTAINER,
              transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
            },
            className: {
              add: 'position-nested-container--flex-start',
              remove: 'position-nested-container--flex-end',
            },
          },
          [K_RETURN_EVENT]: {
            move: {
              target: TARGET_CONTAINER,
              transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
            },
            className: {
              add: 'position-nested-container--flex-end',
              remove: 'position-nested-container--flex-start',
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
          move: { target: Q_CONTAINER },
        },
        actions: { [POSITION_VIEW_FIVE_ITEM_MOVE_EVENT]: true },
      },
    ],
  }
}

/** Schedules twenty four-second Q/K oscillations and two item round trips. */
export function planStoryFiveAnimation(
  planned: Pick<PlannedStrapHelpers, 'repeat' | 'wait'>,
): readonly PlannedStrapOccurrence[] {
  const qShifts = planned.repeat(
    { eachMs: STORY_FIVE_OSCILLATION_DURATION_MS, times: STORY_FIVE_OSCILLATION_REPEAT_COUNT },
    [{ event: { name: Q_SHIFT_EVENT, visibility: 'scene' } }],
  ).map((occurrence) => ({
    ...occurrence,
    offsetMs: STORY_FIVE_Q_OSCILLATION_START_OFFSET_MS + occurrence.offsetMs,
  }))
  const kShifts = planned.repeat(
    { eachMs: STORY_FIVE_OSCILLATION_DURATION_MS, times: STORY_FIVE_OSCILLATION_REPEAT_COUNT },
    [{ event: { name: K_SHIFT_EVENT, visibility: 'scene' } }],
  ).map((occurrence) => ({
    ...occurrence,
    offsetMs: STORY_FIVE_K_OSCILLATION_START_OFFSET_MS + occurrence.offsetMs,
  }))
  const qReturns = planned.repeat(
    { eachMs: STORY_FIVE_OSCILLATION_DURATION_MS, times: STORY_FIVE_OSCILLATION_REPEAT_COUNT },
    [{ event: { name: Q_RETURN_EVENT, visibility: 'scene' } }],
  ).map((occurrence) => ({
    ...occurrence,
    offsetMs: STORY_FIVE_Q_OSCILLATION_START_OFFSET_MS
      + STORY_FIVE_OSCILLATION_LEG_DURATION_MS
      + occurrence.offsetMs,
  }))
  const kReturns = planned.repeat(
    { eachMs: STORY_FIVE_OSCILLATION_DURATION_MS, times: STORY_FIVE_OSCILLATION_REPEAT_COUNT },
    [{ event: { name: K_RETURN_EVENT, visibility: 'scene' } }],
  ).map((occurrence) => ({
    ...occurrence,
    offsetMs: STORY_FIVE_K_OSCILLATION_START_OFFSET_MS
      + STORY_FIVE_OSCILLATION_LEG_DURATION_MS
      + occurrence.offsetMs,
  }))
  return [
    ...planned.wait(STORY_FIVE_SOURCE_VERTICAL_SHIFT_OFFSET_MS, {
      event: { name: SOURCE_VERTICAL_SHIFT_EVENT, visibility: 'scene' },
    }),
    ...planned.wait(STORY_FIVE_TARGET_VERTICAL_SHIFT_OFFSET_MS, {
      event: { name: TARGET_VERTICAL_SHIFT_EVENT, visibility: 'scene' },
    }),
    ...qShifts,
    ...kShifts,
    ...qReturns,
    ...kReturns,
    ...planned.wait(STORY_FIVE_ITEM_MOVE_OFFSET_MS, {
      event: {
        name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
        visibility: 'scene',
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
    ...planned.wait(STORY_FIVE_ITEM_MOVE_OFFSET_MS + STORY_FIVE_ITEM_MOVE_INTERVAL_MS, {
      event: {
        name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
        visibility: 'scene',
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
    ...planned.wait(STORY_FIVE_ITEM_MOVE_OFFSET_MS + STORY_FIVE_ITEM_MOVE_INTERVAL_MS * 2, {
      event: {
        name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
        visibility: 'scene',
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
    ...planned.wait(STORY_FIVE_ITEM_MOVE_OFFSET_MS + STORY_FIVE_ITEM_MOVE_INTERVAL_MS * 3, {
      event: {
        name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
        visibility: 'scene',
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
    ...planned.wait(STORY_FIVE_END_OFFSET_MS, {
      event: { name: POSITION_STORY_END_EVENT, visibility: 'scene' },
    }),
  ]
}
