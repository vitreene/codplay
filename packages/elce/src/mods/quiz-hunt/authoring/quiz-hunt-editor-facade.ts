import type { Actor } from 'xstate'
import { CoreEditorFacade } from '../../../core/authoring/core-editor-facade'
import type { QuestionContent, QuestionType } from '../../../resources/bdcs/question/domain/question-types'
import { QUESTION_TYPE } from '../../../resources/bdcs/question/question-config'
import { ElceQuestionService } from '../../../resources/bdcs/question/domain/question-service'
import type { ElceQuestionEditorActions } from '../../../resources/bdcs/question/authoring/question-facade-types'
import { ElceMediaResourceService } from '../../../domain/media/media-resource-service'
import { ElceCardService } from '../../../resources/bdcs/card/domain/card-service'
import type { CardContent, CardTextField } from '../../../resources/bdcs/card/domain/card-types'
import type { CardImageFit, CardLayoutId } from '../../../resources/bdcs/card/card-config'
import type { CarouselImagePosition } from '../../../resources/bdcs/carousel/carousel-config'
import type { ElceCardEditorActions } from '../../../resources/bdcs/card/authoring/card-facade-types'
import type { ElceCatalogReference } from '../../../core/catalog/catalog-types'
import { CATALOG_REFERENCE } from '../../../core/catalog/catalog-config'
import type { RevelationTransitionOverrides } from '../../../resources/revelation/revelation-types'
import type { ElceTextValue } from '../../../resources/document/rich-text-types'
import type { SectionContent } from '../../../resources/bdcs/section/domain/section-types'
import type { ElceSectionChange } from '../../../resources/anchoring/domain/anchor-types'
import type { SectionChangeSelection } from '../../../resources/anchoring/authoring/anchor-drop-facade'
import { QUESTION_BDC_TYPE } from '../../../resources/bdcs/question/question-config'
import type { QuizHuntCommand } from './quiz-hunt-controller'
import { createQuizHuntControllerMachine } from './quiz-hunt-controller'
import type { QuizHuntGroup, QuizHuntSettings } from '../document/quiz-hunt-document-types'

/** Routes Quiz Hunt authoring intentions through its controller and shared resource rules. */
export class QuizHuntEditorFacade {
  public readonly core: CoreEditorFacade
  private readonly controller: Actor<ReturnType<typeof createQuizHuntControllerMachine>>
  private readonly questions = new ElceQuestionService()
  private readonly cards = new ElceCardService()
  private readonly mediaResources = new ElceMediaResourceService()

  /** Binds core project actions and the Quiz Hunt document actor. */
  public constructor(controller: Actor<ReturnType<typeof createQuizHuntControllerMachine>>) {
    this.controller = controller
    this.core = new CoreEditorFacade(
      (event) => controller.send(event),
      (name) => this.apply({ type: 'document.rename', name }),
    )
  }

  /** Creates a game page inside its owning Question or Finale bank. */
  public createPage(chapterId: string, name: string): void {
    this.apply({ type: 'page.create', chapterId, name })
  }

  /** Renames one bank without changing its role. */
  public renameChapter(chapterId: string, name: string): void {
    this.apply({ type: 'chapter.rename', chapterId, name })
  }

  /** Renames one page without changing its placement. */
  public renamePage(pageId: string, name: string): void {
    this.apply({ type: 'page.rename', pageId, name })
  }

  /** Selects a page in the controller-owned authoring selection. */
  public selectPage(pageId: string): void {
    this.controller.send({ type: 'page.select', pageId })
  }

  /** Selects a bank in the controller-owned authoring selection. */
  public selectChapter(chapterId: string): void {
    this.controller.send({ type: 'chapter.select', chapterId })
  }

  /** Assigns a page to one of the colors authored in the summary. */
  public setPageColor(pageId: string, colorId: string | null): void {
    this.apply({ type: 'page.color.set', pageId, colorId })
  }

  /** Marks a bank question for guaranteed presence in its color's draw. */
  public setMandatory(pageId: string, mandatory: boolean): void {
    this.apply({ type: 'page.mandatory.set', pageId, mandatory })
  }

  /** Adds or updates one summary color group. */
  public setGroup(group: QuizHuntGroup): void {
    this.apply({ type: 'group.set', group })
  }

  /** Removes a color and clears its authored page assignments. */
  public removeGroup(colorId: string): void {
    this.apply({ type: 'group.delete', colorId })
  }

  /** Updates Quiz Hunt settings while retaining the authored color list. */
  public updateSettings(settings: Partial<Omit<QuizHuntSettings, 'groups' | 'successCardBdcId' | 'failureCardBdcId'>>): void {
    this.apply({ type: 'settings.update', settings })
  }

  /** Inserts a Section BDC at the selected page position. */
  public createSection(pageId: string, index: number): void {
    this.apply({ type: 'section.create', pageId, index })
  }

  /** Deletes one Section through the Quiz Hunt document command path. */
  public deleteSection(bdcId: string): void {
    this.apply({ type: 'section.delete', bdcId })
  }

  /** Reorders one BDC inside its owning game page. */
  public moveBdc(bdcId: string, pageId: string, index: number): void {
    this.apply({ type: 'bdc.move', bdcId, pageId, index })
  }

  /** Saves the selected Section's JSON and static HTML projection. */
  public updateSection(bdcId: string, section: SectionContent): void {
    this.apply({ type: 'section.update', bdcId, section })
  }

  /** Sends a Section editor transaction through the queued project history path. */
  public submitSectionChange(
    bdcId: string,
    change: ElceSectionChange,
    selection?: SectionChangeSelection,
  ): void {
    const groupKey = change.kind === 'content' ? focusedTextFieldKey(`section:${bdcId}`) : null
    this.controller.send({
      type: 'section.change',
      sectionBdcId: bdcId,
      change,
      historyGroupKey: groupKey ?? undefined,
      selectionBefore: selection?.before,
      selectionAfter: selection?.after,
    })
  }

