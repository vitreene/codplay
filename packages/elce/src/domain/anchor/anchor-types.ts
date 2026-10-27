import type { BdcId, MediaMetadata } from '../document/document-types'
import type { ElceCatalogDropTarget, ElceCatalogMediaType } from '../catalog/catalog-types'
import type { CardLayoutId } from '../../config/document-config-types'
import type { CardContent } from '../card/card-types'
import type { StatisticalGraphContent } from '../statistical-graph/statistical-graph-types'
import type { StatisticalGraphLayoutId } from '../../config/document-config-types'

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

export type ElceAnchorCardPreview = Readonly<{
  readonly kind?: 'card'
  readonly content: CardContent
  readonly layoutId: CardLayoutId
  readonly media: Readonly<{ source: string; type: ElceCatalogMediaType }> | null
  readonly appearanceClassName?: string
  readonly appearanceStyleSheet?: string
}> | Readonly<{
  readonly kind: 'statistical-graph'
  readonly content: StatisticalGraphContent
  readonly layoutId: StatisticalGraphLayoutId
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
