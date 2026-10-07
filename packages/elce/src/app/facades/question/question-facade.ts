import { BDC_TYPE, CATALOG_REFERENCE, QUESTION_TYPE } from '../../../config/document-config'
import { createQuestionBdcCommand } from '../../../domain/commands/document-commands'
import { createStableId, type ElceDocument } from '../../../domain/document/document-model'
import { ElceMediaResourceService } from '../../../domain/media/media-resource-service'
import type { ElceQuestionFacadeOptions } from './question-facade-types'
import { ElceQuestionService } from '../../../domain/question/question-service'
import type { BdcId, PageId } from '../../../domain/document/document-types'
import type { QuestionType } from '../../../domain/question/question-types'

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
  public create(document: ElceDocument, pageId: PageId, index: number): void {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined || page.bdcIds.some((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId)?.type === BDC_TYPE.QUESTION)) return
    this.dispatch(createQuestionBdcCommand(createStableId('bdc-question'), pageId, index))
  }

  /** Changes the selected question type while retaining its other authored content. */
  public setType(bdcId: BdcId, question: NonNullable<ElceDocument['data']['bdcs'][number]['question']>, type: QuestionType): void {
    this.update(bdcId, this.questionService.changeType(question, type))
  }

  /** Updates the optional title. */
  public setTitle(bdcId: BdcId, question: NonNullable<ElceDocument['data']['bdcs'][number]['question']>, title: string): void {
    this.update(bdcId, this.questionService.setTitle(question, title))
  }

  /** Updates the question prompt. */
  public setPrompt(bdcId: BdcId, question: NonNullable<ElceDocument['data']['bdcs'][number]['question']>, prompt: string): void {
    this.update(bdcId, this.questionService.setPrompt(question, prompt))
  }

  /** Updates one response label. */
  public setAnswerLabel(bdcId: BdcId, question: NonNullable<ElceDocument['data']['bdcs'][number]['question']>, answerId: string, label: string): void {
    this.update(bdcId, this.questionService.setAnswerLabel(question, answerId, label))
  }

  /** Changes which response or responses are correct. */
  public setAnswerCorrect(bdcId: BdcId, question: NonNullable<ElceDocument['data']['bdcs'][number]['question']>, answerId: string, correct: boolean): void {
    this.update(bdcId, this.questionService.setAnswerCorrect(question, answerId, correct))
  }

  /** Adds an editable answer where the selected type allows it. */
  public addAnswer(bdcId: BdcId, question: NonNullable<ElceDocument['data']['bdcs'][number]['question']>): void {
    this.update(bdcId, this.questionService.addAnswer(question))
  }

  /** Removes one answer and keeps a valid correct-answer set. */
  public removeAnswer(bdcId: BdcId, question: NonNullable<ElceDocument['data']['bdcs'][number]['question']>, answerId: string): void {
    this.update(bdcId, this.questionService.removeAnswer(question, answerId))
  }

  /** Reports whether one answer can be removed without leaving an empty question. */
  public canRemoveAnswer(question: NonNullable<ElceDocument['data']['bdcs'][number]['question']>, answerId: string): boolean {
    return question.type !== QUESTION_TYPE.TRUE_FALSE && question.answers.length > 1 && question.answers.some((answer) => answer.id === answerId)
  }

  /** Reorders the authored answers. */
  public moveAnswer(bdcId: BdcId, question: NonNullable<ElceDocument['data']['bdcs'][number]['question']>, answerId: string, index: number): void {
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

  private update(bdcId: BdcId, question: NonNullable<ElceDocument['data']['bdcs'][number]['question']>): void {
    this.dispatch({ type: 'bdc.question.update', bdcId, question })
  }
}

/** Parses the catalogue drag payload without accepting a unique BDC as reusable media. */
function readMediaReference(value: string): Extract<import('../../../domain/catalog/catalog-types').ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.MEDIA }> | null {
  try {
    const parsed = JSON.parse(value) as { kind?: unknown; mediaId?: unknown }
    if (parsed.kind !== CATALOG_REFERENCE.MEDIA || typeof parsed.mediaId !== 'string') return null
    return { kind: CATALOG_REFERENCE.MEDIA, mediaId: parsed.mediaId }
  } catch {
    return null
  }
}
