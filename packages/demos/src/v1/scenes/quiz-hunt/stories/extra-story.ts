import type { SceneStoryDoc } from "codplay/player/types"
import type { CaptureInitFn, CaptureTrackFn, PointerCaptureSample } from "codplay/runtime/capture-types"
import type { GameLabels } from "../types"

type ExtraTokenCaptureState = { x: number; y: number; clientX: number; clientY: number }

/** Reads the token's current offset from `state` (defaults to the origin) when a drag starts. */
const initExtraTokenCaptureState: CaptureInitFn = ({ state }) => {
  const gameState = state as { extraTokenX?: number; extraTokenY?: number }
  return { x: gameState.extraTokenX ?? 0, y: gameState.extraTokenY ?? 0, clientX: 0, clientY: 0 }
}

/** Follows the pointer with no clamping — the token drags freely over the footer/grid. */
const trackExtraTokenMove: CaptureTrackFn = ({ sample, captureState }) => {
  const pointerSample = sample as PointerCaptureSample
  const tokenCaptureState = captureState as ExtraTokenCaptureState
  const x = tokenCaptureState.x + pointerSample.movementX
  const y = tokenCaptureState.y + pointerSample.movementY

  return {
    action: { actionName: "game:extra:drag:tracking:inventory", data: { style: { x, y, zIndex: "10" } } },
    captureState: { x, y, clientX: pointerSample.clientX, clientY: pointerSample.clientY }
  }
}

/** Extra story: one floating clickable token, hidden by default. Purely passive. */
export function createExtraStory(labels: GameLabels): SceneStoryDoc {
  return {
    id: "game-extra-story",
    initial: undefined,
    straps: undefined,
    listen: [],
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
              initCaptureState: initExtraTokenCaptureState,
              trackCommand: trackExtraTokenMove,
              endEmit: { name: "game:extra:drag:end", cascade: true }
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
