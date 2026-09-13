import type { SceneDoc } from 'codplay/scene/types'
import { sceneA } from '../demo1/scenes/scene-a'
import { sceneB } from '../demo1/scenes/scene-b'
import { sightyFile, type SightyDemo4SceneKey } from './sighty-file'
import { layoutScene } from './scenes/layout-scene'
import { menuScene } from './scenes/menu-scene'
import { sceneC } from './scenes/scene-c'
import { telcoScene } from './scenes/telco-scene'

/** Provides the layout, menu, content scenes and navigation telco documents. */
export const sceneDocuments: Readonly<Record<SightyDemo4SceneKey, SceneDoc<string>>> = {
  'scene-layout': layoutScene,
  'scene-menu': menuScene,
  'scene-a': sceneA,
  'scene-b': sceneB,
  'scene-c': sceneC,
  'scene-telco': telcoScene,
}

/** Groups all demo 4 resources under one Sighty scenario surface. */
export const sightyScenario = { file: sightyFile, scenes: sceneDocuments } as const
