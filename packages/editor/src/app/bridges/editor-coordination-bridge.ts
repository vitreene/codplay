import type { Actor } from 'xstate'
import type {
  CodPlayInstance,
  CodPlaySnapshot,
  CodPlaySnapshotPatch,
  CodPlaySnapshotSetResult,
} from 'codplay'
import type { SequenceEditorController } from '../../sequence-editor/controller'
import type { DecorPatch } from '../../decor-editor/types'
import type { controllerMachine } from '../controller/controller-machine'
import {
  EditorPlayerCommandFacade,
  type EditorPlayerCommandResult,
  type EditorPlayerProgress,
  type EditorPlayerProgressListener,
  type EditorPlayerPresentationFrame,
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

/** Numeric runtime pose port consumed by authoring overlays; it never exposes item DOM nodes. */
export type EditorCoordinationPresentation = Readonly<{
  get: () => EditorPlayerPresentationFrame | null
}>

/**
 * Candidate de décor conservé par l'intégration pendant une édition qui n'est pas encore
 * ancrée à un keyframe. `snapshot.get()` exclut la preview active ; ce port est donc le relais
 * V2 explicite entre `decor-editor` et la création d'un keyframe par `sequence-editor`.
 */
export type EditorDecorPreviewCandidate = Readonly<{
  itemId: string
  /** Temps auteur, dans la même référence que `Item.keyframes[].timeMs`. */
  timeMs: number
  patch: DecorPatch
}>

/** Port de handoff des previews de décor, sans accès à l'instance CodPlay. */
export type EditorCoordinationDecorPreview = Readonly<{
  /** Retourne le candidat le plus proche dans la tolérance demandée. */
  getAt: (itemId: string, timeMs: number, toleranceMs?: number) => EditorDecorPreviewCandidate | null
  /** Raccourci de capture pour la grille de keyframes (demi-pas de 100 ms par défaut). */
  getForKeyframe: (itemId: string, timeMs: number) => EditorDecorPreviewCandidate | null
  set: (candidate: EditorDecorPreviewCandidate) => void
  clear: (itemId: string, timeMs?: number) => void
  clearAll: () => void
}>

const KEYFRAME_PREVIEW_TOLERANCE_MS = 50

type SequenceReconciliationPort = Pick<SequenceEditorController, 'reconcilePlaybackTime' | 'seek'>

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
  readonly presentation: EditorCoordinationPresentation
  readonly decorPreview: EditorCoordinationDecorPreview
  private readonly decorPreviewCandidates = new Map<string, Map<number, EditorDecorPreviewCandidate>>()
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
    this.presentation = {
      get: () => this.player.getPresentationFrame(),
    }
    this.decorPreview = {
      getAt: (itemId, timeMs, toleranceMs = 1) => this.findDecorPreview(itemId, timeMs, toleranceMs),
      getForKeyframe: (itemId, timeMs) => this.findDecorPreview(itemId, timeMs, KEYFRAME_PREVIEW_TOLERANCE_MS),
      set: (candidate) => this.setDecorPreview(candidate),
      clear: (itemId, timeMs) => this.clearDecorPreview(itemId, timeMs),
      clearAll: () => this.clearAllDecorPreviews(),
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

  /** Moves the sequence editor's author-owned playhead before relaying its seek to the player. */
  requestAuthorSeek(timelineMs: number): void {
    if (this.sequence !== null) {
      this.sequence.seek(timelineMs)
      return
    }
    // Keep non-mounted/unit-test integrations functional; the mounted sequence editor is the
    // normal owner and emits the same `requestSeek` callback through its bridge.
    this.requestSeek(timelineMs)
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
    // The command resolves asynchronously. Only a rewind that started while the controller was
    // already playing may close that playback state; otherwise a quick rewind→Play sequence would
    // let the stale rewind completion pause the newly requested playback.
    const shouldExitPlayback = this.machine.getSnapshot().value === 'playing'
    void this.execute({ type: 'rewind' }).then((result) => {
      if (!result.ok) return
      this.reconcilePlaybackTime(result.progress.timelineMs)
      if (shouldExitPlayback && this.machine.getSnapshot().value === 'playing') {
        this.machine.send({ type: 'TELCO_PAUSE_REQUEST' })
      }
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
    this.clearAllDecorPreviews()
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

  /** Stores one immutable-by-convention candidate, replacing a previous candidate at the same time. */
  private setDecorPreview(candidate: EditorDecorPreviewCandidate): void {
    if (!Number.isFinite(candidate.timeMs)) return
    const byTime = this.decorPreviewCandidates.get(candidate.itemId) ?? new Map<number, EditorDecorPreviewCandidate>()
    byTime.set(candidate.timeMs, candidate)
    this.decorPreviewCandidates.set(candidate.itemId, byTime)
  }

  /** Finds the closest candidate without confusing an adjacent, independently edited time. */
  private findDecorPreview(itemId: string, timeMs: number, toleranceMs: number): EditorDecorPreviewCandidate | null {
    const byTime = this.decorPreviewCandidates.get(itemId)
    if (!byTime || !Number.isFinite(timeMs)) return null
    let closest: EditorDecorPreviewCandidate | null = null
    let closestDistance = Number.POSITIVE_INFINITY
    for (const candidate of byTime.values()) {
      const distance = Math.abs(candidate.timeMs - timeMs)
      if (distance <= toleranceMs && distance < closestDistance) {
        closest = candidate
        closestDistance = distance
      }
    }
    return closest
  }

  /** Removes one candidate, or all candidates for an item when no time is supplied. */
  private clearDecorPreview(itemId: string, timeMs?: number): void {
    if (timeMs === undefined) {
      this.decorPreviewCandidates.delete(itemId)
      return
    }
    const byTime = this.decorPreviewCandidates.get(itemId)
    if (!byTime) return
    byTime.delete(timeMs)
    if (byTime.size === 0) this.decorPreviewCandidates.delete(itemId)
  }

  /** Drops all uncommitted candidates on document replacement or bridge destruction. */
  private clearAllDecorPreviews(): void {
    this.decorPreviewCandidates.clear()
  }
}
