import { Sighty } from '@codplay/sighty'
import type { CodPlayPublicEvent } from 'codplay'
import { TELCO_INTENTS, type TelcoIntentName } from './messages'
import { sightyScenario } from './scene-resources'
import type { SightyDemo2SceneKey, SightyDemo2SlotName } from './sighty-file'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'

type SightyDemo2Options = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

type Demo2ControlCommand = 'play' | 'pause' | 'replay'
type Demo2MessageRoute = Readonly<{
  command: Demo2ControlCommand
}>

export type Demo2Sighty = Sighty<SightyDemo2SceneKey, SightyDemo2SlotName>
export type Demo2Runtime = Demo2Sighty['runtime']

const INSTANCE_IDS: Readonly<Record<SightyDemo2SceneKey, string>> = {
  layout: 'demo2-layout-1',
  sceneB: 'demo2-scene-b-1',
  telco: 'demo2-telco-1',
}

const MESSAGE_ROUTES: Readonly<Record<TelcoIntentName, Demo2MessageRoute>> = {
  [TELCO_INTENTS.play]: { command: 'play' },
  [TELCO_INTENTS.pause]: { command: 'pause' },
  [TELCO_INTENTS.replay]: { command: 'replay' },
}

/** Owns only the demo 2 message scenario around the generic Sighty runtime. */
export class SightyComposition {
  private readonly sighty: Demo2Sighty
  private readonly onLog: SightyDemo2Options['onLog']
  readonly runtime: Demo2Runtime
  private messageCleanup: (() => void) | null = null
  private messageChain: Promise<void> = Promise.resolve()
  private destroyed = false

  /** Creates the generic runtime and configures the demo-specific message policy. */
  constructor(options: SightyDemo2Options) {
    this.onLog = options.onLog
    this.sighty = new Sighty({
      scenario: sightyScenario,
      runtime: {
        root: options.stage,
        instanceIds: INSTANCE_IDS,
        layout: { sceneKey: 'layout', storyId: 'main' },
        styles: [{
          slot: 'sighty-demo2-scene-root',
          cssText: SIGHTY_SCENE_ROOT_STYLE_SHEET,
        }],
        codplay: {
          engine: {
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

  /** Initializes the generic composition, then connects and starts its demo scenario. */
  async initialize(): Promise<void> {
    await this.sighty.runtime.initialize()
    this.connectMessageRelay()
    await this.startVisibleScenes()
    this.onLog('Démo 2 initialisée : telco → Sighty → sceneB')
  }

  /** Subscribes Sighty to public intentions emitted by the command scene. */
  private connectMessageRelay(): void {
    const telco = this.sighty.runtime.getInstance('telco')
    if (telco === undefined) throw new Error('La scène-telco de la démo 2 est absente.')
    this.messageCleanup = telco.events.onEvent((event) => {
      const route = MESSAGE_ROUTES[event.name as TelcoIntentName]
      if (route === undefined) return
      this.messageChain = this.messageChain
        .then(() => this.dispatchMessage(event, route))
        .catch((error: unknown) => {
          if (!this.destroyed) {
            this.onLog(
              `Relais Sighty impossible : ${error instanceof Error ? error.message : String(error)}`,
              'error',
            )
          }
        })
    })
  }

  /** Applies one scenario route to the reused scene B through its telco surface. */
  private async dispatchMessage(event: CodPlayPublicEvent, route: Demo2MessageRoute): Promise<void> {
    if (this.destroyed) return
    const sceneB = this.sighty.runtime.getInstance('sceneB')
    if (sceneB === undefined) throw new Error('La scène B de la démo 2 est absente.')
    this.onLog(`message ${event.name} → sceneB (${route.command})`)

    if (route.command === 'play') {
      this.onLog('Sighty → sceneB : telco.play')
      await sceneB.telco.play()
      return
    }

    if (route.command === 'pause') {
      this.onLog('Sighty → sceneB : telco.pause')
      await sceneB.telco.pause()
      return
    }

    this.onLog('Sighty → sceneB : telco.rewind')
    await sceneB.telco.rewind()
    this.onLog('Sighty → sceneB : telco.play')
    await sceneB.telco.play()
  }

  /** Starts the visible layout, the controlled scene and the command scene independently. */
  private async startVisibleScenes(): Promise<void> {
    await this.sighty.runtime.play('layout')
    await this.sighty.runtime.play('sceneB')
    await this.sighty.runtime.play('telco')
  }

  /** Tears down only the demo scenario; the page remains responsible for its DOM. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.messageCleanup?.()
    this.messageCleanup = null
    this.sighty.runtime.destroy()
  }
}
