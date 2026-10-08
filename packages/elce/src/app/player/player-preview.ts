import { ElcePlayerComposition } from '../../player/elce-player-composition'
import type { ElcePageSceneCache } from '../../player/player-composition-types'
import type { ElceDocument } from '../../domain/document/document-model'
import type { MediaId, PageId } from '../../domain/document/document-types'

/** Describes the document and media sources mounted into the Sighty/CodPlay player. */
export interface PlayerPreviewProps {
  readonly documentModel: ElceDocument
  readonly selectedPageId: PageId | null
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly sceneCache?: ElcePageSceneCache
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
  return new ElcePlayerComposition({
    stage,
    document: props.documentModel,
    startPageId: props.selectedPageId ?? undefined,
    mediaSources: props.mediaSources,
    sceneCache: props.sceneCache,
    onLog: (message, level) => {
      if (level === 'error') console.error(`[Elcé] ${message}`)
    },
  })
}
