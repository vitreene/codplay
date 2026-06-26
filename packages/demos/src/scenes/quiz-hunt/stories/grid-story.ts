import type { PersoDoc, SceneStoryDoc } from "codplay/player/types"
import type { QuizHuntWord } from "../types"

/**
 * Grid story: one tile per word, in seed-shuffled order. Purely passive — `game-router`
 * (scene-level) drives every visual change via `game:grid:tile:{wordId}:*` actions.
 */
export function createGridStory(words: QuizHuntWord[], gridOrder: string[], colorAccents: Record<string, string>): SceneStoryDoc {
  const wordsById = new Map(words.map((word) => [word.id, word]))

  const tiles: PersoDoc[] = gridOrder.map((wordId, position) => {
    const word = wordsById.get(wordId)
    if (word === undefined) {
      throw new Error(`[quiz-hunt] grid order references unknown word "${wordId}"`)
    }

    const accent = colorAccents[word.color] ?? "#94a3b8"

    return {
      id: `game-grid-tile-${wordId}`,
      type: "tag",
      initial: {
        tag: "button",
        content: String(position + 1),
        attr: { type: "button" },
        style: {
          aspectRatio: "1 / 1",
          border: "none",
          borderRadius: "10px",
          backgroundColor: accent,
          color: "#fff",
          fontSize: "1.25rem",
          fontWeight: 700,
          cursor: "pointer"
        },
        move: { parentId: "game-grid-root" }
      },
      emit: {
        click: { event: { name: "game:trial:open", cascade: true }, data: { trialId: wordId } }
      },
      actions: {
        [`game:grid:tile:${wordId}:success`]: {
          attr: { disabled: true },
          style: { backgroundColor: "#16a34a", cursor: "default", opacity: 1 }
        },
        [`game:grid:tile:${wordId}:fail`]: {
          attr: { disabled: true },
          style: { backgroundColor: "#94a3b8", cursor: "default", opacity: 0.6 }
        },
        [`game:grid:tile:${wordId}:unlocked`]: {
          attr: { disabled: false },
          style: { backgroundColor: accent, cursor: "pointer", opacity: 1 }
        }
      }
    }
  })

  return {
    id: "game-grid-story",
    entries: ["game-grid-root"],
    initial: undefined,
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-grid-root",
        type: "list",
        initial: {
          move: { parentId: "game:zone:main" },
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "10px",
            width: "100%"
          }
        },
        actions: {
          "game:grid:show": { style: { display: "grid" } },
          "game:grid:hide": { style: { display: "none" } }
        }
      },
      ...tiles
    ]
  }
}
