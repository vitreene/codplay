import { createStableId } from '../../../core/document/stable-id'
import { insertAt } from '../../../core/document/collection-operations'
import { QUESTION_BDC_TYPE, QUESTION_PRESET_ID } from '../../../resources/bdcs/question/question-config'
import { ElceQuestionService } from '../../../resources/bdcs/question/domain/question-service'
import type { QuestionContent } from '../../../resources/bdcs/question/domain/question-types'
import { ElceCardService } from '../../../resources/bdcs/card/domain/card-service'
import type { CardContent, CardTextField } from '../../../resources/bdcs/card/domain/card-types'
import { CARD_BDC_TYPE, CARD_PRESET_ID } from '../../../resources/bdcs/card/card-config'
import type { CardLayoutId } from '../../../resources/bdcs/card/card-config'
import type { ElceTextValue } from '../../../resources/document/rich-text-types'
import { SECTION_BDC_TYPE, SECTION_PRESET_ID } from '../../../resources/bdcs/section/section-config'
import { createEmptyRichTextDocument } from '../../../resources/bdcs/section/domain/section-service'
import type { SectionContent } from '../../../resources/bdcs/section/domain/section-types'
import type { MediaMetadata } from '../../../core/document/content-document-types'
import type { QuizHuntDocument, QuizHuntGroup, QuizHuntRootEntry, QuizHuntSettings } from './quiz-hunt-document-types'

/** Owns Quiz Hunt authoring operations without depending on a Learning document. */
export class QuizHuntDocumentService {
  private readonly questions = new ElceQuestionService()
  private readonly cards = new ElceCardService()

  /** Creates the root summary and the two independently named question banks. */
  public createInitialDocument(id = createStableId('quiz-hunt'), name = 'Quiz Hunt'): QuizHuntDocument {
    const summaryId = createStableId('summary')
    const questionsId = createStableId('questions')
    const finalsId = createStableId('finals')
    const initialQuestionPageId = createStableId('page')
    const initialQuestionBdcId = createStableId('bdc')
    const successCardBdcId = createStableId('bdc')
    const failureCardBdcId = createStableId('bdc')
    return {
      id,
      name,
      pages: [
        { id: summaryId, name: 'Sommaire', type: 'summary', chapterId: null, bdcIds: [], colorId: null, mandatory: false },
        { id: initialQuestionPageId, name: 'Question 1', type: 'flux', chapterId: questionsId, bdcIds: [initialQuestionBdcId], colorId: null, mandatory: false },
      ],
      chapters: [
        { id: questionsId, name: 'Questions', type: 'questions', pageIds: [initialQuestionPageId] },
        { id: finalsId, name: 'Finales', type: 'finals', pageIds: [] },
      ],
      scenarioEntries: [
        { kind: 'page', pageId: summaryId },
        { kind: 'chapter', chapterId: questionsId },
        { kind: 'chapter', chapterId: finalsId },
      ],
      bdcs: [
        {
          id: initialQuestionBdcId, type: QUESTION_BDC_TYPE, presetId: QUESTION_PRESET_ID,
          pageId: initialQuestionPageId, parentBdcId: null, section: null, question: this.questions.createDefault(),
        },
        {
          id: successCardBdcId, type: CARD_BDC_TYPE, presetId: CARD_PRESET_ID.TEXT_SHORT,
          pageId: null, parentBdcId: null, section: null, question: null,
          card: this.cards.createDefault(),
        },
        {
          id: failureCardBdcId, type: CARD_BDC_TYPE, presetId: CARD_PRESET_ID.TEXT_SHORT,
          pageId: null, parentBdcId: null, section: null, question: null,
          card: this.cards.createDefault(),
        },
      ],
      medias: [],
      catalogPageIds: [],
      catalogBdcIds: [successCardBdcId, failureCardBdcId],
      settings: {
        groups: [
          { id: createStableId('color'), name: 'Rouge', color: '#d44b50' },
          { id: createStableId('color'), name: 'Bleu', color: '#3978bb' },
          { id: createStableId('color'), name: 'Vert', color: '#37886b' },
          { id: createStableId('color'), name: 'Jaune', color: '#c99826' },
        ],
        menuPresentation: 'grid',
        successCardBdcId,
        failureCardBdcId,
        seed: 1,
        random: true,
        timeBudgetMs: 180_000,
        clueDelayMs: 3_000,
        feedbackDelayMs: 2_000,
        extraEnabled: true,
      },
    }
  }

