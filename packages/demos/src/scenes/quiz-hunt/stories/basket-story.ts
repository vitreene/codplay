import type { PersoDoc, SceneStoryDoc } from "codplay/player/types"
import type { GameLabels } from "../types"

/** Basket story: 4 color slots + the hidden "final question" button. Purely passive. */
export function createBasketStory(colors: string[], colorAccents: Record<string, string>, labels: GameLabels): SceneStoryDoc {
  const slots: PersoDoc[] = colors.map((color) => ({
    id: `game-basket-slot-${color}`,
    type: "tag",
    initial: {
      tag: "div",
      content: labels.basketEmptySlot,
      style: {
        flex: "1",
        padding: "10px 12px",
        borderRadius: "8px",
        border: `2px solid ${colorAccents[color] ?? "#94a3b8"}`,
        fontWeight: 600,
        textAlign: "center"
      },
      move: { parentId: "game-basket-slots" }
    } as unknown as PersoDoc["initial"],
    actions: {
      [`game:basket:fill:${color}`]: {}
    }
  }))

  return {
    id: "game-basket-story",
    entries: ["game-basket-root"],
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
              <div data-part="game-basket-slots" style="display: flex; gap: 8px;"></div>
              <div data-part="game-basket-final-slot" style="margin-top: 12px;"></div>
            </div>
          `,
          style: {}
        } as unknown as PersoDoc["initial"],
        actions: {}
      },
      ...slots,
      {
        id: "game-basket-final-button",
        type: "tag",
        initial: {
          tag: "button",
          content: labels.finalButton,
          attr: { type: "button" },
          style: {
            display: "none",
            width: "100%",
            padding: "10px",
            border: "none",
            borderRadius: "8px",
            backgroundColor: "#2563eb",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer"
          },
          move: { parentId: "game-basket-final-slot" }
        } as unknown as PersoDoc["initial"],
        emit: { click: { event: { name: "game:final:start", cascade: true } } },
        actions: {
          "game:basket:complete": { style: { display: "block" } }
        }
      }
    ]
  }
}
