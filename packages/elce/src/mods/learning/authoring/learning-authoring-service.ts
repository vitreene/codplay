import type { SnapshotFrom } from 'xstate'
import { BDC_TYPE } from '../learning-definition'
import { PAGE_TYPE } from '../learning-definition'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import type { MediaType } from '../../../core/media/media-config'
import type { ElceCatalogContents } from '../../../core/catalog/catalog-types'
import { createLearningAnchorDropService } from '../anchoring/learning-anchor-drop-service'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import type { LearningBdc, LearningChapter, LearningPage } from '../document/learning-document-types'
import type { MediaId } from '../../../core/document/content-document-types'
import type { LearningDocument } from '../document/learning-document'
import { learningControllerMachine } from './learning-controller-machine'
import type { CatalogTabType } from './learning-authoring-config'
import type { ElceAppContext } from '../../../app/controller/controller-types'
import type { LearningSelection, SectionSelection } from './learning-selection-service'
import type { LearningDocumentCommandService } from '../commands/learning-document-command-service'

type EditorSnapshot = Pick<SnapshotFrom<typeof learningControllerMachine>, 'context'>

export interface EditorViewModel {
  readonly documentModel: LearningDocument
  readonly selectedPageId: LearningSelection['selectedPageId']
  readonly selectedChapterId: LearningSelection['selectedChapterId']
  readonly selectedCarouselCardBdcId: LearningSelection['selectedCarouselCardBdcId']
  readonly historyRestore: Readonly<{ selection: SectionSelection | null }> | null
  readonly catalogTab: CatalogTabType
  readonly mediaSources: ElceAppContext['mediaSources']
  readonly mediaSourceKey: string
  readonly selectedPage: LearningPage | undefined
  readonly selectedChapter: LearningChapter | undefined
  readonly pageChapter: LearningChapter | undefined
  readonly selectedPageBdcs: readonly LearningBdc[]
  readonly pageHasQuestion: boolean
  readonly pageHasCarousel: boolean
  readonly pageHasContent: boolean
  readonly mediaById: Readonly<Record<MediaId, Readonly<{ name: string; type: MediaType; source: string | null }>>>
  readonly catalogContents: ElceCatalogContents
}

export interface LearningPageBdcAvailability {
  readonly canCreateQuestion: boolean
  readonly canCreateSection: boolean
  readonly canCreateEvaluationResult: boolean
  readonly canCreateCarousel: boolean
  readonly canCreateStandaloneCard: boolean
  readonly canCreateStatisticalGraph: boolean
}

/** Owns the Learning authoring projection and creation rules used by its views. */
export class LearningAuthoringService {
  private readonly documentCommands: Pick<LearningDocumentCommandService, 'canMoveBdcToPage'>
  private readonly anchorDropService = createLearningAnchorDropService()

  public constructor(documentCommands: Pick<LearningDocumentCommandService, 'canMoveBdcToPage'>) {
    this.documentCommands = documentCommands
  }

  /** Selects the editor's derived data without changing the XState document. */
  public selectEditorViewModel(snapshot: EditorSnapshot): EditorViewModel {
    const context = snapshot.context
    const documentModel = context.document
    const selectedPage = documentModel.pages.find((page) => page.id === context.selection.selectedPageId) ?? documentModel.pages[0]
    const selectedChapter = context.selection.selectedChapterId === null
      ? undefined
      : documentModel.chapters.find((chapter) => chapter.id === context.selection.selectedChapterId)
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
            case BDC_TYPE.STATISTICAL_GRAPH:
              return bdc.statisticalGraph == null ? [] : [bdc]
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
      selectedPageId: context.selection.selectedPageId,
      selectedChapterId: context.selection.selectedChapterId,
      selectedCarouselCardBdcId: context.selection.selectedCarouselCardBdcId,
      historyRestore: context.historyRestore === null
        ? null
        : { selection: context.historyRestore.selection.sectionSelection },
      catalogTab: context.composition.catalogTab,
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
      catalogContents: this.anchorDropService.catalogContents(documentModel.data),
    }
  }

  /** Computes the existing Learning page-type and chapter creation whitelist. */
  public pageBdcAvailability(view: EditorViewModel): LearningPageBdcAvailability {
    const page = view.selectedPage
    const isFlux = page?.type === PAGE_TYPE.FLUX
    const isDiapo = page?.type === PAGE_TYPE.DIAPO
    const isEvaluationChapter = page?.chapterId !== null
      && page?.chapterId !== undefined
      && view.documentModel.chapters.find((chapter) => chapter.id === page.chapterId)?.type === CHAPTER_TYPE.EVALUATION

    return {
      canCreateQuestion: (isFlux || isDiapo)
        && !view.pageHasQuestion
        && (!isDiapo || !view.pageHasContent),
      canCreateSection: isFlux,
      canCreateEvaluationResult: (isFlux || isDiapo)
        && isEvaluationChapter
        && (!isDiapo || !view.pageHasContent),
      canCreateCarousel: isFlux || (isDiapo && !view.pageHasContent && !view.pageHasCarousel),
      canCreateStandaloneCard: isFlux || (isDiapo && !view.pageHasContent),
      canCreateStatisticalGraph: isFlux || (isDiapo && !view.pageHasContent),
    }
  }

  /** Delegates BDC move admission to the Learning document command service. */
  public canMoveBdcToPage(document: LearningDocument, bdcId: string, pageId: string, index: number): boolean {
    return this.documentCommands.canMoveBdcToPage(document, bdcId, pageId, index)
  }
}

/** Keeps derived-view updates limited to the snapshot fields used above. */
export function editorViewModelEqual(left: EditorViewModel, right: EditorViewModel): boolean {
  return left.documentModel === right.documentModel
    && left.selectedPageId === right.selectedPageId
    && left.selectedChapterId === right.selectedChapterId
    && left.selectedCarouselCardBdcId === right.selectedCarouselCardBdcId
    && left.historyRestore === right.historyRestore
    && left.catalogTab === right.catalogTab
    && sameMediaSources(left.mediaSources, right.mediaSources)
}

/** Compares source URLs by value so duplicate registration does not refresh the editor. */
function sameMediaSources(
  left: ElceAppContext['mediaSources'],
  right: ElceAppContext['mediaSources'],
): boolean {
  const leftMediaIds = Object.keys(left)
  const rightMediaIds = Object.keys(right)
  return leftMediaIds.length === rightMediaIds.length
    && leftMediaIds.every((mediaId) => left[mediaId] === right[mediaId])
}
