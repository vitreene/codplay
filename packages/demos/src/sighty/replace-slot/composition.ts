import { Sighty } from '@codplay/sighty'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'
import { SightySceneTelcoController } from '../demo4/telco-controller'
import {
  createReplaceSlotScenario,
  REPLACE_SLOT_CONTENT_SCENE_KEYS,
  type ReplaceSlotName,
  type ReplaceSlotSceneKey,
} from './scenario'

type ReplaceSlotSighty = Sighty<ReplaceSlotSceneKey, ReplaceSlotName>

const INSTANCE_IDS: Readonly<Record<ReplaceSlotSceneKey, string>> = {
  layout: 'replace-slot-layout-instance',
  'scene-telco': 'replace-slot-telco-instance',
  'page-a': 'replace-slot-page-a-instance',
  'page-b': 'replace-slot-page-b-instance',
  'page-c': 'replace-slot-page-c-instance',
  'page-d': 'replace-slot-page-d-instance',
  'page-e': 'replace-slot-page-e-instance',
  'page-f': 'replace-slot-page-f-instance',
  'page-g': 'replace-slot-page-g-instance',
}

/** Creates the Sighty sequence with Demo 4's existing scene telco and global remote. */
export function createReplaceSlotComposition(options: Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>): Readonly<{
  runtime: ReplaceSlotSighty['runtime']
  initialize: () => Promise<void>
  destroy: () => void
}> {
  const sighty = new Sighty({
    scenario: createReplaceSlotScenario(),
    runtime: {
      root: options.stage,
      instanceIds: INSTANCE_IDS,
      styles: [{
        slot: 'sighty-replace-slot-scene-root',
        cssText: SIGHTY_SCENE_ROOT_STYLE_SHEET,
      }],
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
    contentSceneKeys: REPLACE_SLOT_CONTENT_SCENE_KEYS,
    onLog: options.onLog,
  })

  return {
    runtime: sighty.runtime,
    initialize: async () => {
      await sighty.runtime.initialize()
      await sighty.runtime.play('layout')
      await telcoController.connect()
      options.onLog('Séquence replace-slot prête : télécommande Demo 4 et sept profils.')
    },
    destroy: () => {
      telcoController.destroy()
      sighty.runtime.destroy()
    },
  }
}
