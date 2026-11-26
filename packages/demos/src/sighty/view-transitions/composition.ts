import { Sighty } from '@codplay/sighty'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'
import { SightySceneTelcoController } from '../demo4/telco-controller'
import { sightyViewTransitionScenario } from './scenario'
import { connectViewTransitions } from './view-transitions'
import type { SightyViewTransitionSceneKey, SightyViewTransitionSlotName } from './scenario'

type ViewTransitionSighty = Sighty<SightyViewTransitionSceneKey, SightyViewTransitionSlotName>
type ViewTransitionRuntime = ViewTransitionSighty['runtime']

const INSTANCE_IDS: Readonly<Record<SightyViewTransitionSceneKey, string>> = {
  'scene-layout': 'sighty-vt-layout-1',
  'scene-menu': 'sighty-vt-menu-1',
  'scene-intro': 'sighty-vt-intro-1',
  'scene-a': 'sighty-vt-scene-a-1',
  'scene-b': 'sighty-vt-scene-b-1',
  'scene-c': 'sighty-vt-scene-c-1',
  'scene-telco': 'sighty-vt-telco-1',
}

/** Owns the isolated Sighty copy and connects browser transitions to its page slot. */
export class ViewTransitionComposition {
  private readonly sighty: ViewTransitionSighty
  private readonly stage: HTMLElement
  private readonly onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
  private readonly telcoController: SightySceneTelcoController<SightyViewTransitionSceneKey, SightyViewTransitionSlotName>
  private removeViewTransitions: () => void = () => {}
  readonly runtime: ViewTransitionRuntime
  private destroyed = false

  /** Creates a separate Sighty runtime using the copied menu/page scenario. */
  constructor(stage: HTMLElement, onLog: (message: string, level?: 'info' | 'warn' | 'error') => void) {
    this.stage = stage
    this.onLog = onLog
    this.sighty = new Sighty({
      scenario: sightyViewTransitionScenario,
      runtime: {
        root: stage,
        instanceIds: INSTANCE_IDS,
        styles: [{ slot: 'sighty-view-transition-scene-root', cssText: SIGHTY_SCENE_ROOT_STYLE_SHEET }],
        codplay: { engine: { idle: false }, pauseOnDocumentHidden: false },
      },
    })
    this.runtime = this.sighty.runtime
    this.telcoController = new SightySceneTelcoController({
      runtime: this.runtime,
      sceneSlot: 'slot-scene',
      telcoSlot: 'slot-telco',
      telcoSceneKey: 'scene-telco',
      contentSceneKeys: ['scene-a', 'scene-b', 'scene-c'],
      onLog,
    })
  }

  /** Initializes the copied scenario and observes its selected page. */
  async initialize(): Promise<void> {
    await this.runtime.initialize()
    await this.runtime.play('scene-layout')
    const pageSlot = this.stage.querySelector<HTMLElement>('.sighty-vt-layout__page-slot')
    if (pageSlot === null) throw new Error('Le slot de page Sighty est introuvable.')
    this.removeViewTransitions = connectViewTransitions(this.runtime, pageSlot, this.onLog)
    await this.runtime.play('scene-menu')
    await this.runtime.play('scene-intro')
    await this.telcoController.connect()
    this.onLog('POC initialisée : menu → pages A/B/C')
  }

  /** Removes observers and destroys the isolated runtime. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.removeViewTransitions()
    this.telcoController.destroy()
    this.runtime.destroy()
  }
}
