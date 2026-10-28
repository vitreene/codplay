import type { BdcId, PageId } from './content-document-types'

export const BDC_LOCATION = {
  PAGE: 'page',
  PARENT: 'parent',
  CATALOG: 'catalog',
} as const

/** Placement destinations supported by the common BDC collection operations. */
export type BdcPlacement =
  | Readonly<{ kind: typeof BDC_LOCATION.PAGE; pageId: PageId; index?: number }>
  | Readonly<{ kind: typeof BDC_LOCATION.PARENT; parentBdcId: BdcId; index?: number }>
  | Readonly<{ kind: typeof BDC_LOCATION.CATALOG }>

export type BdcLocationKind = typeof BDC_LOCATION[keyof typeof BDC_LOCATION]

export const BDC_ORDER = {
  MIME_TYPE: 'application/x-elce-bdc-order+json',
} as const
