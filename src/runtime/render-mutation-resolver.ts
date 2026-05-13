import type { AnimationResolvedAction } from '../animation/types'
import { RUNTIME_TRACE_STATUS } from './trace-constants'

export type RuntimeResolvedMutation = AnimationResolvedAction

export type RenderMutationConflictReason =
  | 'STYLE_OVERRIDDEN_SAME_TICK'
  | 'ATTR_OVERRIDDEN_SAME_TICK'
  | 'CLASSNAME_OVERRIDDEN_SAME_TICK'

export type RenderMutationTraceEntry = {
  traceId: string
  eventName: string
  status: typeof RUNTIME_TRACE_STATUS.applied | typeof RUNTIME_TRACE_STATUS.rejected
  reason: RenderMutationConflictReason
  targetItemId: string
  payload: {
    key: string
    winnerEventId: string
    loserEventId: string
  }
}

export type RenderMutationResolutionResult = {
  resolvedMutations: RuntimeResolvedMutation[]
  trace: RenderMutationTraceEntry[]
}

export type RenderMutationResolver = {
  resolve: (mutations: RuntimeResolvedMutation[]) => RenderMutationResolutionResult
}

export const passThroughRenderMutationResolver: RenderMutationResolver = {
  resolve: (mutations) => ({
    resolvedMutations: mutations,
    trace: []
  })
}
