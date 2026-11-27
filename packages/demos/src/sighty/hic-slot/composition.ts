import { Sighty } from '@codplay/sighty'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'
import { SightySceneTelcoController } from '../demo4/telco-controller'
import {
  createHicSlotScenario,
  HIC_SLOT_CONTENT_SCENE_KEYS,
  type HicSlotName,
  type HicSlotSceneKey,
} from './scenario'

type HicSlotSighty = Sighty<HicSlotSceneKey, HicSlotName>

const INSTANCE_IDS: Readonly<Record<HicSlotSceneKey, string>> = {
  layout: 'hic-slot-layout-instance',
  'scene-telco': 'hic-slot-telco-instance',
  'hic-burn': 'hic-slot-burn-instance',
  'hic-ripple': 'hic-slot-ripple-instance',
  'hic-pixelate': 'hic-slot-pixelate-instance',
  'hic-swirl': 'hic-slot-swirl-instance',
  'hic-shatter': 'hic-slot-shatter-instance',
  'hic-fold': 'hic-slot-fold-instance',
}

/** Creates the Sighty sequence with Demo 4's scene telco and the shared remote. */
export function createHicSlotComposition(options: Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>): Readonly<{
  runtime: HicSlotSighty['runtime']
  initialize: () => Promise<void>
  destroy: () => void
}> {
  const sighty = new Sighty({
    scenario: createHicSlotScenario(),
    runtime: {
      root: options.stage,
      instanceIds: INSTANCE_IDS,
      styles: [{ slot: 'sighty-hic-slot-scene-root', cssText: SIGHTY_SCENE_ROOT_STYLE_SHEET }],
      codplay: {
        pauseOnDocumentHidden: false,
        engine: {
          idle: false,
          diagnosticOutput: (diagnostic) => {
            options.onLog(
              `${diagnostic.code}: ${diagnostic.message}`,
              diagnostic.severity === 'warning' ? 'warn' : 'error',
            )
          },
        },
      },
    },
  })
  const telcoController = new SightySceneTelcoController({
    runtime: sighty.runtime,
    sceneSlot: 'slot-scene',
    telcoSlot: 'slot-telco',
    telcoSceneKey: 'scene-telco',
    contentSceneKeys: HIC_SLOT_CONTENT_SCENE_KEYS,
    onLog: options.onLog,
  })

  return {
    runtime: sighty.runtime,
    initialize: async () => {
      await sighty.runtime.initialize()
      await sighty.runtime.play('layout')
      await telcoController.connect()
      options.onLog('Séquence HTML-in-Canvas prête : une scène par effet, télécommande Demo 4.')
    },
    destroy: () => {
      telcoController.destroy()
      sighty.runtime.destroy()
    },
  }
}
