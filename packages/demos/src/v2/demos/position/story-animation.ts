import type { PlannedStrapHelpers, PlannedStrapOccurrence, StrapStep } from 'codplay/runtime/player'
import {
  POSITION_STORY_ONE_ID,
  POSITION_STORY_TWO_ID,
  type PositionStoryId,
} from './constants'
import { POSITION_STORY_ONE_ANIMATION_PLAN } from './story-one'
import { POSITION_STORY_TWO_ANIMATION_PLAN } from './story-two'
import type { StoryAnimationOccurrence } from './types'

type StaticStoryId = typeof POSITION_STORY_ONE_ID | typeof POSITION_STORY_TWO_ID

/** Returns the eventime plan owned by the selected position story. */
export function createStoryAnimationPlan(
  storyId: StaticStoryId,
): readonly StoryAnimationOccurrence[] {
  switch (storyId) {
    case POSITION_STORY_ONE_ID: return POSITION_STORY_ONE_ANIMATION_PLAN
    case POSITION_STORY_TWO_ID: return POSITION_STORY_TWO_ANIMATION_PLAN
  }
}

/** Anchors the selected story's eventimes to the navigation interaction. */
export function planStoryAnimation(
  storyId: PositionStoryId,
  planned: Pick<PlannedStrapHelpers, 'wait'>,
): readonly PlannedStrapOccurrence[] {
  // Stories 3, 4, 5 and 6 start through their story-scoped initialize events.
  // Returning no scene-level occurrences keeps their future state in the
  // story-local circuit and prevents a second timeline from being appended.
  if (storyId !== POSITION_STORY_ONE_ID && storyId !== POSITION_STORY_TWO_ID) return []
  const occurrences = createStoryAnimationPlan(storyId).flatMap((occurrence) => planned.wait(occurrence.offsetMs, {
    event: {
      name: occurrence.name,
      visibility: 'scene',
      ...(occurrence.data === undefined ? {} : { data: occurrence.data }),
    },
    ...(occurrence.update === undefined ? {} : { update: occurrence.update }),
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
