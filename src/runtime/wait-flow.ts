export type StoryRef = {
  storyId: string
  instanceId?: string
}

export type WaitMode = 'parallel' | 'suspendSource'

export type ResumePolicy = 'fromCursor' | 'fromStart'

export type WaitHandle = {
  waitId: string
  mode: WaitMode
  fromStory?: StoryRef
  waitStory: StoryRef
  frozenCursorMs?: number
  disabledTrackIds: string[]
  hideFromStory: boolean
}

export type StartWaitOptions = {
  waitStory: StoryRef
  fromStory?: StoryRef
  mode?: WaitMode
  reason?: string
  disableTracks?: 'auto' | string[]
  hideFromStory?: boolean
  showWaitStory?: boolean
  fromStoryCursorMs?: number
  fromStoryTrackIds?: string[]
}

export type ResolveWaitOptions = {
  waitId: string
  resumePolicy?: ResumePolicy
  restoreTracks?: boolean
  hideWaitStory?: boolean
  stopWaitStory?: boolean
}

export type WaitRuntimeOperation =
  | { type: 'story:start'; storyRef: StoryRef }
  | { type: 'story:stop'; storyRef: StoryRef }
  | { type: 'story:show'; storyRef: StoryRef }
  | { type: 'story:hide'; storyRef: StoryRef }
  | { type: 'story:pause'; storyRef: StoryRef }
  | { type: 'story:resume'; storyRef: StoryRef; atMs?: number }
  | { type: 'track:disable'; trackId: string }
  | { type: 'track:enable'; trackId: string }

export type WaitTraceEventName =
  | 'scenario:wait:start'
  | 'scenario:wait:started'
  | 'scenario:wait:resolve'
  | 'scenario:wait:resolved'

export type WaitTraceEntry = {
  traceId: string
  eventName: WaitTraceEventName
  waitId: string
  mode: WaitMode
  payload?: Record<string, unknown>
}

export type RuntimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

export type StartWaitResult = {
  wait: WaitHandle
  operations: WaitRuntimeOperation[]
  trace: WaitTraceEntry[]
}

export type ResolveWaitResult = {
  waitId: string
  operations: WaitRuntimeOperation[]
  trace: WaitTraceEntry[]
  resumedAtMs?: number
}

export type WaitFlowRuntime = {
  startWait: (options: StartWaitOptions) => RuntimeResult<StartWaitResult>
  resolveWait: (options: ResolveWaitOptions) => RuntimeResult<ResolveWaitResult>
  getWait: (waitId: string) => WaitHandle | null
  listWaits: () => WaitHandle[]
}

export type WaitFlowRuntimeOptions = {
  waitIdFactory?: () => string
}

/**
 * Builds a stable key used to compare story references.
 */
function toStoryRefKey(storyRef: StoryRef): string {
  return `${storyRef.storyId}#${storyRef.instanceId ?? 'default'}`
}

/**
 * Builds one typed runtime error result.
 */
