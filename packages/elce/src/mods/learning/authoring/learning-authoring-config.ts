import { CATALOG_TAB as CATALOG_RESOURCE_TAB } from '../../../core/catalog/catalog-config'

export const CATALOG_TAB = {
  ...CATALOG_RESOURCE_TAB,
  PROFILE: 'profile',
} as const

export const LEARNING_AUTHORING_CONFIG = {
  summaryProfileEditing: true,
} as const

export type CatalogTabType = typeof CATALOG_TAB[keyof typeof CATALOG_TAB]
