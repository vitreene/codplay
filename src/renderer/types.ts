import type { AnimationAdapter, AnimationResolvedAction } from '../animation/types'
import type { CreateElementOptions } from '../runtime/create-element'
import type { StoryDoc } from '../runtime/types'

export type CreateRendererOptions = {
  createElementOptions?: CreateElementOptions
  animationAdapter?: AnimationAdapter
}

export type RendererStatus = 'idle' | 'ready' | 'running' | 'paused'

export type RendererCommandError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type RendererCommandResult =
  | { ok: true }
  | {
      ok: false
      error: RendererCommandError
    }

export type RuntimeCommitTarget = {
  storyInstanceId: string
  itemId: string
  targetId?: string
}

export type RuntimeCommit = {
  commitSeq: number
  applyAtMs: number
  target: RuntimeCommitTarget
  operations: AnimationResolvedAction[]
  causeEventId?: string
}

export type RendererTickResult = {
  appliedCommitCount: number
  appliedActionCount: number
  animationAppliedCount: number
  conflictCount: number
}

export type RendererStateSnapshot = {
  status: RendererStatus
  initialized: boolean
  activeStoryId?: string
  runtimeElementCount: number
  pendingCommitCount: number
  lastAppliedCommitSeq: number
  runtimeRevision: number
}

export type RendererError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type RendererErrorListener = (error: RendererError) => void

export type RendererLoadInput = {
  story: StoryDoc
}

export type RendererApi = {
  load: (input: RendererLoadInput) => RendererCommandResult
  start: () => RendererCommandResult
  pause: () => RendererCommandResult
  resume: () => RendererCommandResult
  stop: () => RendererCommandResult
  destroy: () => RendererCommandResult
  enqueueCommit: (commit: RuntimeCommit) => RendererCommandResult
  tick: (nowMs: number) => RendererTickResult
  getState: () => RendererStateSnapshot
  onError: (listener: RendererErrorListener) => () => void
}
