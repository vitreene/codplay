import type { Bdc } from '../../../domain/document/document-types'
import type { ElceAnchorDropTarget, ElceAnchorMediaPreview, ElceSectionChange } from '../../../domain/anchor/anchor-types'
import type { ElceCatalogDropTarget, ElceCatalogReference } from '../../../domain/catalog/catalog-types'
import type { ElceCardEditorActions } from '../../facades/card/card-facade-types'
import type { MediaType } from '../../../config/document-config-types'

export type SectionEditorChange = ElceSectionChange

export interface SectionEditorProps {
  readonly bdc: Bdc
  readonly onDelete: () => void
  readonly createFileDropTarget?: (file: File) => ElceAnchorDropTarget | null
  readonly createCatalogDropTarget?: (reference: ElceCatalogReference) => ElceCatalogDropTarget | null
  readonly resolveCard?: (bdcId: string) => ElceAnchorMediaPreview | null
  readonly anchorCards?: readonly Bdc[]
  readonly mediaById?: Readonly<Record<string, Readonly<{ name: string; type: MediaType; source: string | null }>>>
  readonly cardActions?: ElceCardEditorActions
  readonly onChange: (change: SectionEditorChange) => void
}
