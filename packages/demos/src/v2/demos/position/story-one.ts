import type { StoryDoc } from 'codplay'
import {
  CAROUSEL_SLIDE_DURATION_MS,
  CAROUSEL_SLIDE_OFFSET_PX,
  FIRST_VIEW_MOVE_OFFSET_MS,
  POSITION_MOVE_DURATION_MS,
  POSITION_STORY_ONE_ID,
  POSITION_VIEW_ONE_ITEM_MOVE_EVENT,
  POSITION_VIEWPORT_TARGET,
  VIEW_IDS,
} from './constants'
import { CAROUSEL_EVENTS, POSITION_CAPSULE } from './carousel'
import type { StoryAnimationOccurrence } from './types'

const SOURCE_CONTAINER = 'position:view-one:source'
const TARGET_CONTAINER = 'position:view-one:target'

/** Story 1: a stable source and target, with one item reparented between them. */
export const POSITION_STORY_ONE: StoryDoc = {
  id: POSITION_STORY_ONE_ID,
  eventimes: [{
    name: POSITION_VIEW_ONE_ITEM_MOVE_EVENT,
    startAt: FIRST_VIEW_MOVE_OFFSET_MS,
    data: {
      move: {
        target: TARGET_CONTAINER,
        flipMode: 'overlay-world',
        transition: {
          duration: POSITION_MOVE_DURATION_MS,
          ease: 'inOutCubic',
        },
      },
    },
  }],
  persos: [
    {
      id: VIEW_IDS[0],
      type: 'layout',
      initial: {
        move: { target: POSITION_VIEWPORT_TARGET },
        className: `${POSITION_CAPSULE.children[0]!.className} position-story-cell position-view--visible`,
        markup: `
          <section class="position-view__frame position-view__frame--lesson">
            <div class="position-two-node-stage">
              <article class="position-node position-node--source">
                <strong>source</strong>
                <div class="position-node__outlet" data-part="${SOURCE_CONTAINER}"></div>
              </article>
              <div class="position-route position-route--straight" aria-hidden="true">
                <span class="position-route__line"></span>
              </div>
              <article class="position-node position-node--target">
                <strong>cible</strong>
                <div class="position-node__outlet" data-part="${TARGET_CONTAINER}"></div>
              </article>
            </div>
            <div class="position-story-caption">
              <span class="position-story-caption__number">01</span>
              <p>Le point de départ et le point d’arrivée restent stables ; l’item change d’outlet.</p>
            </div>
          </section>
        `,
      },
      actions: {
        [CAROUSEL_EVENTS[0].intro]: {
          className: {
            add: 'position-view--visible',
            remove: 'position-view--hidden',
          },
          style: {
            x: {
              from: CAROUSEL_SLIDE_OFFSET_PX,
              to: 0,
              duration: CAROUSEL_SLIDE_DURATION_MS,
              ease: 'out(2)',
            },
          },
        },
        [CAROUSEL_EVENTS[0].outro]: {
          className: {
            add: 'position-view--hidden',
            remove: 'position-view--visible',
          },
        },
      },
    },
    {
      id: 'position-view-one-item',
      type: 'tag',
      initial: {
        tag: 'span',
        content: 'item',
        className: 'position-item position-item--violet',
        attr: { 'aria-label': 'item' },
        move: { target: SOURCE_CONTAINER },
      },
      actions: {
        [POSITION_VIEW_ONE_ITEM_MOVE_EVENT]: true,
      },
    },
  ],
}

/** Eventime appended when navigation activates story 1 again. */
export const POSITION_STORY_ONE_ANIMATION_PLAN: readonly StoryAnimationOccurrence[] = [{
  name: POSITION_VIEW_ONE_ITEM_MOVE_EVENT,
  offsetMs: FIRST_VIEW_MOVE_OFFSET_MS,
  data: {
    move: {
      target: TARGET_CONTAINER,
      flipMode: 'overlay-world',
      transition: {
        duration: POSITION_MOVE_DURATION_MS,
        ease: 'inOutCubic',
      },
    },
  },
}]
