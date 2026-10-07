import type { Actor } from 'xstate'
import { BDC_LOCATION, CHAPTER_TYPE, PAGE_TYPE } from '../../config/document-config'
import type { CatalogTabType, EvaluationRetryScope, PageType } from '../../config/document-config-types'
import {
  createChapterCommand,
  createChapterMoveCommand,
  createCarouselBdcCommand,
  createEvaluationResultBdcCommand,
  createPageDeleteCommand,
  createPageMoveCommand,
  createSectionBdcCommand,
  createStandaloneCardBdcCommand,
} from '../../domain/commands/document-commands'
import type { DocumentCommand, PagePlacement } from '../../domain/commands/document-command-types'
import type { EvaluationResultContent } from '../../domain/evaluation/evaluation-result-types'
import { createStableId, type ElceDocument } from '../../domain/document/document-model'
import type { Bdc, BdcId, ChapterId, PageId, RevelationTransitionDefaults } from '../../domain/document/document-types'
import type { ElceSectionChange, ElceAnchorDropTarget } from '../../domain/anchor/anchor-types'
import type { ElceCatalogDropTarget, ElceCatalogReference } from '../../domain/catalog/catalog-types'
import type { QuestionContent } from '../../domain/question/question-types'
import type { ElceMediaImport } from '../../domain/media/media-resource-types'
import { controllerMachine } from '../controller/controller-machine'
import { ElceAnchorDropFacade } from './anchor/anchor-drop-facade'
import { ElceCardFacade } from './card/card-facade'
import type { ElceCardEditorActions } from './card/card-facade-types'
import { ElceCarouselFacade, createCarouselBdcId } from './carousel/carousel-facade'
import type { ElceCarouselEditorActions } from './carousel/carousel-facade-types'
import { ElceQuestionFacade } from './question/question-facade'
import type { ElceQuestionEditorActions } from './question/question-facade-types'

/** Routes authoring intentions through the existing XState actor and facades. */
export class EditorActionsFacade {
  private readonly controller: Actor<typeof controllerMachine>
  private readonly anchorFacade: ElceAnchorDropFacade
  private readonly cardFacade: ElceCardFacade
  private readonly carouselFacade: ElceCarouselFacade
  private readonly questionFacade: ElceQuestionFacade

  public constructor(controller: Actor<typeof controllerMachine>) {
    this.controller = controller
    const dispatch = (command: DocumentCommand): void => {
      this.controller.send({ type: 'document.apply', command })
    }
    const importCardMedia = (bdcId: BdcId, mediaImport: ElceMediaImport): void => {
      this.controller.send({ type: 'card.media.file.import', bdcId, file: mediaImport.file, media: mediaImport.media })
    }

    this.anchorFacade = new ElceAnchorDropFacade({
      dispatch: (sectionBdcId, change) => this.controller.send({ type: 'section.change', sectionBdcId, change }),
    })
    this.cardFacade = new ElceCardFacade({ dispatch, importMedia: importCardMedia })
    this.carouselFacade = new ElceCarouselFacade({
      dispatch,
      selectCard: (bdcId) => this.selectCard(bdcId),
      importMedia: importCardMedia,
    })
    this.questionFacade = new ElceQuestionFacade({
      dispatch,
      importMedia: (bdcId, mediaImport) => this.controller.send({
        type: 'question.media.file.import',
        bdcId,
        file: mediaImport.file,
        media: mediaImport.media,
      }),
    })
  }

  /** Creates a page at the explicit scenario or chapter placement. */
  public createPage(placement: PagePlacement, pageType: PageType = PAGE_TYPE.FLUX): void {
    this.controller.send({ type: 'page.create', placement, pageType })
  }

  /** Creates a standard chapter using the current document command factory. */
  public createChapter(document: ElceDocument): void {
    this.apply(createChapterCommand(document))
  }

  /** Creates an Evaluation chapter using the current document command factory. */
  public createEvaluationChapter(document: ElceDocument): void {
    this.apply(createChapterCommand(document, undefined, CHAPTER_TYPE.EVALUATION))
  }

