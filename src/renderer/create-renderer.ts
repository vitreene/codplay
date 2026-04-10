import type { AnimationAdapter, AnimationResolvedAction } from '../animation/types'
import { applyResolvedActions } from '../runtime/apply-actions'
import { mountSceneElements } from '../runtime/mount-elements'
import type { RuntimeElementMap, StoryDoc } from '../runtime/types'
import type {
  CreateRendererOptions,
  RendererApi,
  RendererCommandResult,
  RendererError,
  RendererErrorListener,
  RendererLoadInput,
  RendererStateSnapshot,
  RendererStatus,
  RendererTickResult,
  RuntimeCommit
} from './types'

const NOOP_ANIMATION_ADAPTER: AnimationAdapter = {
  run: () => [],
  stop: () => {
    return
  }
}

const EMPTY_TICK_RESULT: RendererTickResult = {
  appliedCommitCount: 0,
  appliedActionCount: 0,
  animationAppliedCount: 0,
  conflictCount: 0
}

/**
 * Implements a renderer facade that applies ordered commits to runtime elements.
 */
export class RendererFacade implements RendererApi {
  private readonly options: CreateRendererOptions
  private readonly animationAdapter: AnimationAdapter

  private status: RendererStatus = 'idle'
  private activeStory: StoryDoc | null = null
  private runtimeElements: RuntimeElementMap = new Map()
  private pendingCommits: RuntimeCommit[] = []
  private lastAppliedCommitSeq = 0
  private runtimeRevision = 0

  private readonly errorListeners = new Set<RendererErrorListener>()

  /**
   * Configures one renderer facade from explicit options.
   */
  constructor(options: CreateRendererOptions = {}) {
    this.options = options
    this.animationAdapter = options.animationAdapter ?? NOOP_ANIMATION_ADAPTER
  }

  /**
   * Returns true when one story is currently loaded in renderer.
   */
  private isInitialized(): boolean {
    return this.activeStory !== null
  }

  /**
   * Sorts pending commits according to monotonic commit sequence.
   */
  private sortPendingCommits(): void {
    this.pendingCommits.sort((left, right) => left.commitSeq - right.commitSeq)
  }

  /**
   * Splits pending commits into ready and waiting groups.
   */
  private takeReadyCommits(nowMs: number): RuntimeCommit[] {
    const readyCommits: RuntimeCommit[] = []
    const waitingCommits: RuntimeCommit[] = []

    for (const commit of this.pendingCommits) {
      if (commit.applyAtMs <= nowMs) {
        readyCommits.push(commit)
        continue
      }

      waitingCommits.push(commit)
    }

    this.pendingCommits = waitingCommits
    return readyCommits
  }

  /**
   * Flattens commit operations into one action batch preserving commit order.
   */
  private collectResolvedActions(commits: RuntimeCommit[]): AnimationResolvedAction[] {
    const actions: AnimationResolvedAction[] = []

    for (const commit of commits) {
      actions.push(...commit.operations)
      if (commit.commitSeq > this.lastAppliedCommitSeq) {
        this.lastAppliedCommitSeq = commit.commitSeq
      }
    }

    return actions
  }

  /**
   * Loads one story into renderer and mounts runtime elements.
   */
  load(input: RendererLoadInput): RendererCommandResult {
    this.activeStory = input.story
    this.runtimeElements = mountSceneElements(input.story, this.options.createElementOptions)
    this.pendingCommits = []
    this.lastAppliedCommitSeq = 0
    this.status = 'ready'
    this.runtimeRevision += 1
    return { ok: true }
  }

  /**
   * Starts rendering execution from ready state.
   */
  start(): RendererCommandResult {
    if (!this.isInitialized()) {
      return this.reject('RENDERER_NOT_INITIALIZED', 'load must be called before start')
    }

    if (this.status !== 'ready') {
      return this.reject('RENDERER_INVALID_STATE', 'start is only allowed from ready', {
        currentState: this.status
      })
    }

    this.status = 'running'
    return { ok: true }
  }

  /**
   * Pauses rendering execution from running state.
   */
  pause(): RendererCommandResult {
    if (!this.isInitialized()) {
      return this.reject('RENDERER_NOT_INITIALIZED', 'load must be called before pause')
    }

    if (this.status !== 'running') {
      return this.reject('RENDERER_INVALID_STATE', 'pause is only allowed from running', {
        currentState: this.status
      })
    }

    this.status = 'paused'
    return { ok: true }
  }

