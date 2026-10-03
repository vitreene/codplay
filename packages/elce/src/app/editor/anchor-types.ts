import type { BdcId, MediaId } from '../../domain/document-types'
import type { ElceAnchorDropTarget, ElceCatalogDropTarget } from '../../domain/anchor-types'
import type { ElceCatalogReference } from '../../domain/catalog-types'

export type { ElceAnchorDropTarget, ElceCatalogDropTarget } from '../../domain/anchor-types'

export interface ElceAnchorAttributes {
  readonly bdcId: BdcId
  readonly partId: string
  readonly paddingBottom: string
  readonly mediaId?: MediaId | null
  readonly mediaType?: 'image' | 'video' | null
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
  readonly resolveMediaSource?: (mediaId: MediaId, mediaType: 'image' | 'video') => string | null
}
