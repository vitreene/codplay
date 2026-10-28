import type { BdcId, MediaMetadata } from '../../../core/document/content-document-types'
import type { ElceCatalogDropTarget, ElceCatalogMediaType } from '../../../core/catalog/catalog-types'
import type { CardLayoutId } from '../../bdcs/card/card-config'
import type { CardContent } from '../../bdcs/card/domain/card-types'
import type { StatisticalGraphContent } from '../../bdcs/statistical-graph/domain/statistical-graph-types'
import type { StatisticalGraphLayoutId } from '../../bdcs/statistical-graph/statistical-graph-config'

export type { ElceCatalogDropTarget } from '../../../core/catalog/catalog-types'

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
  readonly content: import('../../bdcs/section/domain/section-types').RichTextDocument
  readonly markup: string
}> & (
  | Readonly<{ kind: 'content' }>
  | Readonly<{ kind: 'file-drop'; file: File; target: ElceAnchorDropTarget }>
  | Readonly<{ kind: 'anchor-ratio' }>
  | Readonly<{ kind: 'catalog-drop'; target: ElceCatalogDropTarget }>
  | Readonly<{ kind: 'anchor-move'; anchorBdcId: BdcId }>
  | Readonly<{ kind: 'anchor-remove'; anchorBdcId: BdcId }>
  | Readonly<{ kind: 'anchor-return'; anchorBdcId: BdcId }>
)
