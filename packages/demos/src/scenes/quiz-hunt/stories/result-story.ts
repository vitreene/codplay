import type { SceneStoryDoc } from "codplay/player/types"
import type { GameLabels } from "../types"

/** Result story: a full-overlay verdict card. Purely passive. */
export function createResultStory(labels: GameLabels): SceneStoryDoc {
  return {
    id: "game-result-story",
    entries: ["game-result-overlay"],
    initial: undefined,
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-result-overlay",
        type: "layout",
        initial: {
          move: { parentId: "game:zone:main" },
          markup: `
            <div class="quiz-hunt-result-card" style="background: #fff; border-radius: 16px; padding: 24px 32px; min-width: 300px; display: flex; flex-direction: column; gap: 8px;">
              <p data-part="game-result-verdict-slot" style="font-weight: 700; font-size: 1.25rem; margin: 0;"></p>
              <p data-part="game-result-summary-slot" style="margin: 0;"></p>
              <p data-part="game-result-time-slot" style="margin: 0; color: #475569;"></p>
            </div>
          `,
          style: {
            position: "absolute",
            inset: "0",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            opacity: 0,
            pointerEvents: "none"
          }
        },
        actions: {
          "game:result:show": {
            style: { opacity: { from: 0, to: 1, duration: 300 }, pointerEvents: "auto" }
          }
        }
      },
      {
        id: "game-result-verdict",
        type: "tag",
        initial: { tag: "span", content: "", move: { parentId: "game-result-verdict-slot" } },
        actions: {
          "game:result:verdict:passed": { content: labels.resultPassedTitle, style: { color: "#16a34a" } },
          "game:result:verdict:failed": { content: labels.resultFailedTitle, style: { color: "#dc2626" } }
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
