import type { PersoDoc } from 'codplay'
import { FIRST_VIEW_MOVE_OFFSET_MS, POSITION_VIEW_ONE_ITEM_MOVE_EVENT } from './constants'
import { createViewRoot } from './carousel'
import { createPositionMoveData } from './shared'
import type { StoryAnimationOccurrence } from './types'

const SOURCE_CONTAINER = 'position:view-one:source'
const TARGET_CONTAINER = 'position:view-one:target'

/** Creates the first lesson: one item is reparented from source to target. */
export function createStoryOne(): readonly PersoDoc[] {
  const view = createViewRoot(0, `
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
  `)
  return [
    view,
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
        [POSITION_VIEW_ONE_ITEM_MOVE_EVENT]: createPositionMoveData(TARGET_CONTAINER),
      },
    },
  ]
}

/** Schedules the first item move at the initial story offset. */
export function createStoryOneAnimationPlan(): readonly StoryAnimationOccurrence[] {
  return [{
    name: POSITION_VIEW_ONE_ITEM_MOVE_EVENT,
    offsetMs: FIRST_VIEW_MOVE_OFFSET_MS,
    data: createPositionMoveData(TARGET_CONTAINER),
  }]
}
