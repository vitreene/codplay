import type { PlannedStrapHelpers, PlannedStrapOccurrence, StrapStep } from 'codplay/runtime/player'
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
  storyId: string,
  planned: Pick<PlannedStrapHelpers, 'wait' | 'repeat'>,
  state: Readonly<Record<string, unknown>>,
): readonly PlannedStrapOccurrence[] {
  const occurrences = index === 3
    ? planStoryFourAnimation(state, planned)
    : index === 4
      ? planStoryFiveAnimation(planned)
      : createStoryAnimationPlan(index).flatMap((occurrence) => planned.wait(occurrence.offsetMs, {
        event: {
          name: occurrence.name,
          visibility: 'scene',
          ...(occurrence.data === undefined ? {} : { data: occurrence.data }),
        },
      }))
  return occurrences.map((occurrence) => ({
    ...occurrence,
    step: targetStoryStep(occurrence.step, storyId),
  }))
}

/** Adds an explicit story target to every runtime plan emitted by navigation. */
function targetStoryStep(step: StrapStep, storyId: string): StrapStep {
  if (step.event === undefined) return step
  return {
    ...step,
    event: {
      ...step.event,
      storyId,
      visibility: 'story',
    },
  }
}
