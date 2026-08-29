export type QuizQuestionType = "boolean" | "single" | "multiple"

export type QuizAnswer = {
  id: string
  label: string
  isCorrect: boolean
}

export type QuizQuestionLabels = {
  validate: string
  next: string
  correct: string
  incorrect: string
  multipleHint: string
}

export type ResolvedQuizQuestion = {
  index: number
  type: QuizQuestionType
  prompt: string
  answers: QuizAnswer[]
  labels: QuizQuestionLabels
}

export type QuizQuestionStoryConfig = {
  showCorrection: boolean
  showResult: boolean
  maxRetries: number
  disableValidateAfterSubmit: boolean
}

export const SERIES_TOTAL = 3
export const SERIES_THRESHOLD = 2

export const SERIES_LABELS: QuizQuestionLabels = {
  validate: "Valider",
  next: "Suivant",
  correct: "Correct !",
  incorrect: "Incorrect",
  multipleHint: "Plusieurs réponses possibles"
}

export const SERIES_BACKGROUNDS = ["#eff6ff", "#f0fdf4", "#fff7ed"]
export const SERIES_BORDERS = ["#2563eb", "#16a34a", "#ea580c"]

export const DEFAULT_SERIES_CONFIG: QuizQuestionStoryConfig = {
  showCorrection: true,
  showResult: true,
  maxRetries: 0,
  disableValidateAfterSubmit: true
}

export const SERIES_QUESTIONS: ResolvedQuizQuestion[] = [
  {
    index: 1,
    type: "boolean",
    prompt: "La Tour Eiffel se trouve à Paris.",
    answers: [
      { id: "vrai", label: "Vrai", isCorrect: true },
      { id: "faux", label: "Faux", isCorrect: false }
    ],
    labels: SERIES_LABELS
  },
  {
    index: 2,
    type: "single",
    prompt: "Quelle est la plus grande planète du système solaire ?",
    answers: [
      { id: "mars", label: "Mars", isCorrect: false },
      { id: "jupiter", label: "Jupiter", isCorrect: true },
      { id: "saturne", label: "Saturne", isCorrect: false },
      { id: "neptune", label: "Neptune", isCorrect: false }
    ],
    labels: SERIES_LABELS
  },
  {
    index: 3,
    type: "multiple",
    prompt: "Parmi ces éléments, lesquels sont des fruits ?",
    answers: [
      { id: "pomme", label: "Pomme", isCorrect: true },
      { id: "carotte", label: "Carotte", isCorrect: false },
      { id: "banane", label: "Banane", isCorrect: true },
      { id: "poireau", label: "Poireau", isCorrect: false }
    ],
    labels: SERIES_LABELS
  }
]
