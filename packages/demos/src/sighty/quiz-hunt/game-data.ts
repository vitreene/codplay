import sfSpatialQuestions from '../../v1/scenes/quiz-hunt/assets/questions/quiz-hunt-sf-spatiale.json'
import nostromoVideoUrl from '../../v1/scenes/quiz-hunt/assets/questions/nostromo.mp4'
import { deriveGameDraw } from '../../v1/scenes/quiz-hunt/seed'
import type { GameDraw, QuizHuntContent, QuizHuntQuestion } from '../../v1/scenes/quiz-hunt/types'
import type { QuizQuestionDefinition } from '../shared/quiz/answer-circuit'

const DEFAULT_QUIZ_HUNT_SEED = 1

/** Describes one clue that a question scene can present before the answer. */
export type QuizHuntClue = Readonly<{
  label: string
  instructions: string
  text?: string
  videoUrl?: string
}>

/** Describes one generated trial scene and its local quiz question. */
export type QuizHuntTrial = Readonly<{
  id: string
  label: string
  color: string
  clue: QuizHuntClue
  revealDelayMs: number
  question: QuizQuestionDefinition
}>

/** Describes one eagerly generated final question for a word. */
export type QuizHuntFinal = Readonly<{
  id: string
  label: string
  color: string
  question: QuizQuestionDefinition
}>

/** Describes the eagerly generated game catalog and its V1-compatible draw. */
export type QuizHuntGameData = Readonly<{
  colors: readonly string[]
  trials: readonly QuizHuntTrial[]
  finals: readonly QuizHuntFinal[]
  draw: GameDraw
  seed: number
}>

/** Builds the full trial/final catalog and resolves the original deterministic draw. */
export function createQuizHuntGameData(seed = DEFAULT_QUIZ_HUNT_SEED): QuizHuntGameData {
  const content = structuredClone(sfSpatialQuestions as QuizHuntContent)
  const nostromo = content.words.find((word) => word.id === 'nostromo')
  if (nostromo?.trial.clueMedia?.type === 'video') {
    nostromo.trial.clueMedia.src = nostromoVideoUrl
  }

  const draw = deriveGameDraw(content, seed)
  const trials = content.words.map((word) => ({
    id: word.id,
    label: word.label,
    color: word.color,
    clue: {
      label: word.trial.epreuveLabel,
      instructions: word.trial.consigne,
      ...(word.trial.clueText === undefined ? {} : { text: word.trial.clueText }),
      ...(word.trial.clueMedia?.src === undefined ? {} : { videoUrl: word.trial.clueMedia.src }),
    },
    revealDelayMs: word.trial.revealDelayMs ?? 3_000,
    question: toQuizQuestionDefinition(word.trial.question, word.id, 'épreuve'),
  }))
  const finals = content.words.map((word) => ({
    id: word.id,
    label: word.label,
    color: word.color,
    question: toQuizQuestionDefinition(word.finalQuestion, word.id, 'finale'),
  }))
  return { colors: content.colors, trials, finals, draw, seed }
}

/** Adapts one V1 question to the local Sighty answer definition. */
function toQuizQuestionDefinition(question: QuizHuntQuestion, wordId: string, kind: string): QuizQuestionDefinition {
  const correctAnswerIds = question.answers.filter((answer) => answer.isCorrect).map((answer) => answer.id)
  if (correctAnswerIds.length === 0) throw new Error(`La question ${kind} de ${wordId} ne contient pas de réponse correcte.`)
  return {
    type: question.type,
    prompt: question.prompt,
    answers: question.answers.map(({ id, label }) => ({ id, label })),
    correctAnswerIds,
  }
}
