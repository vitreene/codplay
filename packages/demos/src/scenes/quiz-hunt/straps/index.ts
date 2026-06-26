import type { StrapCollection } from "codplay/player/strap-types"
import type { GameConfig, GameDraw, QuestionRouteEntry, QuizHuntWord } from "../types"
import { createGameRouterStrap } from "./game-router"
import { createGameTrialResolveStrap } from "./game-trial-resolve"
import { gameExtraCollectStrap } from "./game-extra-collect"
import { createGameTimerStrap } from "./game-timer"
import { createGameFinalRouteStrap } from "./game-final-route"
import { createGameResultStrap } from "./game-result"
import { createGameReportStrap } from "./game-report"

/**
 * Builds the `questionIndex → word/color` lookup `game-trial-resolve` uses to know which
 * trial or final story a given `quiz:question:answered` event closes. Trials occupy indexes
 * 0-15, finals 16-31, both in `words` array order — fixed at scene creation, never recomputed.
 */
function buildQuestionRouteTable(words: QuizHuntWord[]): Record<number, QuestionRouteEntry> {
  const table: Record<number, QuestionRouteEntry> = {}
  words.forEach((word, position) => {
    table[position] = { kind: "trial", wordId: word.id, color: word.color }
    table[words.length + position] = { kind: "final", wordId: word.id, color: word.color }
  })
  return table
}

export function createGameStraps(config: GameConfig, draw: GameDraw): StrapCollection {
  const { words, colors } = config.content
  const wordsById = Object.fromEntries(words.map((word) => [word.id, { label: word.label }]))
  const routeTable = buildQuestionRouteTable(words)

  return {
    "game-router": createGameRouterStrap(config, draw),
    "game-trial-resolve": createGameTrialResolveStrap(routeTable, wordsById, colors),
    "game-extra-collect": gameExtraCollectStrap,
    "game-timer": createGameTimerStrap(config.timerTotalMs),
    "game-final-route": createGameFinalRouteStrap(draw.finalColor, colors),
    "game-result": createGameResultStrap(config.timerTotalMs, colors),
    "game-report": createGameReportStrap(config.seed)
  }
}
