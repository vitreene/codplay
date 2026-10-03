export const PAGE_LOCATION = {
  CHAPTER: 'chapter',
  SCENARIO: 'scenario',
  CATALOG: 'catalog',
} as const

export const BDC_LOCATION = {
  PAGE: 'page',
  CATALOG: 'catalog',
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

export const MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
} as const

export const DEFAULT_PRESET_ID = {
  SECTION: 'section-basic',
  IMAGE: 'image-basic',
  VIDEO: 'video-basic',
} as const

export const DEFAULT_EVALUATION_THRESHOLD = 0.8 as const

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
  ROOT_PAGES_VIEW: 'view-root-pages',
  EMPTY_PAGE: 'empty',
} as const

/** Names the public events and scenario handlers shared by the player scenes. */
export const ELCE_EVENTS = {
  RUNTIME_INITIALIZE: 'runtime:initialize',
  MENU_PREFIX: 'elce:menu:select:',
  NAVIGATION_NEXT: 'elce:navigation:next',
  NAVIGATION_PREVIOUS: 'elce:navigation:previous',
  PAGE_BOTTOM: 'elce:page:bottom',
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
  PAGE_ACCESS: 'guard:elce:page-access',
  PAGE_EXIT: 'guard:elce:page-exit',
} as const
