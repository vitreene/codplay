import { assign, fromPromise, setup } from 'xstate'
import { applyDocumentCommand, createDefaultPageCommand } from '../../domain/commands/document-commands'
import type { DocumentCommand } from '../../domain/commands/document-command-types'
import { BDC_TYPE, CATALOG_TAB, MEDIA_TYPE } from '../../config/document-config'
import { createInitialDocument } from '../../domain/document/document-model'
import { ElceAnchorDropService } from '../../domain/anchor/anchor-drop-service'
import { ElceMediaResourceService, mediaTypeFromMimeType } from '../../domain/media/media-resource-service'
import type { ElceDocumentChange } from './document-change-types'
import type { ChapterId, MediaMetadata, PageId } from '../../domain/document/document-types'
import type { ElceAppContext, ElceControllerEvent, ElceControllerInput } from './controller-types'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'
import type { ProjectSessionOperation, ProjectSessionResult } from '../projects/project-session-types'
import {
  EMPTY_DOCUMENT_HISTORY,
  recordDocumentHistory,
  rebaseMediaMergeHistory,
  redoDocumentHistory,
  undoDocumentHistory,
} from '../history/document-history'
import type { DocumentHistoryPosition, SectionSelection } from '../history/document-history'

const initialDocument = createInitialDocument()
const anchorDropService = new ElceAnchorDropService()

interface DocumentChangeWorkerInput {
  readonly operation: ElceDocumentChange
  readonly store: ElceDocumentStore | null
  readonly document: ElceAppContext['document']
}

interface DocumentChangeWorkerOutput {
  readonly operation: ElceDocumentChange
  readonly source: string | null
  readonly mediaCreated: boolean
}

interface ProjectOperationWorkerInput {
  readonly operation: ProjectSessionOperation
  readonly session: ElceAppContext['projectSession']
  readonly document: ElceAppContext['document']
  readonly activeProject: ElceAppContext['activeProject']
  readonly editAccess: ElceAppContext['editAccess']
  readonly hadEditAccess: boolean
}

const mediaResourceService = new ElceMediaResourceService()

const performProjectOperation = fromPromise<ProjectSessionResult, ProjectOperationWorkerInput>(async ({ input }) => {
  if (input.session === null) throw new Error('La gestion des projets n’est pas configurée.')
  return input.session.perform(
    input.operation,
    input.document,
    input.activeProject,
    input.editAccess,
    input.hadEditAccess,
  )
})

/** Persists imported files and resolves canonical media before command commit. */
const persistDocumentChange = fromPromise<DocumentChangeWorkerOutput, DocumentChangeWorkerInput>(async ({ input, signal }) => {
  const operation = input.operation
  switch (operation.kind) {
    case 'command':
    case 'page-create':
    case 'history-undo':
    case 'history-redo':
      return { operation, source: null, mediaCreated: false }
    case 'anchor':
      switch (operation.operation.change.kind) {
        case 'file-drop': {
          if (input.store === null) throw new Error('Le stockage Elcé n’est pas configuré pour un dépôt de fichier.')
          const { media, created } = await resolveImportedMedia(
            operation.operation.change.file,
            operation.operation.change.target.media,
            input.document,
            input.store,
            signal,
          )
          return {
            operation: withAnchorMedia(operation, media),
            source: created ? createObjectUrl(operation.operation.change.file) : null,
            mediaCreated: created,
          }
        }
        case 'content':
        case 'catalog-drop':
        case 'anchor-move':
        case 'anchor-remove':
        case 'anchor-return':
          return { operation, source: null, mediaCreated: false }
      }
    case 'question-media-import':
    case 'card-media-import':
    case 'summary-media-import':
      return persistMediaImport(operation, input, signal)
  }
})

