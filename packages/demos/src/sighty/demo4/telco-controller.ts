import type { Sighty } from '@codplay/sighty'
import type { CodPlayTelcoState } from 'codplay'
import {
  DEMO4_PLAYBACK_STATE_EVENTS,
  DEMO4_TELCO_STATE_EVENTS,
} from './messages'

type SceneTelcoControllerOptions<SceneKey extends string, SlotName extends string> = Readonly<{
  runtime: Sighty<SceneKey, SlotName>['runtime']
  sceneSlot: SlotName
  telcoSlot: SlotName
  telcoSceneKey: SceneKey
  contentSceneKeys: readonly SceneKey[]
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

const PROGRESS_CONTROL_TARGET = { storyId: 'main', persoId: 'demo4-telco-progress' } as const

/** Keeps one authored scene telco synchronized with the content slot that it controls. */
export class SightySceneTelcoController<SceneKey extends string, SlotName extends string> {
  private readonly runtime: SceneTelcoControllerOptions<SceneKey, SlotName>['runtime']
  private readonly sceneSlot: SlotName
  private readonly telcoSlot: SlotName
  private readonly telcoSceneKey: SceneKey
  private readonly contentSceneKeys: readonly SceneKey[]
  private readonly onLog: SceneTelcoControllerOptions<SceneKey, SlotName>['onLog']
  private removeSlotListener: (() => void) | undefined
  private readonly activeSceneCleanups: Array<() => void> = []
  private selectionRevision = 0
  private playbackStatePending: Readonly<{
    revision: number
    sceneKey: SceneKey
    state: CodPlayTelcoState
  }> | undefined
  private playbackStateRunning = false
  private playbackStateScheduled = false
  private destroyed = false

  /** Creates a controller for an existing Sighty telco scene and its content slot. */
  constructor(options: SceneTelcoControllerOptions<SceneKey, SlotName>) {
    this.runtime = options.runtime
    this.sceneSlot = options.sceneSlot
    this.telcoSlot = options.telcoSlot
    this.telcoSceneKey = options.telcoSceneKey
    this.contentSceneKeys = options.contentSceneKeys
    this.onLog = options.onLog
  }

  /** Subscribes to content selection changes and synchronizes the current scene. */
  async connect(): Promise<void> {
    if (this.removeSlotListener !== undefined) return
    this.removeSlotListener = this.runtime.onSlotChange(this.sceneSlot, (sceneKey) => {
      const revision = ++this.selectionRevision
      this.disconnectActiveSceneObservation()
      void this.activateSelection(sceneKey, revision).catch((error: unknown) => {
        this.onLog(
          `État de la telco indisponible : ${error instanceof Error ? error.message : String(error)}`,
          'error',
        )
      })
    })
    await this.activateSelection(
      this.runtime.getMountedSceneKey(this.sceneSlot),
      this.selectionRevision,
    )
  }

  /** Synchronizes the authored telco after an incoming content scene is ready. */
  private async activateSelection(
    sceneKey: SceneKey | undefined,
    revision: number,
  ): Promise<void> {
    if (!this.isCurrentSceneSelection(sceneKey, revision)) return
    await this.syncTelcoState(sceneKey, revision)
    if (this.isCurrentSceneSelection(sceneKey, revision)
      && sceneKey !== undefined
      && this.contentSceneKeys.includes(sceneKey)) {
      this.connectActiveSceneObservation(sceneKey, revision)
    }
  }

  /** Observes playback only for the selected content scene. */
  private connectActiveSceneObservation(sceneKey: SceneKey, revision: number): void {
    if (!this.isActiveScene(sceneKey, revision)) return
    const instance = this.requireInstance(sceneKey)
    this.activeSceneCleanups.push(
      instance.telco.onProgress((state) => {
        this.projectActiveSceneProgress(sceneKey, revision, state)
      }),
      instance.telco.onChange((state) => {
        this.requestPlaybackState(sceneKey, revision, state)
      }),
    )
    const state = instance.telco.getState()
    this.projectActiveSceneProgress(sceneKey, revision, state)
    this.requestPlaybackState(sceneKey, revision, state)
  }

  /** Projects progress into the authored seek input without journaling it. */
  private projectActiveSceneProgress(
    sceneKey: SceneKey,
    revision: number,
    state: CodPlayTelcoState,
  ): void {
    if (!this.isActiveScene(sceneKey, revision)) return
    const telco = this.requireInstance(this.telcoSceneKey)
    const result = telco.projection.setInputValue(PROGRESS_CONTROL_TARGET, state.timelineMs)
    if (!result.ok && result.code !== 'TARGET_NOT_PRESENT') {
      this.onLog(`Projection de progression impossible : ${result.code}`, 'error')
    }
  }

  /** Removes playback observations from the scene that just exited. */
  private disconnectActiveSceneObservation(): void {
    for (const cleanup of this.activeSceneCleanups.splice(0)) cleanup()
    this.playbackStatePending = undefined
  }

  /** Activates the authored telco controls after a content scene is admitted. */
  private async syncTelcoState(
    sceneKey: SceneKey | undefined,
    revision: number,
  ): Promise<void> {
    if (!this.isCurrentSceneSelection(sceneKey, revision)) return
    const enabled = sceneKey !== undefined && this.contentSceneKeys.includes(sceneKey)
    if (!enabled) {
      if (sceneKey !== undefined) this.onLog(`Sighty → ${sceneKey}`)
      return
    }
    const handled = await this.runtime.dispatch({
      name: DEMO4_TELCO_STATE_EVENTS.on,
      sourceSceneKey: sceneKey,
    })
    if (!handled) {
      if (!this.isCurrentSceneSelection(sceneKey, revision)) return
      throw new Error(`L’activation de la telco n’a pas été admise pour ${sceneKey}.`)
    }
    if (!this.isCurrentSceneSelection(sceneKey, revision)) return
    const selected = this.requireInstance(sceneKey)
    const state = selected.telco.getState()
    this.projectActiveSceneProgress(sceneKey, revision, state)
    this.requestPlaybackState(sceneKey, revision, state)
    this.onLog(`Sighty → ${sceneKey}`)
  }

  /** Reflects the selected scene playback state in the shared toggle control. */
  private async syncPlaybackState(
    sceneKey: SceneKey,
    revision: number,
    state: CodPlayTelcoState,
  ): Promise<void> {
    if (!this.isActiveScene(sceneKey, revision)) return
    const eventName = state.status === 'playing' && !state.sequenceEnded
      ? DEMO4_PLAYBACK_STATE_EVENTS.playing
      : DEMO4_PLAYBACK_STATE_EVENTS.paused
    const handled = await this.runtime.dispatch({
      name: eventName,
      sourceSceneKey: sceneKey,
    })
    if (!handled) {
      if (!this.isActiveScene(sceneKey, revision)) return
      throw new Error(`La projection de l’état de lecture n’a pas été admise pour ${sceneKey}.`)
    }
    if (!this.isActiveScene(sceneKey, revision)) return
    const currentState = this.requireInstance(sceneKey).telco.getState()
    this.projectActiveSceneProgress(sceneKey, revision, currentState)
  }

  /** Keeps only the latest playback state waiting for the authored telco. */
  private requestPlaybackState(
    sceneKey: SceneKey,
    revision: number,
    state: CodPlayTelcoState,
  ): void {
    if (!this.isActiveScene(sceneKey, revision)) return
    this.playbackStatePending = { revision, sceneKey, state }
    this.schedulePlaybackStateFlush()
  }

  /** Schedules one latest playback-state projection without building a queue. */
  private schedulePlaybackStateFlush(): void {
    if (this.playbackStateRunning || this.playbackStateScheduled) return
    if (this.playbackStatePending === undefined) return
    this.playbackStateScheduled = true
    queueMicrotask(() => {
      this.playbackStateScheduled = false
      if (this.destroyed || this.playbackStatePending === undefined) return
      this.playbackStateRunning = true
      void this.flushPlaybackState()
    })
  }

  /** Sends the latest playback state and reschedules only if another arrived. */
  private async flushPlaybackState(): Promise<void> {
    const update = this.playbackStatePending
    this.playbackStatePending = undefined
    try {
      if (this.destroyed || update === undefined) return
      await this.syncPlaybackState(update.sceneKey, update.revision, update.state)
    } catch (error: unknown) {
      if (!this.destroyed) {
        this.onLog(
          `État de lecture indisponible : ${error instanceof Error ? error.message : String(error)}`,
          'error',
        )
      }
    } finally {
      this.playbackStateRunning = false
      if (!this.destroyed) this.schedulePlaybackStateFlush()
    }
  }

  /** Checks that a scene selection still belongs to the current view revision. */
  private isCurrentSceneSelection(sceneKey: SceneKey | undefined, revision: number): boolean {
    return !this.destroyed
      && revision === this.selectionRevision
      && this.runtime.getMountedSceneKey(this.sceneSlot) === sceneKey
  }

  /** Checks that the content scene and its authored telco are both active. */
  private isActiveScene(sceneKey: SceneKey, revision: number): boolean {
    return this.contentSceneKeys.includes(sceneKey)
      && this.isCurrentSceneSelection(sceneKey, revision)
      && this.runtime.getMountedSceneKey(this.telcoSlot) === this.telcoSceneKey
  }

  /** Resolves one mounted scene instance or reports its missing resource. */
  private requireInstance(sceneKey: SceneKey) {
    const instance = this.runtime.getInstance(sceneKey)
    if (instance === undefined) throw new Error(`La scène Sighty ${sceneKey} est absente.`)
    return instance
  }

  /** Removes event and playback observers before the owning runtime is destroyed. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.selectionRevision += 1
    this.disconnectActiveSceneObservation()
    this.removeSlotListener?.()
    this.removeSlotListener = undefined
  }
}
