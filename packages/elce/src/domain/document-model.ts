import {
  BDC_TYPE,
  CHAPTER_TYPE,
  DEFAULT_PRESET_ID,
  PAGE_TYPE,
} from '../config/document-config'
import type { Bdc, Chapter, ElceDocumentData, MediaMetadata, Page, PageId, RichTextDocument } from './document-types'

export const ELCE_DOCUMENT_VERSION = 1 as const

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
    return this.data.scenarioPageIds
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

  /** Rehydrates a document after a structured clone or a JSON round trip. */
  public static fromJSON(data: ElceDocumentData): ElceDocument {
    if (data.version !== ELCE_DOCUMENT_VERSION) {
      throw new Error(`Version de document Elcé non supportée : ${String(data.version)}`)
    }
    return new ElceDocument({
      ...data,
      bdcs: data.bdcs.map((bdc) => bdc.section === null || bdc.section.content !== undefined
        ? bdc
        : { ...bdc, section: { ...bdc.section, content: createEmptyRichTextDocument() } }),
    })
  }
}

/** Creates an identifier without putting identifier generation in React. */
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
  const names = new Set(document.pages.map((page) => page.name))
  let index = document.pages.length
  let name = pageNameForIndex(index)
  while (names.has(name)) {
    index += 1
    name = pageNameForIndex(index)
  }
  return name
}

/** Returns the next automatic chapter name without inspecting presentation state. */
export function nextChapterName(document: ElceDocument): string {
  const names = new Set(document.chapters.map((chapter) => chapter.name))
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
    mediaId: null,
    section: {
      title: '',
      markup: '<p id="section-text-1"></p>',
      content: createEmptyRichTextDocument(),
    },
  }
  return new ElceDocument({
    id: 'elce-document',
    version: ELCE_DOCUMENT_VERSION,
    name: 'Document Elcé',
    chapters: [chapter],
    pages: [page],
    scenarioPageIds: [],
    catalogPageIds: [],
    bdcs: [section],
    catalogBdcIds: [],
    medias: [],
  })
}
