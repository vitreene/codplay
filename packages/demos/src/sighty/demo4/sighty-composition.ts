import { Sighty } from '@codplay/sighty'
import type { CodPlayEventime, CodPlayPublicEvent, CodPlayTelcoState } from 'codplay'
import {
  DEMO4_PLAYBACK_INTENTS,
  DEMO4_PLAYBACK_STATE_EVENTS,
  DEMO4_PROGRESS_INTENTS,
  DEMO4_PROGRESS_STATE_EVENTS,
  DEMO4_TELCO_STATE_EVENTS,
} from './messages'
import type { Demo4PlaybackIntentName } from './messages'
import { sightyScenario } from './scene-resources'
import { actionCatalog } from './action-catalog'
import { DEMO4_LAYOUT_CAROUSEL } from './carousel'
import type {
  SightyDemo4SceneKey,
  SightyDemo4SlotName,
} from './sighty-file'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'

type SightyDemo4Options = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

type Demo4Sighty = Sighty<SightyDemo4SceneKey, SightyDemo4SlotName>
export type Demo4Runtime = Demo4Sighty['runtime']
type Demo4PlaybackCommand = 'toggle' | 'rewind'

const CHAPTER_SCENE_SLOT = 'slot-scene' as const

const INSTANCE_IDS: Readonly<Record<SightyDemo4SceneKey, string>> = {
  'scene-layout': 'demo4-layout-1',
  'scene-menu': 'demo4-menu-1',
  'scene-a': 'demo4-scene-a-1',
  'scene-b': 'demo4-scene-b-1',
  'scene-c': 'demo4-scene-c-1',
  'scene-telco': 'demo4-telco-1',
}

const PROGRESS_SCENE_KEYS = ['scene-a', 'scene-b', 'scene-c'] as const
const SCENE_TARGET = { scope: 'story', storyId: 'main' } as const
const PROGRESS_UPDATE_INTERVAL_MS = 100
const PLAYBACK_COMMANDS: Readonly<Record<Demo4PlaybackIntentName, Demo4PlaybackCommand>> = {
  [DEMO4_PLAYBACK_INTENTS.toggle]: 'toggle',
  [DEMO4_PLAYBACK_INTENTS.rewind]: 'rewind',
}

/** Owns demo-specific progress and button presentation around one Sighty facade. */
export class SightyComposition {
  private readonly sighty: Demo4Sighty
  private readonly onLog: SightyDemo4Options['onLog']
  readonly runtime: Demo4Runtime
  private readonly cleanups: Array<() => void> = []
  private readonly activeSceneCleanups: Array<() => void> = []
  private selectionRevision = 0
  private progressUpdatePending: Readonly<{
    revision: number
    sceneKey: SightyDemo4SceneKey
    value: number
    max: number
  }> | undefined
  private progressUpdateRunning = false
  private progressUpdateScheduled = false
  private progressUpdateTimer: ReturnType<typeof globalThis.setTimeout> | undefined
  private playbackCommandRevision: number | undefined
  private playbackStatePending: Readonly<{
    revision: number
    sceneKey: SightyDemo4SceneKey
    state: CodPlayTelcoState
  }> | undefined
  private playbackStateRunning = false
  private playbackStateScheduled = false
  private destroyed = false

  /** Creates the Sighty facade and supplies only demo-specific presentation features. */
  constructor(options: SightyDemo4Options) {
    this.onLog = options.onLog
    this.sighty = new Sighty({
      scenario: sightyScenario,
      runtime: {
        root: options.stage,
        instanceIds: INSTANCE_IDS,
        layout: { sceneKey: 'scene-layout', storyId: 'main' },
        actionCatalog,
        styles: [{
          slot: 'sighty-demo4-scene-root',
          cssText: SIGHTY_SCENE_ROOT_STYLE_SHEET,
        }, {
          slot: 'sighty-demo4-layout-carousel',
          cssText: DEMO4_LAYOUT_CAROUSEL.styleSheet,
        }],
        codplay: {
          engine: {
            idle: false,
            diagnosticOutput: (diagnostic) => {
              this.onLog(diagnostic.message, diagnostic.severity === 'warning' ? 'warn' : 'error')
            },
          },
          pauseOnDocumentHidden: false,
        },
        onPreloadWarning: (warning) => this.onLog(`${warning.code}: ${warning.message}`, 'warn'),
      },
    })
    this.runtime = this.sighty.runtime
  }

