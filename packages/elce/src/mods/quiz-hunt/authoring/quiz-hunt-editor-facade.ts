import type { Actor } from 'xstate'
import { CoreEditorFacade, runProjectOperationAndWait } from '../../../core/authoring/core-editor-facade'
import type { QuestionContent } from '../../../resources/bdcs/question/domain/question-types'
import { QUESTION_BDC_TYPE } from '../../../resources/bdcs/question/question-config'
import { ElceQuestionFacade } from '../../../resources/bdcs/question/authoring/question-facade'
import type { ElceQuestionEditorActions } from '../../../resources/bdcs/question/authoring/question-facade-types'
import { CARD_BDC_TYPE } from '../../../resources/bdcs/card/card-config'
import { ElceCardFacade } from '../../../resources/bdcs/card/authoring/card-facade'
import type { ElceCardEditorActions } from '../../../resources/bdcs/card/authoring/card-facade-types'
import type { ElceMediaImport } from '../../../domain/media/media-resource-types'
import type { CardContent } from '../../../resources/bdcs/card/domain/card-types'
import type { SectionContent } from '../../../resources/bdcs/section/domain/section-types'
import type { ElceSectionChange } from '../../../resources/anchoring/domain/anchor-types'
import type { SectionChangeSelection } from '../../../resources/anchoring/authoring/anchor-drop-facade'
import type { QuizHuntCommand } from './quiz-hunt-controller'
import { createQuizHuntControllerMachine } from './quiz-hunt-controller'
import type { QuizHuntGroup, QuizHuntSettings } from '../document/quiz-hunt-document-types'

/** Routes Quiz Hunt authoring intentions through its controller and shared resource rules. */
export class QuizHuntEditorFacade {
  public readonly core: CoreEditorFacade
  private readonly controller: Actor<ReturnType<typeof createQuizHuntControllerMachine>>
  private readonly questionFacade: ElceQuestionFacade
  private readonly cardFacade: ElceCardFacade

  /** Binds core project actions and the Quiz Hunt document actor. */
  public constructor(controller: Actor<ReturnType<typeof createQuizHuntControllerMachine>>) {
    this.controller = controller
    this.core = new CoreEditorFacade(
      (event) => controller.send(event),
      (name) => this.apply({ type: 'document.rename', name }),
      (operation) => runProjectOperationAndWait(controller, operation),
    )
    this.questionFacade = new ElceQuestionFacade({
      dispatch: (command) => this.apply(command),
      getQuestion: (bdcId) => this.currentQuestion(bdcId),
      importMedia: (bdcId, mediaImport: ElceMediaImport) => controller.send({
        type: 'question.media.file.import',
        bdcId,
        file: mediaImport.file,
        media: mediaImport.media,
      }),
    })
    this.cardFacade = new ElceCardFacade({
      dispatch: (command) => this.apply(command),
      getCard: (bdcId) => this.currentCard(bdcId),
      importMedia: (bdcId, mediaImport: ElceMediaImport) => controller.send({
        type: 'card.media.file.import',
        bdcId,
        file: mediaImport.file,
        media: mediaImport.media,
      }),
    })
  }

  /** Creates a page inside a game bank or the optional Introduction chapter. */
  public createPage(chapterId: string | null, name: string): void {
    this.controller.send({ type: 'page.create', chapterId, name })
  }

  /** Deletes one authored page while preserving its chapter and referenced media. */
  public deletePage(pageId: string): void {
    this.apply({ type: 'page.delete', pageId })
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

  /** Creates shared Question editor actions against the latest document content. */
  public createQuestionEditorActions(bdcId: string): ElceQuestionEditorActions {
    return this.questionFacade.createEditorActions(bdcId)
  }

  /** Creates the shared Card editor actions for Quiz Hunt's configured result Cards. */
  public createCardEditorActions(): ElceCardEditorActions {
    return this.cardFacade.createEditorActions()
  }

  /** Resolves a shared media drag payload and attaches it to this Question. */
  public attachQuestionMediaReference(bdcId: string, value: string): void {
    this.questionFacade.attachMediaReference(bdcId, value)
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
    return bdc?.type === CARD_BDC_TYPE ? bdc.card ?? null : null
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
