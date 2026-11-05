import type { DocumentStoreCodec } from '../../../core/persistence/indexed-db/document-store-types'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { ElceQuestionService } from '../../../resources/bdcs/question/domain/question-service'
import { assertContentPlacementInvariants } from '../../../core/document/content-placement-service'

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
  if (!Array.isArray(settings.groups) || !['grid', 'diapo'].includes(String(settings.menuPresentation))
    || typeof settings.successCardBdcId !== 'string' || typeof settings.failureCardBdcId !== 'string'
    || typeof settings.random !== 'boolean' || typeof settings.extraEnabled !== 'boolean'
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
    if (!['questions', 'finals'].includes(String(chapter.type)) || !Array.isArray(chapter.pageIds)
      || chapter.pageIds.some((id) => typeof id !== 'string')) throw new Error('Banque Quiz Hunt invalide.')
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
  bdcs.forEach((value) => {
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
  })
  const document = data as unknown as QuizHuntDocument
  const summaries = document.pages.filter((page) => page.type === 'summary')
  if (summaries.length !== 1 || summaries[0]!.chapterId !== null) throw new Error('Un Sommaire racine est requis.')
  if (document.chapters.length !== 2 || new Set(document.chapters.map((chapter) => chapter.type)).size !== 2) {
    throw new Error('Une banque Questions et une banque Finales sont requises.')
  }
  const resultCardIds = [document.settings.successCardBdcId, document.settings.failureCardBdcId]
  if (new Set(resultCardIds).size !== 2 || resultCardIds.some((bdcId) => {
    const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
    return bdc?.type !== 'card' || bdc.card == null || !document.catalogBdcIds.includes(bdcId)
  })) throw new Error('Les Cartes de résultat du Sommaire sont invalides.')
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
    if (page.chapterId !== null && pageQuestions.length === 0) throw new Error('Une page de banque doit contenir une Question.')
    pageQuestions.forEach((question) => questions.assertValid(question))
  })
  return document
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
