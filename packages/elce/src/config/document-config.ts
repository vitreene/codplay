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
  PARENT: 'parent',
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
  EVALUATION_RESULT: 'evaluation-result',
  CAROUSEL: 'carousel',
  CARD: 'card',
} as const

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

export const MEDIA_FILE_EXTENSIONS = {
  IMAGE: '.avif,.bmp,.gif,.jpeg,.jpg,.png,.svg,.webp',
  VIDEO: '.m4v,.mov,.mp4,.ogv,.webm',
} as const

export const MEDIA_FILE_ACCEPT = {
  IMAGE: `${MEDIA_FILE_EXTENSIONS.IMAGE},image/*`,
  IMAGE_AND_VIDEO: `${MEDIA_FILE_EXTENSIONS.IMAGE},${MEDIA_FILE_EXTENSIONS.VIDEO},image/*,video/*`,
} as const

export const DEFAULT_PRESET_ID = {
  CAROUSEL: 'carousel-basic',
  TEXT_IMAGE: 'text-image-basic',
  SECTION: 'section-basic',
  IMAGE: 'image-basic',
  VIDEO: 'video-basic',
  PHOTO: 'photo-basic',
  TEXT_SHORT: 'text-short-basic',
  QUESTION: 'question-basic',
  EVALUATION_RESULT: 'evaluation-result-basic',
  IMAGE_CAPTION: 'image-caption',
  MESSAGE: 'message-basic',
} as const

export const CAROUSEL_PLAYBACK_MODE = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
} as const

export const CAROUSEL_ASPECT_RATIO = {
  WIDE: '16:9',
  STANDARD: '4:3',
  SQUARE: '1:1',
} as const

export const CAROUSEL_IMAGE_POSITION = {
  LEFT: 'left',
  RIGHT: 'right',
} as const

export const CARD_IMAGE_FIT = {
  CONTAIN: 'contain',
  COVER: 'cover',
} as const

export const CARD_LAYOUT_IDS = [
  DEFAULT_PRESET_ID.PHOTO,
  DEFAULT_PRESET_ID.IMAGE_CAPTION,
  DEFAULT_PRESET_ID.TEXT_IMAGE,
  DEFAULT_PRESET_ID.TEXT_SHORT,
] as const

export const CAROUSEL_TRANSITION = {
  CUT: 'cut',
  FADE: 'fade',
  SWIPE_LEFT: 'swipe-left',
  SWIPE_RIGHT: 'swipe-right',
  SWIPE_TOP: 'swipe-top',
  SWIPE_DOWN: 'swipe-down',
  ZOOM: 'zoom',
} as const

export const CAROUSEL_TRANSITION_OPTIONS = [
  { value: CAROUSEL_TRANSITION.CUT, label: 'Aucune' },
  { value: CAROUSEL_TRANSITION.FADE, label: 'Fondu' },
  { value: CAROUSEL_TRANSITION.SWIPE_LEFT, label: 'Glissement vers la gauche' },
  { value: CAROUSEL_TRANSITION.SWIPE_RIGHT, label: 'Glissement vers la droite' },
  { value: CAROUSEL_TRANSITION.SWIPE_TOP, label: 'Glissement vers le haut' },
  { value: CAROUSEL_TRANSITION.SWIPE_DOWN, label: 'Glissement vers le bas' },
  { value: CAROUSEL_TRANSITION.ZOOM, label: 'Zoom' },
] as const

export const CAROUSEL_PLAYBACK_MODE_OPTIONS = [
  { value: CAROUSEL_PLAYBACK_MODE.AUTOMATIC, label: 'Automatique' },
  { value: CAROUSEL_PLAYBACK_MODE.MANUAL, label: 'Manuel' },
] as const

export const CAROUSEL_ASPECT_RATIO_OPTIONS = [
  { value: CAROUSEL_ASPECT_RATIO.WIDE, label: '16:9', ratio: { width: 16, height: 9 } },
  { value: CAROUSEL_ASPECT_RATIO.STANDARD, label: '4:3', ratio: { width: 4, height: 3 } },
  { value: CAROUSEL_ASPECT_RATIO.SQUARE, label: '1:1', ratio: { width: 1, height: 1 } },
] as const

export const CAROUSEL_IMAGE_POSITION_OPTIONS = [
  { value: CAROUSEL_IMAGE_POSITION.LEFT, label: 'Image à gauche' },
  { value: CAROUSEL_IMAGE_POSITION.RIGHT, label: 'Image à droite' },
] as const

export const CARD_IMAGE_FIT_OPTIONS = [
  { value: CARD_IMAGE_FIT.CONTAIN, label: 'Contenir' },
  { value: CARD_IMAGE_FIT.COVER, label: 'Couvrir' },
] as const

export const CARD_LAYOUT_OPTIONS = [
  { value: DEFAULT_PRESET_ID.TEXT_SHORT, label: 'Texte court' },
  { value: DEFAULT_PRESET_ID.TEXT_IMAGE, label: 'Texte avec image' },
  { value: DEFAULT_PRESET_ID.PHOTO, label: 'Photo ou vidéo plein cadre' },
  { value: DEFAULT_PRESET_ID.IMAGE_CAPTION, label: 'Image avec légende' },
] as const

export const CAROUSEL_CONFIG = {
  bdcPresetId: DEFAULT_PRESET_ID.CAROUSEL,
  cardDragMimeType: 'application/x-elce-bdc-card+json',
  initialCardLayoutId: DEFAULT_PRESET_ID.TEXT_SHORT,
  defaultAspectRatio: { width: 16, height: 9 },
  defaultPlaybackMode: CAROUSEL_PLAYBACK_MODE.MANUAL,
  defaultViewDurationMs: 5000,
  minimumViewDurationSeconds: 1,
  maximumViewDurationSeconds: 10,
  defaultRepeatCount: 10,
  minimumRepeatCount: 0,
  maximumRepeatCount: 10,
  defaultImagePosition: CAROUSEL_IMAGE_POSITION.LEFT,
  defaultImageFit: CARD_IMAGE_FIT.COVER,
  textShortMessageMaxLength: 250,
  defaultTransition: CAROUSEL_TRANSITION.FADE,
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
  MENU_DRAWER_OPEN: 'elce:menu:drawer:open',
  MENU_DRAWER_CLOSE: 'elce:menu:drawer:close',
  MENU_DRAWER_CLOSE_REQUEST: 'elce:menu:drawer:close-request',
  NAVIGATION_NEXT: 'elce:navigation:next',
  NAVIGATION_PREVIOUS: 'elce:navigation:previous',
  PAGE_BOTTOM: 'elce:page:bottom',
  QUESTION_ANSWERED: 'elce:question:answered',
  EVALUATION_RESULT_SUCCESS: 'elce:evaluation:result:success',
  EVALUATION_RESULT_FAILURE: 'elce:evaluation:result:failure',
  EVALUATION_RESULT_ACTION: 'elce:evaluation:result:action',
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
  OPEN_MENU_DRAWER: 'action:elce:open-menu-drawer',
  CLOSE_MENU_DRAWER: 'action:elce:close-menu-drawer',
  MARK_PAGE_FINISHED: 'action:elce:mark-page-finished',
  RECORD_QUESTION_RESULT: 'action:elce:record-question-result',
  PAGE_ACCESS: 'guard:elce:page-access',
  PAGE_EXIT: 'guard:elce:page-exit',
} as const
