import { BDC_TYPE, DEFAULT_PRESET_ID, PAGE_TYPE } from '../learning-definition'
import {
  CHAPTER_TYPE,
  SCENARIO_ENTRY_KIND,
  CHAPTER_TYPE_CONFIG,
} from '../organization/learning-organization-config'
import { ELCE_EDITOR_SETTINGS } from '../../../config/editor-settings'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import type { PagePlacement } from '../organization/learning-page-placement'
import { BDC_LOCATION } from '../../../core/document/content-location'
import { createStableId } from '../../../core/document/stable-id'
import { findChapter } from '../../../core/document/content-placement-service'
import type { LearningBdc, LearningChapter, LearningDocumentData, LearningPage } from './learning-document-types'
import { LearningDocument } from './learning-document'
import { INITIAL_PROFILE_DEFINITION, INITIAL_SUMMARY_SETTINGS } from '../profile/domain/learning-profile-types'
import { createEmptyRichTextDocument } from '../../../resources/bdcs/section/domain/section-service'
import { ELCE_DOCUMENT_VERSION } from './learning-document'
import type { LearningDocumentCommand } from '../commands/learning-document-command-types'
import type { LearningCommandResourceServices } from '../commands/learning-command-resource-services'
import type { PageType } from '../learning-definition'
import { assertDocumentInvariants } from '../commands/operations/document-invariants'

/** Owns Learning document creation and its automatic chapter and page names. */
export class LearningDocumentService {
  /** Creates the first empty Learning document used by Elcé. */
  public createInitialDocument(): LearningDocument {
    const chapter: LearningChapter = {
      id: 'chapter-1',
      name: 'Chapitre 1',
      type: CHAPTER_TYPE.STANDARD,
      pageIds: ['page-a'],
    }
    const page: LearningPage = {
      id: 'page-a',
      name: 'Page A',
      type: PAGE_TYPE.FLUX,
      chapterId: chapter.id,
      bdcIds: ['bdc-section-1'],
    }
    const section: LearningBdc = {
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
    const data: LearningDocumentData = {
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
    }
    return new LearningDocument(data)
  }

  /** Applies a new project identity while preserving every authored document value. */
  public withProjectIdentity(document: LearningDocument, id: string, name: string): LearningDocument {
    return new LearningDocument({ ...document.toJSON(), id, name })
  }

  /** Decodes one unknown cache or API value with the current Learning format. */
  public readDocument(value: unknown): LearningDocument {
    const version = typeof value === 'object' && value !== null && 'version' in value ? value.version : undefined
    if (version !== ELCE_DOCUMENT_VERSION) {
      throw new Error(`Version de document Elcé non supportée : ${String(version)}`)
    }
    return LearningDocument.fromJSON(value as LearningDocumentData)
  }

  /** Serializes one Learning document at a persistence boundary. */
  public writeDocument(document: LearningDocument): LearningDocumentData {
    return document.toJSON()
  }

  /** Creates the next default project name from the current project list. */
  public createProjectDocument(projects: readonly Readonly<{ name: string }>[]): LearningDocument {
    const usedNames = new Set(projects.map((project) => project.name))
    let index = 1
    while (usedNames.has(`Projet ${index}`)) index += 1
    return this.withProjectIdentity(this.createInitialDocument(), createStableId('elce-document'), `Projet ${index}`)
  }

  /** Identifies unsupported persisted Learning formats for cache recovery. */
  public isUnsupportedFormatError(error: unknown): boolean {
    return error instanceof Error && error.message.startsWith('Version de document Elcé non supportée :')
  }

  /** Verifies all invariant layers for a decoded or transformed Learning document. */
  public assertDocumentInvariants(document: LearningDocument, resources: LearningCommandResourceServices): void {
    assertDocumentInvariants(document, resources)
  }

  /** Returns the next automatic page name without inspecting presentation state. */
  public nextPageName(document: LearningDocument): string {
    const names = new Set(document.pages.map((page) => page.name))
    let index = document.pages.length
    let name = pageNameForIndex(index)
    while (names.has(name)) {
      index += 1
      name = pageNameForIndex(index)
    }
    return name
  }

  /** Creates a default Page or Diapo command at its requested Learning location. */
  public createDefaultPageCommand(
    document: LearningDocument,
    placement: PagePlacement,
    name?: string,
    pageType: PageType = PAGE_TYPE.FLUX,
  ): Extract<LearningDocumentCommand, { type: 'page.create' }> {
    const pageId = createStableId('page')
    const bdcId = createStableId('bdc')
    if (pageType === PAGE_TYPE.DIAPO) {
      return {
        type: 'page.create',
        pageId,
        bdcId,
        initialCardBdcId: createStableId('bdc-card'),
        pageType,
        name,
        placement,
      }
    }
    return {
      type: 'page.create',
      pageId,
      bdcId,
      defaultBdcType: this.defaultBdcTypeForPlacement(document, placement),
      pageType,
      name,
      placement,
    }
  }

  /** Creates a chapter command with a stable generated identity and fallback name. */
  public createChapterCommand(
    document: LearningDocument,
    name?: string,
    chapterType: LearningChapter['type'] = CHAPTER_TYPE.STANDARD,
  ): Extract<LearningDocumentCommand, { type: 'chapter.create' }> {
    return {
      type: 'chapter.create',
      chapterId: createStableId('chapter'),
      name: name?.trim() || this.nextChapterName(document, chapterType),
      chapterType,
    }
  }

  /** Creates the Learning Result command at its requested Evaluation page position. */
  public createEvaluationResultBdcCommand(
    bdcId: string,
    pageId: string,
    index: number,
  ): Extract<LearningDocumentCommand, { type: 'bdc.create' }> {
    return {
      type: 'bdc.create',
      bdcId,
      bdcType: BDC_TYPE.EVALUATION_RESULT,
      presetId: DEFAULT_PRESET_ID.EVALUATION_RESULT,
      placement: { kind: BDC_LOCATION.PAGE, pageId, index },
    }
  }

  /** Selects the initial page-content BDC from the explicitly requested chapter. */
  private defaultBdcTypeForPlacement(document: LearningDocument, placement: PagePlacement) {
    switch (placement.kind) {
      case PAGE_LOCATION.CHAPTER:
        return CHAPTER_TYPE_CONFIG[findChapter(document.chapters, placement.chapterId).type].defaultBdcType
      case PAGE_LOCATION.SCENARIO:
      case PAGE_LOCATION.CATALOG:
        return CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.STANDARD].defaultBdcType
    }
  }

  /** Returns the default chapter name for its type. */
  public nextChapterName(
    document: LearningDocument,
    chapterType: LearningChapter['type'] = CHAPTER_TYPE.STANDARD,
  ): string {
    switch (chapterType) {
      case CHAPTER_TYPE.EVALUATION:
        return CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.EVALUATION].defaultName
      case CHAPTER_TYPE.STANDARD:
        return this.nextStandardChapterName(document)
    }
  }

  /** Returns the next automatic name for a standard chapter. */
  private nextStandardChapterName(document: LearningDocument): string {
    const names = new Set(document.chapters.map((chapter) => chapter.name))
    let index = document.chapters.length
    let name = `Chapitre ${index + 1}`
    while (names.has(name)) {
      index += 1
      name = `Chapitre ${index + 1}`
    }
    return name
  }
}

/** Provides the application-owned Learning document operations. */
export const learningDocumentService = new LearningDocumentService()

/** Returns the page letter for its zero-based position. */
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
