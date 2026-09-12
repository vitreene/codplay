import { layoutScene } from './scenes/layout-scene'
import { sceneA } from './scenes/scene-a'
import { sceneB } from './scenes/scene-b'
import { sightyFile } from './sighty-file'

const scenes = {
  layout: layoutScene,
  sceneA,
  sceneB,
} as const

/** Groups the demo 1 scenario resources for the Sighty facade. */
export const sightyScenario = { file: sightyFile, scenes } as const
