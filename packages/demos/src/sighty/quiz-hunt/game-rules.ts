import type { QuizHuntFinal, QuizHuntTrial } from './game-data'

export const QUIZ_HUNT_TIMER_BUDGET_MS = 180_000

export type QuizHuntTrialStatus = 'available' | 'success' | 'failed'
export type QuizHuntGameScreen = 'menu' | 'trial' | 'final' | 'result'
export type QuizHuntGameOutcome = 'won' | 'lost'

/** Stores durable game progression in Sighty's scenario context. */
export type QuizHuntProgress = Readonly<{
  trialStatus: Readonly<Record<string, QuizHuntTrialStatus>>
  basket: Readonly<Record<string, string | null>>
  timerRemainingMs: number
  finalAttemptedWordIds: readonly string[]
  feedbackPending: string | null
  pendingTimerExpiry: boolean
  resumeTimerAfterFinal: boolean
  outcome: QuizHuntGameOutcome | null
  screen: QuizHuntGameScreen
}>

/** Creates the empty game state before the first trial is opened. */
export function createInitialQuizHuntProgress(
  trials: readonly QuizHuntTrial[],
  colors: readonly string[] = [...new Set(trials.map((trial) => trial.color))],
): QuizHuntProgress {
  const trialStatus = Object.fromEntries(trials.map((trial) => [trial.id, 'available'])) as Record<string, QuizHuntTrialStatus>
  const basket = Object.fromEntries(colors.map((color) => [color, null]))
  return {
    trialStatus,
    basket,
    timerRemainingMs: QUIZ_HUNT_TIMER_BUDGET_MS,
    finalAttemptedWordIds: [],
    feedbackPending: null,
    pendingTimerExpiry: false,
    resumeTimerAfterFinal: false,
    outcome: null,
    screen: 'menu',
  }
}

/** Reads a valid game state from the untyped Sighty context record. */
export function readQuizHuntProgress(
  value: unknown,
  trials: readonly QuizHuntTrial[],
  colors: readonly string[] = [...new Set(trials.map((trial) => trial.color))],
): QuizHuntProgress {
  if (typeof value !== 'object' || value === null) return createInitialQuizHuntProgress(trials, colors)
  const candidate = value as Partial<QuizHuntProgress>
  const initial = createInitialQuizHuntProgress(trials, colors)
  const trialStatus = Object.fromEntries(trials.map((trial) => {
    const status = candidate.trialStatus?.[trial.id]
    return [trial.id, status === 'success' || status === 'failed' ? status : 'available']
  })) as Record<string, QuizHuntTrialStatus>
  const trialIds = new Set(trials.map((trial) => trial.id))
  const basket = Object.fromEntries(Object.keys(initial.basket).map((color) => {
    const value = candidate.basket?.[color]
    return [color, typeof value === 'string' && trialIds.has(value) ? value : null]
  }))
  const timerRemainingMs = typeof candidate.timerRemainingMs === 'number'
    ? Math.max(0, Math.min(QUIZ_HUNT_TIMER_BUDGET_MS, candidate.timerRemainingMs))
    : QUIZ_HUNT_TIMER_BUDGET_MS
  const finalAttemptedWordIds = Array.isArray(candidate.finalAttemptedWordIds)
    ? candidate.finalAttemptedWordIds.filter((trialId): trialId is string => typeof trialId === 'string' && trialIds.has(trialId))
    : []
  const knownScreen = candidate.screen === 'trial' || candidate.screen === 'final' || candidate.screen === 'result'
    ? candidate.screen
    : 'menu'
  return {
    trialStatus,
    basket,
    timerRemainingMs,
    finalAttemptedWordIds,
    feedbackPending: typeof candidate.feedbackPending === 'string' ? candidate.feedbackPending : null,
    pendingTimerExpiry: candidate.pendingTimerExpiry === true,
    resumeTimerAfterFinal: candidate.resumeTimerAfterFinal === true,
    outcome: candidate.outcome === 'won' || candidate.outcome === 'lost' ? candidate.outcome : null,
    screen: knownScreen,
  }
}

/** Records one accepted answer once and updates the matching basket color. */
export function recordQuizHuntAnswer(
  progress: QuizHuntProgress,
  trial: QuizHuntTrial,
  isCorrect: boolean,
): QuizHuntProgress {
  if (progress.trialStatus[trial.id] !== 'available') return progress
  return {
    ...progress,
    trialStatus: { ...progress.trialStatus, [trial.id]: isCorrect ? 'success' : 'failed' },
    basket: isCorrect ? { ...progress.basket, [trial.color]: trial.id } : progress.basket,
    feedbackPending: `trial:${trial.id}`,
  }
}

/** Resolves one final answer and selects its replacement, retry, or terminal branch. */
export function recordQuizHuntFinalAnswer(
  progress: QuizHuntProgress,
  final: QuizHuntFinal,
  trials: readonly QuizHuntTrial[],
  finalColor: string,
  isCorrect: boolean,
): QuizHuntProgress {
  if (
    progress.outcome !== null
    || progress.feedbackPending !== null
    || progress.basket[finalColor] !== final.id
    || progress.trialStatus[final.id] !== 'success'
    || progress.finalAttemptedWordIds.includes(final.id)
  ) return progress

  if (isCorrect) {
    return {
      ...progress,
      feedbackPending: `final:${final.id}`,
      resumeTimerAfterFinal: false,
      outcome: 'won',
    }
  }

  const finalAttemptedWordIds = [...progress.finalAttemptedWordIds, final.id]
  const trialStatus = { ...progress.trialStatus, [final.id]: 'failed' as const }
  const replacement = trials.find((trial) => (
    trial.color === finalColor
    && trial.id !== final.id
    && trialStatus[trial.id] === 'success'
    && !finalAttemptedWordIds.includes(trial.id)
  ))

  if (replacement !== undefined) {
    return {
      ...progress,
      trialStatus,
      basket: { ...progress.basket, [finalColor]: replacement.id },
      finalAttemptedWordIds,
      feedbackPending: `final:${final.id}`,
      resumeTimerAfterFinal: false,
      outcome: null,
    }
  }

  const hasAvailableQuestion = trials.some((trial) => (
    trial.color === finalColor
    && !finalAttemptedWordIds.includes(trial.id)
    && trialStatus[trial.id] === 'available'
  ))
  return {
    ...progress,
    trialStatus,
    basket: { ...progress.basket, [finalColor]: null },
    finalAttemptedWordIds,
    feedbackPending: `final:${final.id}`,
    resumeTimerAfterFinal: hasAvailableQuestion,
    outcome: hasAvailableQuestion ? null : 'lost',
  }
}

/** Stores the latest remaining budget reported by the local basket timer. */
export function recordQuizHuntTimer(
  progress: QuizHuntProgress,
  timerRemainingMs: unknown,
): QuizHuntProgress {
  if (typeof timerRemainingMs !== 'number' || !Number.isFinite(timerRemainingMs)) return progress
  return {
    ...progress,
    timerRemainingMs: Math.max(0, Math.min(QUIZ_HUNT_TIMER_BUDGET_MS, timerRemainingMs)),
  }
}
