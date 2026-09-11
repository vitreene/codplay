import type { SceneDoc } from 'codplay/scene/types'
import { layoutScene } from './scenes/layout-scene'
import { sceneA } from './scenes/scene-a'
import { sceneB } from './scenes/scene-b'
import type { SightySceneKey } from './sighty-file'

/** Provides the three authored documents named by the declarative demo file. */
export const sceneDocuments: Readonly<Record<SightySceneKey, SceneDoc<string>>> = {
  layout: layoutScene,
  sceneA,
  sceneB,
}