  /** Moves one page to its explicit scenario or chapter placement. */
  public movePage(pageId: PageId, placement: PagePlacement): void {
    this.apply(createPageMoveCommand(pageId, placement))
  }

  /** Moves a chapter in the mixed root scenario order. */
  public moveChapter(chapterId: ChapterId, index: number): void {
    this.apply(createChapterMoveCommand(chapterId, index))
  }

  /** Permanently deletes a page and its placed BDCs. */
  public deletePage(pageId: PageId): void {
    this.apply(createPageDeleteCommand(pageId))
  }

  /** Permanently deletes an empty chapter. */
  public deleteChapter(chapterId: ChapterId): void {
    this.apply({ type: 'chapter.delete', chapterId })
  }

  /** Moves one BDC to a page position. */
  public moveBdc(bdcId: BdcId, pageId: PageId, index: number): void {
    this.apply({ type: 'bdc.move', bdcId, placement: { kind: BDC_LOCATION.PAGE, pageId, index } })
  }

  /** Removes an anchored BDC from its text flow and returns it to the catalogue. */
  public returnBdcToCatalog(bdcId: BdcId): void {
    this.apply({ type: 'bdc.remove', bdcId })
  }

  /** Permanently deletes an unused BDC from the catalogue. */
  public deleteCatalogBdc(bdcId: BdcId): void {
    this.apply({ type: 'bdc.delete', bdcId })
  }

  /** Creates a Section BDC at the requested page position. */
  public createSection(pageId: PageId, index: number): void {
    this.apply(createSectionBdcCommand(createStableId('bdc-section'), pageId, index))
  }

  /** Creates the unique Question BDC through its existing application facade. */
  public createQuestion(document: ElceDocument, pageId: PageId, index: number): void {
    this.questionFacade.create(document, pageId, index)
  }

  /** Creates a Result BDC at the requested page position. */
  public createEvaluationResult(pageId: PageId, index: number): void {
    this.apply(createEvaluationResultBdcCommand(createStableId('bdc-evaluation-result'), pageId, index))
  }

  /** Creates a Carousel BDC at the requested page position. */
  public createCarousel(pageId: PageId, index: number): void {
    this.apply(createCarouselBdcCommand(createCarouselBdcId(), pageId, index))
  }

  /** Creates a standalone Card BDC on the requested page. */
  public createStandaloneCard(pageId: PageId): void {
    this.apply(createStandaloneCardBdcCommand(createStableId('bdc-card'), pageId))
  }

  /** Renames a page through the document command boundary. */
  public renamePage(pageId: PageId, name: string): void {
    this.apply({ type: 'page.rename', pageId, name })
  }

  /** Renames a chapter through the document command boundary. */
  public renameChapter(chapterId: ChapterId, name: string): void {
    this.apply({ type: 'chapter.rename', chapterId, name })
  }

  /** Saves the editable settings of one Evaluation chapter. */
  public updateEvaluationChapterSettings(
    chapterId: ChapterId,
    attemptLimit: number | null,
    retryScope: EvaluationRetryScope,
  ): void {
    this.apply({ type: 'chapter.evaluation.settings.update', chapterId, attemptLimit, retryScope })
  }

  /** Saves both outcomes of a Result BDC. */
  public updateEvaluationResult(bdcId: BdcId, evaluationResult: EvaluationResultContent): void {
    this.apply({ type: 'bdc.evaluation-result.update', bdcId, evaluationResult })
  }

  /** Removes a Result BDC from its page. */
  public deleteEvaluationResult(bdcId: BdcId): void {
    this.apply({ type: 'bdc.evaluation-result.delete', bdcId })
  }

  /** Removes a Section BDC and its anchored Cards. */
  public deleteSection(bdcId: BdcId): void {
    this.apply({ type: 'bdc.section.delete', bdcId })
  }

  /** Removes a standalone Card BDC. */
  public deleteCard(bdcId: BdcId): void {
    this.apply({ type: 'bdc.card.delete', bdcId })
  }

