import type { SceneDoc } from 'codplay/scene/types'
import { sceneB } from '../demo1/scenes/scene-b'
import { layoutScene } from './scenes/layout-scene'
import { telcoScene } from './scenes/telco-scene'
import { sightyFile, type SightyDemo2SceneKey } from './sighty-file'

/** Provides the layout, reused scene B and command scene named by demo 2. */
export const sceneDocuments: Readonly<Record<SightyDemo2SceneKey, SceneDoc<string>>> = {
  layout: layoutScene,
  sceneB,
  telco: telcoScene,
}

/** Groups the demo 2 scenario resources for the Sighty facade. */
export const sightyScenario = { file: sightyFile, scenes: sceneDocuments } as const
