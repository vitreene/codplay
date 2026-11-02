import type { BdcId } from '../../../core/document/content-document-types'
import type { ElceCardPresetBuilder } from '../../../core/presets/card-preset-builder'
import type { ElceAnchorDropTarget, ElceAnchorCardPreview, ElceCatalogDropTarget } from '../domain/anchor-types'
import type { ElceCatalogReference } from '../../../core/catalog/catalog-types'

export type { ElceAnchorCardPreview, ElceAnchorDropTarget, ElceCatalogDropTarget } from '../domain/anchor-types'

export interface ElceAnchorAttributes {
  readonly bdcId: BdcId
  readonly partId: string
  readonly paddingBottom: string
}

export type ElceAnchorTransaction =
  | Readonly<{ kind: 'file-drop'; file: File; target: ElceAnchorDropTarget }>
  | Readonly<{ kind: 'ratio-update'; bdcId: BdcId }>
  | Readonly<{ kind: 'catalog-drop'; target: ElceCatalogDropTarget }>
  | Readonly<{ kind: 'move'; bdcId: BdcId }>
  | Readonly<{ kind: 'remove'; bdcId: BdcId }>
  | Readonly<{ kind: 'return'; bdcId: BdcId }>

export interface ElceAnchorExtensionOptions {
  readonly presetBuilder: ElceCardPresetBuilder
  readonly createFileDropTarget?: (file: File) => ElceAnchorDropTarget | null
  readonly onCardMediaFileDrop?: (bdcId: BdcId, file: File) => void
  readonly createCatalogDropTarget?: (reference: ElceCatalogReference) => ElceCatalogDropTarget | null
  readonly resolveCard?: (bdcId: BdcId) => ElceAnchorCardPreview | null
  readonly onEditCard?: (bdcId: BdcId) => void
  readonly registerNodeViewRefresh?: (bdcId: BdcId, refresh: () => void) => () => void
}
