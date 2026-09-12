import type { SightyFile as SightyFileDefinition } from '@codplay/sighty'

export type SightyDemo3SceneKey = 'layout' | 'sceneA' | 'telco'
export type SightyDemo3SlotName = 'sceneA' | 'telco'
export type SightyDemo3ChildSceneKey = Exclude<SightyDemo3SceneKey, 'layout'>

/** Declarative composition file for the demo 3 data-injection scenario. */
export type SightyDemo3File = SightyFileDefinition<SightyDemo3SceneKey, SightyDemo3SlotName>

/** Places the reusable scene A above the command scene. */
export const sightyFile: SightyDemo3File = {
  format: 'sighty',
  version: 1,
  id: 'sighty-data-injection',
  resources: {
    scenes: {
      layout: './scenes/layout-scene',
      sceneA: './scenes/scene-a',
      telco: './scenes/telco-scene',
    },
  },
  views: [
    {
      view: {
        scene: 'layout',
        slots: {
          sceneA: [{ view: { scene: 'sceneA' } }],
          telco: [{ view: { scene: 'telco' } }],
        },
      },
    },
  ],
}