/** Persists one accepted image or video through the shared media import path. */
async function persistMediaImport(
  operation: Extract<ElceDocumentChange, { kind: 'question-media-import' | 'card-media-import' | 'summary-media-import' }>,
  input: DocumentChangeWorkerInput,
  signal: AbortSignal,
): Promise<DocumentChangeWorkerOutput> {
  if (operation.kind === 'summary-media-import'
    && mediaTypeFromMimeType(operation.media.mimeType) !== MEDIA_TYPE.IMAGE) {
    throw new Error('Seules les images peuvent servir de fond au Sommaire.')
  }
  if (input.store === null) throw new Error('Le stockage Elcé n’est pas configuré pour un dépôt de fichier.')
  const { media, created } = await resolveImportedMedia(operation.file, operation.media, input.document, input.store, signal)
  return {
    operation: { ...operation, media },
    source: created ? createObjectUrl(operation.file) : null,
    mediaCreated: created,
  }
}

/** Reuses an exact media resource or persists the imported bytes once. */
async function resolveImportedMedia(
  file: File,
  media: MediaMetadata,
  document: ElceAppContext['document'],
  store: ElceDocumentStore,
  signal: AbortSignal,
): Promise<Readonly<{ media: MediaMetadata; created: boolean }>> {
  const duplicate = await mediaResourceService.findDuplicate(
    file,
    document.medias,
    (mediaId) => store.loadMedia(mediaId),
  )
  if (signal.aborted) throw new Error('Import annulé.')
  switch (duplicate) {
    case null:
      try {
        await store.saveMedia({ id: media.id, blob: file })
        if (signal.aborted) throw new Error('Import annulé.')
      } catch (error) {
        try {
          await store.deleteMedia([media.id])
        } catch {
          // Preserve the storage error that rejected the import.
        }
        throw error
      }
      return { media, created: true }
    default:
      return { media: duplicate, created: false }
  }
}

/** Replaces only the media reference on a new anchor target after deduplication. */
function withAnchorMedia(
  operation: Extract<ElceDocumentChange, { kind: 'anchor' }>,
  media: MediaMetadata,
): ElceDocumentChange {
  switch (operation.operation.change.kind) {
    case 'file-drop':
      return {
        ...operation,
        operation: {
          ...operation.operation,
          change: {
            ...operation.operation.change,
            target: { ...operation.operation.change.target, media },
          },
        },
      }
    case 'content':
    case 'catalog-drop':
    case 'anchor-move':
    case 'anchor-remove':
    case 'anchor-return':
      return operation
  }
}

/** Creates the player source after a new media blob has been persisted. */
function createObjectUrl(file: File): string | null {
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(file)
    : null
}

/** Maps each persisted document change to one immutable document command. */
function commandForChange(
  operation: Exclude<ElceDocumentChange, { kind: 'history-undo' | 'history-redo' }>,
  mediaCreated: boolean,
  document: ElceAppContext['document'],
): DocumentCommand {
  switch (operation.kind) {
    case 'command':
      return operation.command
    case 'page-create':
      return createDefaultPageCommand(document, operation.placement, operation.name, operation.pageType)
    case 'anchor':
      return anchorDropService.createDocumentCommand(operation.operation.sectionBdcId, operation.operation.change)
    case 'question-media-import':
      switch (mediaCreated) {
        case true:
          return {
            type: 'bdc.question.media.attach' as const,
            bdcId: operation.bdcId,
            media: operation.media,
          }
        case false:
          return {
            type: 'bdc.question.media.set' as const,
            bdcId: operation.bdcId,
            mediaId: operation.media.id,
          }
      }
    case 'card-media-import':
      switch (mediaCreated) {
        case true:
          return {
            type: 'bdc.card.media.attach' as const,
            bdcId: operation.bdcId,
            media: operation.media,
          }
        case false:
          return {
            type: 'bdc.card.media.set' as const,
            bdcId: operation.bdcId,
            mediaId: operation.media.id,
          }
      }
    case 'summary-media-import':
      switch (mediaCreated) {
        case true:
          return { type: 'summary.background.media.attach' as const, media: operation.media }
        case false:
          return {
            type: 'summary.settings.update' as const,
            summary: { ...document.data.summary, backgroundMediaId: operation.media.id },
          }
      }
  }
}

