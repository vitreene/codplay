import type { QuizQuestionType } from "../quiz-question-scene"

export type QuizHuntAnswer = {
  id: string
  label: string
  isCorrect: boolean
}

export type QuizHuntQuestion = {
  type: QuizQuestionType
  prompt: string
  answers: QuizHuntAnswer[]
}

export type QuizHuntWord = {
  id: string
  label: string
  color: string
  finalQuestion: QuizHuntQuestion
  trial: {
    type: "reading+quiz"
    epreuveLabel: string
    consigne: string
    clueText: string
    question: QuizHuntQuestion
  }
}

export type QuizHuntContent = {
  colors: string[]
  words: QuizHuntWord[]
}

export type GameLabels = {
  validate: string
  next: string
  correct: string
  incorrect: string
  multipleHint: string
  gridTitle: string
  basketTitle: string
  basketEmptySlot: string
  finalButton: string
  resultPassedTitle: string
  resultFailedTitle: string
  extraLabel: string
}

export type GameConfig = {
  content: QuizHuntContent
  seed: number
  timerTotalMs: number
  extraDurationMs: number
  showCorrection: boolean
  labels: GameLabels
}

/** One entry of the question-index → word lookup consumed by `game-trial-resolve`. */
export type QuestionRouteEntry = {
  kind: "trial" | "final"
  wordId: string
  color: string
}

export type GameDraw = {
  gridOrder: string[]
  extraWordId: string
  extraOffsetMs: number
  finalColor: string
}