  /** Returns the occurrences addressed by the shared page play/pause remote. */
  getGeneralControlSceneKeys(): readonly SightyDemo4SceneKey[] {
    const sceneKey = this.runtime.getMountedSceneKey(CHAPTER_SCENE_SLOT)
    if (sceneKey === undefined || sceneKey === 'scene-menu') return ['scene-layout', 'scene-menu']
    return ['scene-layout', sceneKey, 'scene-telco']
  }

  /** Initializes the authored graph and starts its declared initial selections. */
  async initialize(): Promise<void> {
    await this.runtime.initialize()
    this.connectSelectionFeature()
    this.connectProgressFeature()
    this.connectPlaybackFeature()
    const initialSceneKey = this.runtime.getMountedSceneKey(CHAPTER_SCENE_SLOT)
    this.connectActiveSceneObservation(initialSceneKey, this.selectionRevision)
    await this.runtime.play('scene-layout')
    await this.runtime.play('scene-menu')
    await this.syncTelcoState(initialSceneKey, this.selectionRevision)
    this.onLog('Démo 4 initialisée : menu → scènes A/B/C')
  }

  /** Connects the scene telco playback intents to the currently selected scene. */
  private connectPlaybackFeature(): void {
    const telco = this.requireInstance('scene-telco')
    this.cleanups.push(telco.events.onEvent((event) => {
      const command = PLAYBACK_COMMANDS[event.name as Demo4PlaybackIntentName]
      if (command === undefined) return
      if (!this.isSceneTelcoMounted()) return
      const revision = this.selectionRevision
      if (this.playbackCommandRevision === revision) return
      this.playbackCommandRevision = revision
      void this.controlSelectedScene(command, revision)
        .finally(() => {
          if (this.playbackCommandRevision === revision) this.playbackCommandRevision = undefined
        })
        .catch((error: unknown) => {
          if (this.destroyed) return
          this.onLog(
            `Commande de lecture impossible : ${error instanceof Error ? error.message : String(error)}`,
            'error',
          )
        })
    }))
  }

  /** Connects the demo-specific state of the scene telco to Sighty selection changes. */
  private connectSelectionFeature(): void {
    this.cleanups.push(this.runtime.onSlotChange(CHAPTER_SCENE_SLOT, (sceneKey) => {
      const revision = ++this.selectionRevision
      this.disconnectActiveSceneObservation()
      this.connectActiveSceneObservation(sceneKey, revision)
      void this.syncTelcoState(sceneKey, revision).catch((error: unknown) => {
        if (this.destroyed) return
        this.onLog(
          `État de la telco indisponible : ${error instanceof Error ? error.message : String(error)}`,
          'error',
        )
      })
    }))
  }

  /** Connects the scene progress intent and the live progress observations. */
  private connectProgressFeature(): void {
    const telco = this.requireInstance('scene-telco')
    this.cleanups.push(telco.events.onEvent((event) => {
      if (event.name !== DEMO4_PROGRESS_INTENTS.seek) return
      if (!this.isSceneTelcoMounted()) return
      const value = readNumericEventValue(event)
      if (value === undefined) {
        this.onLog('La progression reçue par la démo 4 est invalide.', 'warn')
        return
      }
      void this.seekSelectedScene(value).catch((error: unknown) => {
        if (this.destroyed) return
        this.onLog(
          `Seek de la scène impossible : ${error instanceof Error ? error.message : String(error)}`,
          'error',
        )
      })
    }))
  }

