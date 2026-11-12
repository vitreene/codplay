import { createControllerMachine } from '../../../core/controller/controller-machine'
import type { ControllerMachineServices } from '../../../core/controller/controller-machine'
import type { ElceProjectSummary } from '../../../core/persistence/project-api/project-api-types'
import type { DocumentStore } from '../../../core/persistence/indexed-db/document-store-types'
import type { ProjectSessionOperation, ProjectSessionPort } from '../../../core/projects/project-session-types'
import type { QuestionEditCommand } from '../../../resources/bdcs/question/authoring/question-command-types'
import type { CardEditCommand } from '../../../resources/bdcs/card/authoring/card-command-types'
import type { SectionContent } from '../../../resources/bdcs/section/domain/section-types'
import type { ElceSectionChange } from '../../../resources/anchoring/domain/anchor-types'
import type { SectionSelection } from '../../../resources/bdcs/section/authoring/section-selection-types'
import { SECTION_BDC_TYPE } from '../../../resources/bdcs/section/section-config'
import type { MediaMetadata } from '../../../core/document/content-document-types'
import { createObjectUrl, resolveImportedMedia } from '../../../core/media/media-import-service'
import { QuizHuntDocumentService } from '../document/quiz-hunt-document-service'
import type { QuizHuntDocument, QuizHuntGroup, QuizHuntSettings } from '../document/quiz-hunt-document-types'

export type QuizHuntCommand =
  | Readonly<{ type: 'document.rename'; name: string }>
  | Readonly<{ type: 'chapter.rename'; chapterId: string; name: string }>
  | Readonly<{ type: 'page.rename'; pageId: string; name: string }>
  | Readonly<{ type: 'page.create'; chapterId: string | null; name: string }>
  | Readonly<{ type: 'page.delete'; pageId: string }>
  | Readonly<{ type: 'page.color.set'; pageId: string; colorId: string | null }>
  | Readonly<{ type: 'page.mandatory.set'; pageId: string; mandatory: boolean }>
  | Readonly<{ type: 'group.set'; group: QuizHuntGroup }>
  | Readonly<{ type: 'group.delete'; colorId: string }>
  | Readonly<{ type: 'settings.update'; settings: Partial<Omit<QuizHuntSettings, 'groups' | 'successCardBdcId' | 'failureCardBdcId'>> }>
  | Readonly<{ type: 'section.create'; pageId: string; index: number }>
  | Readonly<{ type: 'section.delete'; bdcId: string }>
  | Readonly<{ type: 'section.update'; bdcId: string; section: SectionContent }>
  | Readonly<{ type: 'bdc.move'; bdcId: string; pageId: string; index: number }>
  | QuestionEditCommand
  | CardEditCommand

export type QuizHuntCompositionEvent =
  | Readonly<{ type: 'question.media.file.import'; bdcId: string; file: File; media: MediaMetadata }>
  | Readonly<{ type: 'card.media.file.import'; bdcId: string; file: File; media: MediaMetadata }>
  | Readonly<{
    type: 'section.change'
    sectionBdcId: string
    change: ElceSectionChange
    historyGroupKey?: string
    selectionBefore?: SectionSelection
    selectionAfter?: SectionSelection
  }>

export interface QuizHuntSelection {
  readonly pageId: string | null
  readonly chapterId: string | null
  readonly sectionSelection: SectionSelection | null
}

export type QuizHuntChange =
  | Readonly<{ kind: 'command'; command: QuizHuntCommand; recordedAt: number; groupKey: string | null; recordHistory: boolean }>
  | Readonly<{ kind: 'page-create'; command: Extract<QuizHuntCommand, { type: 'page.create' }>; recordedAt: number }>
  | Readonly<{
    kind: 'section-edit'
    bdcId: string
    change: ElceSectionChange
    recordedAt: number
    groupKey: string | null
    selectionBefore?: SectionSelection
    selectionAfter?: SectionSelection
  }>
  | Readonly<{ kind: 'question-media-import'; bdcId: string; file: File; media: MediaMetadata }>
  | Readonly<{ kind: 'card-media-import'; bdcId: string; file: File; media: MediaMetadata }>

type PageCreateEvent = Extract<QuizHuntCommand, { type: 'page.create' }>
type QuizHuntControllerServices = ControllerMachineServices<
  QuizHuntDocument, QuizHuntCommand, QuizHuntChange, QuizHuntSelection,
  ElceProjectSummary, ProjectSessionOperation, DocumentStore<QuizHuntDocument>,
  ProjectSessionPort<QuizHuntDocument>, PageCreateEvent, QuizHuntCompositionEvent, null
