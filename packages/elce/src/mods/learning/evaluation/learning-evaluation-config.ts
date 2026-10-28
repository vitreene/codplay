export const EVALUATION_RESULT_BDC_TYPE = 'evaluation-result' as const

export const EVALUATION_RESULT_PRESET_ID = 'evaluation-result-basic' as const

export const EVALUATION_RESULT_BRANCH = {
  SUCCESS: 'success',
  FAILURE: 'failure',
} as const

export const EVALUATION_RESULT_ACTION = {
  MENU: 'menu',
  REPLAY: 'replay',
  RETRY: 'retry',
} as const

export const EVALUATION_RESULT_CONFIG = {
  [EVALUATION_RESULT_BRANCH.SUCCESS]: {
    label: 'Réussite',
    messagePlaceholder: 'Message de réussite',
    actionLabel: 'Action du bouton',
    actions: [
      { value: EVALUATION_RESULT_ACTION.REPLAY, label: 'Relire les réponses' },
      { value: EVALUATION_RESULT_ACTION.MENU, label: 'Retour au menu' },
    ],
  },
  [EVALUATION_RESULT_BRANCH.FAILURE]: {
    label: 'Échec',
    messagePlaceholder: 'Message en cas d’échec',
    actionLabel: 'Action du bouton',
    actions: [
      { value: EVALUATION_RESULT_ACTION.RETRY, label: 'Recommencer l’évaluation' },
      { value: EVALUATION_RESULT_ACTION.MENU, label: 'Retour au menu' },
    ],
  },
} as const

export const EVALUATION_RETRY_SCOPE = {
  ALL_QUESTIONS: 'all-questions',
  INCORRECT_QUESTIONS: 'incorrect-questions',
} as const

export const DEFAULT_EVALUATION_THRESHOLD = 0.8 as const

export const DEFAULT_EVALUATION_SETTINGS = {
  threshold: DEFAULT_EVALUATION_THRESHOLD,
  attemptLimit: null,
  retryScope: EVALUATION_RETRY_SCOPE.ALL_QUESTIONS,
} as const

export type EvaluationRetryScope = typeof EVALUATION_RETRY_SCOPE[keyof typeof EVALUATION_RETRY_SCOPE]
export type EvaluationResultAction = typeof EVALUATION_RESULT_ACTION[keyof typeof EVALUATION_RESULT_ACTION]
export type EvaluationResultBranch = typeof EVALUATION_RESULT_BRANCH[keyof typeof EVALUATION_RESULT_BRANCH]
