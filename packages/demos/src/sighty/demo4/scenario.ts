import { sceneA } from '../demo1/scenes/scene-a'
import { sceneB } from '../demo1/scenes/scene-b'
import { DEMO4_LAYOUT_CAROUSEL_EVENTS, DEMO4_LAYOUT_ITEM_IDS } from './carousel'
import { layoutScene } from './scenes/layout-scene'
import { menuScene } from './scenes/menu-scene'
import { sceneC } from './scenes/scene-c'
import { telcoScene } from './scenes/telco-scene'
import type { SightyActionContext, SightyScenarioDefinition } from "@codplay/sighty";
import {
  DEMO4_MENU_INTENTS,
  DEMO4_NAVIGATION_INTENTS,
  DEMO4_PLAYBACK_INTENTS,
  DEMO4_PLAYBACK_STATE_EVENTS,
  DEMO4_PROGRESS_INTENTS,
  DEMO4_SCENARIO_EVENTS,
  DEMO4_TELCO_STATE_EVENTS,
} from "./messages";

export type SightyDemo4SceneKey =
  | "scene-layout"
  | "scene-menu"
  | "scene-a"
  | "scene-b"
  | "scene-c"
  | "scene-telco";
export type SightyDemo4SlotName = "slot-menu" | "slot-scene" | "slot-telco";

/** Names the scene and slot keys used by this scenario. */

const MENU_VIEW_PATH = "view-main/view-summary/slot-menu/view-summary-menu";
const RETURN_TO_MENU_ACTION = {
  action: "action:demo4:return-menu",
  go: { path: MENU_VIEW_PATH },
} as const;
const CHAPTER_NAVIGATION_ACTIONS = {
  [DEMO4_NAVIGATION_INTENTS.previous]: {
    go: { direction: "previous" },
  },
  [DEMO4_NAVIGATION_INTENTS.next]: {
    go: { direction: "next" },
  },
} as const;
const CHAPTER_BOUNDARY_ACTIONS = {
  [DEMO4_NAVIGATION_INTENTS.previous]: RETURN_TO_MENU_ACTION,
  [DEMO4_NAVIGATION_INTENTS.next]: RETURN_TO_MENU_ACTION,
} as const;
const CHAPTER_TELCO_ACTIONS = {
  [DEMO4_TELCO_STATE_EVENTS.on]: { action: "action:demo4:project-telco-event" },
  [DEMO4_TELCO_STATE_EVENTS.off]: { action: "action:demo4:project-telco-event" },
  [DEMO4_PLAYBACK_STATE_EVENTS.playing]: { action: "action:demo4:project-telco-event" },
  [DEMO4_PLAYBACK_STATE_EVENTS.paused]: { action: "action:demo4:project-telco-event" },
} as const;

