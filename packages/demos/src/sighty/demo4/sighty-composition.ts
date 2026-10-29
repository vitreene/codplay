import { Sighty } from '@codplay/sighty'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'
import { DEMO4_LAYOUT_CAROUSEL } from './carousel'
import { sightyScenario } from './scenario'
import { SightySceneTelcoController } from './telco-controller'
import type {
  SightyDemo4SceneKey,
  SightyDemo4SlotName,
} from './scenario'

type SightyDemo4Options = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

type Demo4Sighty = Sighty<SightyDemo4SceneKey, SightyDemo4SlotName>
type Demo4Runtime = Demo4Sighty['runtime']

const CHAPTER_SCENE_SLOT = 'slot-scene' as const
const CONTENT_SCENE_KEYS = ['scene-a', 'scene-b', 'scene-c'] as const

const INSTANCE_IDS: Readonly<Record<SightyDemo4SceneKey, string>> = {
  'scene-layout': 'demo4-layout-1',
  'scene-menu': 'demo4-menu-1',
  'scene-a': 'demo4-scene-a-1',
  'scene-b': 'demo4-scene-b-1',
  'scene-c': 'demo4-scene-c-1',
  'scene-telco': 'demo4-telco-1',
}

/** Owns Demo 4's scenario and connects its shared scene telco to the active page. */
export class SightyComposition {
  private readonly sighty: Demo4Sighty
  private readonly onLog: SightyDemo4Options['onLog']
  private readonly telcoController: SightySceneTelcoController<SightyDemo4SceneKey, SightyDemo4SlotName>
  readonly runtime: Demo4Runtime
  private destroyed = false

  /** Creates Demo 4's Sighty facade and its reusable scene-telco controller. */
  constructor(options: SightyDemo4Options) {
    this.onLog = options.onLog
    this.sighty = new Sighty({
      scenario: sightyScenario,
      runtime: {
        root: options.stage,
        instanceIds: INSTANCE_IDS,
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
      },
    })
    this.runtime = this.sighty.runtime
    this.telcoController = new SightySceneTelcoController({
      runtime: this.runtime,
      sceneSlot: CHAPTER_SCENE_SLOT,
      telcoSlot: 'slot-telco',
      telcoSceneKey: 'scene-telco',
      contentSceneKeys: CONTENT_SCENE_KEYS,
      onLog: this.onLog,
    })
  }

  /** Initializes Demo 4 and subscribes its telco to the selected content scene. */
  async initialize(): Promise<void> {
    await this.runtime.initialize()
    await this.runtime.play('scene-layout')
    await this.runtime.play('scene-menu')
    await this.telcoController.connect()
    this.onLog('Démo 4 initialisée : menu → scènes A/B/C')
  }

  /** Removes the telco observer and releases every Sighty occurrence. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.telcoController.destroy()
    this.sighty.runtime.destroy()
  }
}
