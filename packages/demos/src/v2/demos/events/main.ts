import type { SceneDoc } from 'codplay/scene/types'
import type { V2DemoEventInjection } from '../../layout/types'
import {
  EVENTS_BARRIER_STORY_ID,
  EVENTS_BARRIER_TARGET,
  EVENTS_FRAME_EVENTS,
  EVENTS_FRAME_ONE_ID,
  EVENTS_FRAME_STORY_IDS,
  EVENTS_FRAME_TARGET,
  EVENTS_KEYBOARD_NAVIGATION_EVENT,
  EVENTS_KEYBOARD_TARGET,
  EVENTS_MAIN_STORY_ID,
  EVENTS_SCENE_ID,
  EVENTS_SIGNAL_STORY_ID,
  EVENTS_SIGNAL_TARGET,
} from './constants'
import { createBarrierStory, createSignalStory } from './animation-stories'
import { createEventsFrameStories } from './frame-story'
import { createEventsRememberStraps, createEventsSceneListenRules, createEventsSceneStraps } from './scene-straps'

type EventsPerso = SceneDoc['stories']['main']['persos'][number]

/** Activates the first frame through the same host-owned injection as position. */
export const EVENTS_INITIAL_EVENTS: readonly V2DemoEventInjection[] = [{
  eventime: {
    name: EVENTS_FRAME_EVENTS[EVENTS_FRAME_ONE_ID].enter,
    visibility: 'story',
  },
  target: { scope: 'story', storyId: EVENTS_FRAME_ONE_ID },
}]

/** Creates the new events scene without importing any position demo module. */
export function createScene(): SceneDoc {
  const frameStories = createEventsFrameStories()
  return {
    id: EVENTS_SCENE_ID,
    state: { currentView: 0 },
    straps: {
      ...createEventsSceneStraps(),
      ...createEventsRememberStraps(),
    },
    listen: createEventsSceneListenRules(),
    stories: {
      [EVENTS_MAIN_STORY_ID]: {
        id: EVENTS_MAIN_STORY_ID,
        initial: { move: '@root' },
        persos: [createEventsStagePerso(), createEventsKeyboardPerso()],
      },
      [EVENTS_BARRIER_STORY_ID]: createBarrierStory(),
      [EVENTS_SIGNAL_STORY_ID]: createSignalStory(),
      [EVENTS_FRAME_STORY_IDS[0]]: frameStories[EVENTS_FRAME_STORY_IDS[0]],
      [EVENTS_FRAME_STORY_IDS[1]]: frameStories[EVENTS_FRAME_STORY_IDS[1]],
      [EVENTS_FRAME_STORY_IDS[2]]: frameStories[EVENTS_FRAME_STORY_IDS[2]],
      [EVENTS_FRAME_STORY_IDS[3]]: frameStories[EVENTS_FRAME_STORY_IDS[3]],
    },
  }
}

/** Creates the complete stage and its named mounting targets. */
function createEventsStagePerso(): EventsPerso {
  return {
    id: 'events-stage',
    type: 'layout',
    initial: {
      move: '@root',
      className: 'events-stage',
      markup: `
        <main id="events-stage-markup" class="events-stage__surface">
          <div id="events-frame-mount" class="events-stage__frame-mount" data-part="${EVENTS_FRAME_TARGET}"></div>
          <div id="events-barrier-mount" class="events-stage__barrier-mount" data-part="${EVENTS_BARRIER_TARGET}"></div>
          <div id="events-signal-mount" class="events-stage__signal-mount" data-part="${EVENTS_SIGNAL_TARGET}"></div>
          <div id="events-keyboard-mount" class="events-stage__keyboard-mount" data-part="${EVENTS_KEYBOARD_TARGET}"></div>
        </main>
      `,
    },
    actions: {},
  }
}

/** Creates the global keyboard source consumed by the scene navigation strap. */
function createEventsKeyboardPerso(): EventsPerso {
  return {
    id: 'events-keyboard-manager',
    type: 'tag',
    initial: {
      tag: 'span',
      content: '',
      className: 'events-keyboard-manager',
      attr: { 'aria-hidden': 'true' },
      move: { target: EVENTS_KEYBOARD_TARGET },
    },
    emit: {
      keydown: [
        {
          keyCode: 'ArrowLeft',
          preventDefault: true,
          event: { name: EVENTS_KEYBOARD_NAVIGATION_EVENT, data: { direction: 'previous' } },
        },
        {
          keyCode: 'ArrowRight',
          preventDefault: true,
          event: { name: EVENTS_KEYBOARD_NAVIGATION_EVENT, data: { direction: 'next' } },
        },
        {
          keyCode: 'Enter',
          preventDefault: true,
          event: { name: EVENTS_KEYBOARD_NAVIGATION_EVENT, data: { direction: 'next' } },
        },
      ],
    },
    actions: {},
  }
}
