import { resolveHtmlRenderMutations } from './html-render-mutation-resolver'
import type {
  RenderMutationConflictReason as RuntimeConflictReason,
  RenderMutationResolutionResult,
  RenderMutationTraceEntry as RuntimeConflictTraceEntry,
  RuntimeResolvedMutation
} from './render-mutation-resolver'

export type ResolveSameTickConflictsResult = {
  resolvedActions: RuntimeResolvedMutation[]
  trace: RuntimeConflictTraceEntry[]
}

export type { RuntimeConflictReason, RuntimeConflictTraceEntry }

export function resolveSameTickConflicts(actions: RuntimeResolvedMutation[]): ResolveSameTickConflictsResult {
  const result: RenderMutationResolutionResult = resolveHtmlRenderMutations(actions)
  return {
    resolvedActions: result.resolvedMutations,
    trace: result.trace
  }
}
