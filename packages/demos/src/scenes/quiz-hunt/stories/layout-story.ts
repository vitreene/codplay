import type { SceneStoryDoc } from "codplay/player/types"

/** Root story: the 3 zones (main, basket, timer). Every other story mounts into it via `move`. */
export function createLayoutStory(): SceneStoryDoc {
  return {
    id: "game-layout-story",
    initial: undefined,
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-layout-root",
        type: "layout",
        initial: {
          move: "@root",
          markup: `
            <div class="quiz-hunt-layout">
              <div class="quiz-hunt-main-zone" data-part="game:zone:main"></div>
              <div class="quiz-hunt-footer">
                <div class="quiz-hunt-basket-zone" data-part="game:zone:basket"></div>
                <div class="quiz-hunt-timer-zone" data-part="game:zone:timer"></div>
              </div>
            </div>
          `
        },
        actions: {}
      }
    ]
  }
}
