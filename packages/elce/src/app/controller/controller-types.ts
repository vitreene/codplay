import type { ElceDocument } from '../../domain/document-model'
import type { CatalogTabType } from '../../config/document-config-types'
import type { MediaId, PageId } from '../../domain/document-types'
import type { ElceSectionChange } from '../../domain/anchor-types'
import type { DocumentCommand } from '../commands/document-command-types'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'

export interface ElceAppContext {
  readonly document: ElceDocument
  readonly selectedPageId: PageId | null
  readonly catalogTab: CatalogTabType
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly documentStore: ElceDocumentStore | null
  readonly anchorChanges: readonly ElceAnchorChange[]
}

export interface ElceControllerInput {
  readonly documentStore?: ElceDocumentStore
}

export interface ElceAnchorChange {
  readonly sectionBdcId: string
  readonly change: ElceSectionChange
}

export type ElceControllerEvent =
  | Readonly<{ type: 'document.apply'; command: DocumentCommand }>
  | Readonly<{ type: 'page.create'; name?: string }>
  | Readonly<{ type: 'page.select'; pageId: PageId }>
  | Readonly<{ type: 'catalog.tab.select'; tabId: CatalogTabType }>
  | Readonly<{ type: 'media.source.register'; mediaId: MediaId; source: string }>
  | Readonly<{ type: 'section.change'; sectionBdcId: string; change: ElceSectionChange }>
  | Readonly<{ type: 'document.replace'; document: ElceDocument }>