  /** Observes only the scene currently mounted in the chapter slot. */
  private connectActiveSceneObservation(
    sceneKey: SightyDemo4SceneKey | undefined,
    revision: number,
  ): void {
    if (!this.isCurrentSceneSelection(sceneKey, revision)
      || sceneKey === undefined
      || sceneKey === 'scene-menu') return
    if (!PROGRESS_SCENE_KEYS.includes(sceneKey as typeof PROGRESS_SCENE_KEYS[number])) return

    const instance = this.requireInstance(sceneKey)
    this.activeSceneCleanups.push(
      instance.telco.onProgress((state) => this.requestProgressUpdate(sceneKey, revision, state)),
      instance.telco.onChange((state) => {
        this.requestProgressUpdate(sceneKey, revision, state)
        this.requestPlaybackState(sceneKey, revision, state)
      }),
    )
    const state = instance.telco.getState()
    this.requestProgressUpdate(sceneKey, revision, state)
    this.requestPlaybackState(sceneKey, revision, state)
  }

  /** Removes progress and playback observers from the scene that just exited. */
  private disconnectActiveSceneObservation(): void {
    for (const cleanup of this.activeSceneCleanups.splice(0)) cleanup()
    this.progressUpdatePending = undefined
    this.playbackStatePending = undefined
    if (this.progressUpdateTimer !== undefined) {
      globalThis.clearTimeout(this.progressUpdateTimer)
      this.progressUpdateTimer = undefined
      this.progressUpdateScheduled = false
    }
  }

  /** Relays the scene telco slider to the scene currently selected by Sighty. */
  private async seekSelectedScene(value: number): Promise<void> {
    if (!this.isSceneTelcoMounted()) return
    const revision = this.selectionRevision
    const sceneKey = this.runtime.getMountedSceneKey(CHAPTER_SCENE_SLOT)
    if (sceneKey === undefined
      || sceneKey === 'scene-menu'
      || !this.isActiveScene(sceneKey, revision)) return
    const instance = this.requireInstance(sceneKey)
    const duration = instance.telco.getProgress().durationMs
    const targetTime = Math.max(0, Math.min(duration, value))
    const state = instance.telco.getState()
    if (state.status === 'playing' && !state.sequenceEnded) await instance.telco.pause()
    if (!this.isActiveScene(sceneKey, revision)) return
    await instance.telco.seek(targetTime)
  }

  /** Applies one playback command to the scene selected in the chapter slot. */
  private async controlSelectedScene(command: Demo4PlaybackCommand, revision: number): Promise<void> {
    if (!this.isSceneTelcoMounted()) return
    const sceneKey = this.runtime.getMountedSceneKey(CHAPTER_SCENE_SLOT)
    if (sceneKey === undefined
      || sceneKey === 'scene-menu'
      || !this.isActiveScene(sceneKey, revision)) return
    const instance = this.requireInstance(sceneKey)
    if (command === 'toggle') await instance.telco.togglePlay()
    else await instance.telco.rewind()
    if (!this.isActiveScene(sceneKey, revision)) return
    this.requestPlaybackState(sceneKey, revision, instance.telco.getState())
  }

  /** Schedules the latest active-scene progress for the authored telco input. */
  private requestProgressUpdate(
    sceneKey: SightyDemo4SceneKey,
    revision: number,
    state: CodPlayTelcoState,
  ): void {
    if (!this.isActiveScene(sceneKey, revision)) return
    this.progressUpdatePending = {
      revision,
      sceneKey,
      value: state.timelineMs,
      max: state.durationMs,
    }
    this.scheduleProgressUpdateFlush()
  }

  /** Sends coalesced progress updates through the telco scene event path. */
  private async flushProgressUpdates(): Promise<void> {
    const update = this.progressUpdatePending
    this.progressUpdatePending = undefined
    try {
      if (this.destroyed || update === undefined) return
      if (!this.isActiveScene(update.sceneKey, update.revision)) return
      const telco = this.requireInstance('scene-telco')
      await telco.events.emit({
        name: DEMO4_PROGRESS_STATE_EVENTS.update,
        data: { value: update.value, max: update.max },
      }, SCENE_TARGET)
    } finally {
      this.progressUpdateRunning = false
      if (!this.destroyed && this.progressUpdatePending !== undefined) {
        this.scheduleProgressUpdateFlush()
      }
    }
  }

