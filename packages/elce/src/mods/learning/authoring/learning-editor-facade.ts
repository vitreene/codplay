import type { Actor } from 'xstate'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import { PAGE_TYPE } from '../learning-definition'
import { MEDIA_TYPE } from '../../../core/media/media-config'
import { BDC_LOCATION } from '../../../core/document/content-location'
import type { CatalogTabType } from './learning-authoring-config'
import type { EvaluationRetryScope } from '../evaluation/learning-evaluation-config'
import type { PageType } from '../learning-definition'
import {
  createChapterMoveCommand,
  createPageDeleteCommand,
  createPageMoveCommand,
} from '../../../domain/commands/document-commands'
import { createCarouselBdcCommand } from '../../../resources/bdcs/carousel/authoring/carousel-command-factory'
import { createSectionBdcCommand } from '../../../resources/bdcs/section/authoring/section-command-factory'
import { createStandaloneCardBdcCommand } from '../../../resources/bdcs/card/authoring/card-command-factory'
import {
  createStatisticalGraphBdcCommand,
  createStatisticalGraphCarouselBdcCommand,
} from '../../../resources/bdcs/statistical-graph/authoring/statistical-graph-command-factory'
import type { AppearanceProperty, AppearanceTarget, AppearanceTargetForProperty, LearningDocumentCommand } from '../commands/learning-document-command-types'
import type { PagePlacement } from '../organization/learning-page-placement'
import type { EvaluationResultContent } from '../evaluation/domain/learning-evaluation-result-types'
import { createStableId } from '../../../core/document/stable-id'
import type { LearningDocument } from '../document/learning-document'
import { learningDocumentService } from '../document/learning-document-service'
import { learningDocumentCommandService } from '../commands/learning-command-composition'
import type { LearningBdc } from '../document/learning-document-types'
import type { ResourceBdc, ResourceDocumentData } from '../../../resources/document/resource-document-types'
import type { BdcId, ChapterId, PageId } from '../../../core/document/content-document-types'
import type { RevelationTransitionDefaults } from '../../../resources/revelation/revelation-types'
import type { ElceSectionChange, ElceAnchorDropTarget } from '../../../resources/anchoring/domain/anchor-types'
import type { ElceCatalogDropTarget, ElceCatalogReference } from '../../../core/catalog/catalog-types'
import type { QuestionContent } from '../../../resources/bdcs/question/domain/question-types'
import type { StatisticalGraphContent } from '../../../resources/bdcs/statistical-graph/domain/statistical-graph-types'
import type { ProfileDefinition, SummarySettings } from '../profile/domain/learning-profile-types'
import type { AppearanceSettings } from '../../../config/appearance/appearance-types'
import type { ElceMediaImport } from '../../../domain/media/media-resource-types'
import { ElceMediaResourceService, mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import { learningControllerMachine } from './learning-controller-machine'
import { ElceAnchorDropFacade } from '../../../resources/anchoring/authoring/anchor-drop-facade'
import { createLearningAnchorDropService } from '../anchoring/learning-anchor-drop-service'
import type { SectionChangeSelection } from '../../../resources/anchoring/authoring/anchor-drop-facade'
import { ElceCardFacade } from '../../../resources/bdcs/card/authoring/card-facade'
import type { ElceCardEditorActions } from '../../../resources/bdcs/card/authoring/card-facade-types'
import { ElceCarouselFacade, createCarouselBdcId } from '../../../resources/bdcs/carousel/authoring/carousel-facade'
import type { ElceCarouselEditorActions } from '../../../resources/bdcs/carousel/authoring/carousel-facade-types'
import { ElceQuestionFacade } from '../../../resources/bdcs/question/authoring/question-facade'
import type { ElceQuestionEditorActions } from '../../../resources/bdcs/question/authoring/question-facade-types'
import { StatisticalGraphFacade } from '../../../resources/bdcs/statistical-graph/authoring/statistical-graph-facade'
import { ElceStatisticalGraphService } from '../../../resources/bdcs/statistical-graph/domain/statistical-graph-service'
import type { StatisticalGraphEditorActions } from '../../../resources/bdcs/statistical-graph/authoring/statistical-graph-facade-types'
import { CoreEditorFacade } from '../../../core/authoring/core-editor-facade'
import { LearningAuthoringService } from './learning-authoring-service'

/** Composes Learning document intentions with reusable resource authoring facades. */
export class LearningEditorFacade {
  private readonly controller: Actor<typeof learningControllerMachine>
  public readonly core: CoreEditorFacade
  public readonly authoring: LearningAuthoringService
  private readonly anchorFacade: ElceAnchorDropFacade
  private readonly cardFacade: ElceCardFacade
  private readonly carouselFacade: ElceCarouselFacade
  private readonly questionFacade: ElceQuestionFacade
  private readonly statisticalGraphFacade: StatisticalGraphFacade
  private readonly mediaResourceService = new ElceMediaResourceService()

  public constructor(
    controller: Actor<typeof learningControllerMachine>,
    authoring: LearningAuthoringService = new LearningAuthoringService(learningDocumentCommandService),
  ) {
    this.controller = controller
    this.authoring = authoring
    this.core = new CoreEditorFacade(
      (event) => controller.send(event),
      (name) => this.apply({ type: 'document.rename', name }),
    )
    const dispatch = (command: LearningDocumentCommand): void => {
      this.apply(command)
    }
    const importCardMedia = (bdcId: BdcId, mediaImport: ElceMediaImport): void => {
      this.controller.send({ type: 'card.media.file.import', bdcId, file: mediaImport.file, media: mediaImport.media })
    }

    this.anchorFacade = new ElceAnchorDropFacade({
      targetService: createLearningAnchorDropService(),
      dispatcher: { dispatch: (sectionBdcId, change, selection) => this.controller.send({
        type: 'section.change', sectionBdcId, change,
        historyGroupKey: change.kind === 'content' ? focusedTextFieldKey(`section:${sectionBdcId}`) ?? undefined : undefined,
        selectionBefore: selection?.before,
        selectionAfter: selection?.after,
      }) },
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
    this.statisticalGraphFacade = new StatisticalGraphFacade({ dispatch }, new ElceStatisticalGraphService())
  }

  /** Creates a page at the explicit scenario or chapter placement. */
  public createPage(placement: PagePlacement, pageType: PageType = PAGE_TYPE.FLUX): void {
    this.controller.send({ type: 'page.create', placement, pageType })
  }

  /** Creates a standard chapter using the current document command factory. */
  public createChapter(document: LearningDocument): void {
    this.apply(learningDocumentService.createChapterCommand(document))
  }

  /** Creates an Evaluation chapter using the current document command factory. */
  public createEvaluationChapter(document: LearningDocument): void {
    this.apply(learningDocumentService.createChapterCommand(document, undefined, CHAPTER_TYPE.EVALUATION))
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

  /** Moves one top-level page BDC into the reusable catalogue. */
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
  public createQuestion(document: LearningDocument, pageId: PageId, index: number): void {
    this.questionFacade.create(document.data, pageId, index)
  }

  /** Creates a Result BDC at the requested page position. */
  public createEvaluationResult(pageId: PageId, index: number): void {
    this.apply(learningDocumentService.createEvaluationResultBdcCommand(createStableId('bdc-evaluation-result'), pageId, index))
  }

  /** Creates a Carousel BDC at the requested page position. */
  public createCarousel(pageId: PageId, index: number): void {
    this.apply(createCarouselBdcCommand(createCarouselBdcId(), pageId, index))
  }

  /** Creates a standalone Card BDC on the requested page. */
  public createStandaloneCard(pageId: PageId): void {
    this.apply(createStandaloneCardBdcCommand(createStableId('bdc-card'), pageId))
  }

  /** Creates a Statistical Graph BDC at its ordered page position. */
  public createStatisticalGraph(pageId: PageId, index: number): void {
    this.apply(createStatisticalGraphBdcCommand(createStableId('bdc-statistical-graph'), pageId, index))
  }

  /** Creates a Statistical Graph as one ordered Carousel view. */
  public createCarouselStatisticalGraph(carouselBdcId: BdcId, index: number): BdcId {
    const bdcId = createStableId('bdc-statistical-graph')
    this.apply(createStatisticalGraphCarouselBdcCommand(bdcId, carouselBdcId, index))
    return bdcId
  }

  /** Creates graph edit callbacks for one current document BDC. */
  public createStatisticalGraphEditorActions(bdcId: BdcId, content: StatisticalGraphContent): StatisticalGraphEditorActions {
    return this.statisticalGraphFacade.createEditorActions(bdcId, content)
  }

  /** Deletes a standalone or Carousel Graph through its typed command. */
  public deleteStatisticalGraph(bdcId: BdcId): void {
    this.apply({ type: 'bdc.statistical-graph.delete', bdcId })
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

  /** Saves the unique reader-facing summary settings through document history. */
  public updateSummarySettings(summary: SummarySettings): void {
    this.apply({ type: 'summary.settings.update', summary })
  }

  /** Imports an image through the shared persisted-media change pipeline for the Sommaire background. */
  public importSummaryBackgroundFile(file: File): void {
    const mediaImport = this.mediaResourceService.createImport(file)
    if (mediaImport === null || mediaTypeFromMimeType(mediaImport.media.mimeType) !== MEDIA_TYPE.IMAGE) return
    this.controller.send({ type: 'summary.media.file.import', file: mediaImport.file, media: mediaImport.media })
  }

  /** Saves profile fields and constraints through document history. */
  public updateProfileDefinition(profile: ProfileDefinition): void {
    this.apply({ type: 'profile.definition.update', profile })
  }

  /** Sets one explicit appearance value through the document history. */
  public setAppearanceProperty<Property extends AppearanceProperty>(
    target: AppearanceTargetForProperty<Property>,
    property: Property,
    value: NonNullable<AppearanceSettings[Property]>,
  ): void {
    if (property === 'background') {
      this.apply({ type: 'appearance.background.set', target, value: value as NonNullable<AppearanceSettings['background']> })
      return
    }
    this.apply({ type: 'appearance.property.set', target, property, value } as LearningDocumentCommand)
  }

  /** Applies a suggested heading/body font combination as one document command. */
  public setAppearanceTypography(target: AppearanceTarget, headingFontId: string, bodyFontId: string): void {
    this.apply({ type: 'appearance.typography.set', target, headingFontId, bodyFontId })
  }

  /** Removes one explicit appearance value so it inherits from its context. */
  public resetAppearanceProperty<Property extends AppearanceProperty>(
    target: AppearanceTargetForProperty<Property>,
    property: Property,
  ): void {
    this.apply({ type: 'appearance.property.reset', target, property } as LearningDocumentCommand)
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
    document: ResourceDocumentData,
    reference: ElceCatalogReference,
    pageId: PageId | null,
    sectionBdcId: BdcId,
  ): ElceCatalogDropTarget | null {
    return this.anchorFacade.createCatalogDropTarget(document, reference, pageId, sectionBdcId)
  }

  /** Sends a Section transaction through the existing XState anchor event. */
  public submitSectionChange(sectionBdcId: BdcId, change: ElceSectionChange, selection?: SectionChangeSelection): void {
    this.anchorFacade.submitSectionChange(sectionBdcId, change, selection)
  }

  /** Creates Question editor callbacks for one current BDC. */
  public createQuestionEditorActions(bdcId: BdcId, question: QuestionContent): ElceQuestionEditorActions {
    return {
      setType: (type) => this.questionFacade.setType(bdcId, question, type),
      setTitle: (title) => this.questionFacade.setTitle(bdcId, question, title),
      setPrompt: (prompt) => this.questionFacade.setPrompt(bdcId, question, prompt),
      setValidationLabel: (label) => this.questionFacade.setValidationLabel(bdcId, question, label),
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
  public createCardEditorActions(bdcs: readonly ResourceBdc[]): ElceCardEditorActions {
    return this.cardFacade.createEditorActions(bdcs)
  }

  /** Creates Carousel editor callbacks from its current content and Cards. */
  public createCarouselEditorActions(
    bdcId: BdcId,
    content: NonNullable<LearningBdc['carousel']>,
    cards: readonly ResourceBdc[],
    revelationDefaults: RevelationTransitionDefaults,
  ): ElceCarouselEditorActions {
    return this.carouselFacade.createEditorActions(bdcId, content, cards, revelationDefaults)
  }

  /** Attaches a validated reusable media reference to a Question. */
  public attachQuestionMediaReference(bdcId: BdcId, serializedReference: string): void {
    this.questionFacade.attachMediaReference(bdcId, serializedReference)
  }

  /** Applies one existing document command through the controller actor. */
  private apply(command: LearningDocumentCommand): void {
    this.controller.send({ type: 'document.apply', command, historyGroupKey: focusedTextFieldKey(`command:${command.type}`) ?? undefined })
  }
}

/** Identifies a native text field or Tiptap surface for short typing groups. */
function focusedTextFieldKey(prefix: string): string | null {
  if (typeof document === 'undefined') return null
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || active.id === '') return null
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active.isContentEditable)) return null
  return `${prefix}:${active.id}`
}
