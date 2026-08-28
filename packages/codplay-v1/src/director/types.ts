import type { AnimationAction, AnimationResolvedAction } from '../animation/types'
import type { EventListener, TimelineEvent } from '../core/events/types'
import type { RuntimeCommit } from '../renderer/types'

export type DirectorStatus = 'idle' | 'ready' | 'running' | 'paused'

export type RuntimeTimelinePlan = {
  listeners: EventListener<AnimationAction>[]
  sortedEvents: TimelineEvent[]
}

export type DirectorRuntimePlan = RuntimeTimelinePlan

export type DirectorEventResult = {
  commits: RuntimeCommit[]
  resolvedActions: AnimationResolvedAction[]
}

export type DirectorStateSnapshot = {
  status: DirectorStatus
  initialized: boolean
  nextCommitSeq: number
}

export type DirectorApi = {
  load: (plan: DirectorRuntimePlan) => void
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  destroy: () => void
  getSortedEvents: () => TimelineEvent[]
  runTimelineEvent: (event: TimelineEvent, options?: { dryRun?: boolean }) => DirectorEventResult
  getState: () => DirectorStateSnapshot
  reserveCommitSeq: () => number
}
