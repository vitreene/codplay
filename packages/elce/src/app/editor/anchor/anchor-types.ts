import type { BdcId } from '../../../domain/document/document-types'
import type { ElceAnchorDropTarget, ElceAnchorMediaPreview, ElceCatalogDropTarget } from '../../../domain/anchor/anchor-types'
import type { ElceCatalogReference } from '../../../domain/catalog/catalog-types'

export type { ElceAnchorDropTarget, ElceCatalogDropTarget } from '../../../domain/anchor/anchor-types'

export interface ElceAnchorAttributes {
  readonly bdcId: BdcId
  readonly partId: string
  readonly paddingBottom: string
}

export type ElceAnchorTransaction =
  | Readonly<{ kind: 'file-drop'; file: File; target: ElceAnchorDropTarget }>
  | Readonly<{ kind: 'catalog-drop'; target: ElceCatalogDropTarget }>
  | Readonly<{ kind: 'move'; bdcId: BdcId }>
  | Readonly<{ kind: 'remove'; bdcId: BdcId }>
  | Readonly<{ kind: 'return'; bdcId: BdcId }>

export interface ElceAnchorExtensionOptions {
  readonly createFileDropTarget?: (file: File) => ElceAnchorDropTarget | null
  readonly createCatalogDropTarget?: (reference: ElceCatalogReference) => ElceCatalogDropTarget | null
  readonly resolveCard?: (bdcId: BdcId) => ElceAnchorMediaPreview | null
  readonly onEditCard?: (bdcId: BdcId) => void
  readonly registerNodeViewRefresh?: (bdcId: BdcId, refresh: () => void) => () => void
}