/** Builds the controller-owned queue item for either accepted document change. */
function documentChangeForEvent(event: ElceControllerEvent): ElceDocumentChange | null {
  switch (event.type) {
    case 'section.change':
      return {
        kind: 'anchor',
        operation: { sectionBdcId: event.sectionBdcId, change: event.change },
        historyGroupKey: event.historyGroupKey,
        recordedAt: Date.now(),
        selectionBefore: event.selectionBefore,
        selectionAfter: event.selectionAfter,
      }
    case 'question.media.file.import':
      return { kind: 'question-media-import', bdcId: event.bdcId, file: event.file, media: event.media }
    case 'card.media.file.import':
      return { kind: 'card-media-import', bdcId: event.bdcId, file: event.file, media: event.media }
    case 'summary.media.file.import':
      return { kind: 'summary-media-import', file: event.file, media: event.media }
    case 'document.apply':
      return { kind: 'command', command: event.command, historyGroupKey: event.historyGroupKey, recordHistory: event.recordHistory, recordedAt: Date.now() }
    case 'page.create':
      return { kind: 'page-create', placement: event.placement, pageType: event.pageType, name: event.name }
    case 'history.undo':
      return { kind: 'history-undo' }
    case 'history.redo':
      return { kind: 'history-redo' }
    default:
      return null
  }
}

