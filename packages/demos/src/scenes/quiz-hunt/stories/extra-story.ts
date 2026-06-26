import type { SceneStoryDoc } from "codplay/player/types"
import type { GameLabels } from "../types"

/** Extra story: one floating clickable token, hidden by default. Purely passive. */
export function createExtraStory(labels: GameLabels): SceneStoryDoc {
  return {
    id: "game-extra-story",
    entries: ["game-extra-token"],
    initial: undefined,
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-extra-token",
        type: "tag",
        initial: {
          tag: "button",
          content: labels.extraLabel,
          attr: { type: "button" },
          style: {
            position: "absolute",
            top: "12px",
            right: "12px",
            padding: "8px 14px",
            border: "none",
            borderRadius: "999px",
            backgroundColor: "#f59e0b",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            opacity: 0,
            pointerEvents: "none",
            transition: "opacity 200ms ease"
          },
          move: { parentId: "game:zone:main" }
        },
        emit: {
          click: { event: { name: "game:extra:collect", cascade: true } }
        },
        actions: {
          "game:extra:show": { style: { opacity: 1, pointerEvents: "auto" } },
          "game:extra:hide": { style: { opacity: 0, pointerEvents: "none" } }
        }
      }
    ]
  }
}
