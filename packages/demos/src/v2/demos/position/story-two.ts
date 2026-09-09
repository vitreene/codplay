import type { StoryDoc } from 'codplay';
import {
	CAROUSEL_SLIDE_DURATION_MS,
	CAROUSEL_SLIDE_OFFSET_PX,
	POSITION_MOVE_DURATION_MS,
	POSITION_STORY_END_EVENT,
	POSITION_STORY_TWO_ID,
	POSITION_STORY_VIEW_IDS,
	POSITION_VIEW_TWO_ITEM_MOVE_EVENT,
	POSITION_VIEW_TWO_SOURCE_SHIFT_EVENT,
	POSITION_VIEW_TWO_TARGET_SHIFT_EVENT,
	POSITION_VIEWPORT_TARGET,
} from './constants';
import {
	CAROUSEL_EVENTS_BY_STORY_ID,
	isInitialPositionStory,
} from './carousel';
import type { StoryAnimationOccurrence } from './types';

const STAGE_TARGET = 'position:view-two:stage';
const SOURCE_CONTAINER = 'position:view-two:source';
const TARGET_CONTAINER = 'position:view-two:target';
const STORY_TWO_ANCHOR_SHIFT = 15;
const STORY_TWO_END_OFFSET_MS = 4_100;
const STORY_EVENTS = CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_TWO_ID];

/** Eventimes used when story 2 is activated in the validation carousel. */
export const POSITION_STORY_TWO_ANIMATION_PLAN: readonly StoryAnimationOccurrence[] = [
	{ name: POSITION_VIEW_TWO_SOURCE_SHIFT_EVENT, offsetMs: 450 },
	{ name: POSITION_VIEW_TWO_TARGET_SHIFT_EVENT, offsetMs: 450 },
	{
		name: POSITION_VIEW_TWO_ITEM_MOVE_EVENT,
		offsetMs: 1_350,
		data: {
			move: {
				target: TARGET_CONTAINER,
				reparent: true,
				transition: {
					duration: POSITION_MOVE_DURATION_MS,
				},
			},
		},
	},
	{
		name: POSITION_STORY_END_EVENT,
		offsetMs: STORY_TWO_END_OFFSET_MS,
	},
];

/** Story 2: the visible source and target move while the item changes outlet. */
export const POSITION_STORY_TWO: StoryDoc = {
	id: POSITION_STORY_TWO_ID,
	listen: [
		{ on: STORY_EVENTS.enter, active: true, reset: true },
		{ on: STORY_EVENTS.leave, active: false },
		{ on: STORY_EVENTS.reset, reset: true },
	],
	persos: [
		{
			id: POSITION_STORY_VIEW_IDS[POSITION_STORY_TWO_ID],
			type: 'layout',
			initial: {
				move: { target: POSITION_VIEWPORT_TARGET },
				className: `position-view position-story-cell ${isInitialPositionStory(POSITION_STORY_TWO_ID) ? 'position-view--visible' : 'position-view--hidden'}`,
				markup: `
          <section class="position-view__frame position-view__frame--lesson">
            <div class="position-moving-stage position-two-node-stage" data-part="${STAGE_TARGET}">
              <div class="position-route position-route--stage" aria-hidden="true"><span class="position-route__line"></span></div>
              <div class="position-stage-axis" aria-hidden="true"><span></span><span></span></div>
            </div>
            <div class="position-story-caption">
              <span class="position-story-caption__number">02</span>
              <p>La position n’est plus un point fixe : les deux repères suivent leur propre trajectoire.</p>
            </div>
          </section>
        `,
			},
			actions: {
				[STORY_EVENTS.intro]: {
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
				[STORY_EVENTS.outro]: {
					className: {
						add: 'position-view--hidden',
						remove: 'position-view--visible',
					},
				},
			},
		},
		{
			id: 'position-view-two-source',
			type: 'layout',
			initial: {
				move: { target: STAGE_TARGET },
				className: 'position-anchor position-anchor--source position-node position-node--source',
				style: { translateY: 0 },
				markup: `
          <article>
            <strong>source</strong>
            <div class="position-node__outlet" data-part="${SOURCE_CONTAINER}"></div>
          </article>
        `,
			},
			actions: {
				[POSITION_VIEW_TWO_SOURCE_SHIFT_EVENT]: {
					style: {
						translateY: { from: 0, to: STORY_TWO_ANCHOR_SHIFT, duration: 3_650, ease: 'inOutSine' },
					},
				},
			},
		},
		{
			id: 'position-view-two-target',
			type: 'layout',
			initial: {
				move: { target: STAGE_TARGET },
				className: 'position-anchor position-anchor--target position-node position-node--target',
				style: { translateY: 0 },
				markup: `
          <article>
            <strong>cible</strong>
            <div class="position-node__outlet" data-part="${TARGET_CONTAINER}"></div>
          </article>
        `,
			},
			actions: {
				[POSITION_VIEW_TWO_TARGET_SHIFT_EVENT]: {
					style: {
						translateY: { from: 0, to: -STORY_TWO_ANCHOR_SHIFT, duration: 3_650, ease: 'inOutSine' },
					},
				},
			},
		},
		{
			id: 'position-view-two-item',
			type: 'tag',
			initial: {
				tag: 'span',
				content: 'item',
				className: 'position-item position-item--coral',
				move: { target: SOURCE_CONTAINER },
			},
			actions: {
				[POSITION_VIEW_TWO_ITEM_MOVE_EVENT]: true,
			},
		},
	],
};
