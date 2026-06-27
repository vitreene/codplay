import type { StrapFn } from "codplay/player/strap-types"
import type { QuestionRouteEntry } from "../types"

type WordLookup = Record<string, { label: string }>

/** Time the "Gagné !"/"Perdu" result text stays visible before the trial panel closes. */
const TRIAL_RESULT_DELAY_MS = 2000

/**
 * Scene-level handler for `quiz:question:answered`, emitted by both trial and final
 * question stories (shared `quizQuestionStoryStraps`) and falling through to scene scope
 * since neither story declares a local `listen` rule for it. Branches on the question's
 * route entry (built once at scene creation) to know whether it closes a trial or the final.
 *
 * For a trial, every visible consequence (grid/tile/timer, basket) is delayed by
 * `TRIAL_RESULT_DELAY_MS` so the result text set synchronously by `quiz:question:resolved:*`
 * (inside the still-visible trial panel) stays on screen for that long before the panel hides.
 */
export function createGameTrialResolveStrap(
  routeTable: Record<number, QuestionRouteEntry>,
  wordsById: WordLookup,
  colors: string[]
): StrapFn {
  return ({ event, state, context }) => {
    const payload = event.data as { questionIndex?: number; isCorrect?: boolean } | undefined
    const questionIndex = payload?.questionIndex
    const isCorrect = payload?.isCorrect === true
    if (typeof questionIndex !== "number") {
      return undefined
    }

    const route = routeTable[questionIndex]
    if (route === undefined) {
      return undefined
    }

    if (route.kind === "final") {
      return {
        events: [{ name: "game:final:done", data: { isCorrect } }]
      }
    }

    const { wordId, color } = route
    const trialStatus = { ...((state.trialStatus as Record<string, string> | undefined) ?? {}) }
    trialStatus[wordId] = isCorrect ? "success" : "fail"

    const basket = { ...((state.basket as Record<string, { wordId: string; wordLabel: string } | null> | undefined) ?? {}) }
    const events: { name: string; data?: Record<string, unknown> }[] = [
      { name: "game:grid:show" },
      { name: `game:trial:${wordId}:hide` },
      { name: isCorrect ? `game:grid:tile:${wordId}:success` : `game:grid:tile:${wordId}:fail` },
      { name: "game:timer:resume" }
    ]

    if (isCorrect) {
      const wordLabel = wordsById[wordId]?.label ?? wordId
      basket[color] = { wordId, wordLabel }
      events.push(
        { name: "game:word:collected", data: { color, wordId, wordLabel } },
        { name: `game:basket:fill:${color}`, data: { content: wordLabel } }
      )

      const basketComplete = colors.every((c) => basket[c] !== null && basket[c] !== undefined)
      if (basketComplete) {
        events.push({ name: "game:basket:complete" })
      }
    }

    const [firstEvent, ...restEvents] = events

    return context.planned.delay(TRIAL_RESULT_DELAY_MS, [
      { update: { trialStatus, basket, phase: "grid", currentTrialId: null }, event: firstEvent },
      ...restEvents.map((delayedEvent) => ({ event: delayedEvent }))
    ])
  }
}
