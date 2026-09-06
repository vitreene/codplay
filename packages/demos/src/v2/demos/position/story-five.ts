import type { StoryDoc } from 'codplay'
import type { PlannedStrapHelpers, PlannedStrapOccurrence } from 'codplay/runtime/player'
import {
  POSITION_NAMESPACE,
  POSITION_MOVE_DURATION_MS,
  POSITION_STORY_END_EVENT,
  POSITION_STORY_FIVE_ID,
  POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
} from './constants'
import { createViewRoot } from './carousel'
import { createCircularArcPath, createPositionMoveData } from './shared'

const SOURCE_MOUNT_TARGET = 'position:view-five:source:mount'
const TARGET_MOUNT_TARGET = 'position:view-five:target:mount'
const Q_ITEM_CONTAINER = 'position:view-five:q:item'
const K_ITEM_CONTAINER = 'position:view-five:k:item'
const STAGE_TARGET = 'position:view-five:stage'
const SOURCE_RAIL_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:source:shift`
const TARGET_RAIL_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:target:shift`
const Q_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:q:shift`
const Q_RETURN_EVENT = `${POSITION_NAMESPACE}:view:5:q:return`
const K_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:k:shift`
const K_RETURN_EVENT = `${POSITION_NAMESPACE}:view:5:k:return`
const STORY_FIVE_SHIFT_OFFSET_MS = 450
const STORY_FIVE_SHIFT_DURATION_MS = 3_650
const STORY_FIVE_OSCILLATION_DURATION_MS = 4_000
const STORY_FIVE_OSCILLATION_REPEAT_COUNT = 20
const STORY_FIVE_PARENT_RETURN_OFFSET_MS = STORY_FIVE_SHIFT_OFFSET_MS + POSITION_MOVE_DURATION_MS
const STORY_FIVE_RAIL_SHIFT = 15
const STORY_FIVE_END_OFFSET_MS = STORY_FIVE_SHIFT_OFFSET_MS
  + STORY_FIVE_OSCILLATION_DURATION_MS * STORY_FIVE_OSCILLATION_REPEAT_COUNT

