import type { PersoDoc, SceneStoryDoc } from "codplay/player/types"
import type { QuizHuntColorStyle } from "../color-palette"
import type { GameLabels } from "../types"

/** Basket story: 4 color slots and the final-question button. */
export function createBasketStory(colors: string[], colorStyles: Record<string, QuizHuntColorStyle>, labels: GameLabels): SceneStoryDoc {
  const slots: PersoDoc[] = colors.map((color) => ({
    id: `game-basket-slot-${color}`,
    type: "tag",
    initial: {
      tag: "div",
      className: "quiz-hunt-basket-slot",
      content: labels.basketEmptySlot,
      style: {
        "--quiz-hunt-accent": colorStyles[color]?.solid ?? "#94a3b8",
        "--quiz-hunt-accent-gradient": colorStyles[color]?.gradient ?? "linear-gradient(135deg, #cbd5e1, #94a3b8)"
      },
      move: { parentId: "game-basket-slots" }
    },
    actions: {
      [`game:basket:fill:${color}`]: {},
      [`game:basket:clear:${color}`]: { content: labels.basketEmptySlot }
    }
  }))

  return {
    id: "game-basket-story",
    initial: { move: { parentId: "game:zone:basket" } },
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-basket-root",
        type: "layout",
        initial: {
          move: "@root",
          markup: `
            <div class="quiz-hunt-basket">
              <p class="quiz-hunt-basket-title">${labels.basketTitle}</p>
              <div class="quiz-hunt-basket-slots" data-part="game-basket-slots"></div>
              <div class="quiz-hunt-basket-tools">
                <div class="quiz-hunt-basket-final-slot" data-part="game-basket-final-slot"></div>
              </div>
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
          "game:basket:complete": { className: { remove: "is-hidden" } },
          "game:basket:incomplete": { className: { add: "is-hidden" } }
        }
      }
    ]
  }
}
