import { assign, fromPromise, setup } from 'xstate'
import { applyDocumentCommand, createDefaultPageCommand } from '../commands/document-commands'
import { CATALOG_TAB } from '../../config/document-config'
import { createInitialDocument } from '../../domain/document-model'
import { ElceAnchorDropService } from '../../domain/anchor-drop-service'
import type { PageId } from '../../domain/document-types'
import type { ElceAnchorChange, ElceAppContext, ElceControllerEvent, ElceControllerInput } from './controller-types'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'

const initialDocument = createInitialDocument()
const anchorDropService = new ElceAnchorDropService()

interface AnchorWorkerInput {
  readonly operation: ElceAnchorChange
  readonly store: ElceDocumentStore | null
}

interface AnchorWorkerOutput {
  readonly operation: ElceAnchorChange
  readonly source: string | null
}

const persistAnchorChange = fromPromise<AnchorWorkerOutput, AnchorWorkerInput>(async ({ input }) => {
  const operation = input.operation
  switch (operation.change.kind) {
    case 'file-drop': {
      if (input.store === null) throw new Error('Le stockage Elcé n’est pas configuré pour un dépôt de fichier.')
      await input.store.saveMedia({ id: operation.change.target.media.id, blob: operation.change.file })
      const source = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(operation.change.file)
        : null
      return { operation, source }
    }
    case 'content':
    case 'catalog-drop':
    case 'anchor-move':
    case 'anchor-remove':
    case 'anchor-return':
      return { operation, source: null }
  }
})

/** Owns all application commands and serializes asynchronous anchor changes. */
export const controllerMachine = setup({
  types: {
    context: {} as ElceAppContext,
    events: {} as ElceControllerEvent,
    input: {} as ElceControllerInput | undefined,
  },
  actions: {
    enqueueAnchorChange: assign(({ context, event }) => {
      if (event.type !== 'section.change') return {}
      return { anchorChanges: [...context.anchorChanges, { sectionBdcId: event.sectionBdcId, change: event.change }] }
    }),
    commitAnchorChange: assign(({ context, event }) => {
      const output = (event as unknown as { output: AnchorWorkerOutput }).output
      const command = anchorDropService.createDocumentCommand(output.operation.sectionBdcId, output.operation.change)
      const document = applyDocumentCommand(context.document, command)
      return {
        document,
        selectedPageId: keepSelectedPage(document, context.selectedPageId),
        mediaSources: updateMediaSources(context.mediaSources, output.operation.change, output.source),
        anchorChanges: context.anchorChanges.slice(1),
      }
    }),
    discardAnchorChange: assign(({ context }) => ({ anchorChanges: context.anchorChanges.slice(1) })),
  },
  guards: {
    hasPendingAnchorChanges: ({ context }) => context.anchorChanges.length > 0,
  },
  actors: { persistAnchorChange },
}).createMachine({
  id: 'elce-app',
  context: ({ input }) => ({
    document: initialDocument,
    selectedPageId: initialDocument.pages[0]?.id ?? null,
    catalogTab: CATALOG_TAB.AVAILABLE_BDCS,
    mediaSources: {},
    documentStore: input?.documentStore ?? null,
    anchorChanges: [],
  }),
  initial: 'ready',
  on: {
    'document.apply': {
      actions: assign(({ context, event }) => {
        const document = applyDocumentCommand(context.document, event.command)
        return { document, selectedPageId: keepSelectedPage(document, context.selectedPageId) }
      }),
    },
    'page.create': {
      actions: assign(({ context, event }) => {
        const command = createDefaultPageCommand(context.document, event.name)
        const document = applyDocumentCommand(context.document, command)
        return { document, selectedPageId: command.pageId }
      }),
    },
    'page.select': {
      actions: assign(({ context, event }) => ({
        selectedPageId: keepSelectedPage(context.document, event.pageId),
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
      })),
    },
  },
  states: {
    ready: {
      on: {
        'section.change': {
          actions: 'enqueueAnchorChange',
          target: 'processingAnchor',
        },
      },
    },
    processingAnchor: {
      invoke: {
        src: 'persistAnchorChange',
        input: ({ context }) => ({
          operation: context.anchorChanges[0]!,
          store: context.documentStore,
        }),
        onDone: {
          actions: 'commitAnchorChange',
          target: 'nextAnchorChange',
        },
        onError: {
          actions: 'discardAnchorChange',
          target: 'nextAnchorChange',
        },
      },
      on: {
        'section.change': {
          actions: 'enqueueAnchorChange',
        },
      },
    },
    nextAnchorChange: {
      always: [
        { guard: 'hasPendingAnchorChanges', target: 'processingAnchor' },
        { target: 'ready' },
      ],
    },
  },
})

/** Keeps the selected page when it survives a document replacement. */
function keepSelectedPage(document: ElceAppContext['document'], selectedPageId: PageId | null): PageId | null {
  if (selectedPageId !== null && document.pages.some((page) => page.id === selectedPageId)) return selectedPageId
  return document.pages[0]?.id ?? null
}

/** Adds an object URL only for a file-drop operation that created the media. */
function updateMediaSources(
  mediaSources: ElceAppContext['mediaSources'],
  change: ElceAnchorChange['change'],
  source: string | null,
): ElceAppContext['mediaSources'] {
  switch (change.kind) {
    case 'file-drop':
      switch (source) {
        case null:
          return mediaSources
        default:
          return { ...mediaSources, [change.target.media.id]: source }
      }
    case 'content':
    case 'catalog-drop':
    case 'anchor-move':
    case 'anchor-remove':
    case 'anchor-return':
      return mediaSources
  }
}
