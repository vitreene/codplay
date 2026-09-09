import type { PlannedStrapHelpers, PlannedStrapOccurrence, StrapStep } from 'codplay/runtime/player'
import {
  POSITION_STORY_FIVE_ID,
  POSITION_STORY_FOUR_ID,
  POSITION_STORY_ONE_ID,
  POSITION_STORY_SIX_ID,
  POSITION_STORY_THREE_ID,
  POSITION_STORY_TWO_ID,
  type PositionStoryId,
} from './constants'
import { planStoryFiveAnimation } from './story-five'
import { POSITION_STORY_ONE_ANIMATION_PLAN } from './story-one'
import { createStorySixAnimationPlan } from './story-six'
import { POSITION_STORY_THREE_ANIMATION_PLAN } from './story-three'
import { POSITION_STORY_TWO_ANIMATION_PLAN } from './story-two'
import type { StoryAnimationOccurrence } from './types'

type StaticStoryId = Exclude<PositionStoryId, typeof POSITION_STORY_FOUR_ID | typeof POSITION_STORY_FIVE_ID>

/** Returns the eventime plan owned by the selected position story. */
export function createStoryAnimationPlan(
  storyId: StaticStoryId,
): readonly StoryAnimationOccurrence[] {
  switch (storyId) {
    case POSITION_STORY_ONE_ID: return POSITION_STORY_ONE_ANIMATION_PLAN
    case POSITION_STORY_TWO_ID: return POSITION_STORY_TWO_ANIMATION_PLAN
    case POSITION_STORY_THREE_ID: return POSITION_STORY_THREE_ANIMATION_PLAN
    case POSITION_STORY_SIX_ID: return createStorySixAnimationPlan()
  }
}

/** Anchors the selected story's eventimes to the navigation interaction. */
export function planStoryAnimation(
  storyId: PositionStoryId,
  planned: Pick<PlannedStrapHelpers, 'wait' | 'repeat'>,
  _state: Readonly<Record<string, unknown>>,
): readonly PlannedStrapOccurrence[] {
  // Story 4 starts through its story-scoped initialize event. Returning no
  // scene-level occurrences keeps its future target state in that story.
  if (storyId === POSITION_STORY_FOUR_ID) return []
  const occurrences = storyId === POSITION_STORY_FIVE_ID
    ? planStoryFiveAnimation(planned)
    : createStoryAnimationPlan(storyId as StaticStoryId).flatMap((occurrence) => planned.wait(occurrence.offsetMs, {
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
function targetStoryStep(step: StrapStep, storyId: PositionStoryId): StrapStep {
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
