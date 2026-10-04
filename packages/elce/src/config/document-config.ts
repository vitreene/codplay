export const PAGE_LOCATION = {
  CHAPTER: 'chapter',
  SCENARIO: 'scenario',
  CATALOG: 'catalog',
} as const

export const SCENARIO_ENTRY_KIND = {
  PAGE: 'page',
  CHAPTER: 'chapter',
} as const

export const BDC_LOCATION = {
  PAGE: 'page',
  CATALOG: 'catalog',
} as const

export const CATALOG_TAB = {
  AVAILABLE_BDCS: 'available-bdcs',
  MEDIA: 'media',
} as const

export const CATALOG_REFERENCE = {
  MIME_TYPE: 'application/x-elce-catalog-reference+json',
  BDC: 'bdc',
  MEDIA: 'media',
} as const

export const ANCHOR_RETURN = {
  MIME_TYPE: 'application/x-elce-anchor-return+json',
} as const

export const PAGE_TYPE = {
  FLUX: 'flux',
  DIAPO: 'diapo',
} as const

export const CHAPTER_TYPE = {
  STANDARD: 'standard',
  EVALUATION: 'evaluation',
} as const

export const BDC_TYPE = {
  SECTION: 'section',
  IMAGE: 'image',
  VIDEO: 'video',
  QUESTION: 'question',
  DIAPO: 'diapo',
} as const

export const CHAPTER_TYPE_CONFIG = {
  [CHAPTER_TYPE.STANDARD]: {
    label: null,
    defaultBdcType: BDC_TYPE.SECTION,
    titleLabel: 'Titre du chapitre',
    editTitleLabel: 'Modifier le titre du chapitre',
    createLabel: 'Ajouter un chapitre',
    icon: 'folder',
  },
  [CHAPTER_TYPE.EVALUATION]: {
    label: null,
    defaultBdcType: BDC_TYPE.QUESTION,
    defaultName: 'Évaluation',
    titleLabel: 'Titre de l’évaluation',
    editTitleLabel: 'Modifier le titre de l’évaluation',
    createLabel: 'Ajouter un chapitre d’évaluation',
    icon: 'clipboard-check',
  },
} as const

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

export const BDC_ORDER = {
  MIME_TYPE: 'application/x-elce-bdc-order+json',
} as const

export const QUESTION_DEFAULTS = {
  VALIDATE_LABEL: 'Valider la réponse',
} as const

export const EVALUATION_RETRY_SCOPE = {
  ALL_QUESTIONS: 'all-questions',
  INCORRECT_QUESTIONS: 'incorrect-questions',
} as const

export const MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
} as const

export const MEDIA_MIME_PREFIX = {
  IMAGE: 'image/',
  VIDEO: 'video/',
} as const

export const DEFAULT_PRESET_ID = {
  SECTION: 'section-basic',
  IMAGE: 'image-basic',
  VIDEO: 'video-basic',
  QUESTION: 'question-basic',
  IMAGE_CAPTION: 'image-caption',
  MESSAGE: 'message-basic',
} as const

export const DEFAULT_EVALUATION_THRESHOLD = 0.8 as const

export const DEFAULT_EVALUATION_SETTINGS = {
  threshold: DEFAULT_EVALUATION_THRESHOLD,
  attemptLimit: null,
  retryScope: EVALUATION_RETRY_SCOPE.ALL_QUESTIONS,
} as const

export const SECTION_EDITOR_HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

export const ANCHOR = {
  NODE_NAME: 'elceAnchor',
  DATA_ATTRIBUTE: 'data-elce-anchor',
  CLASS_NAME: 'elce-anchor',
  PADDING_VARIABLE: '--elce-anchor-padding',
  FLOW_BREAK_MARGIN: '100%',
  EDITOR_LINE_BLOCK_SIZE: '1lh',
  DEFAULT_PADDING_BOTTOM: '12rem',
  IMAGE_BLOCK_SIZE: '75%',
  DEFAULT_IMAGE_ASPECT_RATIO: '4 / 3',
  VIDEO_BLOCK_SIZE: '56.25%',
  DEFAULT_BDC_MARGIN_TOP: '1rem',
  DEFAULT_BDC_MARGIN_BOTTOM: '1rem',
} as const

export const ANCHOR_MEDIA_PRESETS = {
  [MEDIA_TYPE.IMAGE]: {
    bdcType: BDC_TYPE.IMAGE,
    presetId: DEFAULT_PRESET_ID.IMAGE,
    blockSize: ANCHOR.IMAGE_BLOCK_SIZE,
  },
  [MEDIA_TYPE.VIDEO]: {
    bdcType: BDC_TYPE.VIDEO,
    presetId: DEFAULT_PRESET_ID.VIDEO,
    blockSize: ANCHOR.VIDEO_BLOCK_SIZE,
  },
} as const

export const ELCE_SCENARIO = {
  ROOT_VIEW: 'main',
  LAYOUT_SCENE: 'scene-layout',
  MENU_SCENE: 'scene-menu',
  TITLE_SCENE: 'scene-title',
  NAVIGATION_SCENE: 'scene-navigation',
  MENU_SLOT: 'slot-menu',
  TITLE_SLOT: 'slot-title',
  CONTENT_SLOT: 'slot-content',
  NAVIGATION_SLOT: 'slot-navigation',
  EMPTY_ENTRY_VIEW: 'empty-scenario-entry',
  EMPTY_PAGE: 'empty',
} as const

/** Names the public events and scenario handlers shared by the player scenes. */
export const ELCE_EVENTS = {
  RUNTIME_INITIALIZE: 'runtime:initialize',
  MENU_PREFIX: 'elce:menu:select:',
  NAVIGATION_NEXT: 'elce:navigation:next',
  NAVIGATION_PREVIOUS: 'elce:navigation:previous',
  PAGE_BOTTOM: 'elce:page:bottom',
  QUESTION_ANSWERED: 'elce:question:answered',
  PRESENTATION_REFRESH: 'elce:presentation:refresh',
  PRESENTATION_MENU: 'elce:presentation:menu',
  PRESENTATION_MENU_PAGE_PREFIX: 'elce:presentation:menu-page:',
  PRESENTATION_TITLE: 'elce:presentation:title',
  PRESENTATION_NAVIGATION_PREVIOUS: 'elce:presentation:navigation-previous',
  PRESENTATION_NAVIGATION_NEXT: 'elce:presentation:navigation-next',
  PRESENTATION_NAVIGATION_STATUS: 'elce:presentation:navigation-status',
} as const

/** Names the declared Sighty handlers used by the Elcé document scenario. */
export const ELCE_SCENARIO_HANDLERS = {
  REFRESH_PRESENTATION: 'action:elce:refresh-presentation',
  MARK_PAGE_FINISHED: 'action:elce:mark-page-finished',
  RECORD_QUESTION_RESULT: 'action:elce:record-question-result',
  PAGE_ACCESS: 'guard:elce:page-access',
  PAGE_EXIT: 'guard:elce:page-exit',
} as const
