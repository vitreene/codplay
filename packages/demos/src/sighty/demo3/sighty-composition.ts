import { Sighty } from '@codplay/sighty'
import type { SightyActionCatalog } from '@codplay/sighty'
import { SCENE_A_EVENTS } from '../demo1/scenes/scene-a'
import {
  DEMO3_COLOR_INTENTS,
  DEMO3_COLOR_VALUES,
  type Demo3ColorName,
} from './messages'
import { sightyScenario } from './scene-resources'
import type { SightyDemo3SceneKey, SightyDemo3SlotName } from './sighty-file'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'

type SightyDemo3Options = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

type Demo3Sighty = Sighty<SightyDemo3SceneKey, SightyDemo3SlotName>
type Demo3Runtime = Demo3Sighty['runtime']

const INSTANCE_IDS: Readonly<Record<SightyDemo3SceneKey, string>> = {
  layout: 'demo3-layout-1',
  sceneA: 'demo3-scene-a-1',
  telco: 'demo3-telco-1',
}

const SCENE_A_TARGET = { scope: 'story', storyId: 'main' } as const

/** Owns the demo 3 message policy around the generic Sighty facade. */
export class SightyComposition {
  private readonly sighty: Demo3Sighty
  private readonly onLog: SightyDemo3Options['onLog']
  readonly runtime: Demo3Runtime
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
        actionCatalog: this.createActionCatalog(),
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

  /** Initializes the composition and starts its independently declared scenes. */
  async initialize(): Promise<void> {
    await this.sighty.runtime.initialize()
    await this.startVisibleScenes()
    this.onLog('Démo 3 initialisée : telco → Sighty → sceneA')
  }

  /** Provides the declared actions that forward telco or host data through Sighty. */
  private createActionCatalog(): SightyActionCatalog<SightyDemo3SceneKey> {
    return {
      'demo3:inject-content': async ({ event, send }) => {
        const content = event.data?.content
        if (typeof content !== 'string' && typeof content !== 'number') {
          this.onLog(`Message ${event.name} sans contenu textuel.`, 'warn')
          return
        }
        this.onLog(`message ${event.name} → sceneA (content)`)
        await send('sceneA', {
          name: SCENE_A_EVENTS.setContent,
          data: { content },
        }, SCENE_A_TARGET)
        this.onLog('Sighty → sceneA : content injecté')
      },
      'demo3:set-color': async ({ event, send }) => {
        const color = event.data?.color
        if (typeof color !== 'string') {
          this.onLog(`Message ${event.name} sans couleur.`, 'warn')
          return
        }
        await send('sceneA', {
          name: SCENE_A_EVENTS.setColor,
          data: { style: { color } },
        }, SCENE_A_TARGET)
        this.onLog(`Sighty → sceneA : couleur ${color}`)
      },
    }
  }

  /** Dispatches one host color intention through the declared telco scope. */
  injectTextColor(colorName: Demo3ColorName): Promise<void> {
    const color = DEMO3_COLOR_VALUES[colorName]
    const sourceEventName = DEMO3_COLOR_INTENTS[colorName]
    if (this.destroyed) return Promise.resolve()
    this.onLog(`event ${sourceEventName} → Sighty (color)`)
    return this.runtime.dispatch({
      name: sourceEventName,
      data: { color },
    }).then((handled) => {
      if (!handled) throw new Error(`L’intention ${sourceEventName} n’a pas été admise.`)
    })
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
    this.sighty.runtime.destroy()
  }
}
