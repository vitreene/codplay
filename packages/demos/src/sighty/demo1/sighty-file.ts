import type { SightyFile as SightyFileDefinition } from '@codplay/sighty'

export type SightySceneKey = 'layout' | 'sceneA' | 'sceneB'
export type SightySlotName = 'A' | 'B'

/** Minimal declarative composition file consumed by the Sighty demo runner. */
export type SightyFile = SightyFileDefinition<SightySceneKey, SightySlotName>

/** Declarative A/B composition; scene documents remain in separate files. */
export const sightyFile: SightyFile = {
  format: 'sighty',
  version: 1,
  id: 'sighty-foreign-scenes',
  resources: {
    scenes: {
      layout: './scenes/layout-scene',
      sceneA: './scenes/scene-a',
      sceneB: './scenes/scene-b',
    },
  },
  views: [
    {
      view: {
        scene: 'layout',
        slots: {
          A: [{ view: { scene: 'sceneA' } }],
          B: [{ view: { scene: 'sceneB' } }],
        },
      },
    },
  ],
}
