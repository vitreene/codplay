import { QUESTION_BDC_TYPE } from '../../../resources/bdcs/question/question-config'
import { SECTION_BDC_TYPE } from '../../../resources/bdcs/section/section-config'

export const SCENARIO_ENTRY_KIND = {
  PAGE: 'page',
  CHAPTER: 'chapter',
} as const

export const CHAPTER_TYPE = {
  STANDARD: 'standard',
  EVALUATION: 'evaluation',
} as const

export const CHAPTER_TYPE_CONFIG = {
  [CHAPTER_TYPE.STANDARD]: {
    label: null,
    defaultBdcType: SECTION_BDC_TYPE,
    titleLabel: 'Titre du chapitre',
    editTitleLabel: 'Modifier le titre du chapitre',
    createLabel: 'Ajouter un chapitre',
    icon: 'folder',
  },
  [CHAPTER_TYPE.EVALUATION]: {
    label: null,
    defaultBdcType: QUESTION_BDC_TYPE,
    defaultName: 'Évaluation',
    titleLabel: 'Titre de l’évaluation',
    editTitleLabel: 'Modifier le titre de l’évaluation',
    createLabel: 'Ajouter un chapitre d’évaluation',
    icon: 'clipboard-check',
  },
} as const

export type ChapterType = typeof CHAPTER_TYPE[keyof typeof CHAPTER_TYPE]
export type ScenarioEntryKind = typeof SCENARIO_ENTRY_KIND[keyof typeof SCENARIO_ENTRY_KIND]
