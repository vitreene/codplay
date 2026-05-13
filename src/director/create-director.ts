import type { AnimationResolvedAction } from '../animation/types'
import { dispatchEvents } from '../core/events/dispatch'
import type { TimelineEvent } from '../core/events/types'
import type { RuntimeCommit } from '../renderer/types'
import type {
  DirectorApi,
  DirectorEventResult,
  DirectorRuntimePlan,
  DirectorStateSnapshot,
  DirectorStatus
} from './types'

/**
 * Implements one runtime director for event dispatch and commit production.
 */
export class DirectorCore implements DirectorApi {
  private static readonly STATUS = {
    idle: 'idle',
    ready: 'ready',
    running: 'running',
    paused: 'paused'
  } as const

  private status: DirectorStatus = DirectorCore.STATUS.idle
  private runtimePlan: DirectorRuntimePlan | null = null
  private nextCommitSeq = 1

  /**
   * Loads one runtime plan and prepares director state.
   */
  load(plan: DirectorRuntimePlan): void {
    this.runtimePlan = plan
    this.nextCommitSeq = 1
    this.status = DirectorCore.STATUS.ready
  }

  /**
   * Starts director execution from ready state.
   */
  start(): void {
    this.status = DirectorCore.STATUS.running
  }

  /**
   * Pauses director execution from running state.
   */
  pause(): void {
    this.status = DirectorCore.STATUS.paused
  }

  /**
   * Resumes director execution from paused state.
   */
  resume(): void {
    this.status = DirectorCore.STATUS.running
  }

  /**
   * Stops director execution while keeping loaded plan.
   */
  stop(): void {
    this.status = DirectorCore.STATUS.ready
  }

  /**
   * Destroys director runtime plan and returns to idle.
   */
  destroy(): void {
    this.runtimePlan = null
    this.nextCommitSeq = 1
    this.status = DirectorCore.STATUS.idle
  }

  /**
   * Returns sorted timeline events from the current runtime plan.
   */
  getSortedEvents(): TimelineEvent[] {
    if (this.runtimePlan === null) {
      return []
    }

    return this.runtimePlan.sortedEvents
  }

  /**
   * Resolves one timeline event into ordered runtime commits.
   */
  runTimelineEvent(event: TimelineEvent): DirectorEventResult {
    if (this.runtimePlan === null) {
      return {
        commits: [],
        resolvedActions: []
      }
    }

    const resolvedActions = dispatchEvents([event], {
      listeners: this.runtimePlan.listeners
    }) as AnimationResolvedAction[]

    if (resolvedActions.length === 0) {
      return {
        commits: [],
        resolvedActions
      }
    }

    const commits: RuntimeCommit[] = []

    for (const resolvedAction of resolvedActions) {
      commits.push(this.createCommit(event, resolvedAction))
    }

    return {
      commits,
      resolvedActions
    }
  }

  /**
   * Returns one immutable snapshot of director state.
   */
  getState(): DirectorStateSnapshot {
    return {
      status: this.status,
      initialized: this.isInitialized(),
      nextCommitSeq: this.nextCommitSeq
    }
  }

  /**
   * Returns true when one runtime plan is currently loaded.
   */
  private isInitialized(): boolean {
    return this.runtimePlan !== null
  }

  /**
   * Creates one runtime commit from one resolved action.
   */
  private createCommit(event: TimelineEvent, resolvedAction: AnimationResolvedAction): RuntimeCommit {
    const storyInstanceId = this.runtimePlan!.story.id

    const commit: RuntimeCommit = {
      commitSeq: this.nextCommitSeq,
      applyAtMs: event.ms,
      target: {
        storyInstanceId,
        itemId: resolvedAction.listenerId,
        targetId: resolvedAction.action.targetId
      },
      operations: [resolvedAction],
      causeEventId: event.id
    }

    this.nextCommitSeq += 1
    return commit
  }
}
