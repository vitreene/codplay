import { CATALOG_REFERENCE } from '../../../../core/catalog/catalog-config'
import type { ElceCatalogReference } from '../../../../core/catalog/catalog-types'
import type { BdcId } from '../../../../core/document/content-document-types'
import { ElceMediaResourceService } from '../../../../domain/media/media-resource-service'
import type { ElceQuestionEditorActions, ElceQuestionFacadeOptions } from './question-facade-types'
import { QUESTION_TYPE_CONFIG } from '../question-config'
import { ElceQuestionService } from '../domain/question-service'
import type { QuestionContent, QuestionType } from '../domain/question-types'
import type { ElceTextValue } from '../../../document/rich-text-types'

/** Routes Question editing through shared rules and the mod's document commands. */
export class ElceQuestionFacade {
  private readonly dispatch: ElceQuestionFacadeOptions['dispatch']
  private readonly getCurrentQuestion: ElceQuestionFacadeOptions['getQuestion']
  private readonly importMedia: ElceQuestionFacadeOptions['importMedia']
  private readonly mediaResourceService = new ElceMediaResourceService()
  private readonly questionService = new ElceQuestionService()

  public constructor(options: ElceQuestionFacadeOptions) {
    this.dispatch = options.dispatch
    this.getCurrentQuestion = options.getQuestion
    this.importMedia = options.importMedia
  }

  /** Creates editor callbacks that read the latest Question before each edit. */
  public createEditorActions(bdcId: BdcId): ElceQuestionEditorActions {
    /** Applies one Question transformation to the latest stored content. */
    const update = (transform: (question: QuestionContent) => QuestionContent): void => {
      const question = this.getCurrentQuestion(bdcId)
      if (question === null) return
      this.dispatch({ type: 'bdc.question.update', bdcId, question: transform(question) })
    }
    return {
      setType: (type: QuestionType) => update((question) => this.questionService.changeType(question, type)),
      setTitle: (title: ElceTextValue) => update((question) => this.questionService.setTitle(question, title)),
      setPrompt: (prompt: ElceTextValue) => update((question) => this.questionService.setPrompt(question, prompt)),
      setValidationLabel: (label: ElceTextValue) => update((question) => this.questionService.setValidationLabel(question, label)),
      setAnswerLabel: (answerId, label) => update((question) => this.questionService.setAnswerLabel(question, answerId, label)),
      setAnswerCorrect: (answerId, correct) => update((question) => this.questionService.setAnswerCorrect(question, answerId, correct)),
      addAnswer: () => update((question) => this.questionService.addAnswer(question)),
      removeAnswer: (answerId) => update((question) => this.questionService.removeAnswer(question, answerId)),
      canRemoveAnswer: (answerId) => {
        const question = this.getCurrentQuestion(bdcId)
        return question !== null && QUESTION_TYPE_CONFIG[question.type].editableAnswers
          && question.answers.length > 1 && question.answers.some((answer) => answer.id === answerId)
      },
      moveAnswer: (answerId, index) => update((question) => this.questionService.moveAnswer(question, answerId, index)),
      importMedia: (file) => this.importMediaFile(bdcId, file),
      clearMedia: () => this.clearMedia(bdcId),
      deleteQuestion: () => this.delete(bdcId),
    }
  }

  /** Attaches a reusable image or video already stored in the media catalogue. */
  public attachMedia(bdcId: BdcId, mediaId: string): void {
    this.dispatch({ type: 'bdc.question.media.set', bdcId, mediaId })
  }

  /** Accepts only a media resource reference from the shared catalogue payload. */
  public attachMediaReference(bdcId: BdcId, serializedReference: string): void {
    const reference = readMediaReference(serializedReference)
    if (reference === null) return
    this.attachMedia(bdcId, reference.mediaId)
  }

  /** Imports one desktop image or video through the mod's media path. */
  public importMediaFile(bdcId: BdcId, file: File): void {
    const mediaImport = this.mediaResourceService.createImport(file)
    if (mediaImport !== null) this.importMedia(bdcId, mediaImport)
  }

  /** Removes the illustration reference without deleting its reusable media. */
  public clearMedia(bdcId: BdcId): void {
    this.dispatch({ type: 'bdc.question.media.set', bdcId, mediaId: null })
  }

  /** Requests removal through the owning mod's required-Question policy. */
  public delete(bdcId: BdcId): void {
    this.dispatch({ type: 'bdc.question.delete', bdcId })
  }
}

/** Parses the catalogue drag payload without accepting a unique BDC as reusable media. */
function readMediaReference(value: string): Extract<ElceCatalogReference, { kind: typeof CATALOG_REFERENCE.MEDIA }> | null {
  try {
    const parsed = JSON.parse(value) as { kind?: unknown; mediaId?: unknown }
    if (parsed.kind !== CATALOG_REFERENCE.MEDIA || typeof parsed.mediaId !== 'string') return null
    return { kind: CATALOG_REFERENCE.MEDIA, mediaId: parsed.mediaId }
  } catch {
    return null
  }
}
