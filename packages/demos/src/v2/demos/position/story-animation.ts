import type { PlannedStrapHelpers, PlannedStrapOccurrence } from 'codplay/runtime/player'
import { createStoryFiveAnimationPlan } from './story-five'
import { createStoryFourAnimationPlan } from './story-four'
import { createStoryOneAnimationPlan } from './story-one'
import { createStorySixAnimationPlan } from './story-six'
import { createStoryThreeAnimationPlan } from './story-three'
import { createStoryTwoAnimationPlan } from './story-two'
import type { StoryAnimationOccurrence, ViewIndex } from './types'

/** Returns the eventime plan owned by the selected story view. */
export function createStoryAnimationPlan(
  index: ViewIndex,
  state: Readonly<Record<string, unknown>> = {},
): readonly StoryAnimationOccurrence[] {
  switch (index) {
    case 0: return createStoryOneAnimationPlan()
    case 1: return createStoryTwoAnimationPlan()
    case 2: return createStoryThreeAnimationPlan()
    case 3: return createStoryFourAnimationPlan(state)
    case 4: return createStoryFiveAnimationPlan()
    case 5: return createStorySixAnimationPlan()
  }
}

/** Converts a view plan into eventimes anchored to the navigation interaction. */
export function planStoryAnimation(
  index: ViewIndex,
  planned: Pick<PlannedStrapHelpers, 'wait'>,
  state: Readonly<Record<string, unknown>>,
): readonly PlannedStrapOccurrence[] {
  return createStoryAnimationPlan(index, state).flatMap((occurrence) => planned.wait(occurrence.offsetMs, {
    event: {
      name: occurrence.name,
      ...(occurrence.data === undefined ? {} : { data: occurrence.data }),
    },
  }))
}