  /** Applies a project identity while preserving every authored Quiz Hunt value. */
  public withProjectIdentity(document: QuizHuntDocument, id: string, name: string): QuizHuntDocument {
    return { ...document, id, name }
  }

  /** Creates a new Quiz Hunt project with the next unused catalog name. */
  public createProjectDocument(projects: readonly Readonly<{ name: string }>[]): QuizHuntDocument {
    const usedNames = new Set(projects.map((project) => project.name))
    let index = 1
    while (usedNames.has(`Quiz Hunt ${index}`)) index += 1
    return this.withProjectIdentity(this.createInitialDocument(), createStableId('quiz-hunt'), `Quiz Hunt ${index}`)
  }

  /** Adds a bank question or a root content page through the same resource model. */
  public createPage(document: QuizHuntDocument, chapterId: string | null, name: string): QuizHuntDocument {
    const chapter = chapterId === null ? null : document.chapters.find((candidate) => candidate.id === chapterId)
    if (chapter === undefined) throw new Error('La banque demandée est absente.')
    const pageId = createStableId('page')
    const bdcId = createStableId('bdc')
    const isQuestion = chapter !== null
    return {
      ...document,
      pages: [...document.pages, { id: pageId, name, type: 'flux', chapterId, bdcIds: [bdcId], colorId: null, mandatory: false }],
      chapters: document.chapters.map((candidate) => candidate.id === chapterId
        ? { ...candidate, pageIds: [...candidate.pageIds, pageId] }
        : candidate),
      scenarioEntries: chapterId === null
        ? [...document.scenarioEntries, { kind: 'page', pageId }]
        : document.scenarioEntries,
      bdcs: [...document.bdcs, {
        id: bdcId,
        type: isQuestion ? QUESTION_BDC_TYPE : SECTION_BDC_TYPE,
        presetId: isQuestion ? QUESTION_PRESET_ID : SECTION_PRESET_ID,
        pageId,
        parentBdcId: null,
        question: isQuestion ? this.questions.createDefault() : null,
        section: isQuestion ? null : {
          title: '', markup: '', content: createEmptyRichTextDocument(), revelation: { intro: null, outro: null },
        },
      }],
    }
  }

  /** Changes a bank title while preserving its identity, role, and contents. */
  public renameChapter(document: QuizHuntDocument, chapterId: string, name: string): QuizHuntDocument {
    return { ...document, chapters: document.chapters.map((chapter) => chapter.id === chapterId ? { ...chapter, name } : chapter) }
  }

  /** Changes one page title without changing the question's identity. */
  public renamePage(document: QuizHuntDocument, pageId: string, name: string): QuizHuntDocument {
    return { ...document, pages: document.pages.map((page) => page.id === pageId ? { ...page, name } : page) }
  }

  /** Assigns a color from the summary's authored choices, or clears the assignment. */
  public setPageColor(document: QuizHuntDocument, pageId: string, colorId: string | null): QuizHuntDocument {
    if (colorId !== null && !document.settings.groups.some((group) => group.id === colorId)) {
      throw new Error('La couleur choisie est absente du sommaire.')
    }
    return { ...document, pages: document.pages.map((page) => page.id === pageId ? { ...page, colorId } : page) }
  }

  /** Marks a bank page for guaranteed selection without imposing a response gate. */
  public setMandatory(document: QuizHuntDocument, pageId: string, mandatory: boolean): QuizHuntDocument {
    return { ...document, pages: document.pages.map((page) => page.id === pageId ? { ...page, mandatory } : page) }
  }

