import type { SceneDoc, StoryDoc } from 'codplay'
import type { V2DemoEventInjection } from '../../layout/types'
import { CAROUSEL_EVENTS_BY_STORY_ID, createCarouselPersos } from './carousel'
import {
  POSITION_MAIN_STORY_ID,
  POSITION_SCENE_ID,
  POSITION_STORY_FIVE_ID,
  POSITION_STORY_FOUR_ID,
  POSITION_STORY_SIX_ID,
  POSITION_STORY_ONE_ID,
  POSITION_STORY_THREE_ID,
  POSITION_STORY_TWO_ID,
  POSITION_VIEW_SIX_INITIALIZE_EVENT,
} from './constants'
import { createStoryFive } from './story-five'
import { createStoryFour } from './story-four'
import { POSITION_STORY_ONE } from './story-one'
import { createStorySix } from './story-six'
import { POSITION_STORY_THREE } from './story-three'
import { POSITION_STORY_TWO } from './story-two'
import { createPositionSceneListenRules, createPositionSceneStraps } from './straps'

/** Activates and starts the first visible story through its declared listen rule. */
export const POSITION_INITIAL_EVENTS: readonly V2DemoEventInjection[] = [{
  eventime: {
    name: CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_SIX_ID].enter,
    visibility: 'story',
  },
  target: { scope: 'story', storyId: POSITION_STORY_SIX_ID },
}, {
  eventime: {
    name: POSITION_VIEW_SIX_INITIALIZE_EVENT,
    visibility: 'story',
  },
  target: { scope: 'story', storyId: POSITION_STORY_SIX_ID },
}]

/** The main story owns only the shared carousel shell and its keyboard source. */
const POSITION_MAIN_STORY: StoryDoc = {
  id: POSITION_MAIN_STORY_ID,
  initial: { move: '@root' },
  persos: createCarouselPersos(),
}

/** Builds the complete scene: the shell plus its six independent stories. */
export function createPositionScene(): SceneDoc {
  return {
    id: POSITION_SCENE_ID,
    state: {
      currentView: 0,
      storyPaused: false,
    },
    straps: createPositionSceneStraps(),
    listen: createPositionSceneListenRules(),
    stories: {
      [POSITION_MAIN_STORY_ID]: POSITION_MAIN_STORY,
      [POSITION_STORY_ONE_ID]: POSITION_STORY_ONE,
      [POSITION_STORY_TWO_ID]: POSITION_STORY_TWO,
      [POSITION_STORY_THREE_ID]: POSITION_STORY_THREE,
      [POSITION_STORY_FOUR_ID]: createStoryFour(),
      [POSITION_STORY_FIVE_ID]: createStoryFive(),
      [POSITION_STORY_SIX_ID]: createStorySix(),
    },
  }
}

/** Returns the position scene consumed by the shared V2 demo layout. */
export function createScene(): SceneDoc {
  return createPositionScene()
}
