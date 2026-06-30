import type { TransformFn } from "codplay/player"
import type { SceneStoryDoc } from "codplay/player/types"
import type { GameLabels } from "../types"

/** Routes the captured pointer delta onto the extra token after it reaches the footer slot. */
const trackExtraTokenMove: TransformFn = (event) => {
  const { dx, dy, baseX, baseY } = event.data as { dx: number; dy: number; baseX: number; baseY: number }
  return [
    {
      name: "game:extra:drag:tracking:inventory",
      cascade: true,
      data: {
        style: {
          x: { to: baseX + dx, duration: 0 },
          y: { to: baseY + dy, duration: 0 },
          zIndex: "10"
        }
      }
    }
  ]
}

/** Extra story: one floating clickable token, hidden by default. Purely passive. */
export function createExtraStory(labels: GameLabels): SceneStoryDoc {
  return {
    id: "game-extra-story",
    initial: undefined,
    straps: undefined,
    listen: [{ on: "game:extra:drag:tracking", transform: [trackExtraTokenMove] }],
    persos: [
      {
        id: "game-extra-inventory-list",
        type: "list",
        initial: {
          move: { parentId: "game:zone:extra" }
        },
        actions: {}
      },
      {
        id: "game-extra-token",
        type: "tag",
        initial: {
          tag: "button",
          className: "quiz-hunt-extra-token is-hidden",
          content: "E",
          attr: { type: "button", "aria-label": labels.extraLabel, title: labels.extraLabel },
          move: { parentId: "game:zone:main" }
        },
        emit: {
          click: { event: { name: "game:extra:collect", cascade: true } },
          pointerdown: {
            event: { name: "game:extra:drag:start", cascade: true },
            capture: {
              event: { name: "game:extra:drag:tracking" },
              endEvent: { name: "game:extra:drag:end" },
              duration: 400,
              snapAt: "end"
            }
          }
        },
        actions: {
          "game:extra:token:show": { className: { add: "is-visible", remove: "is-hidden" } },
          "game:extra:token:hide": { className: { add: "is-hidden", remove: "is-visible" } },
          "game:extra:inventory:collect": {
            move: { parentId: "game-extra-inventory-list", flipMode: "overlay-world" },
            className: { add: "quiz-hunt-extra-token-inventory is-visible", remove: "is-hidden" },
            style: {
              x: { to: 0, duration: 0 },
              y: { to: 0, duration: 0 },
              zIndex: "auto"
            }
          },
          "game:extra:inventory:hide": {
            className: { add: "is-hidden", remove: "is-visible" },
            style: {
              x: { to: 0, duration: 0 },
              y: { to: 0, duration: 0 },
              zIndex: "auto"
            }
          },
          "game:extra:drag:tracking:inventory": {},
          "game:extra:drag:reset": {
            style: {
              x: { to: 0, duration: 250, ease: "outQuad" },
              y: { to: 0, duration: 250, ease: "outQuad" },
              zIndex: "auto"
            }
          }
        }
      }
    ]
  }
}
