import type { PersoDoc, SceneStoryDoc } from "codplay/player/types"
import type { GameLabels } from "../types"

/** Basket story: 4 color slots + the hidden "final question" button. Purely passive. */
export function createBasketStory(colors: string[], colorAccents: Record<string, string>, labels: GameLabels): SceneStoryDoc {
  const slots: PersoDoc[] = colors.map((color) => ({
    id: `game-basket-slot-${color}`,
    type: "tag",
    initial: {
      tag: "div",
      className: "quiz-hunt-basket-slot",
      content: labels.basketEmptySlot,
      style: { "--quiz-hunt-accent": colorAccents[color] ?? "#94a3b8" },
      move: { parentId: "game-basket-slots" }
    },
    actions: {
      [`game:basket:fill:${color}`]: {}
    }
  }))

  return {
    id: "game-basket-story",
    initial: undefined,
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-basket-root",
        type: "layout",
        initial: {
          move: { parentId: "game:zone:basket" },
          markup: `
            <div class="quiz-hunt-basket">
              <div class="quiz-hunt-basket-slots" data-part="game-basket-slots"></div>
              <div class="quiz-hunt-basket-final-slot" data-part="game-basket-final-slot"></div>
            </div>
          `
        },
        actions: {}
      },
      ...slots,
      {
        id: "game-basket-final-button",
        type: "tag",
        initial: {
          tag: "button",
          className: "quiz-hunt-final-button is-hidden",
          content: labels.finalButton,
          attr: { type: "button" },
          style: {
            "--quiz-hunt-accent": "#2563eb"
          },
          move: { parentId: "game-basket-final-slot" }
        },
        emit: { click: { event: { name: "game:final:start", cascade: true } } },
        actions: {
          "game:basket:complete": { className: { remove: "is-hidden" } }
        }
      }
    ]
  }
}
