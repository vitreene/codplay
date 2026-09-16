import type { SightyFile as SightyFileDefinition } from '@codplay/sighty'
import { TELCO_INTENTS } from './messages'

export type SightyDemo2SceneKey = 'layout' | 'sceneB' | 'telco'
export type SightyDemo2SlotName = 'sceneB' | 'telco'

/** Declarative composition file consumed by the Sighty scene-to-scene demo. */
export type SightyDemo2File = SightyFileDefinition<SightyDemo2SceneKey, SightyDemo2SlotName>

/** Places the reused scene B above its CodPlay command scene in one layout. */
export const sightyFile: SightyDemo2File = {
  format: 'sighty',
  version: 1,
  id: 'sighty-scene-telco',
  resources: {
    scenes: {
      layout: './scenes/layout-scene',
      sceneB: '../demo1/scenes/scene-b',
      telco: './scenes/telco-scene',
    },
  },
  views: [
    {
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
          sceneB: [{ view: { scene: 'sceneB' } }],
          telco: [{ view: { scene: 'telco' } }],
        },
      },
    },
  ],
}
