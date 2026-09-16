import type { SightyFile as SightyFileDefinition } from "@codplay/sighty";
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
export type SightyDemo4SlotName = "slot-scene" | "slot-telco";

/** Declarative navigation file; scene sources are supplied by the catalogue. */
export type SightyDemo4File = SightyFileDefinition<SightyDemo4SceneKey, SightyDemo4SlotName>;

const MENU_VIEW_PATH = "view-main/view-summary/slot-scene/view-summary-menu";
const RETURN_TO_MENU_ACTION = {
  action: "demo4:return-menu",
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
  [DEMO4_TELCO_STATE_EVENTS.on]: { action: "demo4:project-telco-event" },
  [DEMO4_TELCO_STATE_EVENTS.off]: { action: "demo4:project-telco-event" },
  [DEMO4_PLAYBACK_STATE_EVENTS.playing]: { action: "demo4:project-telco-event" },
  [DEMO4_PLAYBACK_STATE_EVENTS.paused]: { action: "demo4:project-telco-event" },
} as const;

/** Describes the recursive menu/chapter composition consumed by Sighty. */
export const sightyFile: SightyDemo4File = {
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
                    "slot-scene": {
                      start: "view-summary-menu",
                      views: {
                        "view-summary-menu": { view: { scene: "scene-menu" } },
                      },
                    },
                  },
                },
                actions: {
                  [DEMO4_MENU_INTENTS.sceneA]: {
                    action: "demo4:enter-chapter",
                    go: { path: "view-main/view-chapter/slot-scene/view-page-a" },
                  },
                  [DEMO4_MENU_INTENTS.sceneB]: {
                    action: "demo4:enter-chapter",
                    go: { path: "view-main/view-chapter/slot-scene/view-page-b" },
                  },
                  [DEMO4_MENU_INTENTS.sceneC]: {
                    action: "demo4:enter-chapter",
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
                            action: "demo4:return-menu",
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
};
