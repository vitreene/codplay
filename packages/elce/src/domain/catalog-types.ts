import { BDC_TYPE, CATALOG_REFERENCE, MEDIA_TYPE } from '../config/document-config'
import type { BdcId, MediaId, MediaMetadata, PageId } from './document-types'

export type ElceMediaBdcType = typeof BDC_TYPE.IMAGE | typeof BDC_TYPE.VIDEO
export type ElceCatalogMediaType = typeof MEDIA_TYPE.IMAGE | typeof MEDIA_TYPE.VIDEO

export type ElceCatalogReference =
  | Readonly<{ kind: typeof CATALOG_REFERENCE.BDC; bdcId: BdcId }>
  | Readonly<{ kind: typeof CATALOG_REFERENCE.MEDIA; mediaId: MediaId }>

export interface ElceCatalogBdcEntry {
  readonly key: string
  readonly name: string
  readonly mediaType: ElceCatalogMediaType
  readonly reference: Extract<ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.BDC }>
}

export interface ElceCatalogMediaEntry {
  readonly key: string
  readonly name: string
  readonly mediaType: ElceCatalogMediaType
  readonly reference: Extract<ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.MEDIA }>
}

export interface ElceCatalogContents {
  readonly bdcs: readonly ElceCatalogBdcEntry[]
  readonly media: readonly ElceCatalogMediaEntry[]
}

type ElceCatalogDropTargetBase = Readonly<{
  pageId: PageId
  bdcId: BdcId
  mediaId: MediaId
  bdcType: ElceMediaBdcType
  presetId: string
  partId: string
  paddingBottom: string
}>

export type ElceCatalogDropTarget =
  | (ElceCatalogDropTargetBase & Readonly<{
      source: typeof CATALOG_REFERENCE.BDC
      reference: Extract<ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.BDC }>
    }>)
  | (ElceCatalogDropTargetBase & Readonly<{
      source: typeof CATALOG_REFERENCE.MEDIA
      reference: Extract<ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.MEDIA }>
      media: MediaMetadata
    }>)
