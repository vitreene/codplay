import { Sighty } from '@codplay/sighty'
import type { CodPlayTelcoState } from 'codplay'
import {
  DEMO4_PLAYBACK_STATE_EVENTS,
  DEMO4_TELCO_STATE_EVENTS,
} from './messages'
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
type Demo4Runtime = Demo4Sighty['runtime']

const CHAPTER_SCENE_SLOT = 'slot-scene' as const

const INSTANCE_IDS: Readonly<Record<SightyDemo4SceneKey, string>> = {
  'scene-layout': 'demo4-layout-1',
  'scene-menu': 'demo4-menu-1',
  'scene-a': 'demo4-scene-a-1',
  'scene-b': 'demo4-scene-b-1',
  'scene-c': 'demo4-scene-c-1',
  'scene-telco': 'demo4-telco-1',
}

const CONTENT_SCENE_KEYS = ['scene-a', 'scene-b', 'scene-c'] as const
const PROGRESS_CONTROL_TARGET = { storyId: 'main', persoId: 'demo4-telco-progress' } as const

/** Owns demo-specific seek and button presentation around one Sighty facade. */
export class SightyComposition {
  private readonly sighty: Demo4Sighty
  private readonly onLog: SightyDemo4Options['onLog']
  readonly runtime: Demo4Runtime
  private readonly cleanups: Array<() => void> = []
  private readonly activeSceneCleanups: Array<() => void> = []
  private selectionRevision = 0
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
    const initialSceneKey = this.runtime.getMountedSceneKey(CHAPTER_SCENE_SLOT)
    await this.runtime.play('scene-layout')
    await this.runtime.play('scene-menu')
    await this.activateSelection(initialSceneKey, this.selectionRevision)
    this.onLog('Démo 4 initialisée : menu → scènes A/B/C')
  }

  /** Connects the demo-specific state of the scene telco to Sighty selection changes. */
  private connectSelectionFeature(): void {
    this.cleanups.push(this.runtime.onSlotChange(CHAPTER_SCENE_SLOT, (sceneKey) => {
      const revision = ++this.selectionRevision
      this.disconnectActiveSceneObservation()
      void this.activateSelection(sceneKey, revision).catch((error: unknown) => {
        if (this.destroyed) return
        this.onLog(
          `État de la telco indisponible : ${error instanceof Error ? error.message : String(error)}`,
          'error',
        )
      })
    }))
  }

  /** Synchronizes the scene telco state after Sighty admits the new selection. */
  private async activateSelection(
    sceneKey: SightyDemo4SceneKey | undefined,
    revision: number,
  ): Promise<void> {
    if (!this.isCurrentSceneSelection(sceneKey, revision)) return
    await this.syncTelcoState(sceneKey, revision)
    if (this.isCurrentSceneSelection(sceneKey, revision)) {
      this.connectActiveSceneObservation(sceneKey, revision)
    }
  }

  /** Observes playback state only for the scene currently mounted in the chapter slot. */
  private connectActiveSceneObservation(
    sceneKey: SightyDemo4SceneKey | undefined,
    revision: number,
  ): void {
    if (!this.isCurrentSceneSelection(sceneKey, revision)
      || sceneKey === undefined
      || sceneKey === 'scene-menu') return
    if (!CONTENT_SCENE_KEYS.includes(sceneKey as typeof CONTENT_SCENE_KEYS[number])) return

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

  /** Projects the active scene time into the authored telco input without journaling it. */
  private projectActiveSceneProgress(
    sceneKey: SightyDemo4SceneKey,
    revision: number,
    state: CodPlayTelcoState,
  ): void {
    if (!this.isActiveScene(sceneKey, revision)) return
    const telco = this.requireInstance('scene-telco')
    const result = telco.projection.setInputValue(PROGRESS_CONTROL_TARGET, state.timelineMs)
    if (!result.ok && result.code !== 'TARGET_NOT_PRESENT') {
      this.onLog(`Projection de progression impossible : ${result.code}`, 'error')
    }
  }

  /** Removes the playback observer from the scene that just exited. */
  private disconnectActiveSceneObservation(): void {
    for (const cleanup of this.activeSceneCleanups.splice(0)) cleanup()
    this.playbackStatePending = undefined
  }

  /** Activates the authored telco controls after a content selection is admitted. */
  private async syncTelcoState(
    sceneKey: SightyDemo4SceneKey | undefined,
    revision: number,
  ): Promise<void> {
    if (!this.isCurrentSceneSelection(sceneKey, revision)) return
    const enabled = sceneKey !== undefined && sceneKey !== 'scene-menu'
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
      throw new Error(`L’activation de la telco Demo 4 n’a pas été admise pour ${sceneKey}.`)
    }
    if (!this.isCurrentSceneSelection(sceneKey, revision)) return
    const selected = this.requireInstance(sceneKey)
    this.projectActiveSceneProgress(sceneKey, revision, selected.telco.getState())
    this.requestPlaybackState(sceneKey, revision, selected.telco.getState())
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
      && this.runtime.getMountedSceneKey('slot-telco') === 'scene-telco'
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
