import { assign, fromPromise, setup } from 'xstate'
import { applyDocumentCommand, createDefaultPageCommand } from '../../domain/commands/document-commands'
import type { DocumentCommand } from '../../domain/commands/document-command-types'
import { BDC_TYPE, CATALOG_TAB } from '../../config/document-config'
import { createInitialDocument } from '../../domain/document/document-model'
import { ElceAnchorDropService } from '../../domain/anchor/anchor-drop-service'
import { ElceMediaResourceService } from '../../domain/media/media-resource-service'
import type { ElceDocumentChange } from './document-change-types'
import type { ChapterId, MediaMetadata, PageId } from '../../domain/document/document-types'
import type { ElceAppContext, ElceControllerEvent, ElceControllerInput } from './controller-types'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'
import type { ProjectSessionOperation, ProjectSessionResult } from '../projects/project-session-types'

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
const persistDocumentChange = fromPromise<DocumentChangeWorkerOutput, DocumentChangeWorkerInput>(async ({ input }) => {
  const operation = input.operation
  switch (operation.kind) {
    case 'anchor':
      switch (operation.operation.change.kind) {
        case 'file-drop': {
          if (input.store === null) throw new Error('Le stockage Elcé n’est pas configuré pour un dépôt de fichier.')
          const { media, created } = await resolveImportedMedia(
            operation.operation.change.file,
            operation.operation.change.target.media,
            input.document,
            input.store,
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
    case 'question-media-import': {
      if (input.store === null) throw new Error('Le stockage Elcé n’est pas configuré pour un dépôt de fichier.')
      const { media, created } = await resolveImportedMedia(operation.file, operation.media, input.document, input.store)
      return {
        operation: { ...operation, media },
        source: created ? createObjectUrl(operation.file) : null,
        mediaCreated: created,
      }
    }
    case 'card-media-import': {
      if (input.store === null) throw new Error('Le stockage Elcé n’est pas configuré pour un dépôt de fichier.')
      const { media, created } = await resolveImportedMedia(operation.file, operation.media, input.document, input.store)
      return {
        operation: { ...operation, media },
        source: created ? createObjectUrl(operation.file) : null,
        mediaCreated: created,
      }
    }
  }
})

/** Reuses an exact media resource or persists the imported bytes once. */
async function resolveImportedMedia(
  file: File,
  media: MediaMetadata,
  document: ElceAppContext['document'],
  store: ElceDocumentStore,
): Promise<Readonly<{ media: MediaMetadata; created: boolean }>> {
  const duplicate = await mediaResourceService.findDuplicate(
    file,
    document.medias,
    (mediaId) => store.loadMedia(mediaId),
  )
  switch (duplicate) {
    case null:
      await store.saveMedia({ id: media.id, blob: file })
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
function commandForChange(operation: ElceDocumentChange, mediaCreated: boolean) {
  switch (operation.kind) {
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
  }
}

/** Builds the controller-owned queue item for either accepted document change. */
function documentChangeForEvent(event: ElceControllerEvent): ElceDocumentChange | null {
  switch (event.type) {
    case 'section.change':
      return { kind: 'anchor', operation: { sectionBdcId: event.sectionBdcId, change: event.change } }
    case 'question.media.file.import':
      return { kind: 'question-media-import', bdcId: event.bdcId, file: event.file, media: event.media }
    case 'card.media.file.import':
      return { kind: 'card-media-import', bdcId: event.bdcId, file: event.file, media: event.media }
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
      const document = applyDocumentCommand(context.document, commandForChange(output.operation, output.mediaCreated))
      return {
        document,
        selectedPageId: keepSelectedPage(document, context.selectedPageId),
        selectedChapterId: keepSelectedChapter(document, context.selectedChapterId),
        mediaSources: updateMediaSources(context.mediaSources, output.operation, output.source),
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
        editAccess: 'waiting',
      }
    }),
    commitProjectOperation: assign(({ context, event }) => {
      const output = (event as unknown as { output: ProjectSessionResult }).output
      const document = output.document ?? context.document
      const replaced = output.document !== null
      return {
        document,
        selectedPageId: replaced ? document.pages[0]?.id ?? null : context.selectedPageId,
        selectedChapterId: replaced ? null : context.selectedChapterId,
        selectedCarouselCardBdcId: replaced ? null : context.selectedCarouselCardBdcId,
        mediaSources: replaced ? {} : context.mediaSources,
        projects: output.projects,
        activeProject: output.activeProject,
        projectStatus: output.status,
        projectError: null,
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
      editAccess: 'waiting' as const,
    })),
  },
  guards: {
    hasPendingDocumentChanges: ({ context }) => context.documentChanges.length > 0,
    hasEditAccess: ({ context }) => context.editAccess === 'active',
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
    projectSession: input?.projectSession ?? null,
    projects: [],
    activeProject: null,
    projectStatus: 'loading',
    projectError: null,
    pendingProjectOperation: null,
    projectOperationHadAccess: false,
  }),
  initial: 'suspended',
  on: {
    'document.apply': {
      guard: 'hasEditAccess',
      actions: assign(({ context, event }) => {
        const document = applyDocumentCommand(context.document, event.command)
        return {
          document,
          selectedPageId: keepSelectedPage(document, context.selectedPageId),
          selectedChapterId: keepSelectedChapter(document, context.selectedChapterId),
          selectedCarouselCardBdcId: selectedCarouselCardAfterCommand(document, event.command, context.selectedCarouselCardBdcId),
        }
      }),
    },
    'page.create': {
      guard: 'hasEditAccess',
      actions: assign(({ context, event }) => {
        const command = createDefaultPageCommand(context.document, event.placement, event.name, event.pageType)
        const document = applyDocumentCommand(context.document, command)
        return { document, selectedPageId: command.pageId, selectedChapterId: null, selectedCarouselCardBdcId: null }
      }),
    },
    'page.select': {
      actions: assign(({ context, event }) => ({
        selectedPageId: keepSelectedPage(context.document, event.pageId),
        selectedChapterId: null,
        selectedCarouselCardBdcId: null,
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
        syncStatus: 'pending',
      })),
    },
    'document.sync.status': {
      actions: assign(({ event }) => ({ syncStatus: event.status })),
    },
    'project.access.error': { actions: 'markProjectAccessError' },
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
        'section.change': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange', target: 'processingDocumentChange' },
        'question.media.file.import': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange', target: 'processingDocumentChange' },
        'card.media.file.import': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange', target: 'processingDocumentChange' },
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
        'project.operation': { actions: 'beginProjectOperation' },
        'editor.access.suspend': { actions: assign({ editAccess: 'waiting' }) },
        'section.change': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
        'question.media.file.import': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
        'card.media.file.import': { guard: 'hasEditAccess', actions: 'enqueueDocumentChange' },
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
      return mediaSourceAddition(mediaSources, operation.media.id, source)
    case 'card-media-import':
      return mediaSourceAddition(mediaSources, operation.media.id, source)
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
