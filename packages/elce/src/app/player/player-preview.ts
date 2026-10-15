import { ElcePlayerComposition } from '../../player/elce-player-composition'
import type { ElcePageSceneCache } from '../../player/player-composition-types'
import type { ElceDocument } from '../../domain/document/document-model'
import type { MediaId, PageId } from '../../domain/document/document-types'
import type { ProjectTestState } from '../../domain/summary-profile/test-state-types'
import { INITIAL_PROJECT_TEST_STATE } from '../../domain/summary-profile/test-state-types'
import { projectReaderDocument } from '../../domain/summary-profile/reader-projection'

/** Describes the document and media sources mounted into the Sighty/CodPlay player. */
export interface PlayerPreviewProps {
  readonly documentModel: ElceDocument
  readonly selectedPageId: PageId | null
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly sceneCache?: ElcePageSceneCache
  readonly testState?: ProjectTestState
  readonly onTestStateChange?: (state: ProjectTestState) => void
}

/** Returns whether the selected page belongs to the author-only content catalog. */
export function isCatalogPage(documentModel: ElceDocument, selectedPageId: PageId | null): boolean {
  const selectedPage = documentModel.pages.find((page) => page.id === selectedPageId)
  return selectedPage !== undefined && documentModel.data.catalogPageIds.includes(selectedPage.id)
}

/** Creates the existing player composition for one document snapshot. */
export function createPlayerPreviewComposition(
  stage: HTMLElement,
  props: PlayerPreviewProps,
): ElcePlayerComposition | null {
  if (isCatalogPage(props.documentModel, props.selectedPageId)) return null
  const testState = props.testState ?? INITIAL_PROJECT_TEST_STATE
  const collectProfile = testState.profileEnabled
    && props.documentModel.data.profile.fieldPropertyIds.length > 0
    && !testState.profileSubmitted
  const readerDocument = collectProfile
    ? props.documentModel
    : projectReaderDocument(props.documentModel, testState.profileValues, testState.profileEnabled)
  const selectedPageId = !collectProfile && props.selectedPageId !== null && readerDocument.pages.some((page) => page.id === props.selectedPageId)
    ? props.selectedPageId
    : null
  return new ElcePlayerComposition({
    stage,
    document: readerDocument,
    startPageId: selectedPageId ?? undefined,
    testState,
    onTestStateChange: props.onTestStateChange,
    mediaSources: props.mediaSources,
    sceneCache: props.sceneCache,
    onLog: (message, level) => {
      if (level === 'error') console.error(`[Elcé] ${message}`)
    },
  })
}