/** Owns all application commands and serializes document changes that persist files. */
export const controllerMachine = setup({
  types: {
    context: {} as ElceAppContext,
    events: {} as ElceControllerEvent,
    input: {} as ElceControllerInput | undefined,
  },
  actions: {
    enqueueDocumentChange: assign(({ context, event }) => {
      const operation = documentChangeForEvent(event)
      return operation === null ? {} : { documentChanges: [...context.documentChanges, operation] }
    }),
    commitDocumentChange: assign(({ context, event }) => {
      const output = (event as unknown as { output: DocumentChangeWorkerOutput }).output
      const operation = output.operation
      if (operation.kind === 'history-undo' || operation.kind === 'history-redo') {
        return {
          ...applyHistoryMovement(context, operation.kind),
          documentChanges: context.documentChanges.slice(1),
        }
      }
      const command = commandForChange(operation, output.mediaCreated, context.document)
      return {
        ...commitCommand(context, command, operation.kind === 'command' ? operation.historyGroupKey ?? null
          : operation.kind === 'anchor' ? operation.historyGroupKey ?? null : null,
        operation.kind === 'page-create', operation.kind !== 'command' || operation.recordHistory !== false,
        operation.kind === 'command' || operation.kind === 'anchor' ? operation.recordedAt : Date.now(),
        operation.kind === 'anchor' ? operation.selectionBefore : undefined,
        operation.kind === 'anchor' ? operation.selectionAfter : undefined),
        mediaSources: updateMediaSources(context.mediaSources, operation, output.source),
        documentChanges: context.documentChanges.slice(1),
      }
    }),
    discardDocumentChange: assign(({ context }) => ({ documentChanges: context.documentChanges.slice(1) })),
    beginProjectOperation: assign(({ context, event }) => {
      if (event.type !== 'project.operation') return {}
      return {
        pendingProjectOperation: event.operation,
        projectOperationHadAccess: context.editAccess === 'active',
        projectStatus: event.operation.kind === 'bootstrap' ? 'loading' : 'busy',
        projectError: null,
        accessRecoveryAvailable: false,
        editAccess: 'waiting',
      }
    }),
    commitProjectOperation: assign(({ context, event }) => {
      const output = (event as unknown as { output: ProjectSessionResult }).output
      const document = output.document ?? context.document
      const replaced = output.document !== null
      return {
        document,
        history: replaced ? EMPTY_DOCUMENT_HISTORY : context.history,
        sectionSelection: replaced ? null : context.sectionSelection,
        historyRestore: null,
        selectedPageId: replaced ? document.pages[0]?.id ?? null : context.selectedPageId,
        selectedChapterId: replaced ? null : context.selectedChapterId,
        selectedCarouselCardBdcId: replaced ? null : context.selectedCarouselCardBdcId,
        mediaSources: replaced ? {} : context.mediaSources,
        projects: output.projects,
        activeProject: output.activeProject,
        projectStatus: output.status,
        projectError: output.projectError ?? null,
        accessRecoveryAvailable: false,
        recoverableLocalCopy: output.activeProject?.id === context.activeProject?.id ? context.recoverableLocalCopy : false,
        pendingProjectOperation: null,
        projectOperationHadAccess: false,
        editAccess: context.projectOperationHadAccess ? output.editAccess : 'waiting',
      }
    }),
    startProjectLock: ({ context }) => {
      if (context.projectStatus === 'opening' && context.activeProject !== null) {
        context.projectSession?.startLock(context.activeProject.id)
      }
    },
    failProjectOperation: assign(({ context, event }) => ({
      projectStatus: context.activeProject === null ? 'list' as const : 'active' as const,
      projectError: errorMessage((event as unknown as { error: unknown }).error),
      pendingProjectOperation: null,
      editAccess: context.projectOperationHadAccess ? 'active' as const : 'waiting' as const,
      projectOperationHadAccess: false,
    })),
    markProjectAccessError: assign(({ event }) => ({
      projectStatus: 'error' as const,
      projectError: event.type === 'project.access.error' ? event.message : null,
      accessRecoveryAvailable: false,
      editAccess: 'waiting' as const,
    })),
    markProjectAccessRecovery: assign(({ event }) => ({
      projectStatus: 'error' as const,
      projectError: event.type === 'project.access.recovery' ? event.message : null,
      accessRecoveryAvailable: true,
      editAccess: 'waiting' as const,
    })),
  },
  guards: {
    hasPendingDocumentChanges: ({ context }) => context.documentChanges.length > 0,
    hasEditAccess: ({ context }) => context.editAccess === 'active',
    hasActiveImport: ({ context }) => isImportChange(context.documentChanges[0]),
  },
  actors: { persistDocumentChange, performProjectOperation },
}).createMachine({
  id: 'elce-app',
  context: ({ input }) => ({
    document: initialDocument,
    selectedPageId: initialDocument.pages[0]?.id ?? null,
    selectedChapterId: null,
    selectedCarouselCardBdcId: null,
    catalogTab: CATALOG_TAB.AVAILABLE_BDCS,
    mediaSources: {},
    syncStatus: 'pending',
    editAccess: 'waiting',
    documentStore: input?.documentStore ?? null,
    documentChanges: [],
    history: EMPTY_DOCUMENT_HISTORY,
    sectionSelection: null,
    historyRestore: null,
    projectSession: input?.projectSession ?? null,
    projects: [],
    activeProject: null,
    projectStatus: 'loading',
    projectError: null,
    accessRecoveryAvailable: false,
    recoverableLocalCopy: false,
    pendingProjectOperation: null,
    projectOperationHadAccess: false,
  }),
  initial: 'suspended',
  on: {
    'page.select': {
      actions: assign(({ context, event }) => ({
        selectedPageId: keepSelectedPage(context.document, event.pageId),
        selectedChapterId: null,
        selectedCarouselCardBdcId: null,
        historyRestore: null,
      })),
    },
    'carousel.card.select': {
      actions: assign(({ context, event }) => ({
        selectedCarouselCardBdcId: event.bdcId !== null && findCarouselCard(context.document, event.bdcId) ? event.bdcId : null,
      })),
    },
    'chapter.select': {
      actions: assign(({ context, event }) => ({
        selectedChapterId: keepSelectedChapter(context.document, event.chapterId),
        selectedCarouselCardBdcId: null,
        historyRestore: null,
      })),
    },
    'catalog.tab.select': {
      actions: assign(({ event }) => ({ catalogTab: event.tabId })),
    },
    'media.source.register': {
      actions: assign(({ context, event }) => ({
        mediaSources: { ...context.mediaSources, [event.mediaId]: event.source },
      })),
    },
    'document.replace': {
      actions: assign(({ context, event }) => ({
        document: event.document,
        selectedPageId: keepSelectedPage(event.document, context.selectedPageId),
        selectedChapterId: keepSelectedChapter(event.document, context.selectedChapterId),
        selectedCarouselCardBdcId: keepSelectedCarouselCard(event.document, context.selectedCarouselCardBdcId),
        mediaSources: {},
        history: EMPTY_DOCUMENT_HISTORY,
        sectionSelection: null,
        historyRestore: null,
        syncStatus: 'pending',
      })),
    },
    'document.sync.status': {
      actions: assign(({ event }) => ({ syncStatus: event.status })),
    },
    'document.sync.merge': {
      guard: ({ context, event }) => context.activeProject?.id === event.projectId
        && context.document.id === event.projectId,
      actions: assign(({ context, event }) => commitCommand(context, {
        type: 'media.merge',
        canonicalMediaId: event.canonicalMediaId,
        duplicateMediaIds: [event.duplicateMediaId],
      }, null, false, false)),
    },
    'project.summary.refresh': {
      actions: assign(({ context, event }) => ({
        activeProject: context.activeProject?.id === event.project.id ? event.project : context.activeProject,
        projects: context.projects.some((project) => project.id === event.project.id)
          ? context.projects.map((project) => project.id === event.project.id ? event.project : project)
          : [...context.projects, event.project],
      })),
    },
    'project.reader.ready': {
      actions: assign(({ context }) => ({
        projectStatus: context.activeProject !== null && context.projectStatus === 'opening' ? 'active' as const : context.projectStatus,
      })),
    },
    'project.access.error': { actions: 'markProjectAccessError' },
    'project.access.recovery': { actions: 'markProjectAccessRecovery' },
    'project.sync.warning': { actions: assign(({ event }) => ({ projectError: event.message })) },
    'project.local-copy.availability': {
      actions: assign(({ context, event }) => ({
        recoverableLocalCopy: context.activeProject?.id === event.projectId ? event.available : context.recoverableLocalCopy,
      })),
    },
    'project.access.retry': { actions: ({ context }) => context.projectSession?.retryAccess?.() },
    'project.access.force': { actions: ({ context }) => context.projectSession?.forceAccess?.() },
  },
  states: {
    suspended: {
      on: {
        'project.operation': { actions: 'beginProjectOperation', target: 'projectOperation' },
        'editor.access.activate': {
          actions: assign(({ context }) => ({
            editAccess: 'active',
            projectStatus: context.activeProject === null ? context.projectStatus : 'active',
            projectError: null,
            accessRecoveryAvailable: false,
          })),
          target: 'ready',
        },
      },
    },
    ready: {
      on: {
        'project.operation': { actions: 'beginProjectOperation', target: 'projectOperation' },
        'editor.access.suspend': {
          actions: assign({ editAccess: 'waiting' }),
          target: 'suspended',
        },
        'document.apply': {
          guard: 'hasEditAccess',
          actions: assign(({ context, event }) => commitCommand(
            context, event.command, event.historyGroupKey ?? null, false, event.recordHistory !== false,
          )),
        },
        'page.create': {
          guard: 'hasEditAccess',
          actions: assign(({ context, event }) => commitCommand(
            context,
            createDefaultPageCommand(context.document, event.placement, event.name, event.pageType),
            null,
            true,
          )),
        },
        'history.undo': { guard: 'hasEditAccess', actions: assign(({ context }) => applyHistoryMovement(context, 'history-undo')) },
        'history.redo': { guard: 'hasEditAccess', actions: assign(({ context }) => applyHistoryMovement(context, 'history-redo')) },
        'section.change': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange', target: 'processingDocumentChange' },
        'question.media.file.import': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange', target: 'processingDocumentChange' },
        'card.media.file.import': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange', target: 'processingDocumentChange' },
        'summary.media.file.import': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange', target: 'processingDocumentChange' },
      },
    },
    processingDocumentChange: {
      invoke: {
        src: 'persistDocumentChange',
        input: ({ context }) => ({
          operation: context.documentChanges[0]!,
          store: context.documentStore,
          document: context.document,
        }),
        onDone: {
          actions: 'commitDocumentChange',
          target: 'nextDocumentChange',
        },
        onError: {
          actions: 'discardDocumentChange',
          target: 'nextDocumentChange',
        },
      },
      on: {
        'import.cancel': { guard: 'hasActiveImport', actions: 'discardDocumentChange', target: 'nextDocumentChange' },
        'project.operation': { actions: 'beginProjectOperation' },
        'editor.access.suspend': { actions: assign({ editAccess: 'waiting' }) },
        'document.apply': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
        'page.create': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
        'history.undo': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
        'history.redo': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
        'section.change': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
        'question.media.file.import': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
        'card.media.file.import': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
        'summary.media.file.import': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
      },
    },
    nextDocumentChange: {
      always: [
        { guard: 'hasPendingDocumentChanges', target: 'processingDocumentChange' },
        { guard: ({ context }) => context.pendingProjectOperation !== null, target: 'projectOperation' },
        { guard: 'hasEditAccess', target: 'ready' },
        { target: 'suspended' },
      ],
    },
    projectOperation: {
      invoke: {
        src: 'performProjectOperation',
        input: ({ context }) => ({
          operation: context.pendingProjectOperation!,
          session: context.projectSession,
          document: context.document,
          activeProject: context.activeProject,
          editAccess: context.editAccess,
          hadEditAccess: context.projectOperationHadAccess,
        }),
        onDone: {
          target: 'resumeProjectAccess',
          actions: ['commitProjectOperation', 'startProjectLock'],
        },
        onError: {
          target: 'resumeProjectAccess',
          actions: 'failProjectOperation',
        },
      },
      on: {
        'editor.access.suspend': {
          actions: assign({ editAccess: 'waiting', projectOperationHadAccess: false }),
        },
      },
    },
    resumeProjectAccess: {
      always: [
        { guard: 'hasEditAccess', target: 'ready' },
        { target: 'suspended' },
      ],
    },
  },
})

