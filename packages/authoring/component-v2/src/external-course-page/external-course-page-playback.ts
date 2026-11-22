import type { ExternalCoursePagePlaybackStatus } from './external-course-page-types'

/** Page-timeline position and lifecycle reported by the external reader. */
export type ExternalCoursePageProgress = Readonly<{
  timelineMs: number
  durationMs: number
  status?: ExternalCoursePagePlaybackStatus
}>

/** Structured result returned when the external reader rejects a seek. */
export type ExternalCoursePageCommandResult = void | Readonly<{
  ok: boolean
  error?: Readonly<{ message: string }>
}>

/** Transport view of the external page's native progress and seek controls. */
export type ExternalCoursePagePlaybackTransport = Readonly<{
  getState: () => ExternalCoursePageProgress
  getProgress: () => Readonly<{ timelineMs: number; durationMs: number }>
  readonly commandInFlight: boolean
  onProgress: (listener: (state: ExternalCoursePageProgress) => void) => () => void
  seek: (targetMs: number) => Promise<ExternalCoursePageCommandResult>
  rewind: () => Promise<ExternalCoursePageCommandResult>
}>

type ExternalCoursePageSeekHandler = (
  targetMs: number,
) => Promise<ExternalCoursePageCommandResult>

/** Holds the source timeline snapshot and forwards telco seek commands to its adapter. */
export class ExternalCoursePagePlaybackStore {
  private state: ExternalCoursePageProgress = { timelineMs: 0, durationMs: 0 }
  private readonly listeners = new Set<(state: ExternalCoursePageProgress) => void>()
  private seekHandler: ExternalCoursePageSeekHandler | undefined
  private pendingCommands = 0
  readonly transport: ExternalCoursePagePlaybackTransport

  /** Creates the stable transport object consumed by the shared V2 telco. */
  constructor() {
    const store = this
    this.transport = {
      getState: () => store.getState(),
      getProgress: () => store.getProgress(),
      get commandInFlight() {
        return store.pendingCommands > 0
      },
      onProgress: (listener) => store.onProgress(listener),
      seek: (targetMs) => store.seek(targetMs),
      rewind: () => store.seek(0),
    }
  }

  /** Returns the last validated reader snapshot. */
  getState(): ExternalCoursePageProgress {
    return this.state
  }

  /** Returns only the timeline values consumed by the remote seek range. */
  getProgress(): Readonly<{ timelineMs: number; durationMs: number }> {
    const { timelineMs, durationMs } = this.state
    return { timelineMs, durationMs }
  }

  /** Subscribes to source progress and command-state updates. */
  onProgress(listener: (state: ExternalCoursePageProgress) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Replaces the source snapshot after validating it at the message boundary. */
  setState(state: ExternalCoursePageProgress): void {
    if (state.timelineMs === this.state.timelineMs
      && state.durationMs === this.state.durationMs
      && state.status === this.state.status) return
    this.state = state
    this.notify()
  }

  /** Makes the active adapter's native seek operation available to the remote. */
  setSeekHandler(handler: ExternalCoursePageSeekHandler | undefined): void {
    this.seekHandler = handler
  }

  /** Clears source progress when its iframe session closes. */
  clear(): void {
    this.setState({ timelineMs: 0, durationMs: 0 })
  }

  /** Seeks the reader through its active adapter and exposes command progress. */
  async seek(targetMs: number): Promise<ExternalCoursePageCommandResult> {
    if (!Number.isFinite(targetMs) || targetMs < 0) {
      return { ok: false, error: { message: 'Le temps de seek doit être positif et fini.' } }
    }
    if (this.pendingCommands > 0) {
      return { ok: false, error: { message: 'Un seek du lecteur est déjà en cours.' } }
    }
    const seekHandler = this.seekHandler
    if (seekHandler === undefined) {
      return { ok: false, error: { message: 'Le lecteur externe n’est pas prêt pour le seek.' } }
    }
    this.pendingCommands += 1
    this.notify()
    try {
      return await seekHandler(targetMs)
    } finally {
      this.pendingCommands -= 1
      this.notify()
    }
  }

  /** Notifies the remote without creating a CodPlay event or journal entry. */
  private notify(): void {
    const state = this.state
    for (const listener of this.listeners) listener(state)
  }
}
