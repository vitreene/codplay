import {
  BDC_TYPE,
  CHAPTER_TYPE,
  DEFAULT_PRESET_ID,
  PAGE_TYPE,
  SCENARIO_ENTRY_KIND,
  CHAPTER_TYPE_CONFIG,
} from '../../config/document-config'
import { ELCE_EDITOR_SETTINGS } from '../../config/editor-settings'
import type { Bdc, Chapter, ElceDocumentData, MediaMetadata, Page, PageId, RichTextDocument } from './document-types'
import { INITIAL_PROFILE_DEFINITION, INITIAL_SUMMARY_SETTINGS } from '../summary-profile/summary-profile-types'
import { parseInlineTextTokens } from '../inline-text/inline-text-value'
import { plainTextFromValue } from '../inline-text/inline-text-value'

export const ELCE_DOCUMENT_VERSION = 9 as const

/** Creates the empty rich-text document used by a new Section. */
export function createEmptyRichTextDocument(): RichTextDocument {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

/** Owns the serializable Elcé document value used by commands and persistence. */
export class ElceDocument {
  public readonly data: ElceDocumentData

  public constructor(data: ElceDocumentData) {
    this.data = data
  }

  public get id(): string {
    return this.data.id
  }

  public get chapters(): readonly Chapter[] {
    return this.data.chapters
  }

  public get pages(): readonly Page[] {
    return this.data.pages
  }

  public get scenarioPageIds(): readonly PageId[] {
    return this.data.scenarioEntries.flatMap((entry) => {
      switch (entry.kind) {
        case SCENARIO_ENTRY_KIND.PAGE:
          return [entry.pageId]
        case SCENARIO_ENTRY_KIND.CHAPTER:
          return this.data.chapters.find((chapter) => chapter.id === entry.chapterId)?.pageIds ?? []
      }
    })
  }

  public get catalogPageIds(): readonly PageId[] {
    return this.data.catalogPageIds
  }

  public get bdcs(): readonly Bdc[] {
    return this.data.bdcs
  }

  public get medias(): readonly MediaMetadata[] {
    return this.data.medias
  }

  /** Returns the structured-clone-safe value stored in IndexedDB. */
  public toJSON(): ElceDocumentData {
    return this.data
  }

  /** Rehydrates a document and migrates v7 inline profile tokens to Tiptap JSON. */
  public static fromJSON(value: unknown): ElceDocument {
    if (!isRecord(value) || (value.version !== 7 && value.version !== 8 && value.version !== ELCE_DOCUMENT_VERSION)) {
      const version = isRecord(value) ? value.version : undefined
      throw new Error(`Version de document Elcé non supportée : ${String(version)}`)
    }
    const data = value.version === 7
      ? migrateV7Document(value)
      : value.version === 8
        ? migrateV8Document(value)
        : value as unknown as ElceDocumentData
    return new ElceDocument(data)
  }
}

/** Upgrades a v8 document with the optional page-level early-exit setting. */
function migrateV8Document(value: Record<string, unknown>): ElceDocumentData {
  return { ...value, version: ELCE_DOCUMENT_VERSION } as unknown as ElceDocumentData
}

/** Upgrades v7 authored text fields while preserving all other document data. */
function migrateV7Document(value: Record<string, unknown>): ElceDocumentData {
  const migrated: Record<string, unknown> = {
    ...value,
    version: ELCE_DOCUMENT_VERSION,
    summary: mapTextFields(value.summary, ['title', 'description']),
    chapters: mapRecords(value.chapters, (chapter) => mapTextRecordFields(chapter, ['name'])),
    pages: mapRecords(value.pages, (page) => mapTextRecordFields(page, ['name'])),
    bdcs: mapRecords(value.bdcs, migrateBdcTextFields),
  }
  return migrated as unknown as ElceDocumentData
}

/** Migrates every authored text value in one BDC while leaving identifiers intact. */
function migrateBdcTextFields(bdc: Record<string, unknown>): Record<string, unknown> {
  const question = mapTextFields(bdc.question, ['title', 'prompt', 'validationLabel'])
  if (isRecord(question) && Array.isArray(question.answers)) {
    question.answers = mapRecords(question.answers, (answer) => mapTextRecordFields(answer, ['label']))
  }
  const statisticalGraph = mapTextFields(bdc.statisticalGraph, [
    'overline', 'title', 'categoryAxisLabel', 'seriesAxisLabel', 'editorialText',
  ])
  if (isRecord(statisticalGraph)) {
    statisticalGraph.categories = mapRecords(statisticalGraph.categories, (category) => mapTextRecordFields(category, ['label']))
    statisticalGraph.series = mapRecords(statisticalGraph.series, (series) => mapTextRecordFields(series, ['label']))
  }
  const evaluationResult = isRecord(bdc.evaluationResult)
    ? {
      ...bdc.evaluationResult,
      success: mapTextFields(bdc.evaluationResult.success, ['message']),
      failure: mapTextFields(bdc.evaluationResult.failure, ['message']),
    }
    : bdc.evaluationResult
  return {
    ...bdc,
    section: mapTextFields(bdc.section, ['title']),
    question,
    card: mapTextFields(bdc.card, ['overline', 'title', 'description', 'message', 'note', 'caption']),
    statisticalGraph,
    evaluationResult,
  }
}

/** Promotes only text strings that contain recognized inline-label tokens. */
function mapTextFields(value: unknown, fields: readonly string[]): unknown {
  if (!isRecord(value)) return value
  return mapTextRecordFields(value, fields)
}

/** Promotes text fields on an already narrowed document record. */
function mapTextRecordFields(value: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const mapped: Record<string, unknown> = { ...value }
  for (const field of fields) {
    const current = mapped[field]
    mapped[field] = typeof current === 'string' ? parseInlineTextTokens(current) ?? current : current
  }
  return mapped
}

/** Maps array records while retaining malformed entries for domain validation. */
function mapRecords(value: unknown, mapper: (record: Record<string, unknown>) => Record<string, unknown>): unknown {
  if (!Array.isArray(value)) return value
  return value.map((item) => isRecord(item) ? mapper(item) : item)
}

/** Narrows document records before a version migration reads their fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Creates an identifier within the document model boundary. */
export function createStableId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function pageNameForIndex(index: number): string {
  let value = index + 1
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return `Page ${name}`
}

/** Returns the next automatic page name without inspecting presentation state. */
export function nextPageName(document: ElceDocument): string {
  const names = new Set(document.pages.map((page) => plainTextFromValue(page.name)))
  let index = document.pages.length
  let name = pageNameForIndex(index)
  while (names.has(name)) {
    index += 1
    name = pageNameForIndex(index)
  }
  return name
}

/** Returns the default chapter name for its type. */
export function nextChapterName(
  document: ElceDocument,
  chapterType: Chapter['type'] = CHAPTER_TYPE.STANDARD,
): string {
  switch (chapterType) {
    case CHAPTER_TYPE.EVALUATION:
      return CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.EVALUATION].defaultName
    case CHAPTER_TYPE.STANDARD:
      return nextStandardChapterName(document)
  }
}

