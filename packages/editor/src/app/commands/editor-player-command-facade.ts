import type {
  CodPlayInstance,
  CodPlayProgress,
  CodPlaySnapshot,
  CodPlaySnapshotPatch,
  CodPlaySnapshotSetResult,
  CodPlayTelcoState,
} from 'codplay'

/** Command vocabulary exposed to the editor coordination layer. */
export type EditorPlayerCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'rewind' }
  | { type: 'seek'; timelineMs: number }
  | { type: 'setRate'; rate: number }

/** Transport state exposed to editor modules in the author time reference. */
export type EditorPlayerTransportState = Readonly<{
  status: CodPlayTelcoState['status']
  timelineMs: number
  durationMs: number
  rate: number
  initialized: boolean
  sequenceEnded: boolean
  runtimeRevision: number
  playerTimeMs: number
}>

/** Progress exposed to editor modules in the author time reference. */
export type EditorPlayerProgress = Readonly<{
  timelineMs: number
  durationMs: number
  playerTimeMs: number
}>

/** Result returned after one transport command has been executed and checked. */
export type EditorPlayerCommandResult = Readonly<
  | { ok: true; state: EditorPlayerTransportState; progress: EditorPlayerProgress }
  | {
      ok: false
      code: 'PLAYER_NOT_BOUND' | 'SEEK_NOT_APPLIED' | 'COMMAND_NOT_APPLIED'
      command?: EditorPlayerCommand['type']
      state?: EditorPlayerTransportState
      progress?: EditorPlayerProgress
    }
>

/** Listener for one editor-facing transport state. */
export type EditorPlayerTransportListener = (state: EditorPlayerTransportState) => void

/** Listener for one editor-facing playback progress update. */
export type EditorPlayerProgressListener = (progress: EditorPlayerProgress) => void

/** Imperative player port owned by the application and independent of coordination bridges. */
export class EditorPlayerCommandFacade {
  private instance: CodPlayInstance | null = null
  private preRollMs = 0
  private authorDurationMs = 0
  private unsubscribeTelcoChange: (() => void) | null = null
  private unsubscribeTelcoProgress: (() => void) | null = null
  private readonly transportListeners = new Set<EditorPlayerTransportListener>()
  private readonly progressListeners = new Set<EditorPlayerProgressListener>()

  /** Binds one V2 instance and replaces the previous transport observation. */
  bind(instance: CodPlayInstance, preRollMs: number, authorDurationMs: number): void {
    this.unbind()
    this.instance = instance
    this.preRollMs = Number.isFinite(preRollMs) && preRollMs >= 0 ? preRollMs : 0
    this.authorDurationMs = Number.isFinite(authorDurationMs) && authorDurationMs >= 0 ? authorDurationMs : 0
    this.unsubscribeTelcoChange = instance.telco.onChange((state) => {
      this.publishTransport(state)
    })
    this.unsubscribeTelcoProgress = instance.telco.onProgress((state) => {
      this.publishProgress(state)
    })
    this.publishTransport(instance.telco.getState())
    this.publishProgress(instance.telco.getProgress())
  }

  /** Removes the current binding without destroying the instance it references. */
  unbind(): void {
    this.unsubscribeTelcoChange?.()
    this.unsubscribeTelcoProgress?.()
    this.unsubscribeTelcoChange = null
    this.unsubscribeTelcoProgress = null
    this.instance = null
    this.preRollMs = 0
    this.authorDurationMs = 0
  }

  /** Executes one transport command through the bound V2 instance only. */
  async execute(command: EditorPlayerCommand): Promise<EditorPlayerCommandResult> {
    const instance = this.instance
    if (instance === null) return { ok: false, code: 'PLAYER_NOT_BOUND' }

    if (command.type === 'seek') {
      // The V2 runtime exposes an open discovered horizon: a fresh instance may report 0 ms
      // even though the authored EditorScene already has a longer fixed duration. Seek requests
      // therefore clamp against the author duration supplied at bind time, never that transient
      // runtime horizon (otherwise a rebuild silently loses the current author playhead).
      const expectedAuthorTime = clampAuthorTime(command.timelineMs, this.authorDurationMs)
      await instance.telco.seek(expectedAuthorTime + this.preRollMs)
      const progress = this.getProgressFromInstance(instance)
      const state = this.getStateFromInstance(instance)
      if (Math.abs(progress.timelineMs - expectedAuthorTime) > 1) {
        return { ok: false, code: 'SEEK_NOT_APPLIED', state, progress }
      }
      return { ok: true, state, progress }
    }

    if (command.type === 'play') await instance.telco.play()
    if (command.type === 'pause') await instance.telco.pause()
    if (command.type === 'rewind') await instance.telco.rewind()
    if (command.type === 'setRate') instance.telco.setRate(command.rate)
    const state = this.getStateFromInstance(instance)
    const progress = this.getProgressFromInstance(instance)
    if (!commandPostconditionHolds(command, state, progress)) {
      return { ok: false, code: 'COMMAND_NOT_APPLIED', command: command.type, state, progress }
    }
    return { ok: true, state, progress }
  }

