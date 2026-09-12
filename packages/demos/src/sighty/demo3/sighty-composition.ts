import { Sighty } from '@codplay/sighty'
import type { CodPlayEventime, CodPlayPublicEvent } from 'codplay'
import { SCENE_A_EVENTS } from '../demo1/scenes/scene-a'
import {
  DEMO3_COLOR_INTENTS,
  DEMO3_COLOR_VALUES,
  DEMO3_CONTENT_INTENTS,
  type Demo3ColorName,
  type Demo3ContentIntentName,
} from './messages'
import { sightyScenario } from './scene-resources'
import type { SightyDemo3SceneKey, SightyDemo3SlotName } from './sighty-file'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'

type SightyDemo3Options = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

type Demo3Sighty = Sighty<SightyDemo3SceneKey, SightyDemo3SlotName>
export type Demo3Runtime = Demo3Sighty['runtime']

const INSTANCE_IDS: Readonly<Record<SightyDemo3SceneKey, string>> = {
  layout: 'demo3-layout-1',
  sceneA: 'demo3-scene-a-1',
  telco: 'demo3-telco-1',
}

const SCENE_A_TARGET = { scope: 'story', storyId: 'main' } as const

const CONTENT_ROUTES: Readonly<Record<Demo3ContentIntentName, true>> = {
  [DEMO3_CONTENT_INTENTS.first]: true,
  [DEMO3_CONTENT_INTENTS.second]: true,
}

/** Owns the demo 3 message policy around the generic Sighty facade. */
export class SightyComposition {
  private readonly sighty: Demo3Sighty
  private readonly onLog: SightyDemo3Options['onLog']
  readonly runtime: Demo3Runtime
  private messageCleanup: (() => void) | null = null
  private messageChain: Promise<void> = Promise.resolve()
  private destroyed = false

  /** Creates the generic Sighty runtime and its demo-specific configuration. */
  constructor(options: SightyDemo3Options) {
    this.onLog = options.onLog
    this.sighty = new Sighty({
      scenario: sightyScenario,
      runtime: {
        root: options.stage,
        instanceIds: INSTANCE_IDS,
        layout: { sceneKey: 'layout', storyId: 'main' },
        styles: [{
          slot: 'sighty-demo3-scene-root',
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

  /** Initializes the composition, connects the message relay and starts its scenes. */
  async initialize(): Promise<void> {
    await this.sighty.runtime.initialize()
    this.connectMessageRelay()
    await this.startVisibleScenes()
    this.onLog('Démo 3 initialisée : telco → Sighty → sceneA')
  }

  /** Subscribes Sighty to the public text messages emitted by the command scene. */
  private connectMessageRelay(): void {
    const telco = this.sighty.runtime.getInstance('telco')
    if (telco === undefined) throw new Error('La scène-telco de la démo 3 est absente.')
    this.messageCleanup = telco.events.onEvent((event) => {
      if (CONTENT_ROUTES[event.name as Demo3ContentIntentName] !== true) return
      this.messageChain = this.messageChain
        .then(() => this.dispatchContent(event))
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

  /** Injects the public text payload into the declared scene A action. */
  private async dispatchContent(event: CodPlayPublicEvent): Promise<void> {
    if (this.destroyed) return
    const content = event.data?.content
    if (typeof content !== 'string' && typeof content !== 'number') {
      this.onLog(`Message ${event.name} sans contenu textuel.`, 'warn')
      return
    }
    this.onLog(`message ${event.name} → sceneA (content)`)
    await this.emitSceneA({
      name: SCENE_A_EVENTS.setContent,
      data: { content },
    })
    this.onLog('Sighty → sceneA : content injecté')
  }

  /** Enqueues one Sighty-level color event for the text of scene A. */
  injectTextColor(colorName: Demo3ColorName): Promise<void> {
    const color = DEMO3_COLOR_VALUES[colorName]
    const sourceEventName = DEMO3_COLOR_INTENTS[colorName]
    this.messageChain = this.messageChain.then(async () => {
      if (this.destroyed) return
      this.onLog(`event ${sourceEventName} → sceneA (color)`)
      await this.emitSceneA({
        name: SCENE_A_EVENTS.setColor,
        data: { style: { color } },
      })
      this.onLog(`Sighty → sceneA : couleur ${colorName}`)
    })
    return this.messageChain
  }

  /** Emits one regular targeted event through the public scene instance facade. */
  private async emitSceneA(eventime: CodPlayEventime): Promise<void> {
    const sceneA = this.sighty.runtime.getInstance('sceneA')
    if (sceneA === undefined) throw new Error('La scène A de la démo 3 est absente.')
    await sceneA.events.emit(eventime, SCENE_A_TARGET)
  }

  /** Starts the layout, target scene and command scene as independent occurrences. */
  private async startVisibleScenes(): Promise<void> {
    await this.sighty.runtime.play('layout')
    await this.sighty.runtime.play('sceneA')
    await this.sighty.runtime.play('telco')
  }

  /** Releases the message listener and the Sighty runtime exactly once. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.messageCleanup?.()
    this.messageCleanup = null
    this.sighty.runtime.destroy()
  }
}
