import type { SceneDoc } from 'codplay/scene/types'
import { layoutScene } from './scenes/layout-scene'
import { sceneAForDemo3 } from './scenes/scene-a'
import { telcoScene } from './scenes/telco-scene'
import { sightyFile, type SightyDemo3SceneKey } from './sighty-file'

/** Provides the layout, reusable scene A and command scene documents. */
export const sceneDocuments: Readonly<Record<SightyDemo3SceneKey, SceneDoc<string>>> = {
  layout: layoutScene,
  sceneA: sceneAForDemo3,
  telco: telcoScene,
}

/** Groups the demo 3 resources for the single Sighty facade. */
export const sightyScenario = { file: sightyFile, scenes: sceneDocuments } as const
