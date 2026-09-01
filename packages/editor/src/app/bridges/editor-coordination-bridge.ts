import type { Actor } from 'xstate'
import type {
  CodPlayInstance,
  CodPlaySnapshot,
  CodPlaySnapshotPatch,
  CodPlaySnapshotSetResult,
} from 'codplay'
import type { SequenceEditorController } from '../../sequence-editor/controller'
import type { controllerMachine } from '../controller/controller-machine'
import {
  EditorPlayerCommandFacade,
  type EditorPlayerCommandResult,
  type EditorPlayerProgress,
  type EditorPlayerProgressListener,
  type EditorPlayerTransportListener,
  type EditorPlayerTransportState,
} from '../commands/editor-player-command-facade'

/** Transport port consumed by sequence-editor without exposing a CodPlay instance. */
export type EditorCoordinationTransport = Readonly<{
  getState: () => EditorPlayerTransportState | null
  getProgress: () => EditorPlayerProgress | null
  play: () => void
  pause: () => void
  rewind: () => void
  seek: (timelineMs: number) => void
  setRate: (rate: number) => void
  onChange: (listener: EditorPlayerTransportListener) => () => void
  onProgress: (listener: EditorPlayerProgressListener) => () => void
}>

/** Logical snapshot port consumed by decor-editor and its Selection Frame integration. */
export type EditorCoordinationSnapshot = Readonly<{
  get: () => CodPlaySnapshot | null
  set: (patches: readonly CodPlaySnapshotPatch[]) => CodPlaySnapshotSetResult | null
  clear: () => void
}>

type SequenceReconciliationPort = Pick<SequenceEditorController, 'reconcilePlaybackTime'>

/**
 * Coordinates autonomous editor modules around the player command facade.
 * It owns no CodPlay instance and never writes the document model.
 */
export class EditorCoordinationBridge {
  readonly transport: EditorCoordinationTransport
  readonly snapshot: EditorCoordinationSnapshot
  private sequence: SequenceReconciliationPort | null = null
  private readonly unsubscribeSeekApplied: () => void
  private readonly machine: Actor<typeof controllerMachine>
  private readonly player: EditorPlayerCommandFacade

  /** Creates the bridge between the central controller and the player facade. */
  constructor(
    machine: Actor<typeof controllerMachine>,
    player: EditorPlayerCommandFacade,
  ) {
    this.machine = machine
    this.player = player
    this.transport = {
      getState: () => this.player.getState(),
      getProgress: () => this.player.getProgress(),
      play: () => this.requestPlay(),
      pause: () => this.requestPause(),
      rewind: () => this.requestRewind(),
      seek: (timelineMs) => this.requestSeek(timelineMs),
      setRate: (rate) => { void this.execute({ type: 'setRate', rate }) },
      onChange: (listener) => this.player.onTransportChange(listener),
      onProgress: (listener) => this.player.onPlaybackProgress(listener),
    }
    this.snapshot = {
      get: () => this.player.getSnapshot(),
      set: (patches) => this.player.setSnapshot(patches),
      clear: () => this.player.clearSnapshot(),
    }
    this.unsubscribeSeekApplied = this.machine.on('seekApplied', () => {
      const progress = this.player.getProgress()
      if (progress !== null) this.sequence?.reconcilePlaybackTime(progress.timelineMs)
    }).unsubscribe
  }

  /** Registers the sequence model as the owner of the author playhead. */
  attachSequenceEditor(sequence: SequenceReconciliationPort): void {
    this.sequence = sequence
  }

  /** Binds the current V2 player to the separate player facade. */
  bindPlayer(instance: CodPlayInstance, preRollMs: number): void {
    this.player.bind(instance, preRollMs)
  }

  /** Removes the current V2 player binding while keeping the coordination object alive. */
  unbindPlayer(): void {
    this.player.unbind()
  }

  /** Sends the author seek intention to the controller; the scene bridge executes it. */
  requestSeek(timelineMs: number): void {
    this.machine.send({ type: 'SEEK', timelineMs })
  }

  /** Requests play after giving the controller the chance to flush pending document edits. */
  requestPlay(): void {
    this.machine.send({ type: 'TELCO_ACTION_REQUEST' })
    void this.execute({ type: 'play' })
  }

  /** Requests pause and adopts the resulting player time once the command has completed. */
  requestPause(): void {
    this.machine.send({ type: 'TELCO_PAUSE_REQUEST' })
    void this.execute({ type: 'pause' }).then((result) => {
      if (result.ok) this.sequence?.reconcilePlaybackTime(result.progress.timelineMs)
    })
  }

  /** Requests rewind and adopts its resulting time without emitting a second seek intention. */
  requestRewind(): void {
    if (this.player.getState()?.status === 'playing') this.machine.send({ type: 'TELCO_PAUSE_REQUEST' })
    void this.execute({ type: 'rewind' }).then((result) => {
      if (result.ok) this.sequence?.reconcilePlaybackTime(result.progress.timelineMs)
    })
  }

  /** Executes one command through the player facade and exposes its checked result to callers. */
  execute(command: Parameters<EditorPlayerCommandFacade['execute']>[0]): Promise<EditorPlayerCommandResult> {
    return this.player.execute(command)
  }

  /** Subscribes to the acknowledgement emitted after the V2 seek has been applied. */
  onSeekApplied(listener: () => void): () => void {
    const subscription = this.machine.on('seekApplied', listener)
    return () => subscription.unsubscribe()
  }

  /** Releases bridge subscriptions and the module references it owns. */
  destroy(): void {
    this.unsubscribeSeekApplied()
    this.sequence = null
  }
}
