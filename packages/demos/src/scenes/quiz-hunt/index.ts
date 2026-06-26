import type { SceneDoc, SceneStoryDoc } from "codplay/player/types"
import type { QuizQuestionLabels, QuizQuestionStoryConfig } from "../quiz-question-scene"
import type { GameConfig } from "./types"
import { deriveGameDraw } from "./seed"
import { createLayoutStory } from "./stories/layout-story"
import { createGridStory } from "./stories/grid-story"
import { createBasketStory } from "./stories/basket-story"
import { createTimerStory } from "./stories/timer-story"
import { createExtraStory } from "./stories/extra-story"
import { createResultStory } from "./stories/result-story"
import { createFinalStory } from "./stories/final-story"
import { createReadingQuizTrial } from "./stories/trials/build-reading-quiz"
import { createGameStraps } from "./straps"

const COLOR_ACCENTS: Record<string, string> = {
  rouge: "#dc2626",
  bleu: "#2563eb",
  vert: "#16a34a",
  jaune: "#ca8a04"
}

const QUESTION_CONFIG: QuizQuestionStoryConfig = {
  showCorrection: true,
  showResult: true,
  maxRetries: 0,
  disableValidateAfterSubmit: true
}

function toQuestionLabels(config: GameConfig): QuizQuestionLabels {
  return {
    validate: config.labels.validate,
    next: config.labels.next,
    correct: config.labels.correct,
    incorrect: config.labels.incorrect,
    multipleHint: config.labels.multipleHint
  }
}

/** Assembles the quiz-hunt scene: passive zone stories, 16 trial + 16 final stories, scene-level straps. */
export function createQuizHuntScene(config: GameConfig): SceneDoc {
  const { words, colors } = config.content
  const draw = deriveGameDraw(config.content, config.seed)
  const questionLabels = toQuestionLabels(config)

  const stories: Record<string, SceneStoryDoc> = {
    "game-layout-story": createLayoutStory(),
    "game-grid-story": createGridStory(words, draw.gridOrder, COLOR_ACCENTS),
    "game-basket-story": createBasketStory(colors, COLOR_ACCENTS, config.labels),
    "game-timer-story": createTimerStory(),
    "game-extra-story": createExtraStory(config.labels),
    "game-result-story": createResultStory(config.labels)
  }

  const questionStoryConfig: QuizQuestionStoryConfig = { ...QUESTION_CONFIG, showCorrection: config.showCorrection }

  words.forEach((word, index) => {
    const trial = createReadingQuizTrial(word, index, questionStoryConfig, questionLabels)
    stories[trial.id] = trial

    const final = createFinalStory(word, words.length + index, questionStoryConfig, questionLabels)
    stories[final.id] = final
  })

  return {
    id: "quiz-hunt-scene",
    rootStories: ["game-layout-story"],
    initial: {
      phase: "grid",
      currentTrialId: null,
      trialStatus: {},
      basket: Object.fromEntries(colors.map((color) => [color, null])),
      extraToken: false,
      extraConsumedOn: null,
      extraOfferedOn: null,
      timerRemainingMs: config.timerTotalMs,
      timerStarted: false,
      seed: config.seed
    },
    straps: undefined,
    listen: [
      { on: "game:trial:open", straps: ["game-router"] },
      { on: "quiz:question:answered", straps: ["game-trial-resolve"] },
      { on: "game:extra:collect", straps: ["game-extra-collect"] },
      { on: "game:timer:start", straps: ["game-timer"] },
      { on: "game:timer:resume", straps: ["game-timer"] },
      { on: "game:final:start", straps: ["game-final-route"] },
      { on: "game:final:done", straps: ["game-result"] },
      { on: "game:timer:expired", straps: ["game-result"] },
      { on: "game:result:show", straps: ["game-report"] }
    ],
    stories,
    tracks: {}
  }
}

/**
 * Builds the matching scene-level `StrapCollection` for `createQuizHuntScene(config)`.
 * Kept as a separate export (rather than bundled into the scene) because the demo entry
 * point passes `{ scene, strapCollection }` as two distinct fields to `runCodPlaySceneDemo`.
 * Re-derives the same deterministic draw from `config.seed` — calling both functions with
 * the same `config` always yields a consistent scene/straps pair.
 */
export function createQuizHuntStraps(config: GameConfig) {
  const draw = deriveGameDraw(config.content, config.seed)
  return createGameStraps(config, draw)
}

export type { GameConfig } from "./types"
