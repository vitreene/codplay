import { SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import type { LearningBdc, LearningChapter, LearningDocumentData, LearningPage, PageId } from './learning-document-types'
import { authoredTextToPlainText } from '../../../core/document/rich-text-utils'
import { isRichTextDocument, parseInlineTextTokens } from '../inline-text/learning-inline-text-value'

export const ELCE_DOCUMENT_VERSION = 11 as const

/** Owns the serializable Learning document value and its versioned codec. */
export class LearningDocument {
  public readonly data: LearningDocumentData

  public constructor(data: LearningDocumentData) {
    this.data = data
  }

  public get id(): string {
    return this.data.id
  }

  public get chapters(): readonly LearningChapter[] {
    return this.data.chapters
  }

  public get pages(): readonly LearningPage[] {
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

  public get bdcs(): readonly LearningBdc[] {
    return this.data.bdcs
  }

  public get medias() {
    return this.data.medias
  }

  /** Returns the structured-clone-safe value stored in IndexedDB. */
  public toJSON(): LearningDocumentData {
    return this.data
  }

  /** Rehydrates legacy document versions and supplies Card transition defaults. */
  public static fromJSON(value: unknown): LearningDocument {
    if (!isRecord(value) || (value.version !== 7 && value.version !== 8 && value.version !== 9 && value.version !== 10 && value.version !== ELCE_DOCUMENT_VERSION)) {
      const version = isRecord(value) ? value.version : undefined
      throw new Error(`Version de document Elcé non supportée : ${String(version)}`)
    }
    const data = value.version === 7
      ? migrateV9Document(migrateV7Document(value))
      : value.version === 8
        ? migrateV9Document(migrateV8Document(value))
        : value.version === 9
          ? migrateV9Document(value)
          : { ...value, version: ELCE_DOCUMENT_VERSION } as unknown as LearningDocumentData
    return new LearningDocument(normalizeQuestionAnswerLabels(data))
  }
}

/** Promotes a v8 document to the v9 shape that introduced page early exit. */
function migrateV8Document(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value, version: 9 }
}

/** Upgrades v7 authored text fields while preserving all other document data. */
function migrateV7Document(value: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = {
    ...value,
    version: 9,
    summary: mapTextFields(value.summary, ['title', 'description']),
    chapters: mapRecords(value.chapters, (chapter) => mapTextRecordFields(chapter, ['name'])),
    pages: mapRecords(value.pages, (page) => mapTextRecordFields(page, ['name'])),
    bdcs: mapRecords(value.bdcs, migrateBdcTextFields),
  }
  return migrated
}

/** Adds inherited transition defaults to every Card stored in a v9 document. */
function migrateV9Document(value: Record<string, unknown>): LearningDocumentData {
  return {
    ...value,
    version: ELCE_DOCUMENT_VERSION,
    bdcs: mapRecords(value.bdcs, (bdc) => {
      if (!isRecord(bdc.card) || bdc.card.revelation !== undefined) return bdc
      return { ...bdc, card: { ...bdc.card, revelation: { intro: null, outro: null } } }
    }),
  } as unknown as LearningDocumentData
}

/** Promotes legacy inline text tokens in the authored fields of one BDC. */
function migrateBdcTextFields(bdc: Record<string, unknown>): Record<string, unknown> {
  const question = mapTextFields(bdc.question, ['title', 'prompt', 'validationLabel'])
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

/** Flattens legacy enriched Question answers at the persisted document boundary. */
function normalizeQuestionAnswerLabels(data: LearningDocumentData): LearningDocumentData {
  return {
    ...data,
    bdcs: data.bdcs.map((bdc) => {
      if (bdc.question == null) return bdc
      return {
        ...bdc,
        question: {
          ...bdc.question,
          answers: bdc.question.answers.map((answer) => ({
            ...answer,
            label: questionAnswerLabelToPlainText(answer.label),
          })),
        },
      }
    }),
  }
}

/** Keeps plain labels as stored and uses the saved fallback text for old rich values. */
function questionAnswerLabelToPlainText(value: unknown): string {
  if (typeof value === 'string') return value
  return isRichTextDocument(value) ? authoredTextToPlainText(value) : ''
}

/** Promotes configured string fields without changing ordinary strings. */
function mapTextFields(value: unknown, fields: readonly string[]): unknown {
  if (!isRecord(value)) return value
  return mapTextRecordFields(value, fields)
}

/** Applies inline-token migration to the selected properties of one record. */
function mapTextRecordFields(value: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const mapped: Record<string, unknown> = { ...value }
  for (const field of fields) {
    const current = mapped[field]
    mapped[field] = typeof current === 'string' ? parseInlineTextTokens(current) ?? current : current
  }
  return mapped
}

/** Maps valid object entries while retaining malformed values for validation. */
function mapRecords(value: unknown, mapper: (record: Record<string, unknown>) => Record<string, unknown>): unknown {
  if (!Array.isArray(value)) return value
  return value.map((item) => isRecord(item) ? mapper(item) : item)
}

/** Narrows untrusted persisted values before migration reads their properties. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