  /**
   * Resumes rendering execution from paused state.
   */
  resume(): RendererCommandResult {
    if (!this.isInitialized()) {
      return this.reject('RENDERER_NOT_INITIALIZED', 'load must be called before resume')
    }

    if (this.status !== 'paused') {
      return this.reject('RENDERER_INVALID_STATE', 'resume is only allowed from paused', {
        currentState: this.status
      })
    }

    this.status = 'running'
    return { ok: true }
  }

  /**
   * Stops renderer and clears pending commits while keeping mounted story.
   */
  stop(): RendererCommandResult {
    if (!this.isInitialized()) {
      return { ok: true }
    }

    this.pendingCommits = []
    if (this.status !== 'idle') {
      this.status = 'ready'
    }
    return { ok: true }
  }

  /**
   * Destroys renderer runtime and returns to idle state.
   */
  destroy(): RendererCommandResult {
    this.pendingCommits = []
    this.runtimeElements = new Map()
    this.activeStory = null
    this.status = 'idle'
    this.animationAdapter.stop()
    this.runtimeRevision += 1
    return { ok: true }
  }

  /**
   * Enqueues one runtime commit for frame-based application.
   */
  enqueueCommit(commit: RuntimeCommit): RendererCommandResult {
    if (!this.isInitialized()) {
      return this.reject('RENDERER_NOT_INITIALIZED', 'load must be called before enqueueCommit', {
        commitSeq: commit.commitSeq
      })
    }

    this.pendingCommits.push(commit)
    this.sortPendingCommits()
    return { ok: true }
  }

  /**
   * Applies all ready commits for one renderer tick.
   */
  tick(nowMs: number): RendererTickResult {
    if (!this.isInitialized()) {
      return EMPTY_TICK_RESULT
    }

    const readyCommits = this.takeReadyCommits(nowMs)
    if (readyCommits.length === 0) {
      return EMPTY_TICK_RESULT
    }

    const resolvedActions = this.collectResolvedActions(readyCommits)
    if (resolvedActions.length === 0) {
      return {
        appliedCommitCount: readyCommits.length,
        appliedActionCount: 0,
        animationAppliedCount: 0,
        conflictCount: 0
      }
    }

    try {
      const applyResult = applyResolvedActions(resolvedActions, this.runtimeElements, this.animationAdapter)
      return {
        appliedCommitCount: readyCommits.length,
        appliedActionCount: applyResult.appliedActionsCount,
        animationAppliedCount: applyResult.animation.appliedCount,
        conflictCount: applyResult.conflictTrace.length
      }
    } catch (error) {
      this.emitError({
        code: 'RENDERER_COMMIT_APPLY_FAILED',
        message: 'Renderer failed to apply one commit batch',
        details: {
          nowMs,
          appliedCommitCount: readyCommits.length,
          error: error instanceof Error ? error.message : 'unknown_error'
        }
      })

      return {
        appliedCommitCount: readyCommits.length,
        appliedActionCount: 0,
        animationAppliedCount: 0,
        conflictCount: 0
      }
    }
  }

  /**
   * Returns one immutable snapshot of renderer state.
   */
  getState(): RendererStateSnapshot {
    return {
      status: this.status,
      initialized: this.isInitialized(),
      activeStoryId: this.activeStory?.id,
      runtimeElementCount: this.runtimeElements.size,
      pendingCommitCount: this.pendingCommits.length,
      lastAppliedCommitSeq: this.lastAppliedCommitSeq,
      runtimeRevision: this.runtimeRevision
    }
  }

  /**
   * Emits one renderer error to all subscribers.
   */
  private emitError(error: RendererError): void {
    for (const listener of this.errorListeners) {
      listener(error)
    }
  }

  /**
   * Builds one rejected command result and publishes the error.
   */
  private reject(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): RendererCommandResult {
    this.emitError({ code, message, details })
    return {
      ok: false,
      error: {
        code,
        message,
        details
      }
    }
  }

  /**
   * Subscribes to renderer errors.
   */
  onError(listener: RendererErrorListener): () => void {
    this.errorListeners.add(listener)
    return () => {
      this.errorListeners.delete(listener)
    }
  }
}
