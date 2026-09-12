import type { SceneDoc } from 'codplay/scene/types'
import { sceneA } from '../../demo1/scenes/scene-a'

/** Reuses scene A for demo 3 with a twenty-second sequence duration. */
export const sceneAForDemo3: SceneDoc<string> = {
  ...sceneA,
  id: 'sighty-demo3-scene-a',
  eventimes: [{ name: 'sequence:end', startAt: 20_000 }],
}
