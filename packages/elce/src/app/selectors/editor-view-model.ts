import type { SnapshotFrom } from 'xstate'
import { BDC_TYPE } from '../../config/document-config'
import type { MediaType } from '../../config/document-config-types'
import type { ElceCatalogContents } from '../../domain/catalog/catalog-types'
import { ElceAnchorDropService } from '../../domain/anchor/anchor-drop-service'
import { mediaTypeFromMimeType } from '../../domain/media/media-resource-service'
import type { Bdc, Chapter, MediaId, Page } from '../../domain/document/document-types'
import type { ElceDocument } from '../../domain/document/document-model'
import { controllerMachine } from '../controller/controller-machine'
import type { CatalogTabType } from '../../config/document-config-types'
import type { ElceAppContext } from '../controller/controller-types'

type EditorSnapshot = Pick<SnapshotFrom<typeof controllerMachine>, 'context'>

export interface EditorViewModel {
  readonly documentModel: ElceDocument
  readonly selectedPageId: ElceAppContext['selectedPageId']
  readonly selectedChapterId: ElceAppContext['selectedChapterId']
  readonly selectedCarouselCardBdcId: ElceAppContext['selectedCarouselCardBdcId']
  readonly catalogTab: CatalogTabType
  readonly mediaSources: ElceAppContext['mediaSources']
  readonly mediaSourceKey: string
  readonly selectedPage: Page | undefined
  readonly selectedChapter: Chapter | undefined
  readonly pageChapter: Chapter | undefined
  readonly selectedPageBdcs: readonly Bdc[]
  readonly pageHasQuestion: boolean
  readonly pageHasCarousel: boolean
  readonly pageHasContent: boolean
  readonly mediaById: Readonly<Record<MediaId, Readonly<{ name: string; type: MediaType; source: string | null }>>>
  readonly catalogContents: ElceCatalogContents
}

const anchorDropService = new ElceAnchorDropService()

/** Selects the editor's derived data without changing the XState document. */
export function selectEditorViewModel(snapshot: EditorSnapshot): EditorViewModel {
  const context = snapshot.context
  const documentModel = context.document
  const selectedPage = documentModel.pages.find((page) => page.id === context.selectedPageId) ?? documentModel.pages[0]
  const selectedChapter = context.selectedChapterId === null
    ? undefined
    : documentModel.chapters.find((chapter) => chapter.id === context.selectedChapterId)
  const pageChapter = selectedPage?.chapterId === null || selectedPage === undefined
    ? undefined
    : documentModel.chapters.find((chapter) => chapter.id === selectedPage.chapterId)
  const selectedPageBdcs = selectedPage === undefined
    ? []
    : selectedPage.bdcIds.flatMap((bdcId) => {
        const bdc = documentModel.bdcs.find((candidate) => candidate.id === bdcId)
        switch (bdc?.type) {
          case BDC_TYPE.SECTION:
            return bdc.section === null ? [] : [bdc]
          case BDC_TYPE.QUESTION:
            return bdc.question === null ? [] : [bdc]
          case BDC_TYPE.EVALUATION_RESULT:
            return bdc.evaluationResult == null ? [] : [bdc]
          case BDC_TYPE.CAROUSEL:
            return bdc.carousel == null ? [] : [bdc]
          case BDC_TYPE.CARD:
            return bdc.card == null ? [] : [bdc]
          default:
            return []
        }
      })
  const mediaById = Object.fromEntries(documentModel.medias.flatMap((media) => {
    const type = mediaTypeFromMimeType(media.mimeType)
    return type === null ? [] : [[media.id, { name: media.name, type, source: context.mediaSources[media.id] ?? null }]]
  }))

  return {
    documentModel,
    selectedPageId: context.selectedPageId,
    selectedChapterId: context.selectedChapterId,
    selectedCarouselCardBdcId: context.selectedCarouselCardBdcId,
    catalogTab: context.catalogTab,
    mediaSources: context.mediaSources,
    mediaSourceKey: Object.keys(context.mediaSources).sort().join('|'),
    selectedPage,
    selectedChapter,
    pageChapter,
    selectedPageBdcs,
    pageHasQuestion: selectedPageBdcs.some((bdc) => bdc.type === BDC_TYPE.QUESTION),
    pageHasCarousel: selectedPageBdcs.some((bdc) => bdc.type === BDC_TYPE.CAROUSEL),
    pageHasContent: selectedPageBdcs.length > 0,
    mediaById,
    catalogContents: anchorDropService.catalogContents(documentModel),
  }
}

/** Keeps derived-view updates limited to the snapshot fields used above. */
export function editorViewModelEqual(left: EditorViewModel, right: EditorViewModel): boolean {
  return left.documentModel === right.documentModel
    && left.selectedPageId === right.selectedPageId
    && left.selectedChapterId === right.selectedChapterId
    && left.selectedCarouselCardBdcId === right.selectedCarouselCardBdcId
    && left.catalogTab === right.catalogTab
    && left.mediaSources === right.mediaSources
}
