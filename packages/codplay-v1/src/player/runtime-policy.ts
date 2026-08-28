export type RuntimeEventPolicySameTickHandling = {
  mode: 'keep-all' | 'coalesce-last' | 'defer-next-tick'
  key?: 'name' | 'name+data'
  eventNames?: string[]
}

export type RuntimeEventPolicyStrapErrorHandling = {
  mode: 'continue-with-warning' | 'stop-chain'
}

export type RuntimeEventPolicyMasterClock = {
  unique?: boolean
  previousMasterAction?: 'pause' | 'stop'
  fallbackToTicker?: boolean
}

export type RuntimeEventPolicy = {
  maxEventsPerTick?: number
  maxCascadeDepth?: number
  sameTickHandling?: RuntimeEventPolicySameTickHandling
  strapErrorHandling?: RuntimeEventPolicyStrapErrorHandling
  masterClock?: RuntimeEventPolicyMasterClock
  rejectUnknownPersoTarget?: boolean
  rejectInvalidPayload?: boolean
}

export type ResolvedRuntimeEventPolicy = {
  maxEventsPerTick: number
  maxCascadeDepth: number
  sameTickHandling: RuntimeEventPolicySameTickHandling
  strapErrorHandling: RuntimeEventPolicyStrapErrorHandling
  masterClock: RuntimeEventPolicyMasterClock
  rejectUnknownPersoTarget: boolean
  rejectInvalidPayload: boolean
}

export const DEFAULT_RUNTIME_EVENT_POLICY: ResolvedRuntimeEventPolicy = {
  maxEventsPerTick: 1000,
  maxCascadeDepth: 16,
  sameTickHandling: {
    mode: 'keep-all'
  },
  strapErrorHandling: {
    mode: 'continue-with-warning'
  },
  masterClock: {
    unique: true,
    previousMasterAction: 'pause',
    fallbackToTicker: true
  },
  rejectUnknownPersoTarget: false,
  rejectInvalidPayload: false
}

/**
 * Merges one partial runtime policy with the V1 defaults.
 */
export function createRuntimeEventPolicy(policy: RuntimeEventPolicy = {}): ResolvedRuntimeEventPolicy {
  const sameTickHandling: RuntimeEventPolicySameTickHandling = policy.sameTickHandling
    ? {
        mode: policy.sameTickHandling.mode,
        key: policy.sameTickHandling.key ?? DEFAULT_RUNTIME_EVENT_POLICY.sameTickHandling.key,
        eventNames: policy.sameTickHandling.eventNames ?? DEFAULT_RUNTIME_EVENT_POLICY.sameTickHandling.eventNames
      }
    : DEFAULT_RUNTIME_EVENT_POLICY.sameTickHandling

  const strapErrorHandling: RuntimeEventPolicyStrapErrorHandling = policy.strapErrorHandling
    ? {
        mode: policy.strapErrorHandling.mode
      }
    : DEFAULT_RUNTIME_EVENT_POLICY.strapErrorHandling

  const masterClock: RuntimeEventPolicyMasterClock = policy.masterClock
    ? {
        unique: policy.masterClock.unique ?? DEFAULT_RUNTIME_EVENT_POLICY.masterClock.unique,
        previousMasterAction:
          policy.masterClock.previousMasterAction ?? DEFAULT_RUNTIME_EVENT_POLICY.masterClock.previousMasterAction,
        fallbackToTicker: policy.masterClock.fallbackToTicker ?? DEFAULT_RUNTIME_EVENT_POLICY.masterClock.fallbackToTicker
      }
    : DEFAULT_RUNTIME_EVENT_POLICY.masterClock

  return {
    maxEventsPerTick: policy.maxEventsPerTick ?? DEFAULT_RUNTIME_EVENT_POLICY.maxEventsPerTick,
    maxCascadeDepth: policy.maxCascadeDepth ?? DEFAULT_RUNTIME_EVENT_POLICY.maxCascadeDepth,
    sameTickHandling,
    strapErrorHandling,
    masterClock,
    rejectUnknownPersoTarget: policy.rejectUnknownPersoTarget ?? DEFAULT_RUNTIME_EVENT_POLICY.rejectUnknownPersoTarget,
    rejectInvalidPayload: policy.rejectInvalidPayload ?? DEFAULT_RUNTIME_EVENT_POLICY.rejectInvalidPayload
  }
}
