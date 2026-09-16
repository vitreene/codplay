import { Sighty } from '@codplay/sighty'
import { sightyScenario } from './scene-resources'
import type { SightyDemo2SceneKey, SightyDemo2SlotName } from './sighty-file'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'

type SightyDemo2Options = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

type Demo2Sighty = Sighty<SightyDemo2SceneKey, SightyDemo2SlotName>
type Demo2Runtime = Demo2Sighty['runtime']

const INSTANCE_IDS: Readonly<Record<SightyDemo2SceneKey, string>> = {
  layout: 'demo2-layout-1',
  sceneB: 'demo2-scene-b-1',
  telco: 'demo2-telco-1',
}

/** Owns only the demo 2 message scenario around the generic Sighty runtime. */
export class SightyComposition {
  private readonly sighty: Demo2Sighty
  private readonly onLog: SightyDemo2Options['onLog']
  readonly runtime: Demo2Runtime
  private eventCleanup: (() => void) | null = null
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
    this.connectEventLog()
    await this.startVisibleScenes()
    this.onLog('Démo 2 initialisée : telco → Sighty → sceneB')
  }

  /** Logs public controller events while Sighty performs the declared coupling. */
  private connectEventLog(): void {
    this.eventCleanup = this.sighty.runtime.events.onEvent((event) => {
      if (event.sourceSceneKey === 'telco') this.onLog(`event ${event.name} → Sighty`)
    })
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
    this.eventCleanup?.()
    this.eventCleanup = null
    this.sighty.runtime.destroy()
  }
}
