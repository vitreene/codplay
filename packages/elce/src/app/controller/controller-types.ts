import type { ElceDocument } from '../../domain/document-model'
import type { CatalogTabType } from '../../config/document-config-types'
import type { BdcId, ChapterId, MediaId, MediaMetadata, PageId } from '../../domain/document-types'
import type { ElceSectionChange } from '../../domain/anchor-types'
import type { DocumentCommand, PagePlacement } from '../commands/document-command-types'
import type { ElceDocumentChange } from './document-change-types'

export type { ElceAnchorChange } from './document-change-types'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'

export interface ElceAppContext {
  readonly document: ElceDocument
  readonly selectedPageId: PageId | null
  readonly selectedChapterId: ChapterId | null
  readonly selectedCarouselCardBdcId: string | null
  readonly catalogTab: CatalogTabType
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly documentStore: ElceDocumentStore | null
  readonly documentChanges: readonly ElceDocumentChange[]
}

export interface ElceControllerInput {
  readonly documentStore?: ElceDocumentStore
}

export type ElceControllerEvent =
  | Readonly<{ type: 'document.apply'; command: DocumentCommand }>
  | Readonly<{ type: 'page.create'; placement: PagePlacement; name?: string }>
  | Readonly<{ type: 'page.select'; pageId: PageId }>
  | Readonly<{ type: 'chapter.select'; chapterId: ChapterId }>
  | Readonly<{ type: 'carousel.card.select'; bdcId: string | null }>
  | Readonly<{ type: 'catalog.tab.select'; tabId: CatalogTabType }>
  | Readonly<{ type: 'media.source.register'; mediaId: MediaId; source: string }>
  | Readonly<{ type: 'section.change'; sectionBdcId: string; change: ElceSectionChange }>
  | Readonly<{ type: 'question.media.file.import'; bdcId: string; file: File; media: MediaMetadata }>
  | Readonly<{ type: 'carousel.card.media.file.import'; bdcId: BdcId; file: File; media: MediaMetadata }>
  | Readonly<{ type: 'document.replace'; document: ElceDocument }>
