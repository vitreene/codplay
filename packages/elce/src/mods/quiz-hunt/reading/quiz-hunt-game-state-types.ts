export type QuizHuntTrialStatus = 'available' | 'success' | 'failed'
export type QuizHuntGameScreen = 'menu' | 'trial' | 'final' | 'result'
export type QuizHuntGameOutcome = 'success' | 'failure'

/** Captures the complete mod-owned game state that Sighty actions can restore. */
export interface QuizHuntGameState {
  readonly trialStatus: Readonly<Record<string, QuizHuntTrialStatus>>
  readonly basket: Readonly<Record<string, string | null>>
  readonly timerRemainingMs: number
  readonly timerStartedAtMs: number | null
  readonly screen: QuizHuntGameScreen
  readonly activeTrialId: string | null
  readonly activeFinalId: string | null
  readonly feedbackPending: string | null
  readonly pendingTimerExpiry: boolean
  readonly outcome: QuizHuntGameOutcome | null
  readonly extraOfferedOn: string | null
  readonly extraAvailable: boolean
}