/** Distinguishes the cancellable file-preparation stage from other queued work. */
export function isImportChange(change: ElceDocumentChange | undefined): boolean {
  return change?.kind === 'card-media-import'
    || change?.kind === 'question-media-import'
    || change?.kind === 'summary-media-import'
    || (change?.kind === 'anchor' && change.operation.change.kind === 'file-drop')
}

/** Captures the actor state restored together with one document revision. */
function historyPosition(context: ElceAppContext): DocumentHistoryPosition {
  return {
    document: context.document,
    selectedPageId: context.selectedPageId,
    selectedChapterId: context.selectedChapterId,
    selectedCarouselCardBdcId: context.selectedCarouselCardBdcId,
    sectionSelection: context.sectionSelection,
  }
}

/** Commits one existing document command and records its author gesture. */
function commitCommand(
  context: ElceAppContext,
  command: DocumentCommand,
  groupKey: string | null,
  selectCreatedPage = false,
  recordHistory = true,
  recordedAt = Date.now(),
  selectionBefore?: SectionSelection,
  selectionAfter?: SectionSelection,
): Partial<ElceAppContext> {
  if (!recordHistory && command.type === 'media.merge') {
    const mediaIds = new Set(context.document.medias.map((media) => media.id))
    if (!mediaIds.has(command.canonicalMediaId)
      || command.duplicateMediaIds.some((mediaId) => !mediaIds.has(mediaId))) return {}
  }
  const document = applyDocumentCommand(context.document, command)
  const createdPageId = selectCreatedPage && command.type === 'page.create' ? command.pageId : null
  const after: DocumentHistoryPosition = {
    document,
    selectedPageId: createdPageId ?? keepSelectedPage(document, context.selectedPageId),
    selectedChapterId: createdPageId === null ? keepSelectedChapter(document, context.selectedChapterId) : null,
    selectedCarouselCardBdcId: createdPageId === null
      ? selectedCarouselCardAfterCommand(document, command, context.selectedCarouselCardBdcId)
      : null,
    sectionSelection: createdPageId !== null ? null
      : selectionAfter ?? keepSectionSelection(document, context.sectionSelection),
  }
  const before: DocumentHistoryPosition = {
    ...historyPosition(context),
    sectionSelection: selectionBefore ?? context.sectionSelection,
  }
  return {
    ...after,
    historyRestore: null,
    history: recordHistory
      ? recordDocumentHistory(context.history, before, after, groupKey, recordedAt)
      : command.type === 'media.merge'
        ? rebaseMediaMergeHistory(context.history, command.canonicalMediaId, command.duplicateMediaIds)
        : context.history,
  }
}