  /** Selects one page for editing and reading. */
  public selectPage(pageId: PageId): void {
    this.controller.send({ type: 'page.select', pageId })
  }

  /** Selects a chapter settings view in the work area. */
  public selectChapter(chapterId: ChapterId): void {
    this.controller.send({ type: 'chapter.select', chapterId })
  }

  /** Selects one Carousel Card in the existing XState controller. */
  public selectCard(bdcId: BdcId | null): void {
    this.controller.send({ type: 'carousel.card.select', bdcId })
  }

  /** Selects the requested catalogue tab. */
  public selectCatalogTab(tabId: CatalogTabType): void {
    this.controller.send({ type: 'catalog.tab.select', tabId })
  }

  /** Creates a Section media target for a native file-drop gesture. */
  public createSectionFileDropTarget(file: File, pageId: PageId): ElceAnchorDropTarget | null {
    return this.anchorFacade.createFileDropTarget(file, pageId)
  }

  /** Resolves a reusable catalogue reference for one Section. */
  public createSectionCatalogDropTarget(
    document: ElceDocument,
    reference: ElceCatalogReference,
    pageId: PageId | null,
    sectionBdcId: BdcId,
  ): ElceCatalogDropTarget | null {
    return this.anchorFacade.createCatalogDropTarget(document, reference, pageId, sectionBdcId)
  }

  /** Sends a Section transaction through the existing XState anchor event. */
  public submitSectionChange(sectionBdcId: BdcId, change: ElceSectionChange): void {
    this.anchorFacade.submitSectionChange(sectionBdcId, change)
  }

  /** Creates Question editor callbacks for one current BDC. */
  public createQuestionEditorActions(bdcId: BdcId, question: QuestionContent): ElceQuestionEditorActions {
    return {
      setType: (type) => this.questionFacade.setType(bdcId, question, type),
      setTitle: (title) => this.questionFacade.setTitle(bdcId, question, title),
      setPrompt: (prompt) => this.questionFacade.setPrompt(bdcId, question, prompt),
      setAnswerLabel: (answerId, label) => this.questionFacade.setAnswerLabel(bdcId, question, answerId, label),
      setAnswerCorrect: (answerId, correct) => this.questionFacade.setAnswerCorrect(bdcId, question, answerId, correct),
      addAnswer: () => this.questionFacade.addAnswer(bdcId, question),
      removeAnswer: (answerId) => this.questionFacade.removeAnswer(bdcId, question, answerId),
      canRemoveAnswer: (answerId) => this.questionFacade.canRemoveAnswer(question, answerId),
      moveAnswer: (answerId, index) => this.questionFacade.moveAnswer(bdcId, question, answerId, index),
      importMedia: (file) => this.questionFacade.importMediaFile(bdcId, file),
      clearMedia: () => this.questionFacade.clearMedia(bdcId),
      deleteQuestion: () => this.questionFacade.delete(bdcId),
    }
  }

  /** Creates Card editor callbacks from the current document BDCs. */
  public createCardEditorActions(bdcs: readonly Bdc[]): ElceCardEditorActions {
    return this.cardFacade.createEditorActions(bdcs)
  }

  /** Creates Carousel editor callbacks from its current content and Cards. */
  public createCarouselEditorActions(
    bdcId: BdcId,
    content: NonNullable<Bdc['carousel']>,
    cards: readonly Bdc[],
    revelationDefaults: RevelationTransitionDefaults,
  ): ElceCarouselEditorActions {
    return this.carouselFacade.createEditorActions(bdcId, content, cards, revelationDefaults)
  }

  /** Attaches a validated reusable media reference to a Question. */
  public attachQuestionMediaReference(bdcId: BdcId, serializedReference: string): void {
    this.questionFacade.attachMediaReference(bdcId, serializedReference)
  }

  /** Applies one existing document command through the controller actor. */
  private apply(command: DocumentCommand): void {
    this.controller.send({ type: 'document.apply', command })
  }
}