  /** Adds or updates an authored group without changing existing question references. */
  public setGroup(document: QuizHuntDocument, group: QuizHuntGroup): QuizHuntDocument {
    const exists = document.settings.groups.some((candidate) => candidate.id === group.id)
    const groups = exists
      ? document.settings.groups.map((candidate) => candidate.id === group.id ? group : candidate)
      : [...document.settings.groups, group]
    return { ...document, settings: { ...document.settings, groups } }
  }

  /** Removes a color and clears its assignments while preserving every authored page. */
  public removeGroup(document: QuizHuntDocument, colorId: string): QuizHuntDocument {
    return {
      ...document,
      settings: { ...document.settings, groups: document.settings.groups.filter((group) => group.id !== colorId) },
      pages: document.pages.map((page) => page.colorId === colorId ? { ...page, colorId: null } : page),
    }
  }

  /** Updates game settings independently of page and bank organization. */
  public updateSettings(
    document: QuizHuntDocument,
    settings: Partial<Omit<QuizHuntSettings, 'groups' | 'successCardBdcId' | 'failureCardBdcId'>>,
  ): QuizHuntDocument {
    return { ...document, settings: { ...document.settings, ...settings } }
  }

  /** Reorders an existing root entry, including the summary, within its own level. */
  public moveRootEntry(document: QuizHuntDocument, entry: QuizHuntRootEntry, index: number): QuizHuntDocument {
    const currentIndex = document.scenarioEntries.findIndex((candidate) => candidate.kind === entry.kind
      && (candidate.kind === 'page' && entry.kind === 'page' ? candidate.pageId === entry.pageId
        : candidate.kind === 'chapter' && entry.kind === 'chapter' && candidate.chapterId === entry.chapterId))
    if (currentIndex < 0) throw new Error('Cette entrée ne se trouve pas à la racine.')
    return { ...document, scenarioEntries: insertAt(document.scenarioEntries.filter((_, position) => position !== currentIndex), entry, index) }
  }

  /** Inserts a Section at any position without imposing a question-page template. */
  public addSection(document: QuizHuntDocument, pageId: string, index: number): QuizHuntDocument {
    const bdcId = createStableId('bdc')
    return {
      ...document,
      pages: document.pages.map((page) => page.id === pageId ? { ...page, bdcIds: insertAt(page.bdcIds, bdcId, index) } : page),
      bdcs: [...document.bdcs, {
        id: bdcId, type: SECTION_BDC_TYPE, presetId: SECTION_PRESET_ID, pageId, parentBdcId: null, question: null,
        section: { title: '', markup: '', content: createEmptyRichTextDocument(), revelation: { intro: null, outro: null } },
      }],
    }
  }

  /** Applies the shared Question rules to an edited bank question. */
  public updateQuestion(document: QuizHuntDocument, bdcId: string, question: QuestionContent): QuizHuntDocument {
    this.questions.assertValid(question)
    return { ...document, bdcs: document.bdcs.map((bdc) => bdc.id === bdcId ? { ...bdc, question } : bdc) }
  }

  /** Applies the shared Card rules while preserving its catalog placement. */
  public updateCard(document: QuizHuntDocument, bdcId: string, card: CardContent): QuizHuntDocument {
    this.cards.assertValid(card)
    return {
      ...document,
      bdcs: document.bdcs.map((bdc) => bdc.id === bdcId && bdc.type === CARD_BDC_TYPE ? { ...bdc, card } : bdc),
    }
  }

  /** Changes one text field through the shared Card business service. */
  public setCardText(document: QuizHuntDocument, bdcId: string, field: CardTextField, value: ElceTextValue): QuizHuntDocument {
    const bdc = document.bdcs.find((candidate) => candidate.id === bdcId && candidate.type === CARD_BDC_TYPE)
    if (bdc?.card == null) return document
    return this.updateCard(document, bdcId, this.cards.setTextField(bdc.card, field, value))
  }

  /** Changes one shared Card layout without replacing its authored fields. */
  public setCardLayout(document: QuizHuntDocument, bdcId: string, layoutId: CardLayoutId): QuizHuntDocument {
    return {
      ...document,
      bdcs: document.bdcs.map((bdc) => bdc.id === bdcId && bdc.type === CARD_BDC_TYPE
        ? { ...bdc, presetId: layoutId }
        : bdc),
    }
  }

