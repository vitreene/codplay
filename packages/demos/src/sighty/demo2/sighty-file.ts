import type { SightyFile as SightyFileDefinition } from '@codplay/sighty'

export type SightyDemo2SceneKey = 'layout' | 'sceneB' | 'telco'
export type SightyDemo2SlotName = 'sceneB' | 'telco'
export type SightyDemo2ChildSceneKey = Exclude<SightyDemo2SceneKey, 'layout'>

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