>

/** Routes typed authoring commands to the owning mod and shared resource services. */
function applyCommand(documents: QuizHuntDocumentService, document: QuizHuntDocument, command: QuizHuntCommand): QuizHuntDocument {
  switch (command.type) {
    case 'document.rename': return { ...document, name: command.name }
    case 'chapter.rename': return documents.renameChapter(document, command.chapterId, command.name)
    case 'page.rename': return documents.renamePage(document, command.pageId, command.name)
    case 'page.create': return documents.createPage(document, command.chapterId, command.name)
    case 'page.delete': return documents.deletePage(document, command.pageId)
    case 'page.color.set': return documents.setPageColor(document, command.pageId, command.colorId)
    case 'page.mandatory.set': return documents.setMandatory(document, command.pageId, command.mandatory)
    case 'group.set': return documents.setGroup(document, command.group)
    case 'group.delete': return documents.removeGroup(document, command.colorId)
    case 'settings.update': return documents.updateSettings(document, command.settings)
    case 'section.create': return documents.addSection(document, command.pageId, command.index)
    case 'section.delete': return documents.deleteSection(document, command.bdcId)
    case 'section.update': return documents.updateSection(document, command.bdcId, command.section)
    case 'bdc.move': return documents.moveBdc(document, command.bdcId, command.pageId, command.index)
    case 'bdc.question.update': return documents.updateQuestion(document, command.bdcId, command.question)
    case 'bdc.question.media.set': return documents.setQuestionMedia(document, command.bdcId, command.mediaId)
    case 'bdc.question.media.attach': return documents.attachQuestionMedia(document, command.bdcId, command.media)
    case 'bdc.question.delete': return documents.deleteQuestion(document, command.bdcId)
    case 'bdc.card.update': return documents.updateCard(document, command.bdcId, command.card)
    case 'bdc.card.layout.set': return documents.setCardLayout(document, command.bdcId, command.layoutId)
    case 'bdc.card.media.set': return documents.setCardMedia(document, command.bdcId, command.mediaId)
    case 'bdc.card.media.attach': return documents.attachCardMedia(document, command.bdcId, command.media)
  }
}

/** Resolves the current Section content for a queued rich-text transaction. */
function findSection(document: QuizHuntDocument, bdcId: string): SectionContent {
  const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
  if (bdc?.type !== SECTION_BDC_TYPE || bdc.section === null) throw new Error('La Section Quiz Hunt est absente.')
  return bdc.section
}

