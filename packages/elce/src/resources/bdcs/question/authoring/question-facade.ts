import { QUESTION_BDC_TYPE, QUESTION_TYPE } from '../question-config'
import { CATALOG_REFERENCE } from '../../../../core/catalog/catalog-config'
import { createQuestionBdcCommand } from './question-command-factory'
import { createStableId } from '../../../../core/document/stable-id'
import type { ResourceDocumentData } from '../../../document/resource-document-types'
import { ElceMediaResourceService } from '../../../../domain/media/media-resource-service'
import type { ElceQuestionFacadeOptions } from './question-facade-types'
import { ElceQuestionService } from '../domain/question-service'
import type { BdcId, PageId } from '../../../../core/document/content-document-types'
import type { QuestionContent, QuestionType } from '../domain/question-types'

/** Routes Question authoring intents to immutable document commands and XState. */
export class ElceQuestionFacade {
  private readonly dispatch: ElceQuestionFacadeOptions['dispatch']
  private readonly importMedia: ElceQuestionFacadeOptions['importMedia']
  private readonly mediaResourceService = new ElceMediaResourceService()
  private readonly questionService = new ElceQuestionService()

  public constructor(options: ElceQuestionFacadeOptions) {
    this.dispatch = options.dispatch
    this.importMedia = options.importMedia
  }

  /** Creates the page's unique Question BDC at its requested flow position. */
  public create(document: ResourceDocumentData, pageId: PageId, index: number): void {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined || page.bdcIds.some((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId)?.type === QUESTION_BDC_TYPE)) return
    this.dispatch(createQuestionBdcCommand(createStableId('bdc-question'), pageId, index))
  }

  /** Changes the selected question type while retaining its other authored content. */
  public setType(bdcId: BdcId, question: QuestionContent, type: QuestionType): void {
    this.update(bdcId, this.questionService.changeType(question, type))
  }

  /** Updates the optional title. */
  public setTitle(bdcId: BdcId, question: QuestionContent, title: string): void {
    this.update(bdcId, this.questionService.setTitle(question, title))
  }

  /** Updates the question prompt. */
  public setPrompt(bdcId: BdcId, question: QuestionContent, prompt: string): void {
    this.update(bdcId, this.questionService.setPrompt(question, prompt))
  }

  /** Updates the reader-facing validation button label. */
  public setValidationLabel(
    bdcId: BdcId,
    question: QuestionContent,
    label: string,
  ): void {
    this.update(bdcId, this.questionService.setValidationLabel(question, label))
  }

  /** Updates one response label. */
  public setAnswerLabel(bdcId: BdcId, question: QuestionContent, answerId: string, label: string): void {
    this.update(bdcId, this.questionService.setAnswerLabel(question, answerId, label))
  }

  /** Changes which response or responses are correct. */
  public setAnswerCorrect(bdcId: BdcId, question: QuestionContent, answerId: string, correct: boolean): void {
    this.update(bdcId, this.questionService.setAnswerCorrect(question, answerId, correct))
  }

  /** Adds an editable answer where the selected type allows it. */
  public addAnswer(bdcId: BdcId, question: QuestionContent): void {
    this.update(bdcId, this.questionService.addAnswer(question))
  }

  /** Removes one answer and keeps a valid correct-answer set. */
  public removeAnswer(bdcId: BdcId, question: QuestionContent, answerId: string): void {
    this.update(bdcId, this.questionService.removeAnswer(question, answerId))
  }

  /** Reports whether one answer can be removed without leaving an empty question. */
  public canRemoveAnswer(question: QuestionContent, answerId: string): boolean {
    return question.type !== QUESTION_TYPE.TRUE_FALSE && question.answers.length > 1 && question.answers.some((answer) => answer.id === answerId)
  }

  /** Reorders the authored answers. */
  public moveAnswer(bdcId: BdcId, question: QuestionContent, answerId: string, index: number): void {
    this.update(bdcId, this.questionService.moveAnswer(question, answerId, index))
  }

  /** Attaches a reusable image or video already stored in the media catalogue. */
  public attachMedia(bdcId: BdcId, mediaId: string): void {
    this.dispatch({ type: 'bdc.question.media.set', bdcId, mediaId })
  }

  /** Accepts only a media resource reference from the shared catalogue payload. */
  public attachMediaReference(bdcId: BdcId, serializedReference: string): void {
    const reference = readMediaReference(serializedReference)
    switch (reference) {
      case null:
        return
      default:
        this.attachMedia(bdcId, reference.mediaId)
    }
  }

  /** Imports one desktop image or video through the controller's media path. */
  public importMediaFile(bdcId: BdcId, file: File): void {
    const mediaImport = this.mediaResourceService.createImport(file)
    if (mediaImport !== null) this.importMedia(bdcId, mediaImport)
  }

  /** Removes the illustration reference without deleting its reusable media. */
  public clearMedia(bdcId: BdcId): void {
    this.dispatch({ type: 'bdc.question.media.set', bdcId, mediaId: null })
  }

  /** Permanently removes the Question BDC and keeps its media in the catalogue. */
  public delete(bdcId: BdcId): void {
    this.dispatch({ type: 'bdc.question.delete', bdcId })
  }

  private update(bdcId: BdcId, question: QuestionContent): void {
    this.dispatch({ type: 'bdc.question.update', bdcId, question })
  }
}

/** Parses the catalogue drag payload without accepting a unique BDC as reusable media. */
function readMediaReference(value: string): Extract<import('../../../../core/catalog/catalog-types').ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.MEDIA }> | null {
  try {
    const parsed = JSON.parse(value) as { kind?: unknown; mediaId?: unknown }
    if (parsed.kind !== CATALOG_REFERENCE.MEDIA || typeof parsed.mediaId !== 'string') return null
    return { kind: CATALOG_REFERENCE.MEDIA, mediaId: parsed.mediaId }
  } catch {
    return null
  }
}