  /** Defers and samples non-critical progress so playback commands stay responsive. */
  private scheduleProgressUpdateFlush(): void {
    if (this.progressUpdateRunning || this.progressUpdateScheduled) return
    this.progressUpdateScheduled = true
    this.progressUpdateTimer = globalThis.setTimeout(() => {
      this.progressUpdateTimer = undefined
      this.progressUpdateScheduled = false
      if (this.destroyed || this.progressUpdatePending === undefined) return
      const update = this.progressUpdatePending
      if (!this.isActiveScene(update.sceneKey, update.revision)) {
        this.progressUpdatePending = undefined
        return
      }
      this.progressUpdateRunning = true
      void this.flushProgressUpdates().catch((error: unknown) => {
        if (this.destroyed) return
        this.onLog(
          `Projection de progression impossible : ${error instanceof Error ? error.message : String(error)}`,
          'error',
        )
      })
    }, PROGRESS_UPDATE_INTERVAL_MS)
  }

  /** Enables or disables the authored navigation, playback and progress controls. */
  private async syncTelcoState(
    sceneKey: SightyDemo4SceneKey | undefined,
    revision: number,
  ): Promise<void> {
    if (!this.isCurrentSceneSelection(sceneKey, revision)) return
    const telco = this.requireInstance('scene-telco')
    const enabled = sceneKey !== undefined && sceneKey !== 'scene-menu'
    const eventime: CodPlayEventime = {
      name: enabled ? DEMO4_TELCO_STATE_EVENTS.enable : DEMO4_TELCO_STATE_EVENTS.disable,
    }
    await telco.events.emit(eventime, SCENE_TARGET)
    if (!this.isCurrentSceneSelection(sceneKey, revision)) return
    if (enabled) {
      const selected = this.requireInstance(sceneKey)
      this.requestPlaybackState(sceneKey, revision, selected.telco.getState())
    }
    if (sceneKey !== undefined) this.onLog(`Sighty → ${sceneKey}`)
  }

  /** Reflects the selected scene playback state in the single toggle control. */
  private async syncPlaybackState(
    sceneKey: SightyDemo4SceneKey,
    revision: number,
    state: CodPlayTelcoState,
  ): Promise<void> {
    if (!this.isActiveScene(sceneKey, revision)) return
    const eventName = state.status === 'playing' && !state.sequenceEnded
      ? DEMO4_PLAYBACK_STATE_EVENTS.playing
      : DEMO4_PLAYBACK_STATE_EVENTS.paused
    const telco = this.requireInstance('scene-telco')
    await telco.events.emit({ name: eventName }, SCENE_TARGET)
  }

  /** Keeps only the latest playback state waiting for the authored telco. */
  private requestPlaybackState(
    sceneKey: SightyDemo4SceneKey,
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

  /** Sends one latest playback state and reschedules only if a newer one arrived. */
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
  private isCurrentSceneSelection(
    sceneKey: SightyDemo4SceneKey | undefined,
    revision: number,
  ): boolean {
    return !this.destroyed
      && revision === this.selectionRevision
      && this.runtime.getMountedSceneKey(CHAPTER_SCENE_SLOT) === sceneKey
  }

  /** Checks that one content scene and its scene telco are both active. */
  private isActiveScene(sceneKey: SightyDemo4SceneKey, revision: number): boolean {
    return this.isCurrentSceneSelection(sceneKey, revision)
      && this.isSceneTelcoMounted()
  }

  /** Checks that the scene telco is currently part of the selected chapter view. */
  private isSceneTelcoMounted(): boolean {
    return this.runtime.getMountedSceneKey('slot-telco') === 'scene-telco'
  }

  /** Resolves one live occurrence and reports a demo-specific missing resource. */
  private requireInstance(sceneKey: SightyDemo4SceneKey) {
    const instance = this.runtime.getInstance(sceneKey)
    if (instance === undefined) throw new Error(`La scène Sighty ${sceneKey} est absente.`)
    return instance
  }

  /** Removes observers and releases every occurrence owned by this composition. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.selectionRevision += 1
    this.disconnectActiveSceneObservation()
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    this.sighty.runtime.destroy()
  }
}

/** Reads the numeric slider value from one public CodPlay event. */
function readNumericEventValue(event: CodPlayPublicEvent): number | undefined {
  const value = event.data?.value
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : undefined
}
