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
        className: "quiz-hunt-grid-tile",
        content: String(position + 1),
        attr: { type: "button" },
        style: { "--quiz-hunt-accent": accent },
        move: { parentId: "game-grid-root" }
      },
      emit: {
        click: { event: { name: "game:trial:open", cascade: true }, data: { trialId: wordId } }
      },
      actions: {
        [`game:grid:tile:${wordId}:success`]: {
          attr: { disabled: true },
          content: "✓",
          className: "quiz-hunt-grid-tile is-success"
        },
        [`game:grid:tile:${wordId}:fail`]: {
          attr: { disabled: true },
          content: "✗",
          className: "quiz-hunt-grid-tile is-fail"
        },
        [`game:grid:tile:${wordId}:unlocked`]: {
          attr: { disabled: false },
          content: String(position + 1),
          className: "quiz-hunt-grid-tile"
        }
      }
    }
  })

  return {
    id: "game-grid-story",
    initial: { move: { parentId: "game:zone:main" } },
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "game-grid-root",
        type: "list",
        initial: {
          className: "quiz-hunt-grid",
          move: "@root",
        },
        actions: {
          "game:grid:show": { className: { remove: "is-hidden" } },
          "game:grid:hide": { className: { add: "is-hidden" } }
        }
      },
      ...tiles
    ]
  }
}
