import type { BdcId, MediaMetadata } from '../document/document-types'
import type { ElceCatalogDropTarget, ElceCatalogMediaType } from '../catalog/catalog-types'
import type { CardLayoutId } from '../../config/document-config-types'

export type { ElceCatalogDropTarget } from '../catalog/catalog-types'

/** Describes the business data carried by a media dropped into a Flux. */
export interface ElceAnchorDropTarget {
  readonly pageId: string
  readonly bdcId: BdcId
  readonly media: MediaMetadata
  readonly presetId: string
  readonly partId: string
  readonly paddingBottom: string
}

export type ElceAnchorMediaPreview = Readonly<{
  readonly source: string
  readonly type: ElceCatalogMediaType
  readonly layoutId: CardLayoutId
}>

/** Describes one serializable editor change handled by the anchor service. */
export type ElceSectionChange = Readonly<{
  readonly title: string
  readonly content: import('../document/document-types').RichTextDocument
  readonly markup: string
}> & (
  | Readonly<{ kind: 'content' }>
  | Readonly<{ kind: 'file-drop'; file: File; target: ElceAnchorDropTarget }>
  | Readonly<{ kind: 'catalog-drop'; target: ElceCatalogDropTarget }>
  | Readonly<{ kind: 'anchor-move'; anchorBdcId: BdcId }>
  | Readonly<{ kind: 'anchor-remove'; anchorBdcId: BdcId }>
  | Readonly<{ kind: 'anchor-return'; anchorBdcId: BdcId }>
)