/** Restores the document and selection owned by the next history entry. */
function applyHistoryMovement(
  context: ElceAppContext,
  kind: 'history-undo' | 'history-redo',
): Partial<ElceAppContext> {
  const movement = kind === 'history-undo'
    ? undoDocumentHistory(context.history)
    : redoDocumentHistory(context.history)
  return movement === null ? {} : {
    ...movement.position,
    history: movement.history,
    historyRestore: { selection: movement.position.sectionSelection },
  }
}

/** Keeps a saved caret only while its Section still belongs to the document. */
function keepSectionSelection(document: ElceAppContext['document'], selection: SectionSelection | null): SectionSelection | null {
  return selection !== null && document.bdcs.some((bdc) => bdc.id === selection.sectionBdcId)
    ? selection : null
}

/** Keeps the selected page when it survives a document replacement. */
function keepSelectedPage(document: ElceAppContext['document'], selectedPageId: PageId | null): PageId | null {
  if (selectedPageId !== null && document.pages.some((page) => page.id === selectedPageId)) return selectedPageId
  return document.pages[0]?.id ?? null
}

/** Keeps the selected chapter only while it remains in the document. */
function keepSelectedChapter(document: ElceAppContext['document'], selectedChapterId: ChapterId | null): ChapterId | null {
  return selectedChapterId !== null && document.chapters.some((chapter) => chapter.id === selectedChapterId)
    ? selectedChapterId
    : null
}

