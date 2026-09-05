import type { PersoDoc } from 'codplay';
import {
	POSITION_VIEW_TWO_ITEM_MOVE_EVENT,
	POSITION_VIEW_TWO_SOURCE_SHIFT_EVENT,
	POSITION_VIEW_TWO_TARGET_SHIFT_EVENT,
} from './constants';
import { createViewRoot } from './carousel';
import { createCircularArcPath, createPositionMoveData } from './shared';
import type { AnchorRole, StoryAnimationOccurrence } from './types';

const STAGE_TARGET = 'position:view-two:stage';
const SOURCE_CONTAINER = 'position:view-two:source';
const TARGET_CONTAINER = 'position:view-two:target';
const STORY_TWO_ANCHOR_SHIFT = 15;

/** Creates one moving source or target block for the second lesson. */
function createStoryTwoAnchor(role: AnchorRole): PersoDoc {
	const isSource = role === 'source';
	const actionName = isSource ? POSITION_VIEW_TWO_SOURCE_SHIFT_EVENT : POSITION_VIEW_TWO_TARGET_SHIFT_EVENT;
	const outlet = isSource ? SOURCE_CONTAINER : TARGET_CONTAINER;
	const label = isSource ? 'source' : 'cible';
	const toY = isSource ? STORY_TWO_ANCHOR_SHIFT : -STORY_TWO_ANCHOR_SHIFT;
	return {
		id: `position-view-two-${role}`,
		type: 'layout',
		initial: {
			move: { target: STAGE_TARGET },
			className: `position-anchor position-anchor--${role} position-node position-node--${role}`,
			// Keep the anchor tween on the ordinary transform channel used by the V2 demos.
			style: { translateY: 0 },
			markup: `
        <article>
          <strong>${label}</strong>
          <div class="position-node__outlet" data-part="${outlet}"></div>
        </article>
      `,
		},
		actions: {
			[actionName]: {
				style: {
					translateY: { from: 0, to: toY, duration: 3_650, ease: 'inOutSine' },
				},
			},
		},
	};
}

/** Creates the second lesson where both anchors move while the item is reparented. */
export function createStoryTwo(): readonly PersoDoc[] {
	const view = createViewRoot(
		1,
		`
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
	);
	return [
		view,
		createStoryTwoAnchor('source'),
		createStoryTwoAnchor('target'),
		{
			id: 'position-view-two-item',
			type: 'tag',
			initial: {
				tag: 'span',
				content: 'item',
				className: 'position-item position-item--coral',
				move: { target: SOURCE_CONTAINER },
			},
			// The complete move is supplied by the story eventime data at activation.
			actions: { [POSITION_VIEW_TWO_ITEM_MOVE_EVENT]: true },
		},
	];
}

/** Schedules the anchor tweens and the two-second source-to-target reparent. */
export function createStoryTwoAnimationPlan(): readonly StoryAnimationOccurrence[] {
	return [
		{ name: POSITION_VIEW_TWO_SOURCE_SHIFT_EVENT, offsetMs: 450 },
		{ name: POSITION_VIEW_TWO_TARGET_SHIFT_EVENT, offsetMs: 450 },
		{
			name: POSITION_VIEW_TWO_ITEM_MOVE_EVENT,
			offsetMs: 1_350,
			data: createPositionMoveData(TARGET_CONTAINER, createCircularArcPath(0.5, -0.42), 'overlay'),
		},
	];
}
