import { layoutScene } from './scenes/layout-scene'
import { sceneA } from './scenes/scene-a'
import { sceneB } from './scenes/scene-b'
import type { SightyScenarioDefinition } from '@codplay/sighty'

export type SightySceneKey = 'layout' | 'sceneA' | 'sceneB'
export type SightySlotName = 'A' | 'B'

/** Names the scene and slot keys used by this scenario. */
/** Declarative A/B composition; scene documents remain in separate files. */
export const sightyScenario: SightyScenarioDefinition<SightySceneKey, SightySlotName> = {
  format: 'sighty',
  version: 1,
  id: 'sighty-foreign-scenes',
  views: [
    {
      id: 'layout-view',
      view: {
        scene: 'layout',
        slots: {
          A: [{ id: 'scene-a', view: { scene: 'sceneA' } }],
          B: [{ id: 'scene-b', view: { scene: 'sceneB' } }],
        },
      },
    },
  ],
  scenes: { layout: layoutScene, sceneA, sceneB },
}
