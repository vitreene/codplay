import type { StoryDoc } from 'codplay/scene/types'
import { createCarouselPersos } from './carousel'
import {
  FIRST_VIEW_MOVE_OFFSET_MS,
  POSITION_STORY_ID,
  POSITION_VIEW_ONE_ITEM_MOVE_EVENT,
} from './constants'
import { createStoryFive } from './story-five'
import { createStoryFour } from './story-four'
import { createStoryOne } from './story-one'
import { createStorySix } from './story-six'
import { createStoryThree } from './story-three'
import { createStoryTwo } from './story-two'
import { createPositionListenRules, createPositionStraps } from './straps'
import type { PositionState } from './types'

const INITIAL_STATE: PositionState = {
  currentView: 0,
  storyPaused: false,
  pathControlX: 0.5,
  pathControlY: -0.48,
  liveSourceX: 0,
  liveSourceY: 0,
  liveTargetX: 0,
  liveTargetY: 0,
}

/** Assembles the one story while keeping each view implementation in its own module. */
export function createPositionStory(): StoryDoc {
  return {
    id: POSITION_STORY_ID,
    initial: { move: '@root' },
    eventimes: [{
      name: POSITION_VIEW_ONE_ITEM_MOVE_EVENT,
      startAt: FIRST_VIEW_MOVE_OFFSET_MS,
    }],
    state: INITIAL_STATE,
    straps: createPositionStraps(),
    listen: createPositionListenRules(),
    persos: [
      ...createCarouselPersos(),
      ...createStoryOne(),
      ...createStoryTwo(),
      ...createStoryThree(),
      ...createStoryFour(),
      ...createStoryFive(),
      ...createStorySix(),
    ],
  }
}
