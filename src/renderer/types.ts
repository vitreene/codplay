import type { AnimationAdapter, AnimationResolvedAction } from '../animation/types'
import type { RuntimeComponentClass, RuntimeRegistryCommandResult, RuntimeRegistrySnapshot } from '../runtime/components'
import type { CreateElementOptions } from '../runtime/create-element'
import type { RuntimeEmitEvent, StoryDoc } from '../runtime/types'

/**
 * Defines renderer constructor options.
 */
export type CreateRendererOptions = {
  createElementOptions?: CreateElementOptions
  animationAdapter?: AnimationAdapter
  emitRuntimeEvent?: (event: RuntimeEmitEvent) => void
}

/**
 * Defines renderer runtime status values.
 */
export type RendererStatus = 'idle' | 'ready' | 'running' | 'paused'

/**
 * Defines one renderer command error payload.
 */
export type RendererCommandError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Defines one renderer command result payload.
 */
export type RendererCommandResult =
  | { ok: true }
  | {
      ok: false
      error: RendererCommandError
    }

/**
 * Defines one runtime commit target payload emitted by Director.
 */
export type RuntimeCommitTarget = {
  storyInstanceId: string
  itemId: string
  targetId?: string
}

/**
 * Defines one runtime commit payload consumed by renderer.
 */
export type RuntimeCommit = {
  commitSeq: number
  applyAtMs: number
  target: RuntimeCommitTarget
  operations: AnimationResolvedAction[]
  causeEventId?: string
}

/**
 * Defines one renderer tick result snapshot.
 */
export type RendererTickResult = {
  appliedCommitCount: number
  appliedActionCount: number
  animationAppliedCount: number
  conflictCount: number
}

/**
 * Defines one renderer state snapshot for observers.
 */
export type RendererStateSnapshot = {
  status: RendererStatus
  initialized: boolean
  runtimeElementCount: number
  pendingCommitCount: number
  lastAppliedCommitSeq: number
  runtimeRevision: number
}

/**
 * Defines one renderer warning/error record routed to listeners.
 */
export type RendererError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Defines one renderer error listener callback.
 */
export type RendererErrorListener = (error: RendererError) => void

/**
 * Defines renderer load command payload.
 */
export type RendererLoadInput = {
  story: StoryDoc
}

/**
 * Defines renderer facade API used by Player.
 */
export type RendererApi = {
  registerComponent: (persoType: string, componentClass: RuntimeComponentClass) => RuntimeRegistryCommandResult
  overrideComponent: (persoType: string, componentClass: RuntimeComponentClass) => RuntimeRegistryCommandResult
  getRuntimeRegistry: () => RuntimeRegistrySnapshot
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
