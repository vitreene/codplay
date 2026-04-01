import type { AnimationAdapter, AnimationBatchResult, AnimationTraceEntry, TransitionRequest } from './types'

/**
 * Builds one trace entry that links an event to one animation transition.
 */
function toTraceEntry(transition: TransitionRequest, index: number): AnimationTraceEntry {
  return {
    traceId: `anim-trace-${index}-${transition.transitionId}`,
    eventId: transition.eventId,
    eventName: transition.eventName,
    transitionId: transition.transitionId,
    property: transition.property,
    status: 'applied'
  }
}

/**
 * Executes one animation batch and returns a minimal trace report.
 */
export function runAnimationBatch(
  transitions: TransitionRequest[],
  animationAdapter: AnimationAdapter
): AnimationBatchResult {
  if (transitions.length === 0) {
    return {
      appliedCount: 0,
      trace: []
    }
  }

  const startedHandles = animationAdapter.run(transitions)
  const startedTransitionIds = new Set(startedHandles.map((handle) => handle.transitionId))
  const appliedTransitions = transitions.filter((transition) => startedTransitionIds.has(transition.transitionId))

  return {
    appliedCount: startedHandles.length,
    trace: appliedTransitions.map((transition, index) => toTraceEntry(transition, index))
  }
}
