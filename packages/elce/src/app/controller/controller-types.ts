import type { ElceDocument } from '../../domain/document/document-model'
import type { CatalogTabType, PageType } from '../../config/document-config-types'
import type { BdcId, ChapterId, MediaId, MediaMetadata, PageId } from '../../domain/document/document-types'
import type { ElceSectionChange } from '../../domain/anchor/anchor-types'
import type { DocumentCommand, PagePlacement } from '../../domain/commands/document-command-types'
import type { ElceDocumentChange } from './document-change-types'
import type { DocumentSyncState, ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'
import type { ElceProjectSummary } from '../../infrastructure/project-api/project-api-types'
import type { ProjectSessionOperation, ProjectSessionPort, ProjectSessionStatus } from '../projects/project-session-types'
import type { DocumentHistory, SectionSelection } from '../history/document-history'

export type { ElceAnchorChange } from './document-change-types'

export interface ElceAppContext {
  readonly document: ElceDocument
  readonly selectedPageId: PageId | null
  readonly selectedChapterId: ChapterId | null
  readonly selectedCarouselCardBdcId: string | null
  readonly catalogTab: CatalogTabType
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly syncStatus: DocumentSyncState['status']
  readonly editAccess: 'waiting' | 'active'
  readonly documentStore: ElceDocumentStore | null
  readonly documentChanges: readonly ElceDocumentChange[]
  readonly history: DocumentHistory
  readonly sectionSelection: SectionSelection | null
  readonly historyRestore: Readonly<{ selection: SectionSelection | null }> | null
  readonly projectSession: ProjectSessionPort | null
  readonly projects: readonly ElceProjectSummary[]
  readonly activeProject: ElceProjectSummary | null
  readonly projectStatus: ProjectSessionStatus
  readonly projectError: string | null
  readonly recoverableLocalCopy: boolean
  readonly pendingProjectOperation: ProjectSessionOperation | null
  readonly projectOperationHadAccess: boolean
}

export interface ElceControllerInput {
  readonly documentStore?: ElceDocumentStore
  readonly projectSession?: ProjectSessionPort
}

export type ElceControllerEvent =
  | Readonly<{ type: 'document.apply'; command: DocumentCommand; historyGroupKey?: string; recordHistory?: boolean }>
  | Readonly<{ type: 'page.create'; placement: PagePlacement; pageType?: PageType; name?: string }>
  | Readonly<{ type: 'page.select'; pageId: PageId }>
  | Readonly<{ type: 'chapter.select'; chapterId: ChapterId }>
  | Readonly<{ type: 'carousel.card.select'; bdcId: string | null }>
  | Readonly<{ type: 'catalog.tab.select'; tabId: CatalogTabType }>
  | Readonly<{ type: 'media.source.register'; mediaId: MediaId; source: string }>
  | Readonly<{ type: 'section.change'; sectionBdcId: string; change: ElceSectionChange; historyGroupKey?: string; selectionBefore?: SectionSelection; selectionAfter?: SectionSelection }>
  | Readonly<{ type: 'history.undo' | 'history.redo' }>
  | Readonly<{ type: 'import.cancel' }>
  | Readonly<{ type: 'question.media.file.import'; bdcId: string; file: File; media: MediaMetadata }>
  | Readonly<{ type: 'card.media.file.import'; bdcId: BdcId; file: File; media: MediaMetadata }>
  | Readonly<{ type: 'document.replace'; document: ElceDocument }>
  | Readonly<{ type: 'document.sync.status'; status: DocumentSyncState['status'] }>
  | Readonly<{ type: 'document.sync.merge'; projectId: string; canonicalMediaId: MediaId; duplicateMediaId: MediaId }>
  | Readonly<{ type: 'project.summary.refresh'; project: ElceProjectSummary }>
  | Readonly<{ type: 'project.reader.ready' }>
  | Readonly<{ type: 'editor.access.activate' }>
  | Readonly<{ type: 'editor.access.suspend' }>
  | Readonly<{ type: 'project.operation'; operation: ProjectSessionOperation }>
  | Readonly<{ type: 'project.access.error'; message: string }>
  | Readonly<{ type: 'project.sync.warning'; message: string }>
  | Readonly<{ type: 'project.local-copy.availability'; projectId: string; available: boolean }>
  | Readonly<{ type: 'project.access.retry' }>
