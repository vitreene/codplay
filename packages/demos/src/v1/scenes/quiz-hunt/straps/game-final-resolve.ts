import type { StrapFn } from "codplay-v1/player/strap-types"
import type { QuizHuntWord } from "../types"

type BasketEntry = { wordId: string; wordLabel: string }

const FINAL_RESULT_DELAY_MS = 2000
const WON_PANEL_DISPLAY_MS = 1200

/** Resolves one serializable string array from scene state. */
function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

/**
 * Handles the final question outcome while keeping `game:final:done` as the pivot event.
 */
export function createGameFinalResolveStrap(finalColor: string, words: QuizHuntWord[]): StrapFn {
  const wordsById = new Map(words.map((word) => [word.id, word]))
  const wordsForFinalColor = words.filter((word) => word.color === finalColor)

  return ({ event, state, context }) => {
    if (event.name !== "game:final:done") {
      return undefined
    }

    const wordId = typeof event.data?.wordId === "string" ? event.data.wordId : undefined
    const color = typeof event.data?.color === "string" ? event.data.color : undefined
    if (wordId === undefined || color !== finalColor) {
      return undefined
    }

    if (event.data?.isCorrect === true) {
      return [
        context.planned.delay(FINAL_RESULT_DELAY_MS, {
          event: { name: "game:final:won", data: { color: finalColor, wordId } }
        }),
        context.planned.delay(FINAL_RESULT_DELAY_MS + WON_PANEL_DISPLAY_MS, {
          event: { name: "sequence:end" }
        })
      ]
    }

    const trialStatus = { ...((state.trialStatus as Record<string, string> | undefined) ?? {}) }
    const basket = { ...((state.basket as Record<string, BasketEntry | null> | undefined) ?? {}) }
    const finalAttemptedWordIds = new Set(readStringArray(state.finalAttemptedWordIds))
    finalAttemptedWordIds.add(wordId)
    trialStatus[wordId] = "fail"

    const replacement = wordsForFinalColor.find((word) => {
      return word.id !== wordId && trialStatus[word.id] === "success" && !finalAttemptedWordIds.has(word.id)
    })

    const hideFailedFinalEvent = { name: `game:final:${wordId}:hide` }
    const markFailedTileEvent = { name: `game:grid:tile:${wordId}:fail` }

    if (replacement !== undefined) {
      const replacementLabel = wordsById.get(replacement.id)?.label ?? replacement.id
      basket[finalColor] = { wordId: replacement.id, wordLabel: replacementLabel }

      return context.planned.delay(FINAL_RESULT_DELAY_MS, [
        {
          update: { trialStatus, basket, finalAttemptedWordIds: [...finalAttemptedWordIds], phase: "grid", currentTrialId: null },
          event: hideFailedFinalEvent
        },
        { event: markFailedTileEvent },
        { event: { name: "game:grid:show" } },
        { event: { name: `game:basket:fill:${finalColor}`, data: { content: replacementLabel } } },
        { event: { name: "game:basket:complete" } }
      ])
    }

    basket[finalColor] = null
    const hasAvailableQuestion = wordsForFinalColor.some((word) => {
      return !finalAttemptedWordIds.has(word.id) && trialStatus[word.id] !== "fail" && trialStatus[word.id] !== "success"
    })

    if (!hasAvailableQuestion) {
      return context.planned.delay(FINAL_RESULT_DELAY_MS, [
        {
          update: { trialStatus, basket, finalAttemptedWordIds: [...finalAttemptedWordIds], phase: "result", currentTrialId: null },
          event: hideFailedFinalEvent
        },
        { event: markFailedTileEvent },
        { event: { name: `game:basket:clear:${finalColor}` } },
        { event: { name: "game:final:lost", data: { color: finalColor, wordId } } }
      ])
    }

    return context.planned.delay(FINAL_RESULT_DELAY_MS, [
      {
        update: { trialStatus, basket, finalAttemptedWordIds: [...finalAttemptedWordIds], phase: "grid", currentTrialId: null },
        event: hideFailedFinalEvent
      },
      { event: markFailedTileEvent },
      { event: { name: "game:grid:show" } },
      { event: { name: `game:basket:clear:${finalColor}` } },
      { event: { name: "game:basket:incomplete" } },
      { event: { name: "game:timer:resume" } }
    ])
  }
}
