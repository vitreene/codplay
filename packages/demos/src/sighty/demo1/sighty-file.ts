export type SightySceneKey = 'layout' | 'sceneA' | 'sceneB'
export type SightySlotName = 'A' | 'B'
export type SightyChildSceneKey = Exclude<SightySceneKey, 'layout'>

type SightyView = Readonly<{
  view: Readonly<{
    scene: SightySceneKey
    slots: Readonly<Record<SightySlotName, readonly SightySlotPlacement[]>>
  }>
}>

type SightySlotPlacement = Readonly<{
  view: Readonly<{ scene: SightyChildSceneKey }>
}>

/** Minimal declarative composition file consumed by the Sighty demo runner. */
export type SightyFile = Readonly<{
  format: 'sighty'
  version: 1
  id: string
  resources: Readonly<{
    scenes: Readonly<Record<SightySceneKey, string>>
  }>
  views: readonly SightyView[]
}>

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