  /** Returns the currently presented logical snapshot without exposing the instance. */
  getSnapshot(): CodPlaySnapshot | null {
    return this.instance?.snapshot.get() ?? null
  }

  /** Applies one atomic logical preview through the bound instance snapshot port. */
  setSnapshot(patches: readonly CodPlaySnapshotPatch[]): CodPlaySnapshotSetResult | null {
    return this.instance?.snapshot.set(patches) ?? null
  }

  /** Clears the current logical preview through the bound instance snapshot port. */
  clearSnapshot(): void {
    this.instance?.snapshot.clear()
  }

  /** Returns the current editor-facing transport state, if a player is bound. */
  getState(): EditorPlayerTransportState | null {
    return this.instance === null ? null : this.getStateFromInstance(this.instance)
  }

  /** Returns the current editor-facing progress, if a player is bound. */
  getProgress(): EditorPlayerProgress | null {
    return this.instance === null ? null : this.getProgressFromInstance(this.instance)
  }

  /** Subscribes to state changes and immediately provides the current state when available. */
  onTransportChange(listener: EditorPlayerTransportListener): () => void {
    this.transportListeners.add(listener)
    const state = this.getState()
    if (state !== null) listener(state)
    return () => { this.transportListeners.delete(listener) }
  }

  /** Subscribes to playback progress without writing to the editor playhead. */
  onPlaybackProgress(listener: EditorPlayerProgressListener): () => void {
    this.progressListeners.add(listener)
    const progress = this.getProgress()
    if (progress !== null) listener(progress)
    return () => { this.progressListeners.delete(listener) }
  }

  /** Releases subscriptions and listeners owned by the application facade. */
  destroy(): void {
    this.unbind()
    this.transportListeners.clear()
    this.progressListeners.clear()
  }

  /** Adapts one V2 telco state from player time to author time. */
  private getStateFromInstance(instance: CodPlayInstance): EditorPlayerTransportState {
    const state = instance.telco.getState()
    return {
      ...state,
      timelineMs: toAuthorTime(state.timelineMs, this.preRollMs),
      playerTimeMs: state.timelineMs,
    }
  }

  /** Adapts one V2 telco progress value from player time to author time. */
  private getProgressFromInstance(instance: CodPlayInstance): EditorPlayerProgress {
    const progress = instance.telco.getProgress()
    return {
      timelineMs: toAuthorTime(progress.timelineMs, this.preRollMs),
      durationMs: progress.durationMs,
      playerTimeMs: progress.timelineMs,
    }
  }

  /** Publishes a state update to all editor-facing listeners. */
  private publishTransport(state: CodPlayTelcoState): void {
    const adapted: EditorPlayerTransportState = {
      ...state,
      timelineMs: toAuthorTime(state.timelineMs, this.preRollMs),
      playerTimeMs: state.timelineMs,
    }
    for (const listener of this.transportListeners) listener(adapted)
  }

  /** Publishes a progress update to all editor-facing listeners. */
  private publishProgress(progress: CodPlayProgress): void {
    const adapted: EditorPlayerProgress = {
      timelineMs: toAuthorTime(progress.timelineMs, this.preRollMs),
      durationMs: progress.durationMs,
      playerTimeMs: progress.timelineMs,
    }
    for (const listener of this.progressListeners) listener(adapted)
  }
}

/** Converts a player time to the author time reference without crossing zero. */
function toAuthorTime(playerTimeMs: number, preRollMs: number): number {
  return Math.max(0, playerTimeMs - preRollMs)
}

/** Clamps an author seek target to the duration known by the player. */
function clampAuthorTime(timeMs: number, durationMs: number): number {
  const safeTime = Number.isFinite(timeMs) ? timeMs : 0
  return Math.max(0, Math.min(safeTime, durationMs))
}

/** Verifies the observable postcondition of a non-seek transport command. */
function commandPostconditionHolds(
  command: EditorPlayerCommand,
  state: EditorPlayerTransportState,
  progress: EditorPlayerProgress,
): boolean {
  if (command.type === 'play') return state.status === 'playing'
  if (command.type === 'pause') return state.status !== 'playing'
  if (command.type === 'rewind') return state.status !== 'playing' && Math.abs(progress.timelineMs) <= 1
  if (command.type === 'setRate') return Math.abs(state.rate - command.rate) <= 0.001
  return true
}
