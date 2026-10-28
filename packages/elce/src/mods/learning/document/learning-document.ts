import { SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import type { LearningBdc, LearningChapter, LearningDocumentData, LearningPage, PageId } from './learning-document-types'

export const ELCE_DOCUMENT_VERSION = 7 as const

/** Owns the serializable Learning document value and its v7 codec. */
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

  /** Rehydrates a document after a structured clone or a JSON round trip. */
  public static fromJSON(data: LearningDocumentData): LearningDocument {
    if (data.version !== ELCE_DOCUMENT_VERSION) {
      throw new Error(`Version de document Elcé non supportée : ${String(data.version)}`)
    }
    return new LearningDocument(data)
  }
}
