export const QUESTION_BDC_TYPE = 'question' as const

export const QUESTION_PRESET_ID = 'question-basic' as const

export const QUESTION_TYPE = {
  TRUE_FALSE: 'true-false',
  CHOICE: 'choice',
  MULTIPLE_CHOICE: 'multiple-choice',
} as const

export const QUESTION_TYPE_CONFIG = {
  [QUESTION_TYPE.TRUE_FALSE]: {
    label: 'Vrai / Faux',
    inputType: 'radio',
    selection: 'single',
    editableAnswers: false,
    defaultAnswers: [
      { label: 'Oui', correct: true },
      { label: 'Non', correct: false },
    ],
    instruction: 'Sélectionnez une réponse, puis validez.',
    note: '',
  },
  [QUESTION_TYPE.CHOICE]: {
    label: 'Choix',
    inputType: 'radio',
    selection: 'single',
    editableAnswers: true,
    defaultAnswers: [
      { label: 'Réponse 1', correct: true },
      { label: 'Réponse 2', correct: false },
    ],
    instruction: 'Sélectionnez une réponse, puis validez.',
    note: '',
  },
  [QUESTION_TYPE.MULTIPLE_CHOICE]: {
    label: 'Choix multiple',
    inputType: 'checkbox',
    selection: 'multiple',
    editableAnswers: true,
    defaultAnswers: [
      { label: 'Réponse 1', correct: true },
      { label: 'Réponse 2', correct: false },
    ],
    instruction: 'Plusieurs réponses possibles. Sélectionnez-les, puis validez.',
    note: 'Plusieurs réponses possibles',
  },
} as const

export const QUESTION_TYPE_OPTIONS = [
  { value: QUESTION_TYPE.TRUE_FALSE, label: QUESTION_TYPE_CONFIG[QUESTION_TYPE.TRUE_FALSE].label },
  { value: QUESTION_TYPE.CHOICE, label: QUESTION_TYPE_CONFIG[QUESTION_TYPE.CHOICE].label },
  { value: QUESTION_TYPE.MULTIPLE_CHOICE, label: QUESTION_TYPE_CONFIG[QUESTION_TYPE.MULTIPLE_CHOICE].label },
] as const

export const QUESTION_DEFAULTS = {
  VALIDATE_LABEL: 'Valider la réponse',
} as const

export const QUESTION_EVENTS = {
  ANSWERED: 'elce:question:answered',
  RESET: 'elce:question:reset',
  RESTORE: 'elce:question:restore',
} as const

export type ConfiguredQuestionType = typeof QUESTION_TYPE[keyof typeof QUESTION_TYPE]
