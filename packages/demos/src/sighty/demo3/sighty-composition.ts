import { Sighty } from '@codplay/sighty'
import {
  DEMO3_COLOR_INTENTS,
  DEMO3_COLOR_VALUES,
  type Demo3ColorName,
} from './messages'
import { createDemo3Scenario, type SightyDemo3SceneKey, type SightyDemo3SlotName } from './scenario'
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
      scenario: createDemo3Scenario(this.onLog),
      runtime: {
        root: options.stage,
        instanceIds: INSTANCE_IDS,
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
