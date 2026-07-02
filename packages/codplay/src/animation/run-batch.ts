import { RUNTIME_TRACE_STATUS } from '../runtime/trace-constants'
import type { AnimationAdapter, AnimationBatchResult, AnimationOperation, AnimationTraceEntry } from './types'

/**
 * Resolves the stable handle id used by animation traces for any operation.
 */
function getAnimationOperationId(operation: AnimationOperation): string {
  return 'operationId' in operation ? operation.operationId : operation.transitionId
}

/**
 * Builds one trace entry that links an event to one animation transition.
 */
function toTraceEntry(operation: AnimationOperation, index: number): AnimationTraceEntry {
  const operationId = getAnimationOperationId(operation)
  return {
    traceId: `anim-trace-${index}-${operationId}`,
    eventId: operation.eventId,
    eventName: operation.eventName,
    transitionId: operationId,
    property: operation.property,
    status: RUNTIME_TRACE_STATUS.applied
  }
}

/**
 * Executes one animation batch and returns a minimal trace report.
 */
export function runAnimationBatch(
  operations: AnimationOperation[],
  animationAdapter: AnimationAdapter
): AnimationBatchResult {
  if (operations.length === 0) {
    return {
      appliedCount: 0,
      trace: []
    }
  }

  const startedHandles = animationAdapter.run(operations)
  const startedTransitionIds = new Set(startedHandles.map((handle) => handle.transitionId))
  const appliedTransitions = operations.filter((operation) => startedTransitionIds.has(getAnimationOperationId(operation)))

  return {
    appliedCount: startedHandles.length,
    trace: appliedTransitions.map((transition, index) => toTraceEntry(transition, index))
  }
}
