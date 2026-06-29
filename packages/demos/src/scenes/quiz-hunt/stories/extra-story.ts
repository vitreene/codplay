import type { SceneStoryDoc } from "codplay/player/types"
import type { GameLabels } from "../types"

/** Extra story: one floating clickable token, hidden by default. Purely passive. */
export function createExtraStory(labels: GameLabels): SceneStoryDoc {
  return {
    id: "game-extra-story",
    initial: { move: { parentId: "game:zone:main" } },
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-extra-token",
        type: "tag",
        initial: {
          tag: "button",
          className: "quiz-hunt-extra-token is-hidden",
          content: labels.extraLabel,
          attr: { type: "button" },
          move: "@root"
        },
        emit: {
          click: { event: { name: "game:extra:collect", cascade: true } }
        },
        actions: {
          "game:extra:show": { className: { add: "is-visible", remove: "is-hidden" } },
          "game:extra:hide": { className: { add: "is-hidden", remove: "is-visible" } }
        }
      }
    ]
  }
}
