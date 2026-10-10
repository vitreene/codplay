/** Names the public game events and the local scene projection messages. */
export const QUIZ_HUNT_EVENTS = {
  refresh: 'quiz-hunt:presentation:refresh',
  timerPause: 'quiz-hunt:timer:pause',
  timerPlay: 'quiz-hunt:timer:play',
  timerStop: 'quiz-hunt:timer:stop',
  timerPaused: 'quiz-hunt:timer:paused',
  timerExpired: 'quiz-hunt:timer:expired',
  timerExpiredDuringFeedback: 'quiz-hunt:timer:expired-during-feedback',
  timerFeedbackPending: 'quiz-hunt:timer:feedback-pending',
  timerFeedbackFinished: 'quiz-hunt:timer:feedback-finished',
  questionRevealDue: 'quiz-hunt:question:reveal-due',
  questionReveal: 'quiz-hunt:question:reveal',
  trialAnswered: 'quiz-hunt:trial:answered',
  trialFeedbackFinished: 'quiz-hunt:trial:feedback-finished',
  finalAnswered: 'quiz-hunt:final:answered',
  finalFeedbackFinished: 'quiz-hunt:final:feedback-finished',
  basketProject: 'quiz-hunt:basket:project',
  menuProject: 'quiz-hunt:menu:project',
  resultProject: 'quiz-hunt:result:project',
  resultShow: 'quiz-hunt:result:show',
  resultPassed: 'quiz-hunt:result:verdict:passed',
  resultFailed: 'quiz-hunt:result:verdict:failed',
  resultSummary: 'quiz-hunt:result:summary',
  resultTime: 'quiz-hunt:result:time',
} as const

/** Creates the public menu intent for one stable trial id. */
export function openTrialEvent(trialId: string): string {
  return `quiz-hunt:trial:open:${trialId}`
}

/** Creates the local button projection event for one trial's progress state. */
export function menuTrialStatusEvent(
  trialId: string,
  status: 'available' | 'success' | 'failed',
): string {
  return `quiz-hunt:menu:trial:${trialId}:${status}`
}

/** Creates the local story event that begins one trial's clue phase. */
export function enterTrialEvent(trialId: string): string {
  return `quiz-hunt:trial:enter:${trialId}`
}

/** Creates the public correction event that records one trial's outcome. */
export function trialAnsweredEvent(trialId: string): string {
  return `${QUIZ_HUNT_EVENTS.trialAnswered}:${trialId}`
}

/** Creates the public event that returns one resolved trial to the menu. */
export function trialFeedbackFinishedEvent(trialId: string): string {
  return `${QUIZ_HUNT_EVENTS.trialFeedbackFinished}:${trialId}`
}

/** Creates the public basket intent for one generated final question. */
export function openFinalEvent(finalId: string): string {
  return `quiz-hunt:final:open:${finalId}`
}

/** Creates the public answer-result event for one generated final question. */
export function finalAnsweredEvent(finalId: string): string {
  return `${QUIZ_HUNT_EVENTS.finalAnswered}:${finalId}`
}

/** Creates the public event emitted after one final question's feedback. */
export function finalFeedbackFinishedEvent(finalId: string): string {
  return `${QUIZ_HUNT_EVENTS.finalFeedbackFinished}:${finalId}`
}

/** Creates the local show/hide projection event for one final button. */
export function basketFinalButtonEvent(finalId: string, visible: boolean): string {
  return `quiz-hunt:basket:final-button:${finalId}:${visible ? 'show' : 'hide'}`
}

/** Creates the basket projection event for one color's current word. */
export function basketColorEvent(color: string): string {
  return `quiz-hunt:basket:color:${color}`
}

/** Creates the Sighty route path for one question view in the content slot. */
export function trialViewPath(trialId: string): string {
  return `view-game/slot-content/view-trial-${trialId}`
}

/** Creates the Sighty route path for one generated final question. */
export function finalViewPath(finalId: string): string {
  return `view-game/slot-content/view-final-${finalId}`
}