/** Creates story 5 with one item crossing nested Q/K containers. */
export function createStoryFive(): StoryDoc {
  const view = createViewRoot(4, `
    <section class="position-view__frame position-view__frame--lesson position-story-five-frame">
      <div class="position-nested-stage" data-part="${STAGE_TARGET}">
      </div>
      <div class="position-story-caption">
        <span class="position-story-caption__number">05</span>
        <p>Les rails se déplacent verticalement en sens opposés ; les conteneurs intérieurs oscillent horizontalement dans leur rail avant le reparenting de l’item.</p>
      </div>
    </section>
  `)
  return {
    id: POSITION_STORY_FIVE_ID,
    persos: [
      view,
      {
        id: 'position-view-five-source-rail',
        type: 'layout',
        initial: {
          move: { target: STAGE_TARGET },
          className: 'position-node position-node--source position-nested-rail position-nested-rail--source',
          style: { translateY: 0 },
          markup: `
            <article>
              <div class="position-node__outlet" data-part="${SOURCE_MOUNT_TARGET}"></div>
            </article>
          `,
        },
        actions: {
          [SOURCE_RAIL_SHIFT_EVENT]: {
            style: {
              translateY: {
                from: 0,
                to: STORY_FIVE_RAIL_SHIFT,
                duration: STORY_FIVE_SHIFT_DURATION_MS,
                ease: 'inOutSine',
              },
            },
          },
        },
      },
      {
        id: 'position-view-five-target-rail',
        type: 'layout',
        initial: {
          move: { target: STAGE_TARGET },
          className: 'position-node position-node--target position-nested-rail position-nested-rail--target',
          style: { translateY: 0 },
          markup: `
            <article>
              <div class="position-node__outlet" data-part="${TARGET_MOUNT_TARGET}"></div>
            </article>
          `,
        },
        actions: {
          [TARGET_RAIL_SHIFT_EVENT]: {
            style: {
              translateY: {
                from: 0,
                to: -STORY_FIVE_RAIL_SHIFT,
                duration: STORY_FIVE_SHIFT_DURATION_MS,
                ease: 'inOutSine',
              },
            },
          },
        },
      },
      {
        id: 'position-view-five-source-parent',
        type: 'layout',
        initial: {
          move: { target: SOURCE_MOUNT_TARGET },
          className: 'position-nested-parent position-nested-parent--q position-nested-parent--flex-start',
          markup: `
            <div class="position-nested-parent__surface">
              <div class="position-nested-parent__item-mount" data-part="${Q_ITEM_CONTAINER}"></div>
            </div>
          `,
        },
        actions: {
          [Q_SHIFT_EVENT]: {
            move: {
              target: SOURCE_MOUNT_TARGET,
              transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
            },
            className: {
              add: 'position-nested-parent--flex-end',
              remove: 'position-nested-parent--flex-start',
            },
          },
          [Q_RETURN_EVENT]: {
            move: {
              target: SOURCE_MOUNT_TARGET,
              transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
            },
            className: {
              add: 'position-nested-parent--flex-start',
              remove: 'position-nested-parent--flex-end',
            },
          },
        },
      },
      {
        id: 'position-view-five-target-parent',
        type: 'layout',
        initial: {
          move: { target: TARGET_MOUNT_TARGET },
          className: 'position-nested-parent position-nested-parent--k position-nested-parent--flex-end',
          markup: `
            <div class="position-nested-parent__surface">
              <div class="position-nested-parent__item-mount" data-part="${K_ITEM_CONTAINER}"></div>
            </div>
          `,
        },
        actions: {
          [K_SHIFT_EVENT]: {
            move: {
              target: TARGET_MOUNT_TARGET,
              transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
            },
            className: {
              add: 'position-nested-parent--flex-start',
              remove: 'position-nested-parent--flex-end',
            },
          },
          [K_RETURN_EVENT]: {
            move: {
              target: TARGET_MOUNT_TARGET,
              transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
            },
            className: {
              add: 'position-nested-parent--flex-end',
              remove: 'position-nested-parent--flex-start',
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
          move: { target: Q_ITEM_CONTAINER },
        },
        // Nested source-to-target reparent; the event data carries the move.
        actions: { [POSITION_VIEW_FIVE_ITEM_MOVE_EVENT]: true },
      },
    ],
  }
}

/** Schedules the vertical rails, repeated inner oscillations and item reparent. */
export function planStoryFiveAnimation(
  planned: Pick<PlannedStrapHelpers, 'repeat' | 'wait'>,
): readonly PlannedStrapOccurrence[] {
  const shifts = planned.repeat(
    { eachMs: STORY_FIVE_OSCILLATION_DURATION_MS, times: STORY_FIVE_OSCILLATION_REPEAT_COUNT },
    [
      { event: { name: Q_SHIFT_EVENT, cascade: true } },
      { event: { name: K_SHIFT_EVENT, cascade: true } },
    ],
  ).map((occurrence) => ({
    ...occurrence,
    offsetMs: STORY_FIVE_SHIFT_OFFSET_MS + occurrence.offsetMs,
  }))
  const returns = planned.repeat(
    { eachMs: STORY_FIVE_OSCILLATION_DURATION_MS, times: STORY_FIVE_OSCILLATION_REPEAT_COUNT },
    [
      { event: { name: Q_RETURN_EVENT, cascade: true } },
      { event: { name: K_RETURN_EVENT, cascade: true } },
    ],
  ).map((occurrence) => ({
    ...occurrence,
    offsetMs: STORY_FIVE_PARENT_RETURN_OFFSET_MS + occurrence.offsetMs,
  }))
  return [
    ...planned.wait(STORY_FIVE_SHIFT_OFFSET_MS, {
      event: { name: SOURCE_RAIL_SHIFT_EVENT, cascade: true },
    }),
    ...planned.wait(STORY_FIVE_SHIFT_OFFSET_MS, {
      event: { name: TARGET_RAIL_SHIFT_EVENT, cascade: true },
    }),
    ...shifts,
    ...returns,
    ...planned.wait(1_200, {
      event: {
        name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
        cascade: true,
        data: createPositionMoveData(K_ITEM_CONTAINER, createCircularArcPath(0.5, 0.44)),
      },
    }),
    ...planned.wait(STORY_FIVE_END_OFFSET_MS, {
      event: { name: POSITION_STORY_END_EVENT, cascade: true },
    }),
  ]
}
