import type { StoryDoc } from 'codplay'
import {
  POSITION_NAMESPACE,
  POSITION_STORY_END_EVENT,
  POSITION_STORY_FIVE_ID,
  POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
} from './constants'
import { createViewRoot } from './carousel'
import { createCircularArcPath, createPositionMoveData } from './shared'
import type { StoryAnimationOccurrence } from './types'

const SOURCE_MOUNT_TARGET = 'position:view-five:source:mount'
const TARGET_MOUNT_TARGET = 'position:view-five:target:mount'
const SOURCE_ITEM_TARGET = 'position:view-five:source:item'
const TARGET_ITEM_TARGET = 'position:view-five:target:item'
const STAGE_TARGET = 'position:view-five:stage'
const SOURCE_RAIL_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:source:shift`
const TARGET_RAIL_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:target:shift`
const SOURCE_PARENT_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:source:parent:shift`
const TARGET_PARENT_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:5:target:parent:shift`
const STORY_FIVE_SHIFT_OFFSET_MS = 450
const STORY_FIVE_SHIFT_DURATION_MS = 3_650
const STORY_FIVE_RAIL_SHIFT = 15
const STORY_FIVE_PARENT_SHIFT = 48
const STORY_FIVE_END_OFFSET_MS = STORY_FIVE_SHIFT_OFFSET_MS + STORY_FIVE_SHIFT_DURATION_MS

/** Creates story 5 with one item crossing nested source/target parents. */
export function createStoryFive(): StoryDoc {
  const view = createViewRoot(4, `
    <section class="position-view__frame position-view__frame--lesson position-story-five-frame">
      <div class="position-nested-stage" data-part="${STAGE_TARGET}">
      </div>
      <div class="position-story-caption">
        <span class="position-story-caption__number">05</span>
        <p>Les rails source et cible se déplacent verticalement en sens opposés ; les conteneurs intérieurs restent dans leur rail et glissent horizontalement en sens inverse avant le reparenting de l’item.</p>
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
              <strong>source</strong>
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
              <strong>cible</strong>
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
          className: 'position-nested-parent position-nested-parent--source',
          style: { translateX: 0 },
          markup: `
            <div class="position-nested-parent__surface">
              <div class="position-nested-parent__item-mount" data-part="${SOURCE_ITEM_TARGET}"></div>
            </div>
          `,
        },
        actions: {
          [SOURCE_PARENT_SHIFT_EVENT]: {
            style: {
              translateX: {
                from: 0,
                to: STORY_FIVE_PARENT_SHIFT,
                duration: STORY_FIVE_SHIFT_DURATION_MS,
                ease: 'inOutSine',
              },
            },
          },
        },
      },
      {
        id: 'position-view-five-target-parent',
        type: 'layout',
        initial: {
          move: { target: TARGET_MOUNT_TARGET },
          className: 'position-nested-parent position-nested-parent--target',
          style: { translateX: 0 },
          markup: `
            <div class="position-nested-parent__surface">
              <div class="position-nested-parent__item-mount" data-part="${TARGET_ITEM_TARGET}"></div>
            </div>
          `,
        },
        actions: {
          [TARGET_PARENT_SHIFT_EVENT]: {
            style: {
              translateX: {
                from: 0,
                to: -STORY_FIVE_PARENT_SHIFT,
                duration: STORY_FIVE_SHIFT_DURATION_MS,
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
          move: { target: SOURCE_ITEM_TARGET },
        },
        // Nested source-to-target reparent; the event data carries the move.
        actions: { [POSITION_VIEW_FIVE_ITEM_MOVE_EVENT]: true },
      },
    ],
  }
}

/** Schedules the vertical rails, horizontal nested parents and item reparent. */
export function createStoryFiveAnimationPlan(): readonly StoryAnimationOccurrence[] {
  return [{
    name: SOURCE_RAIL_SHIFT_EVENT,
    offsetMs: STORY_FIVE_SHIFT_OFFSET_MS,
  }, {
    name: TARGET_RAIL_SHIFT_EVENT,
    offsetMs: STORY_FIVE_SHIFT_OFFSET_MS,
  }, {
    name: SOURCE_PARENT_SHIFT_EVENT,
    offsetMs: STORY_FIVE_SHIFT_OFFSET_MS,
  }, {
    name: TARGET_PARENT_SHIFT_EVENT,
    offsetMs: STORY_FIVE_SHIFT_OFFSET_MS,
  }, {
    name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
    offsetMs: 1_200,
    data: createPositionMoveData(TARGET_ITEM_TARGET, createCircularArcPath(0.5, 0.44)),
  }, {
    name: POSITION_STORY_END_EVENT,
    offsetMs: STORY_FIVE_END_OFFSET_MS,
  }]
}
