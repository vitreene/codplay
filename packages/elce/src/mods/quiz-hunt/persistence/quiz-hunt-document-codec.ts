import type { DocumentStoreCodec } from '../../../core/persistence/indexed-db/document-store-types'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { normalizeQuizHuntExtraTrigger } from '../document/quiz-hunt-extra-trigger.ts'
import { normalizeQuizHuntFinalColors } from '../document/quiz-hunt-final-color.ts'
import { ElceQuestionService } from '../../../resources/bdcs/question/domain/question-service'
import { assertContentPlacementInvariants } from '../../../core/document/content-placement-service'
import { CARD_PRESET_ID } from '../../../resources/bdcs/card/card-config'
import { ListService } from '../../../resources/list/domain/list-service'

type RecordValue = Record<string, unknown>

/** Reads a JSON object once at the mod's persistence boundary. */
function record(value: unknown): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Objet Quiz Hunt attendu.')
  return value as RecordValue
}

/** Rejects missing or malformed string fields before admitting persisted content. */
function requireStrings(value: RecordValue, names: readonly string[]): void {
  if (names.some((name) => typeof value[name] !== 'string')) throw new Error('Identifiant ou texte Quiz Hunt invalide.')
}

/** Reads only the dedicated Quiz Hunt document format and checks its references. */
export function readQuizHuntDocument(value: unknown): QuizHuntDocument {
  const envelope = record(value)
  if (envelope.version !== 1) throw new Error('Format Quiz Hunt non pris en charge.')
  const data = record(envelope.document)
  requireStrings(data, ['id', 'name'])
  const arrays = ['pages', 'chapters', 'scenarioEntries', 'bdcs', 'medias', 'catalogPageIds', 'catalogBdcIds']
  if (arrays.some((name) => !Array.isArray(data[name]))) throw new Error('Collections Quiz Hunt invalides.')
  const settings = record(data.settings)
  settings.extraTriggerPageId ??= null
  settings.authoringGridDebug ??= false
  if (!Array.isArray(settings.groups)
    || typeof settings.successCardBdcId !== 'string' || typeof settings.failureCardBdcId !== 'string'
    || typeof settings.random !== 'boolean' || typeof settings.extraEnabled !== 'boolean'
    || typeof settings.authoringGridDebug !== 'boolean'
    || settings.extraTriggerPageId !== null && typeof settings.extraTriggerPageId !== 'string'
    || ['seed', 'timeBudgetMs', 'clueDelayMs', 'feedbackDelayMs'].some((name) => typeof settings[name] !== 'number' || !Number.isFinite(settings[name]))) {
    throw new Error('Réglages Quiz Hunt invalides.')
  }
  settings.groups.forEach((value: unknown) => requireStrings(record(value), ['id', 'name', 'color']))
  const pages = data.pages as unknown[]
  pages.forEach((value) => {
    const page = record(value)
    requireStrings(page, ['id', 'name', 'type'])
    if (!['summary', 'flux', 'diapo'].includes(String(page.type)) || !Array.isArray(page.bdcIds)
      || page.bdcIds.some((id) => typeof id !== 'string') || typeof page.mandatory !== 'boolean'
      || page.colorId !== null && typeof page.colorId !== 'string'
      || page.chapterId !== null && typeof page.chapterId !== 'string') throw new Error('Page Quiz Hunt invalide.')
  })
  const chapters = data.chapters as unknown[]
  chapters.forEach((value) => {
    const chapter = record(value)
    requireStrings(chapter, ['id', 'name', 'type'])
    if (!['questions', 'finals', 'introduction'].includes(String(chapter.type)) || !Array.isArray(chapter.pageIds)
      || chapter.pageIds.some((id) => typeof id !== 'string')) throw new Error('Chapitre Quiz Hunt invalide.')
  })
  const entries = data.scenarioEntries as unknown[]
  entries.forEach((value) => {
    const entry = record(value)
    if (entry.kind === 'page') return requireStrings(entry, ['pageId'])
    if (entry.kind === 'chapter') return requireStrings(entry, ['chapterId'])
    throw new Error('Entrée racine Quiz Hunt invalide.')
  })
  const questions = new ElceQuestionService()
  const bdcs = data.bdcs as unknown[]
  data.bdcs = bdcs.map((value) => {
    const bdc = record(value)
    if (bdc.type !== 'card' || typeof bdc.card !== 'object' || bdc.card === null || Array.isArray(bdc.card)) return bdc
    const card = record(bdc.card)
    return card.list === undefined ? { ...bdc, card: { ...card, list: null } } : bdc
  })
  const normalizedBdcs = data.bdcs as unknown[]
  const lists: ListService = new ListService()
  normalizedBdcs.forEach((value) => {
    const bdc = record(value)
    requireStrings(bdc, ['id', 'type', 'presetId'])
    if (bdc.question !== null) {
      const question = record(bdc.question)
      if (!['true-false', 'choice', 'multiple-choice'].includes(String(question.type)) || !Array.isArray(question.answers)) {
        throw new Error('Question Quiz Hunt invalide.')
      }
      question.answers.forEach((value: unknown) => {
        const answer = record(value)
        requireStrings(answer, ['id', 'label'])
        if (typeof answer.correct !== 'boolean') throw new Error('Réponse Quiz Hunt invalide.')
      })
    }
    if (bdc.section !== null) {
      const section = record(bdc.section)
      requireStrings(section, ['markup'])
      if (record(section.content).type !== 'doc') throw new Error('Texte Section invalide.')
    }
    if (bdc.type === 'card' && typeof bdc.card === 'object' && bdc.card !== null && !Array.isArray(bdc.card)) {
      const card = record(bdc.card)
      if (bdc.presetId === CARD_PRESET_ID.LIST && card.list === null) throw new Error('Une Carte Liste doit contenir son sous-module.')
      if (card.list !== null) lists.assertValid(card.list)
    }
  })
  const document = normalizeQuizHuntResultMessages(
    normalizeQuizHuntExtraTrigger(
      normalizeQuizHuntFinalColors(data as unknown as QuizHuntDocument),
    ),
  )
  const summaries = document.pages.filter((page) => page.type === 'summary')
  if (summaries.length !== 1 || summaries[0]!.chapterId !== null) throw new Error('Un Sommaire racine est requis.')
  const questionChapters = document.chapters.filter((chapter) => chapter.type === 'questions')
  const finalChapters = document.chapters.filter((chapter) => chapter.type === 'finals')
  const introductionChapters = document.chapters.filter((chapter) => chapter.type === 'introduction')
  if (questionChapters.length !== 1 || finalChapters.length !== 1 || introductionChapters.length > 1
    || document.chapters.length !== 2 + introductionChapters.length
    || introductionChapters.some((chapter) => chapter.pageIds.length > 1)) {
    throw new Error('Une banque Questions et une banque Finales sont requises.')
  }
  const resultCardIds = [document.settings.successCardBdcId, document.settings.failureCardBdcId]
  if (new Set(resultCardIds).size !== 2 || resultCardIds.some((bdcId) => {
    const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
    return bdc?.type !== 'card' || bdc.card == null || !document.catalogBdcIds.includes(bdcId)
  })) throw new Error('Les Cartes de résultat du Sommaire sont invalides.')
  delete settings.menuPresentation
  const pageById = new Map(document.pages.map((page) => [page.id, page]))
  const chapterById = new Map(document.chapters.map((chapter) => [chapter.id, chapter]))
  const groupIds = new Set(document.settings.groups.map((group) => group.id))
  if (groupIds.size !== document.settings.groups.length) throw new Error('Couleur dupliquée.')
  const placedPages = document.scenarioEntries.flatMap((entry) => {
    if (entry.kind === 'page') {
      const page = pageById.get(entry.pageId)
      if (page === undefined || page.chapterId !== null) throw new Error('Page racine incohérente.')
      return [page.id]
    }
    const chapter = chapterById.get(entry.chapterId)
    if (chapter === undefined) throw new Error('Banque référencée absente.')
    chapter.pageIds.forEach((pageId) => {
      if (pageById.get(pageId)?.chapterId !== chapter.id) throw new Error('Page de banque incohérente.')
    })
    return [...chapter.pageIds]
  })
  if (placedPages.length !== document.pages.length || new Set(placedPages).size !== document.pages.length) {
    throw new Error('Chaque page doit avoir un placement unique.')
  }
  assertContentPlacementInvariants({ ...document, scenarioPageIds: placedPages })
  document.pages.forEach((page) => {
    if (page.colorId !== null && !groupIds.has(page.colorId)) throw new Error('Couleur de question inconnue.')
    const pageQuestions = page.bdcIds.flatMap((id) => document.bdcs.find((bdc) => bdc.id === id)?.question ?? [])
    const chapter = page.chapterId === null ? undefined : chapterById.get(page.chapterId)
    if ((chapter?.type === 'questions' || chapter?.type === 'finals') && pageQuestions.length === 0) {
      throw new Error('Une page de banque doit contenir une Question.')
    }
    pageQuestions.forEach((question) => questions.assertValid(question))
  })
  return document
}