  /** Removes a Question only when its page keeps the bank's required Question. */
  public deleteQuestion(document: QuizHuntDocument, bdcId: string): QuizHuntDocument {
    const target = document.bdcs.find((bdc) => bdc.id === bdcId && bdc.question !== null)
    if (target === undefined || target.pageId === null) return document
    const page = document.pages.find((candidate) => candidate.id === target.pageId)
    if (page === undefined) return document
    const hasRemainingQuestion = page.bdcIds.some((candidateId) => candidateId !== bdcId
      && document.bdcs.some((bdc) => bdc.id === candidateId && bdc.question !== null))
    if (page.chapterId !== null && !hasRemainingQuestion) return document
    return {
      ...document,
      pages: document.pages.map((candidate) => candidate.id === page.id
        ? { ...candidate, bdcIds: candidate.bdcIds.filter((candidateId) => candidateId !== bdcId) }
        : candidate),
      bdcs: document.bdcs.filter((bdc) => bdc.id !== bdcId),
    }
  }

  /** Attaches a newly persisted shared media resource to one Question. */
  public attachQuestionMedia(document: QuizHuntDocument, bdcId: string, media: MediaMetadata): QuizHuntDocument {
    return {
      ...this.setQuestionMedia(document, bdcId, media.id),
      medias: document.medias.some((candidate) => candidate.id === media.id) ? document.medias : [...document.medias, media],
    }
  }

  /** Sets or clears a Question's reference to an existing shared media resource. */
  public setQuestionMedia(document: QuizHuntDocument, bdcId: string, mediaId: string | null): QuizHuntDocument {
    return {
      ...document,
      bdcs: document.bdcs.map((bdc) => bdc.id === bdcId && bdc.question !== null
        ? { ...bdc, question: { ...bdc.question, mediaId } }
        : bdc),
    }
  }

  /** Sets or clears a shared Card media reference. */
  public setCardMedia(document: QuizHuntDocument, bdcId: string, mediaId: string | null): QuizHuntDocument {
    return {
      ...document,
      bdcs: document.bdcs.map((bdc) => bdc.id === bdcId && bdc.card !== null && bdc.card !== undefined
        ? { ...bdc, card: { ...bdc.card, mediaId } }
        : bdc),
    }
  }

  /** Attaches a newly persisted media resource to one shared Card. */
  public attachCardMedia(document: QuizHuntDocument, bdcId: string, media: MediaMetadata): QuizHuntDocument {
    return {
      ...this.setCardMedia(document, bdcId, media.id),
      medias: document.medias.some((candidate) => candidate.id === media.id) ? document.medias : [...document.medias, media],
    }
  }

  /** Rewrites duplicate Question references after shared media synchronization. */
  public mergeMedia(document: QuizHuntDocument, canonicalMediaId: string, duplicateMediaIds: readonly string[]): QuizHuntDocument | null {
    const knownIds = new Set(document.medias.map((media) => media.id))
    if (!knownIds.has(canonicalMediaId) || duplicateMediaIds.some((mediaId) => !knownIds.has(mediaId))) return null
    const duplicates = new Set(duplicateMediaIds)
    return {
      ...document,
      medias: document.medias.filter((media) => !duplicates.has(media.id)),
      bdcs: document.bdcs.map((bdc) => bdc.question !== null && bdc.question !== undefined
        && bdc.question.mediaId !== null && duplicates.has(bdc.question.mediaId)
        ? { ...bdc, question: { ...bdc.question, mediaId: canonicalMediaId } }
        : bdc.card !== null && bdc.card !== undefined && bdc.card.mediaId !== null && duplicates.has(bdc.card.mediaId)
          ? { ...bdc, card: { ...bdc.card, mediaId: canonicalMediaId } }
          : bdc),
    }
  }

  /** Stores a Section edited through the shared rich-text resource. */
  public updateSection(document: QuizHuntDocument, bdcId: string, section: SectionContent): QuizHuntDocument {
    return { ...document, bdcs: document.bdcs.map((bdc) => bdc.id === bdcId ? { ...bdc, section } : bdc) }
  }
}
