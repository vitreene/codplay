import type { PlannedStrapHelpers, PlannedStrapOccurrence } from 'codplay/runtime/player'
import { createStoryFiveAnimationPlan } from './story-five'
import { createStoryFourAnimationPlan } from './story-four'
import { POSITION_STORY_ONE_ANIMATION_PLAN } from './story-one'
import { createStorySixAnimationPlan } from './story-six'
import { POSITION_STORY_THREE_ANIMATION_PLAN } from './story-three'
import { POSITION_STORY_TWO_ANIMATION_PLAN } from './story-two'
import type { StoryAnimationOccurrence, ViewIndex } from './types'

/** Returns the eventime plan owned by the selected position story. */
export function createStoryAnimationPlan(
  index: ViewIndex,
  state: Readonly<Record<string, unknown>> = {},
): readonly StoryAnimationOccurrence[] {
  switch (index) {
    case 0: return POSITION_STORY_ONE_ANIMATION_PLAN
    case 1: return POSITION_STORY_TWO_ANIMATION_PLAN
    case 2: return POSITION_STORY_THREE_ANIMATION_PLAN
    case 3: return createStoryFourAnimationPlan(state)
    case 4: return createStoryFiveAnimationPlan()
    case 5: return createStorySixAnimationPlan()
  }
}

/** Anchors the selected story's eventimes to the navigation interaction. */
export function planStoryAnimation(
  index: ViewIndex,
  planned: Pick<PlannedStrapHelpers, 'wait'>,
  state: Readonly<Record<string, unknown>>,
): readonly PlannedStrapOccurrence[] {
  return createStoryAnimationPlan(index, state).flatMap((occurrence) => planned.wait(occurrence.offsetMs, {
    event: {
      name: occurrence.name,
      cascade: true,
      ...(occurrence.data === undefined ? {} : { data: occurrence.data }),
    },
  }))
}
