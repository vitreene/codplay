import type { SceneStoryDoc } from "codplay/player/types"

/** Root story: the 3 zones (main, basket, timer). Every other story mounts into it via `move`. */
export function createLayoutStory(): SceneStoryDoc {
  return {
    id: "game-layout-story",
    entries: ["game-layout-root"],
    initial: undefined,
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-layout-root",
        type: "layout",
        initial: {
          markup: `
            <div class="quiz-hunt-layout">
              <div data-part="game:zone:main" style="position: relative; min-height: 420px;"></div>
              <div class="quiz-hunt-footer" style="display: flex; gap: 16px; margin-top: 16px;">
                <div data-part="game:zone:basket" style="flex: 1;"></div>
                <div data-part="game:zone:timer" style="width: 220px;"></div>
              </div>
            </div>
          `,
          style: { width: "100%" }
        },
        actions: {}
      }
    ]
  }
}
