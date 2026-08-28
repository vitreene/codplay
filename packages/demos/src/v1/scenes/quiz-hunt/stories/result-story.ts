import type { SceneStoryDoc } from "codplay-v1/player/types"
import type { GameLabels } from "../types"

/** Result story: a full-overlay verdict card. Purely passive. */
export function createResultStory(labels: GameLabels): SceneStoryDoc {
  return {
    id: "game-result-story",
    initial: { move: { parentId: "game:zone:main" } },
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-result-overlay",
        type: "layout",
        initial: {
          className: "quiz-hunt-result-overlay is-hidden",
          move: "@root",
          markup: `
            <div class="quiz-hunt-result-card">
              <p class="quiz-hunt-result-verdict-slot" data-part="game-result-verdict-slot"></p>
              <p class="quiz-hunt-result-summary-slot" data-part="game-result-summary-slot"></p>
              <p class="quiz-hunt-result-time-slot" data-part="game-result-time-slot"></p>
            </div>
          `
        },
        actions: {
          "game:result:show": {
            className: { add: "is-visible", remove: "is-hidden" },
            style: { opacity: { from: 0, to: 1, duration: 300 } }
          }
        }
      },
        {
          id: "game-result-verdict",
          type: "tag",
        initial: { tag: "span", className: "quiz-hunt-result-verdict", content: "", move: { parentId: "game-result-verdict-slot" } },
        actions: {
          "game:result:verdict:passed": { content: labels.resultPassedTitle, className: "quiz-hunt-result-verdict is-passed" },
          "game:result:verdict:failed": { content: labels.resultFailedTitle, className: "quiz-hunt-result-verdict is-failed" }
        }
      },
      {
        id: "game-result-summary",
        type: "tag",
        initial: { tag: "span", content: "", move: { parentId: "game-result-summary-slot" } },
        actions: { "game:result:summary": {} }
      },
      {
        id: "game-result-time",
        type: "tag",
        initial: { tag: "span", content: "", move: { parentId: "game-result-time-slot" } },
        actions: { "game:result:time": {} }
      }
    ]
  }
}
