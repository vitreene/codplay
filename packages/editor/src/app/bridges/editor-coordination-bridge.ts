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

/** Internal editor handoff notification used to resynchronize decor before playback resumes. */
export type EditorPlaybackReconciledListener = (timelineMs: number) => void

/** DOM host port used only to mount editor overlays in the scene region. */
export type EditorSceneHostListener = (host: HTMLElement | null) => void

/**
 * Coordinates autonomous editor modules around the player command facade.
 * It owns no CodPlay instance and never writes the document model.
 */
export class EditorCoordinationBridge {
  readonly transport: EditorCoordinationTransport
  readonly snapshot: EditorCoordinationSnapshot
  private sequence: SequenceReconciliationPort | null = null
  private sceneHost: HTMLElement | null = null
  private readonly sceneHostListeners = new Set<EditorSceneHostListener>()
  private readonly playbackReconciledListeners = new Set<EditorPlaybackReconciledListener>()
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
  }

  /** Registers the sequence model as the owner of the author playhead. */
  attachSequenceEditor(sequence: SequenceReconciliationPort): void {
    this.sequence = sequence
  }

  /** Publishes the stable scene-region host to editor overlays without exposing the player. */
  bindSceneHost(host: HTMLElement): void {
    this.sceneHost = host
    for (const listener of this.sceneHostListeners) listener(host)
  }

  /** Removes the scene-region host only when it is the currently bound host. */
  unbindSceneHost(host: HTMLElement): void {
    if (this.sceneHost !== host) return
    this.sceneHost = null
    for (const listener of this.sceneHostListeners) listener(null)
  }

  /** Returns the current overlay host, never a player item node. */
  getSceneHost(): HTMLElement | null {
    return this.sceneHost
  }

  /** Subscribes to scene-host lifecycle changes and immediately reports the current host. */
  onSceneHostChange(listener: EditorSceneHostListener): () => void {
    this.sceneHostListeners.add(listener)
    listener(this.sceneHost)
    return () => { this.sceneHostListeners.delete(listener) }
  }

  /** Binds the current V2 player to the separate player facade. */
  bindPlayer(instance: CodPlayInstance, preRollMs: number, authorDurationMs: number): void {
    this.player.bind(instance, preRollMs, authorDurationMs)
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
  }

  /** Requests pause and adopts the resulting player time before leaving the playing state. */
  requestPause(): void {
    void this.execute({ type: 'pause' }).then((result) => {
      if (!result.ok) return
      this.reconcilePlaybackTime(result.progress.timelineMs)
      this.machine.send({ type: 'TELCO_PAUSE_REQUEST' })
    })
  }

  /** Requests rewind and adopts its resulting time without an intermediate handoff. */
  requestRewind(): void {
    void this.execute({ type: 'rewind' }).then((result) => {
      if (!result.ok) return
      this.reconcilePlaybackTime(result.progress.timelineMs)
      if (this.machine.getSnapshot().value === 'playing') this.machine.send({ type: 'TELCO_PAUSE_REQUEST' })
    })
  }

  /** Subscribes to the one-shot player-to-author time handoff after pause or rewind. */
  onPlaybackReconciled(listener: EditorPlaybackReconciledListener): () => void {
    this.playbackReconciledListeners.add(listener)
    return () => { this.playbackReconciledListeners.delete(listener) }
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
    this.sequence = null
    this.sceneHost = null
    this.sceneHostListeners.clear()
    this.playbackReconciledListeners.clear()
  }

  /** Applies one checked player time to the autonomous sequence and its editor projections. */
  private reconcilePlaybackTime(timelineMs: number): void {
    this.sequence?.reconcilePlaybackTime(timelineMs)
    for (const listener of this.playbackReconciledListeners) listener(timelineMs)
  }
}