function toError<T>(code: string, message: string, details?: unknown): RuntimeResult<T> {
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
 * Creates a deterministic trace entry for one wait-flow transition.
 */
function createWaitTraceEntry(
  waitId: string,
  mode: WaitMode,
  eventName: WaitTraceEventName,
  payload?: Record<string, unknown>
): WaitTraceEntry {
  return {
    traceId: `wait-trace-${waitId}-${eventName}`,
    eventName,
    waitId,
    mode,
    payload
  }
}

/**
 * Resolves the normalized wait mode with V1 defaults.
 */
function resolveWaitMode(mode?: WaitMode): WaitMode {
  return mode ?? 'parallel'
}

/**
 * Resolves which track IDs must be disabled when a wait starts.
 */
function resolveDisabledTrackIds(options: StartWaitOptions, mode: WaitMode): string[] {
  const disableTracks = options.disableTracks ?? 'auto'

  if (Array.isArray(disableTracks)) {
    return [...disableTracks]
  }

  if (mode !== 'suspendSource') {
    return []
  }

  return [...(options.fromStoryTrackIds ?? [])]
}

/**
 * Creates a runtime wait-flow service with in-memory wait handles.
 */
export function createWaitFlowRuntime(options: WaitFlowRuntimeOptions = {}): WaitFlowRuntime {
  const activeWaits = new Map<string, WaitHandle>()
  const waitIdFactory = options.waitIdFactory
  let nextWaitIndex = 1

  /**
   * Generates one unique wait identifier.
   */
  function createWaitId(): string {
    if (waitIdFactory) {
      return waitIdFactory()
    }

    const waitId = `wait-${nextWaitIndex}`
    nextWaitIndex += 1
    return waitId
  }

  /**
   * Starts one wait flow and returns the required runtime operations.
   */
  function startWait(startOptions: StartWaitOptions): RuntimeResult<StartWaitResult> {
    const mode = resolveWaitMode(startOptions.mode)

    if (mode === 'suspendSource' && startOptions.fromStory === undefined) {
      return toError(
        'WAIT_SOURCE_REQUIRED_FOR_SUSPEND',
        'fromStory is required when mode is suspendSource'
      )
    }

    const waitStoryKey = toStoryRefKey(startOptions.waitStory)
    for (const wait of activeWaits.values()) {
      if (toStoryRefKey(wait.waitStory) === waitStoryKey) {
        return toError('WAIT_STORY_ALREADY_ACTIVE', 'waitStory already has an active wait', {
          waitStory: startOptions.waitStory
        })
      }
    }

    const waitId = createWaitId()
    const hideFromStory = startOptions.hideFromStory ?? false
    const showWaitStory = startOptions.showWaitStory ?? true
    const disabledTrackIds = resolveDisabledTrackIds(startOptions, mode)

    const waitHandle: WaitHandle = {
      waitId,
      mode,
      fromStory: startOptions.fromStory,
      waitStory: startOptions.waitStory,
      frozenCursorMs: mode === 'suspendSource' ? startOptions.fromStoryCursorMs : undefined,
      disabledTrackIds,
      hideFromStory
    }

    const operations: WaitRuntimeOperation[] = []

    if (mode === 'suspendSource' && startOptions.fromStory) {
      operations.push({ type: 'story:pause', storyRef: startOptions.fromStory })
    }

    if (hideFromStory && startOptions.fromStory) {
      operations.push({ type: 'story:hide', storyRef: startOptions.fromStory })
    }

    for (const trackId of disabledTrackIds) {
      operations.push({ type: 'track:disable', trackId })
    }

    if (showWaitStory) {
      operations.push({ type: 'story:show', storyRef: startOptions.waitStory })
    }

    operations.push({ type: 'story:start', storyRef: startOptions.waitStory })

    const trace: WaitTraceEntry[] = [
      createWaitTraceEntry(waitId, mode, 'scenario:wait:start', {
        reason: startOptions.reason,
        waitStory: startOptions.waitStory,
        fromStory: startOptions.fromStory
      }),
      createWaitTraceEntry(waitId, mode, 'scenario:wait:started', {
        disabledTrackIds,
        frozenCursorMs: waitHandle.frozenCursorMs
      })
    ]

    activeWaits.set(waitId, waitHandle)

    return {
      ok: true,
      data: {
        wait: {
          ...waitHandle,
          disabledTrackIds: [...waitHandle.disabledTrackIds]
        },
        operations,
        trace
      }
    }
  }

  /**
   * Resolves one active wait and returns the operations needed to resume flow.
   */
  function resolveWait(resolveOptions: ResolveWaitOptions): RuntimeResult<ResolveWaitResult> {
    const activeWait = activeWaits.get(resolveOptions.waitId)
    if (activeWait === undefined) {
      return toError('WAIT_NOT_FOUND', 'waitId does not match an active wait', {
        waitId: resolveOptions.waitId
      })
    }

    const resumePolicy = resolveOptions.resumePolicy ?? 'fromCursor'
    const restoreTracks = resolveOptions.restoreTracks ?? true
    const hideWaitStory = resolveOptions.hideWaitStory ?? true
    const stopWaitStory = resolveOptions.stopWaitStory ?? true

    const operations: WaitRuntimeOperation[] = []

    if (hideWaitStory) {
      operations.push({ type: 'story:hide', storyRef: activeWait.waitStory })
    }

    if (stopWaitStory) {
      operations.push({ type: 'story:stop', storyRef: activeWait.waitStory })
    }

    if (restoreTracks) {
      for (const trackId of activeWait.disabledTrackIds) {
        operations.push({ type: 'track:enable', trackId })
      }
    }

    if (activeWait.hideFromStory && activeWait.fromStory) {
      operations.push({ type: 'story:show', storyRef: activeWait.fromStory })
    }

    let resumedAtMs: number | undefined
    if (activeWait.mode === 'suspendSource' && activeWait.fromStory) {
      resumedAtMs = resumePolicy === 'fromStart' ? 0 : activeWait.frozenCursorMs

      operations.push({
        type: 'story:resume',
        storyRef: activeWait.fromStory,
        atMs: resumedAtMs
      })
    }

    const trace: WaitTraceEntry[] = [
      createWaitTraceEntry(activeWait.waitId, activeWait.mode, 'scenario:wait:resolve', {
        resumePolicy,
        restoreTracks
      }),
      createWaitTraceEntry(activeWait.waitId, activeWait.mode, 'scenario:wait:resolved', {
        resumedAtMs,
        restoredTracks: restoreTracks ? [...activeWait.disabledTrackIds] : []
      })
    ]

    activeWaits.delete(activeWait.waitId)

    return {
      ok: true,
      data: {
        waitId: activeWait.waitId,
        operations,
        trace,
        resumedAtMs
      }
    }
  }

  /**
   * Reads one active wait handle by identifier.
   */
  function getWait(waitId: string): WaitHandle | null {
    const activeWait = activeWaits.get(waitId)
    if (activeWait === undefined) {
      return null
    }

    return {
      ...activeWait,
      disabledTrackIds: [...activeWait.disabledTrackIds]
    }
  }

  /**
   * Lists all currently active wait handles.
   */
  function listWaits(): WaitHandle[] {
    return [...activeWaits.values()].map((activeWait) => ({
      ...activeWait,
      disabledTrackIds: [...activeWait.disabledTrackIds]
    }))
  }

  return {
    startWait,
    resolveWait,
    getWait,
    listWaits
  }
}