/** Selects the first Card on Carousel creation and retains a surviving Card after edits. */
function selectedCarouselCardAfterCommand(
  document: ElceAppContext['document'],
  command: DocumentCommand,
  currentBdcId: string | null,
): string | null {
  switch (command.type) {
    case 'bdc.create':
      if (command.bdcType === BDC_TYPE.CAROUSEL) {
        return document.bdcs.find((bdc) => bdc.id === command.bdcId)?.carousel?.cards[0]?.bdcId ?? null
      }
      return keepSelectedCarouselCard(document, currentBdcId)
    case 'bdc.carousel.update': {
      if (currentBdcId !== null && command.carousel.cards.some((entry) => entry.bdcId === currentBdcId)) return currentBdcId
      return command.carousel.cards[0]?.bdcId ?? null
    }
    default:
      return keepSelectedCarouselCard(document, currentBdcId)
  }
}

/** Keeps a selected Card BDC when it remains in a Carousel, or selects an available Card. */
function keepSelectedCarouselCard(document: ElceAppContext['document'], bdcId: string | null): string | null {
  if (bdcId !== null && findCarouselCard(document, bdcId)) return bdcId
  return document.bdcs.find((bdc) => bdc.carousel?.cards[0] !== undefined)?.carousel?.cards[0]?.bdcId ?? null
}

/** Checks whether a Card BDC identifier belongs to an authored Carousel. */
function findCarouselCard(document: ElceAppContext['document'], bdcId: string): boolean {
  return document.bdcs.some((bdc) => bdc.carousel?.cards.some((entry) => entry.bdcId === bdcId) === true)
}

/** Registers an object URL only when an import created a new media resource. */
function updateMediaSources(
  mediaSources: ElceAppContext['mediaSources'],
  operation: ElceDocumentChange,
  source: string | null,
): ElceAppContext['mediaSources'] {
  switch (operation.kind) {
    case 'anchor':
      switch (operation.operation.change.kind) {
        case 'file-drop':
          return mediaSourceAddition(mediaSources, operation.operation.change.target.media.id, source)
        case 'content':
        case 'catalog-drop':
        case 'anchor-move':
        case 'anchor-remove':
        case 'anchor-return':
          return mediaSources
      }
    case 'question-media-import':
    case 'card-media-import':
    case 'summary-media-import':
      return mediaSourceAddition(mediaSources, operation.media.id, source)
    case 'command':
    case 'page-create':
    case 'history-undo':
    case 'history-redo':
      return mediaSources
  }
}

/** Adds one object URL after the associated file has been persisted. */
function mediaSourceAddition(
  mediaSources: ElceAppContext['mediaSources'],
  mediaId: string,
  source: string | null,
): ElceAppContext['mediaSources'] {
  return source === null ? mediaSources : { ...mediaSources, [mediaId]: source }
}

/** Converts an operation failure into a readable status without hiding its cause. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
