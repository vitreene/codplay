import { BDC_LOCATION, BDC_TYPE, CATALOG_TAB, CHAPTER_TYPE, EVALUATION_RETRY_SCOPE, MEDIA_TYPE, PAGE_LOCATION, PAGE_TYPE, QUESTION_TYPE, SCENARIO_ENTRY_KIND } from './document-config'

export type PageLocationKind = typeof PAGE_LOCATION[keyof typeof PAGE_LOCATION]
export type ScenarioEntryKind = typeof SCENARIO_ENTRY_KIND[keyof typeof SCENARIO_ENTRY_KIND]
export type BdcLocationKind = typeof BDC_LOCATION[keyof typeof BDC_LOCATION]
export type CatalogTabType = typeof CATALOG_TAB[keyof typeof CATALOG_TAB]
export type PageType = typeof PAGE_TYPE[keyof typeof PAGE_TYPE]
export type ChapterType = typeof CHAPTER_TYPE[keyof typeof CHAPTER_TYPE]
export type BdcType = typeof BDC_TYPE[keyof typeof BDC_TYPE]
export type MediaType = typeof MEDIA_TYPE[keyof typeof MEDIA_TYPE]
export type ConfiguredQuestionType = typeof QUESTION_TYPE[keyof typeof QUESTION_TYPE]
export type EvaluationRetryScope = typeof EVALUATION_RETRY_SCOPE[keyof typeof EVALUATION_RETRY_SCOPE]
