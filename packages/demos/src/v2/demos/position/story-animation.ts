import type { PlannedStrapHelpers, PlannedStrapOccurrence, StrapStep } from 'codplay/runtime/player'
import type { PositionStoryId } from './constants'
import type { StoryAnimationOccurrence } from './types'

/** Converts one story-owned animation plan into planned story-scoped eventimes. */
export function planStoryAnimationOccurrences(
  plan: readonly StoryAnimationOccurrence[],
  storyId: PositionStoryId,
  planned: Pick<PlannedStrapHelpers, 'wait'>,
): readonly PlannedStrapOccurrence[] {
  const occurrences = plan.flatMap((occurrence) => planned.wait(occurrence.offsetMs, {
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

/** Adds an explicit story target to every runtime plan emitted by a story strap. */
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
