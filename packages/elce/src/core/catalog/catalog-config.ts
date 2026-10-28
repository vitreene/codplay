export const CATALOG_REFERENCE = {
  MIME_TYPE: 'application/x-elce-catalog-reference+json',
  BDC: 'bdc',
  MEDIA: 'media',
} as const

export const CATALOG_TAB = {
  AVAILABLE_BDCS: 'available-bdcs',
  MEDIA: 'media',
} as const

export type CatalogResourceTab = typeof CATALOG_TAB[keyof typeof CATALOG_TAB]
