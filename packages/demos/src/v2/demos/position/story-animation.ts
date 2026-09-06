import type { PlannedStrapHelpers, PlannedStrapOccurrence } from 'codplay/runtime/player'
import { planStoryFiveAnimation } from './story-five'
import { planStoryFourAnimation } from './story-four'
import { POSITION_STORY_ONE_ANIMATION_PLAN } from './story-one'
import { createStorySixAnimationPlan } from './story-six'
import { POSITION_STORY_THREE_ANIMATION_PLAN } from './story-three'
import { POSITION_STORY_TWO_ANIMATION_PLAN } from './story-two'
import type { StoryAnimationOccurrence, ViewIndex } from './types'

/** Returns the eventime plan owned by the selected position story. */
export function createStoryAnimationPlan(
  index: Exclude<ViewIndex, 3 | 4>,
): readonly StoryAnimationOccurrence[] {
  switch (index) {
    case 0: return POSITION_STORY_ONE_ANIMATION_PLAN
    case 1: return POSITION_STORY_TWO_ANIMATION_PLAN
    case 2: return POSITION_STORY_THREE_ANIMATION_PLAN
    case 5: return createStorySixAnimationPlan()
  }
}

/** Anchors the selected story's eventimes to the navigation interaction. */
export function planStoryAnimation(
  index: ViewIndex,
  planned: Pick<PlannedStrapHelpers, 'wait' | 'repeat'>,
  state: Readonly<Record<string, unknown>>,
): readonly PlannedStrapOccurrence[] {
  if (index === 3) return planStoryFourAnimation(state, planned)
  if (index === 4) return planStoryFiveAnimation(planned)
  return createStoryAnimationPlan(index).flatMap((occurrence) => planned.wait(occurrence.offsetMs, {
    event: {
      name: occurrence.name,
      visibility: 'scene',
      ...(occurrence.data === undefined ? {} : { data: occurrence.data }),
    },
  }))
}
