import type { AnimationAdapter, AnimationResolvedAction, ContinuousAnimationEngine } from '../animation/types'
import type { ComponentRegistryApi, ModuleRegistryApi, RuntimeRegistrySnapshot, ServiceRegistryApi } from '../runtime/components'
import type { CreateElementOptions } from '../runtime/create-element'
import type { MoveCommand, RuntimeEmitEvent, RuntimePersos } from '../runtime/types'
export type { ComponentRegistryApi, ModuleRegistryApi, ServiceRegistryApi }

/**
 * Defines renderer constructor options.
 */
export type CreateRendererOptions = {
  createElementOptions?: CreateElementOptions
  animationAdapter?: AnimationAdapter
  continuousAnimationEngines?: ContinuousAnimationEngine[]
  emitRuntimeEvent?: (event: RuntimeEmitEvent) => void
  getCurrentTimelineMs?: () => number
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
  runtimePersos: RuntimePersos
  /**
   * Restricts the load to story entries plus persos listed here. Omit for a
   * full load (initial mount). Used at seek once mounted state at the seek
   * target has been resolved — see
   * 2026-06-28-unify-action-execution-and-move-off-plan.md Phase 3.
   */
  mountedPersoIds?: ReadonlySet<string>
  /**
   * The move resolved per perso at the seek target (same dry-run scan that
   * produced `mountedPersoIds`). When present, the orchestrator applies it
   * directly instead of falling back to the perso's static `initial.move` —
   * the completion of Phase 3 (resolution alone used to only filter which
   * persos to refresh, never to attach/detach a perso whose position is
   * entirely track-driven). See
   * 2026-06-29-entries-removal-and-dynamic-move-seek-plan.md, défaut 2.
   */
  effectiveMoveByPersoId?: ReadonlyMap<string, MoveCommand | null>
}

/**
 * Defines renderer facade API used by Player.
 */
export type RendererApi = {
  component: ComponentRegistryApi
  service: ServiceRegistryApi
  module: ModuleRegistryApi
  getRuntimeRegistry: () => RuntimeRegistrySnapshot
  resolveMountedStateAtSeek: (input: {
    rootPersoIds: ReadonlySet<string>
    effectiveMoveByPersoId: ReadonlyMap<string, MoveCommand | null>
  }) => Map<string, boolean>
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