/** Describes the recursive menu/chapter composition consumed by Sighty. */
export const sightyScenario: SightyScenarioDefinition<SightyDemo4SceneKey, SightyDemo4SlotName> = {
  // Demo 4 is a replay fixture: every newly shown scene starts from a fresh session.
  showMode: "reset",
  views: {
    start: "view-main",
    views: {
      "view-main": {
        actions: {
          [DEMO4_NAVIGATION_INTENTS.previous]: { go: { direction: "previous" } },
          [DEMO4_NAVIGATION_INTENTS.next]: { go: { direction: "next" } },
        },
        view: {
          scene: "scene-layout",
          views: {
            start: "view-summary",
            views: {
              "view-summary": {
                view: {
                  slots: {
                    "slot-menu": {
                      start: "view-summary-menu",
                      views: {
                        "view-summary-menu": { view: { scene: "scene-menu" } },
                      },
                    },
                  },
                },
                actions: {
                  [DEMO4_MENU_INTENTS.sceneA]: {
                    action: "action:demo4:enter-chapter",
                    go: { path: "view-main/view-chapter/slot-scene/view-page-a" },
                  },
                  [DEMO4_MENU_INTENTS.sceneB]: {
                    action: "action:demo4:enter-chapter",
                    go: { path: "view-main/view-chapter/slot-scene/view-page-b" },
                  },
                  [DEMO4_MENU_INTENTS.sceneC]: {
                    action: "action:demo4:enter-chapter",
                    go: { path: "view-main/view-chapter/slot-scene/view-page-c" },
                  },
                },
              },
              "view-chapter": {
                coupling: {
                  couplingId: "sighty-demo4-scene-telco",
                  controllerSlot: "slot-telco",
                  controlledSlot: "slot-scene",
                  commands: {
                    [DEMO4_NAVIGATION_INTENTS.resetCurrent]: "reset",
                    [DEMO4_PLAYBACK_INTENTS.toggle]: "togglePlay",
                    [DEMO4_PLAYBACK_INTENTS.rewind]: "rewind",
                    [DEMO4_PROGRESS_INTENTS.seek]: ["pause", "seek"],
                  },
                },
                actions: {
                  ...CHAPTER_BOUNDARY_ACTIONS,
                  ...CHAPTER_TELCO_ACTIONS,
                },
                view: {
                  slots: {
                    "slot-scene": [
                      {
                        id: "view-page-a",
                        actions: CHAPTER_NAVIGATION_ACTIONS,
                        view: { scene: "scene-a" },
                      },
                      {
                        id: "view-page-b",
                        actions: CHAPTER_NAVIGATION_ACTIONS,
                        view: { scene: "scene-b" },
                      },
                      {
                        id: "view-page-c",
                        actions: {
                          ...CHAPTER_NAVIGATION_ACTIONS,
                          [DEMO4_SCENARIO_EVENTS.sequenceEnd]: {
                            action: "action:demo4:return-menu",
                            go: { path: MENU_VIEW_PATH },
                          },
                        },
                        view: { scene: "scene-c" },
                      },
                    ],
                    "slot-telco": {
                      start: "view-chapter-telco",
                      views: {
                        "view-chapter-telco": { view: { scene: "scene-telco" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  scenes: {
    'scene-layout': layoutScene,
    'scene-menu': menuScene,
    'scene-a': sceneA,
    'scene-b': sceneB,
    'scene-c': sceneC,
    'scene-telco': telcoScene,
  },
  actions: {
    'action:demo4:enter-chapter': createLayoutCarouselAction('menu', 'chapter'),
    'action:demo4:return-menu': createLayoutCarouselAction('chapter', 'menu'),
    'action:demo4:project-telco-event': projectTelcoEvent,
  },
};

const LAYOUT_SCENE_KEY = 'scene-layout' as const
const LAYOUT_STORY_ID = 'main' as const
const TELCO_SCENE_KEY = 'scene-telco' as const
const TELCO_STORY_ID = 'main' as const

/** Creates one action that moves the layout carousel between its two layout persos. */
function createLayoutCarouselAction(
  leavingItemId: keyof typeof DEMO4_LAYOUT_ITEM_IDS,
  enteringItemId: keyof typeof DEMO4_LAYOUT_ITEM_IDS,
) {
  return async ({ send }: SightyActionContext<SightyDemo4SceneKey>) => {
    await send(
      LAYOUT_SCENE_KEY,
      { name: DEMO4_LAYOUT_CAROUSEL_EVENTS[DEMO4_LAYOUT_ITEM_IDS[leavingItemId]].leave },
      { scope: 'story', storyId: LAYOUT_STORY_ID },
    )
    await send(
      LAYOUT_SCENE_KEY,
      { name: DEMO4_LAYOUT_CAROUSEL_EVENTS[DEMO4_LAYOUT_ITEM_IDS[enteringItemId]].enter },
      { scope: 'story', storyId: LAYOUT_STORY_ID },
    )
  }
}

/** Sends one declared discrete telco-state event through Sighty's internal gateway. */
async function projectTelcoEvent({ event, send }: SightyActionContext<SightyDemo4SceneKey>): Promise<void> {
  await send(
    TELCO_SCENE_KEY,
    { name: event.name },
    { scope: 'story', storyId: TELCO_STORY_ID },
  )
}
