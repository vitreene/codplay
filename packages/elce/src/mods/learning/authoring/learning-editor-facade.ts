import { AVATAR_BDC_TYPE, AVATAR_PRESET_ID } from '../../../resources/bdcs/avatar/avatar-config'
import { parseAvatarTimeline } from '../../../resources/bdcs/avatar/domain/avatar-service'
import { readAvatarAudioDuration } from '../../../resources/bdcs/avatar/authoring/avatar-audio-duration'
import type { AvatarContent } from '../../../resources/bdcs/avatar/domain/avatar-types'
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
import { createSummaryBdcCommand } from '../../../resources/bdcs/summary/authoring/summary-bdc-command-factory'
import { createStandaloneCardBdcCommand } from '../../../resources/bdcs/card/authoring/card-command-factory'
import { CARD_PRESET_ID } from '../../../resources/bdcs/card/card-config'
import { ListService } from '../../../resources/list/domain/list-service'
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
import { createQuestionBdcCommand } from '../../../resources/bdcs/question/authoring/question-command-factory'
import { QUESTION_BDC_TYPE } from '../../../resources/bdcs/question/question-config'
import { CARD_BDC_TYPE } from '../../../resources/bdcs/card/card-config'
import { StatisticalGraphFacade } from '../../../resources/bdcs/statistical-graph/authoring/statistical-graph-facade'
import { ElceStatisticalGraphService } from '../../../resources/bdcs/statistical-graph/domain/statistical-graph-service'
import type { StatisticalGraphEditorActions } from '../../../resources/bdcs/statistical-graph/authoring/statistical-graph-facade-types'
import { CoreEditorFacade, runProjectOperationAndWait } from '../../../core/authoring/core-editor-facade'
import { LearningAuthoringService } from './learning-authoring-service'
import type { ElceTextValue } from '../../../resources/document/rich-text-types'

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
      (operation) => runProjectOperationAndWait(controller, operation),
    )
    const dispatch = (command: LearningDocumentCommand): void => {
      this.apply(command)
    }
    const importCardMedia = (bdcId: BdcId, mediaImport: ElceMediaImport): void => {
      this.controller.send({ type: 'card.media.file.import', bdcId, file: mediaImport.file, media: mediaImport.media })
    }
    /** Reads one Card from the controller's latest document snapshot. */
    const getCard = (bdcId: BdcId) => {
      const bdc = this.controller.getSnapshot().context.document.bdcs.find((candidate) => candidate.id === bdcId)
      return bdc?.type === CARD_BDC_TYPE ? bdc.card ?? null : null
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
    this.cardFacade = new ElceCardFacade({
      dispatch,
      getCard,
      importMedia: importCardMedia,
    })
    this.carouselFacade = new ElceCarouselFacade({
      dispatch,
      getCard,
      selectCard: (bdcId) => this.selectCard(bdcId),
      importMedia: importCardMedia,
    })
    this.questionFacade = new ElceQuestionFacade({
      dispatch,
      getQuestion: (bdcId) => {
        const bdc = this.controller.getSnapshot().context.document.bdcs.find((candidate) => candidate.id === bdcId)
        return bdc?.type === QUESTION_BDC_TYPE ? bdc.question : null
      },
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
  public createChapter(document: LearningDocument, parentChapterId?: ChapterId): void {
    this.apply(learningDocumentService.createChapterCommand(document, undefined, CHAPTER_TYPE.STANDARD, parentChapterId))
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
  public moveChapter(chapterId: ChapterId, index: number, parentChapterId: ChapterId | null = null): void {
    this.apply(createChapterMoveCommand(chapterId, index, parentChapterId))
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

  /** Permanently deletes a Summary BDC from its page or the reusable catalogue. */
  public deleteSummaryBdc(bdcId: BdcId): void {
    this.apply({ type: 'bdc.summary.delete', bdcId })
  }

  /** Creates the page's one sibling Avatar through the existing command queue. */
  public createAvatar(pageId: PageId, index: number): void {
    this.apply({ type: 'bdc.create', bdcId: createStableId('bdc-avatar'), bdcType: AVATAR_BDC_TYPE, presetId: AVATAR_PRESET_ID, placement: { kind: BDC_LOCATION.PAGE, pageId, index } })
  }

  /** Updates placement and playback settings without changing the current take. */
  public updateAvatar(bdcId: BdcId, avatar: AvatarContent): void {
    this.apply({ type: 'bdc.avatar.update', bdcId, avatar })
  }

  /** Deletes the Avatar and its word links while retaining the Carousel times. */
  public deleteAvatar(bdcId: BdcId): void {
    this.apply({ type: 'bdc.avatar.delete', bdcId })
  }

  /** Reads the generated take files and waits for the common persisted import circuit to apply them. */
  public async importAvatarTake(bdcId: BdcId, audio: File, timeline: File): Promise<void> {
    const imported = this.mediaResourceService.createImport(audio)
    if (imported === null || !imported.media.mimeType.startsWith('audio/')) throw new Error('Choisissez un fichier audio.')
    const durationMs = await readAvatarAudioDuration(audio)
    const take = parseAvatarTimeline(JSON.parse(await timeline.text()), { id: createStableId('take'), audioMediaId: imported.media.id, durationMs })
    await new Promise<void>((resolve, reject) => {
      let wasQueued = false
      let settled = false
      let subscription: { unsubscribe(): void } | null = null
      const finish = (error?: Error): void => {
        if (settled) return
        settled = true
        subscription?.unsubscribe()
        if (error === undefined) resolve()
        else reject(error)
      }
      const inspectImport = (): void => {
        const context = this.controller.getSnapshot().context
        const appliedTake = context.document.bdcs.find((bdc) => bdc.id === bdcId)?.avatar?.take
        if (appliedTake?.id === take.id) {
          finish()
          return
        }
        const queued = context.documentChanges.some((change) =>
          change.kind === 'avatar-take-import' && change.take.id === take.id)
        if (queued) {
          wasQueued = true
          return
        }
        if (wasQueued) finish(new Error('Elcé n’a pas pu enregistrer la prise dans l’Avatar.'))
        else finish(new Error('L’éditeur Elcé n’a pas accepté la prise de l’Avatar.'))
      }

      subscription = this.controller.subscribe(inspectImport)
      this.controller.send({ type: 'avatar.take.file.import', bdcId, file: audio, media: imported.media, take })
      inspectImport()
    })
  }

  /** Reassociates one view with a specific occurrence of the current voice transcript. */
  public associateCarouselWord(bdcId: BdcId, cardBdcId: BdcId, avatarBdcId: BdcId, wordIndex: number, startAtMs: number): void {
    this.apply({ type: 'bdc.carousel.word.set', bdcId, cardBdcId, avatarBdcId, wordIndex, startAtMs })
  }

  /** Creates a Section BDC at the requested page position. */
  public createSection(pageId: PageId, index: number): void {
    this.apply(createSectionBdcCommand(createStableId('bdc-section'), pageId, index))
  }

  /** Creates a page-level Summary BDC through the existing document command queue. */
  public createSummary(pageId: PageId, index: number): void {
    this.apply(createSummaryBdcCommand(createStableId('bdc-summary'), pageId, index))
  }

  /** Creates the unique Question BDC under Learning's per-page rule. */
  public createQuestion(document: LearningDocument, pageId: PageId, index: number): void {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined || page.bdcIds.some((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId)?.type === QUESTION_BDC_TYPE)) return
    this.apply(createQuestionBdcCommand(createStableId('bdc-question'), pageId, index))
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

  /** Creates a standalone Card that hosts a new reusable List module. */
  public createStandaloneListCard(pageId: PageId): void {
    const list = new ListService().createDefault(createStableId('list-row'))
    this.apply(createStandaloneCardBdcCommand(createStableId('bdc-card'), pageId, CARD_PRESET_ID.LIST, undefined, list))
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
  public renamePage(pageId: PageId, name: ElceTextValue): void {
    this.apply({ type: 'page.rename', pageId, name })
  }

  /** Sets or clears one page's early-exit override through document history. */
  public setPageEarlyExit(pageId: PageId, allowEarlyExit: boolean | null): void {
    this.apply({ type: 'page.early-exit.set', pageId, allowEarlyExit })
  }

  /** Renames a chapter through the document command boundary. */
  public renameChapter(chapterId: ChapterId, name: ElceTextValue): void {
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

  /** Adds a custom color to the shared project palette. */
  public addCustomAppearanceColor(color: string): void {
    this.apply({ type: 'appearance.palette.color.add', color })
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

  /** Creates Question editor callbacks backed by the current document getter. */
  public createQuestionEditorActions(bdcId: BdcId): ElceQuestionEditorActions {
    return this.questionFacade.createEditorActions(bdcId)
  }

  /** Creates Card editor callbacks backed by the current document getter. */
  public createCardEditorActions(): ElceCardEditorActions {
    return this.cardFacade.createEditorActions()
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
