import type { StrapCollection } from "codplay/player/strap-types"
import type { SceneDoc } from "codplay/player/types"
import type { GameConfig, GameDraw, QuestionRouteEntry, QuizHuntWord } from "../types"
import { createGameRouterStrap } from "./game-router"
import { createGameTrialResolveStrap } from "./game-trial-resolve"
import { gameExtraCollectStrap } from "./game-extra-collect"
import { gameExtraWindowStrap } from "./game-extra-window"
import { createGameExtraDropStrap } from "./game-extra-drop"
import { createGameTimerStrap } from "./game-timer"
import { createGameFinalRouteStrap } from "./game-final-route"
import { createGameFinalResolveStrap } from "./game-final-resolve"
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

/** Clones one serializable story state snapshot for later retry resets. */
function cloneState<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

/** Builds the per-trial state reset hook used by the retry token drop flow. */
function createTrialStoryStateReset(scene: SceneDoc, words: QuizHuntWord[]): (trialId: string) => void {
  const initialStateByTrialId = new Map<string, Record<string, unknown> | undefined>()

  for (const word of words) {
    const storyId = `game-trial-${word.id}-story`
    initialStateByTrialId.set(word.id, cloneState(scene.stories[storyId]?.state as Record<string, unknown> | undefined))
  }

  return (trialId: string) => {
    const storyId = `game-trial-${trialId}-story`
    const story = scene.stories[storyId]
    if (story === undefined) {
      return
    }

    story.state = cloneState(initialStateByTrialId.get(trialId))
  }
}

export function createGameStraps(config: GameConfig, draw: GameDraw, scene?: SceneDoc): StrapCollection {
  const { words, colors } = config.content
  const wordsById = Object.fromEntries(words.map((word) => [word.id, { label: word.label }]))
  const routeTable = buildQuestionRouteTable(words)
  const resetTrialStoryState = scene === undefined ? () => undefined : createTrialStoryStateReset(scene, words)

  return {
    "game-router": createGameRouterStrap(config, draw),
    "game-trial-resolve": createGameTrialResolveStrap(routeTable, wordsById, colors),
    "game-extra-collect": gameExtraCollectStrap,
    "game-extra-window": gameExtraWindowStrap,
    "game-extra-drop": createGameExtraDropStrap(resetTrialStoryState),
    "game-timer": createGameTimerStrap(config.timerTotalMs),
    "game-final-route": createGameFinalRouteStrap(draw.finalColor, colors),
    "game-final-resolve": createGameFinalResolveStrap(draw.finalColor, words),
    "game-result": createGameResultStrap(config.timerTotalMs, colors),
    "game-report": createGameReportStrap(config.seed)
  }
}
