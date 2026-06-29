import type { SceneStoryDoc } from "codplay/player/types"

/**
 * Timer story: a label + a progress bar. Purely passive — the countdown logic
 * (start/pause/resume/stop, the per-second tick) lives in the scene-level `game-timer` strap.
 */
export function createTimerStory(): SceneStoryDoc {
  return {
    id: "game-timer-story",
    initial: { move: { parentId: "game:zone:timer" } },
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-timer-root",
        type: "layout",
        initial: {
          move: "@root",
          markup: `
            <div class="quiz-hunt-timer">
              <span class="quiz-hunt-timer-label-slot" data-part="game-timer-label-slot"></span>
              <div class="quiz-hunt-timer-track-slot" data-part="game-timer-track-slot"></div>
            </div>
          `
        },
        actions: {}
      },
      {
        id: "game-timer-label",
        type: "tag",
        initial: {
          tag: "span",
          content: "--:--",
          move: { parentId: "game-timer-label-slot" }
        },
        actions: { "game:timer:label": {} }
      },
      {
        id: "game-timer-fill",
        type: "tag",
        initial: {
          tag: "div",
          className: "quiz-hunt-timer-fill",
          content: "",
          move: { parentId: "game-timer-track-slot" }
        },
        actions: { "game:timer:fill": {} }
      }
    ]
  }
}
