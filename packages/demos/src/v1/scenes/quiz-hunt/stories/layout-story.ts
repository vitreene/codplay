import type { SceneStoryDoc } from "codplay-v1/player/types"

/** Root story: title, main stack, then footer zones for basket, extra token, and timer. */
export function createLayoutStory(title: string): SceneStoryDoc {
  return {
    id: "game-layout-story",
    initial: { move: "@root" },
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
              <div class="quiz-hunt-title-zone">
                <h2 class="quiz-hunt-title">${title}</h2>
              </div>
              <div class="quiz-hunt-main-zone" data-part="game:zone:main"></div>
              <div class="quiz-hunt-footer">
                <div class="quiz-hunt-basket-zone" data-part="game:zone:basket"></div>
                <div class="quiz-hunt-extra-zone" data-part="game:zone:extra"></div>
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