/** Returns the next automatic name for a standard chapter. */
function nextStandardChapterName(document: ElceDocument): string {
  const names = new Set(document.chapters.map((chapter) => plainTextFromValue(chapter.name)))
  let index = document.chapters.length
  let name = `Chapitre ${index + 1}`
  while (names.has(name)) {
    index += 1
    name = `Chapitre ${index + 1}`
  }
  return name
}

/** Builds the smallest document used by the first Elcé tranche. */
export function createInitialDocument(): ElceDocument {
  const chapter: Chapter = {
    id: 'chapter-1',
    name: 'Chapitre 1',
    type: CHAPTER_TYPE.STANDARD,
    pageIds: ['page-a'],
  }
  const page: Page = {
    id: 'page-a',
    name: 'Page A',
    type: PAGE_TYPE.FLUX,
    chapterId: chapter.id,
    bdcIds: ['bdc-section-1'],
  }
  const section: Bdc = {
    id: 'bdc-section-1',
    type: BDC_TYPE.SECTION,
    presetId: DEFAULT_PRESET_ID.SECTION,
    pageId: page.id,
    parentBdcId: null,
    question: null,
    evaluationResult: null,
    carousel: null,
    card: null,
    section: {
      title: '',
      markup: '<p id="section-text-1"></p>',
      content: createEmptyRichTextDocument(),
      revelation: { intro: null, outro: null },
    },
  }
  return new ElceDocument({
    id: 'elce-document',
    version: ELCE_DOCUMENT_VERSION,
    name: 'Document Elcé',
    revelationDefaults: ELCE_EDITOR_SETTINGS.revelation.projectDefaults,
    summary: INITIAL_SUMMARY_SETTINGS,
    profile: INITIAL_PROFILE_DEFINITION,
    chapters: [chapter],
    pages: [page],
    scenarioEntries: [{ kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId: chapter.id }],
    catalogPageIds: [],
    bdcs: [section],
    catalogBdcIds: [],
    medias: [],
  })
}
