import type { PageSceneCache } from '../../../core/reading/page-scene-cache'
import type { MediaId, PageId } from '../../../core/document/content-document-types'
import { LearningDocument } from '../document/learning-document'
import { learningDocumentService } from '../document/learning-document-service'
import { learningReaderProjectionService } from '../profile/reading/learning-reader-projection-service'
import type { ProjectTestState } from '../reading/learning-test-state-types'
import { LearningPlayer } from '../reading/learning-player'

/** Describes the Learning content passed to its shared Sighty/CodPlay player. */
export interface LearningPreviewPlayerOptions {
  readonly documentModel: LearningDocument
  readonly selectedPageId: PageId | null
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly sceneCache?: PageSceneCache
  readonly testState?: ProjectTestState
  readonly onTestStateChange?: (state: ProjectTestState) => void
}

/** Owns Learning-specific decoding, page selection rules, and player construction. */
export class LearningPreviewService {
  /** Decodes a document snapshot received over the shared preview protocol. */
  public decodeDocument(payload: unknown): LearningDocument {
    return learningDocumentService.readDocument(payload)
  }

  /** Returns whether the selected page belongs to the author-only content catalog. */
  public isCatalogPage(documentModel: LearningDocument, selectedPageId: PageId | null): boolean {
    const selectedPage = documentModel.pages.find((page) => page.id === selectedPageId)
    return selectedPage !== undefined && documentModel.data.catalogPageIds.includes(selectedPage.id)
  }

  /** Detects a start page removed by the same reader projection used by the player. */
  public isPageExcludedByProfile(
    documentModel: LearningDocument,
    selectedPageId: PageId | null,
    testState: ProjectTestState,
  ): boolean {
    if (selectedPageId === null || !testState.profileEnabled || !testState.profileSubmitted) return false
    const readerDocument = learningReaderProjectionService.projectReaderDocument(
      documentModel,
      testState.profileValues,
      testState.profileEnabled,
    )
    return !readerDocument.pages.some((page) => page.id === selectedPageId)
  }

  /** Creates Learning's reader with the source document and consultation state. */
  public createPlayer(stage: HTMLElement, props: LearningPreviewPlayerOptions): LearningPlayer | null {
    if (this.isCatalogPage(props.documentModel, props.selectedPageId)) return null
    return new LearningPlayer({
      stage,
      document: props.documentModel,
      startPageId: props.selectedPageId ?? undefined,
      testState: props.testState,
      onTestStateChange: props.onTestStateChange,
      mediaSources: props.mediaSources,
      sceneCache: props.sceneCache,
      onLog: (message, level) => {
        if (level === 'error') console.error(`[Elcé] ${message}`)
      },
    })
  }
}

export const learningPreviewService = new LearningPreviewService()