  /** Creates the shared Question editor actions against the latest controller value. */
  public createQuestionEditorActions(bdcId: string): ElceQuestionEditorActions {
    const update = (change: (question: QuestionContent) => QuestionContent): void => {
      const question = this.currentQuestion(bdcId)
      if (question !== null) this.apply({ type: 'question.update', bdcId, question: change(question) })
    }
    return {
      setType: (type: QuestionType) => update((question) => this.questions.changeType(question, type)),
      setTitle: (title: ElceTextValue) => update((question) => this.questions.setTitle(question, title)),
      setPrompt: (prompt: ElceTextValue) => update((question) => this.questions.setPrompt(question, prompt)),
      setValidationLabel: (label: ElceTextValue) => update((question) => this.questions.setValidationLabel(question, label)),
      setAnswerLabel: (answerId, label) => update((question) => this.questions.setAnswerLabel(question, answerId, label)),
      setAnswerCorrect: (answerId, correct) => update((question) => this.questions.setAnswerCorrect(question, answerId, correct)),
      addAnswer: () => update((question) => this.questions.addAnswer(question)),
      removeAnswer: (answerId) => update((question) => this.questions.removeAnswer(question, answerId)),
      canRemoveAnswer: (answerId) => {
        const question = this.currentQuestion(bdcId)
        return question !== null && question.type !== QUESTION_TYPE.TRUE_FALSE
          && question.answers.length > 1 && question.answers.some((answer) => answer.id === answerId)
      },
      deleteQuestion: () => this.apply({ type: 'question.delete', bdcId }),
      moveAnswer: (answerId, index) => update((question) => this.questions.moveAnswer(question, answerId, index)),
      importMedia: (file) => {
        const mediaImport = this.mediaResources.createImport(file)
        if (mediaImport !== null) this.controller.send({ type: 'question.media.file.import', bdcId, file, media: mediaImport.media })
      },
      clearMedia: () => this.apply({ type: 'question.media.set', bdcId, mediaId: null }),
    }
  }

  /** Creates the shared Card editor actions for Quiz Hunt's configured result Cards. */
  public createCardEditorActions(): ElceCardEditorActions {
    const update = (bdcId: string, change: (card: CardContent) => CardContent): void => {
      const card = this.currentCard(bdcId)
      if (card !== null) this.apply({ type: 'card.update', bdcId, card: change(card) })
    }
    return {
      setCardLayout: (bdcId: string, layoutId: CardLayoutId) => this.apply({ type: 'card.layout.set', bdcId, layoutId }),
      setCardText: (bdcId: string, field: CardTextField, value: ElceTextValue) => update(bdcId, (card) => this.cards.setTextField(card, field, value)),
      setCaption: (bdcId: string, value: ElceTextValue) => update(bdcId, (card) => ({ ...card, caption: value })),
      setImagePosition: (bdcId: string, imagePosition: CarouselImagePosition) => update(bdcId, (card) => this.cards.setImagePosition(card, imagePosition)),
      setImageFit: (bdcId: string, imageFit: CardImageFit) => update(bdcId, (card) => this.cards.setImageFit(card, imageFit)),
      setRevelation: (bdcId: string, revelation: RevelationTransitionOverrides) => update(bdcId, (card) => this.cards.setRevelation(card, revelation)),
      attachCatalogReference: (bdcId: string, reference: ElceCatalogReference) => {
        if (reference.kind === CATALOG_REFERENCE.MEDIA) this.apply({ type: 'card.media.set', bdcId, mediaId: reference.mediaId })
      },
      importMediaFile: (bdcId: string, file: File) => {
        const mediaImport = this.mediaResources.createImport(file)
        if (mediaImport !== null) this.controller.send({ type: 'card.media.file.import', bdcId, file, media: mediaImport.media })
      },
      clearMedia: (bdcId: string) => this.apply({ type: 'card.media.set', bdcId, mediaId: null }),
    }
  }

  /** Resolves a shared media drag payload and attaches it to this Question. */
  public attachQuestionMediaReference(bdcId: string, value: string): void {
    try {
      const reference = JSON.parse(value) as { kind?: unknown; mediaId?: unknown }
      if (reference.kind !== CATALOG_REFERENCE.MEDIA || typeof reference.mediaId !== 'string') return
      this.apply({ type: 'question.media.set', bdcId, mediaId: reference.mediaId })
    } catch {
      return
    }
  }

  /** Dispatches one accepted Quiz Hunt command to the shared controller machine. */
  private apply(command: QuizHuntCommand): void {
    this.controller.send({ type: 'document.apply', command })
  }

  /** Reads the current Question without retaining authoring state in the view. */
  private currentQuestion(bdcId: string): QuestionContent | null {
    const bdc = this.controller.getSnapshot().context.document.bdcs.find((candidate) => candidate.id === bdcId)
    return bdc?.type === QUESTION_BDC_TYPE ? bdc.question : null
  }

  /** Reads the current Card without retaining authoring state in the view. */
  private currentCard(bdcId: string): CardContent | null {
    const bdc = this.controller.getSnapshot().context.document.bdcs.find((candidate) => candidate.id === bdcId)
    return bdc?.type === 'card' ? bdc.card ?? null : null
  }

}

/** Identifies the active native text field or Tiptap surface for a typing group. */
function focusedTextFieldKey(prefix: string): string | null {
  if (typeof document === 'undefined') return null
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || active.id === '') return null
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active.isContentEditable)) return null
  return `${prefix}:${active.id}`
}
