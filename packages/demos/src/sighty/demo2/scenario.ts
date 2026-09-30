import { sceneB } from '../demo1/scenes/scene-b'
import { layoutScene } from './scenes/layout-scene'
import { telcoScene } from './scenes/telco-scene'
import type { SightyScenarioDefinition } from '@codplay/sighty'
import { TELCO_INTENTS } from './messages'

export type SightyDemo2SceneKey = 'layout' | 'sceneB' | 'telco'
export type SightyDemo2SlotName = 'sceneB' | 'telco'

/** Names the scene and slot keys used by this scenario. */
/** Places the reused scene B above its CodPlay command scene in one layout. */
export const sightyScenario: SightyScenarioDefinition<SightyDemo2SceneKey, SightyDemo2SlotName> = {
  format: 'sighty',
  version: 1,
  id: 'sighty-scene-telco',
  views: [
    {
      id: 'layout-view',
      coupling: {
        couplingId: 'sighty-demo2-telco-sceneB',
        controllerSlot: 'telco',
        controlledSlot: 'sceneB',
        commands: {
          [TELCO_INTENTS.play]: 'play',
          [TELCO_INTENTS.pause]: 'pause',
          [TELCO_INTENTS.replay]: ['rewind', 'play'],
        },
      },
      view: {
        scene: 'layout',
        slots: {
          sceneB: [{ id: 'scene-b', view: { scene: 'sceneB' } }],
          telco: [{ id: 'telco', view: { scene: 'telco' } }],
        },
      },
    },
  ],
  scenes: { layout: layoutScene, sceneB, telco: telcoScene },
}