/** Adds the result page defaults to an unedited result Card in an existing project. */
function normalizeQuizHuntResultMessages(document: QuizHuntDocument): QuizHuntDocument {
  const defaultsByCardId = new Map([
    [document.settings.successCardBdcId, {
      title: 'Bravo !',
      message: 'Vous avez remporté la partie.',
    }],
    [document.settings.failureCardBdcId, {
      title: 'Partie terminée',
      message: 'Vous pouvez recommencer pour tenter de gagner, ou revenir au sommaire.',
    }],
  ])
  const bdcs = document.bdcs.map((bdc) => {
    const defaults = defaultsByCardId.get(bdc.id)
    if (defaults === undefined || bdc.card == null || bdc.card.title !== '' || bdc.card.message !== '') return bdc
    return { ...bdc, card: { ...bdc.card, ...defaults } }
  })
  return bdcs.some((bdc, index) => bdc !== document.bdcs[index]) ? { ...document, bdcs } : document
}

/** Serializes the versioned document with the shared cache index fields. */
export function writeQuizHuntDocument(document: QuizHuntDocument) {
  return {
    id: document.id,
    medias: document.medias.map(({ id }) => ({ id })),
    version: 1 as const,
    document,
  }
}

export const quizHuntDocumentCodec: DocumentStoreCodec<QuizHuntDocument> = {
  readDocument: readQuizHuntDocument,
  writeDocument: writeQuizHuntDocument,
  documentId: (document) => document.id,
  mediaIds: (document) => document.medias.map((media) => media.id),
}

/** Adapts the mod document to the shared HTTP controller's serialization contract. */
export class QuizHuntProjectDocument {
  public readonly id: string
  public readonly data: QuizHuntDocument

  /** Retains the domain document independently of the shared project's metadata. */
  public constructor(data: QuizHuntDocument) {
    this.id = data.id
    this.data = data
  }

  /** Writes the same versioned value used by the browser cache and API codec. */
  public toJSON() {
    return writeQuizHuntDocument(this.data)
  }
}
