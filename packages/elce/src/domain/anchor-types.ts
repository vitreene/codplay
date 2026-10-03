import type { BdcId, MediaId, MediaMetadata } from './document-types'
import type { ElceCatalogDropTarget, ElceMediaBdcType } from './catalog-types'

export type { ElceCatalogDropTarget } from './catalog-types'

/** Describes the business data carried by a media dropped into a Flux. */
export interface ElceAnchorDropTarget {
  readonly pageId: string
  readonly bdcId: BdcId
  readonly mediaId: MediaId
  readonly media: MediaMetadata
  readonly bdcType: ElceMediaBdcType
  readonly presetId: string
  readonly partId: string
  readonly paddingBottom: string
}

/** Describes one serializable editor change handled by the anchor service. */
export type ElceSectionChange = Readonly<{
  readonly title: string
  readonly content: import('./document-types').RichTextDocument
  readonly markup: string
}> & (
  | Readonly<{ kind: 'content' }>
  | Readonly<{ kind: 'file-drop'; file: File; target: ElceAnchorDropTarget }>
  | Readonly<{ kind: 'catalog-drop'; target: ElceCatalogDropTarget }>
  | Readonly<{ kind: 'anchor-move'; anchorBdcId: BdcId }>
  | Readonly<{ kind: 'anchor-remove'; anchorBdcId: BdcId }>
  | Readonly<{ kind: 'anchor-return'; anchorBdcId: BdcId }>
)
