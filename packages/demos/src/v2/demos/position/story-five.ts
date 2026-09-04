import type { PersoDoc } from 'codplay'
import { POSITION_VIEW_FIVE_ITEM_MOVE_EVENT } from './constants'
import { createViewRoot } from './carousel'
import { createCircularArcPath, createPositionMoveData } from './shared'
import type { AnchorRole, StoryAnimationOccurrence } from './types'

const SOURCE_MOUNT_TARGET = 'position:view-five:source:mount'
const TARGET_MOUNT_TARGET = 'position:view-five:target:mount'
const SOURCE_ITEM_TARGET = 'position:view-five:source:item'
const TARGET_ITEM_TARGET = 'position:view-five:target:item'

/** Creates the fifth lesson with one item crossing nested source/target parents. */
export function createStoryFive(): readonly PersoDoc[] {
  const view = createViewRoot(4, `
    <section class="position-view__frame position-view__frame--lesson">
      <div class="position-nested-stage">
        <div class="position-nested-rail position-nested-rail--source">
          <span class="position-nested-rail__label">source</span>
          <div class="position-nested-rail__mount" data-part="${SOURCE_MOUNT_TARGET}"></div>
        </div>
        <div class="position-route position-route--nested" aria-hidden="true"><span class="position-route__line"></span></div>
        <div class="position-nested-rail position-nested-rail--target">
          <span class="position-nested-rail__label">cible</span>
          <div class="position-nested-rail__mount" data-part="${TARGET_MOUNT_TARGET}"></div>
        </div>
      </div>
      <div class="position-story-caption">
        <span class="position-story-caption__number">05</span>
        <p>Deux rails contiennent chacun un parent. L’item traverse les niveaux sans quitter le circuit V2.</p>
      </div>
    </section>
  `)
  return [
    view,
    createNestedParent('source'),
    createNestedParent('target'),
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
  ]
}

/** Creates one nested parent layout for the fifth lesson. */
function createNestedParent(role: AnchorRole): PersoDoc {
  const mountTarget = role === 'source' ? SOURCE_MOUNT_TARGET : TARGET_MOUNT_TARGET
  const itemTarget = role === 'source' ? SOURCE_ITEM_TARGET : TARGET_ITEM_TARGET
  return {
    id: `position-view-five-${role}-parent`,
    type: 'layout',
    initial: {
      move: { target: mountTarget },
      className: `position-nested-parent position-nested-parent--${role}`,
      markup: `
        <div class="position-nested-parent__surface">
          <div class="position-nested-parent__item-mount" data-part="${itemTarget}"></div>
        </div>
      `,
    },
    actions: {},
  }
}

/** Schedules the two-second nested reparent for the fifth lesson. */
export function createStoryFiveAnimationPlan(): readonly StoryAnimationOccurrence[] {
  return [{
    name: POSITION_VIEW_FIVE_ITEM_MOVE_EVENT,
    offsetMs: 1_200,
    data: createPositionMoveData(TARGET_ITEM_TARGET, createCircularArcPath(0.5, 0.44)),
  }]
}