/** Creates the Quiz Hunt composition of the existing queued XState controller. */
export function createQuizHuntControllerMachine(documents = new QuizHuntDocumentService()) {
  const services: QuizHuntControllerServices = {
    document: {
      createInitialDocument: () => documents.createInitialDocument(),
      createPageCommand: (_document, event) => event,
      applyCommand: (document, command) => applyCommand(documents, document, command),
      mergeMedia: (document, canonicalMediaId, duplicateMediaIds) => documents.mergeMedia(document, canonicalMediaId, duplicateMediaIds),
    },
    changes: {
      documentChangeForEvent: (event, recordedAt) => {
        if (event.type === 'question.media.file.import') {
          return { kind: 'question-media-import', bdcId: event.bdcId, file: event.file, media: event.media }
        }
        if (event.type === 'card.media.file.import') {
          return { kind: 'card-media-import', bdcId: event.bdcId, file: event.file, media: event.media }
        }
        if (event.type === 'section.change') {
          if (event.change.kind !== 'content') return null
          return {
            kind: 'section-edit',
            bdcId: event.sectionBdcId,
            change: event.change,
            recordedAt,
            groupKey: event.historyGroupKey ?? null,
            selectionBefore: event.selectionBefore,
            selectionAfter: event.selectionAfter,
          }
        }
        if (event.type === 'page.create') return { kind: 'page-create', command: event, recordedAt }
        if (event.type !== 'document.apply') return null
        return { kind: 'command', command: event.command, recordedAt, groupKey: event.historyGroupKey ?? null, recordHistory: event.recordHistory !== false }
      },
      prepare: async (change, document, store, signal) => {
        if (change.kind !== 'question-media-import' && change.kind !== 'card-media-import') {
          return { operation: change, mediaCreated: false, mediaSource: null }
        }
        if (store === null) throw new Error('Le stockage Quiz Hunt n’est pas configuré pour un import média.')
        const { media, created } = await resolveImportedMedia(change.file, change.media, document, store, signal)
        const source = created ? createObjectUrl(change.file) : null
        return {
          operation: { ...change, media },
          mediaCreated: created,
          mediaSource: source === null ? null : { mediaId: media.id, source },
        }
      },
      commandForChange: (change, mediaCreated, document) => {
        if (change.kind === 'page-create') return change.command
        if (change.kind === 'command') return change.command
        if (change.kind === 'section-edit') {
          if (change.change.kind !== 'content') throw new Error('Quiz Hunt édite les Sections sans ancres.')
          const previous = findSection(document, change.bdcId)
          return {
            type: 'section.update',
            bdcId: change.bdcId,
            section: { ...previous, title: change.change.title, content: change.change.content, markup: change.change.markup },
          }
        }
        if (change.kind === 'question-media-import') return mediaCreated
          ? { type: 'bdc.question.media.attach', bdcId: change.bdcId, media: change.media }
          : { type: 'bdc.question.media.set', bdcId: change.bdcId, mediaId: change.media.id }
        return mediaCreated
          ? { type: 'bdc.card.media.attach', bdcId: change.bdcId, media: change.media }
          : { type: 'bdc.card.media.set', bdcId: change.bdcId, mediaId: change.media.id }
      },
      isImportChange: (change) => change?.kind === 'question-media-import' || change?.kind === 'card-media-import',
      historyMetadata: (change, selection) => {
        if (change.kind === 'question-media-import' || change.kind === 'card-media-import') {
          return { kind: 'commit', groupKey: null, recordHistory: true, recordedAt: Date.now(), selectCreatedPage: false }
        }
        if (change.kind === 'page-create') {
          return { kind: 'commit', groupKey: null, recordHistory: true, recordedAt: change.recordedAt, selectCreatedPage: true }
        }
        if (change.kind === 'section-edit') {
          return {
            kind: 'commit',
            groupKey: change.groupKey,
            recordHistory: change.change.kind !== 'anchor-ratio',
            recordedAt: change.recordedAt,
            selectCreatedPage: false,
            ...(change.selectionBefore === undefined ? {} : {
              selectionBefore: { ...selection, sectionSelection: change.selectionBefore },
            }),
            ...(change.selectionAfter === undefined ? {} : {
              selectionAfter: { ...selection, sectionSelection: change.selectionAfter },
            }),
          }
        }
        return {
          kind: 'commit', groupKey: change.groupKey, recordHistory: change.recordHistory,
          recordedAt: change.recordedAt, selectCreatedPage: false,
        }
      },
    },
    selection: {
      initial: (document) => ({ pageId: document.pages[0]?.id ?? null, chapterId: null, sectionSelection: null }),
      afterReplace: (document, current) => document.pages.some((page) => page.id === current.pageId)
        ? { ...current, sectionSelection: null }
        : { pageId: document.pages[0]?.id ?? null, chapterId: null, sectionSelection: null },
      afterCommand: (document, command, current, selectCreatedPage, selectionAfter) => {
        if (command.type === 'page.create' && selectCreatedPage) return { pageId: document.pages.at(-1)?.id ?? null, chapterId: null, sectionSelection: null }
        if (command.type === 'page.delete' && current.pageId === command.pageId) {
          return { pageId: document.pages.find((page) => page.type === 'summary')?.id ?? document.pages[0]?.id ?? null, chapterId: null, sectionSelection: null }
        }
        const sectionSelection = selectionAfter?.sectionSelection ?? current.sectionSelection
        return {
          ...current,
          sectionSelection: sectionSelection !== null && document.bdcs.some((bdc) => bdc.id === sectionSelection.sectionBdcId)
            ? sectionSelection
            : null,
        }
      },
      selectPage: (_document, _current, pageId) => ({ pageId, chapterId: null, sectionSelection: null }),
      selectChapter: (_document, _current, chapterId) => ({ pageId: null, chapterId, sectionSelection: null }),
    },
    queuedEventTypes: ['question.media.file.import', 'card.media.file.import', 'section.change'],
    additionalEventTypes: [],
    createInitialCompositionState: () => null,
    handleAdditionalEvent: () => ({}),
    isBootstrapOperation: (operation) => operation.kind === 'bootstrap',
  }
  return createControllerMachine(services)
}

/** Reports whether a queued Quiz Hunt media import can be cancelled. */
export function isQuizHuntImportChange(change: QuizHuntChange | undefined): boolean {
  return change?.kind === 'question-media-import' || change?.kind === 'card-media-import'
}
