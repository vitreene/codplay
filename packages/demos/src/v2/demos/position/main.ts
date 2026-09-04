import type { SceneDoc } from 'codplay'
import { POSITION_SCENE_ID, POSITION_STORY_ID } from './constants'
import { createPositionStory } from './story'

/** Creates the complete position scene from its single assembled story. */
export function createPositionScene(): SceneDoc {
  return {
    id: POSITION_SCENE_ID,
    stories: {
      [POSITION_STORY_ID]: createPositionStory(),
    },
  }
}

/** Returns the position scene consumed by the shared V2 demo layout. */
export function createScene(): SceneDoc {
  return createPositionScene()
}
