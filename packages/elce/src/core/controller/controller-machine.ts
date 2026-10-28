import { assign, fromPromise, setup } from 'xstate'
import type { ChapterId, MediaId, PageId } from '../document/content-document-types'
import { EMPTY_DOCUMENT_HISTORY, rebaseMediaMergeHistory, recordDocumentHistory, redoDocumentHistory, undoDocumentHistory } from '../history/document-history'
import type { DocumentHistoryPosition } from '../history/document-history'
import type {
  ControllerContext,
  ControllerEvent,
  ControllerMachineInput,
  ControllerProjectSession,
  DocumentSyncStatus,
  ProjectOperationResult,
} from './controller-types'

export interface ControllerHistoryMetadata<TSelection> {
  readonly kind: 'commit' | 'undo' | 'redo'
  readonly groupKey: string | null
  readonly recordHistory: boolean
  readonly recordedAt: number
  readonly selectCreatedPage: boolean
  readonly selectionBefore?: TSelection
  readonly selectionAfter?: TSelection
  readonly mediaMerge?: Readonly<{ canonicalMediaId: MediaId; duplicateMediaIds: readonly MediaId[] }>
}

export interface PreparedDocumentChange<TChange> {
  readonly operation: TChange
  readonly mediaCreated: boolean
  readonly mediaSource: Readonly<{ mediaId: MediaId; source: string }> | null
}

export interface ControllerMachineServices<
  TDocument,
  TCommand,
  TChange,
  TSelection,
  TProject extends Readonly<{ id: string }>,
  TProjectOperation,
  TStore,
  TProjectSession extends ControllerProjectSession<TDocument, TProject, TProjectOperation>,
  TPageCreateEvent extends Readonly<{ type: 'page.create' }>,
  TCompositionEvent extends Readonly<{ type: string }>,
  TCompositionState,
> {
  readonly document: Readonly<{
    createInitialDocument(): TDocument
    createPageCommand(document: TDocument, event: TPageCreateEvent): TCommand
    applyCommand(document: TDocument, command: TCommand): TDocument
    mergeMedia(document: TDocument, canonicalMediaId: MediaId, duplicateMediaIds: readonly MediaId[]): TDocument | null
  }>
  readonly changes: Readonly<{
    documentChangeForEvent(
      event: ControllerEvent<TDocument, TCommand, TPageCreateEvent, TProject, TProjectOperation, TCompositionEvent>,
      recordedAt: number,
    ): TChange | null
    prepare(change: TChange, document: TDocument, store: TStore | null, signal: AbortSignal): Promise<PreparedDocumentChange<TChange>>
    commandForChange(change: TChange, mediaCreated: boolean, document: TDocument): TCommand
    isImportChange(change: TChange | undefined): boolean
    historyMetadata(change: TChange, selection: TSelection): ControllerHistoryMetadata<TSelection>
  }>
  readonly selection: Readonly<{
    initial(document: TDocument): TSelection
    afterReplace(document: TDocument, current: TSelection): TSelection
    afterCommand(document: TDocument, command: TCommand, current: TSelection, selectCreatedPage: boolean, selectionAfter?: TSelection): TSelection
    selectPage(document: TDocument, current: TSelection, pageId: PageId): TSelection
    selectChapter(document: TDocument, current: TSelection, chapterId: ChapterId): TSelection
  }>
  readonly queuedEventTypes: readonly TCompositionEvent['type'][]
  readonly additionalEventTypes: readonly TCompositionEvent['type'][]
  createInitialCompositionState(
    input: ControllerMachineInput<TStore, TProjectSession> | undefined,
    document: TDocument,
  ): TCompositionState
  handleAdditionalEvent(
    context: ControllerContext<TDocument, TChange, TSelection, TProject, TProjectOperation, TStore, TProjectSession> & { composition: TCompositionState },
    event: ControllerEvent<TDocument, TCommand, TPageCreateEvent, TProject, TProjectOperation, TCompositionEvent>,
  ): Partial<Readonly<{ selection: TSelection; composition: TCompositionState }>>
  isBootstrapOperation(operation: TProjectOperation): boolean
}

interface ProjectOperationWorkerInput<TDocument, TProject, TProjectOperation, TProjectSession> {
  readonly operation: TProjectOperation
  readonly session: TProjectSession | null
  readonly document: TDocument
  readonly activeProject: TProject | null
  readonly editAccess: 'waiting' | 'active'
  readonly hadEditAccess: boolean
}

interface DocumentChangeWorkerInput<TDocument, TChange, TStore> {
  readonly operation: TChange
  readonly store: TStore | null
  readonly document: TDocument
}

/** Creates the shared authoring actor while the selected composition supplies its document behavior. */
export function createControllerMachine<
  TDocument extends Readonly<{ id: string }>,
  TCommand,
  TChange,
  TSelection,
  TProject extends Readonly<{ id: string }>,
  TProjectOperation,
  TStore,
  TProjectSession extends ControllerProjectSession<TDocument, TProject, TProjectOperation>,
  TPageCreateEvent extends Readonly<{ type: 'page.create' }>,
  TCompositionEvent extends Readonly<{ type: string }>,
  TCompositionState,
>(services: ControllerMachineServices<
  TDocument,
  TCommand,
  TChange,
  TSelection,
  TProject,
  TProjectOperation,
  TStore,
  TProjectSession,
  TPageCreateEvent,
  TCompositionEvent,
  TCompositionState
>) {
  type BaseContext = ControllerContext<TDocument, TChange, TSelection, TProject, TProjectOperation, TStore, TProjectSession>
  type MachineContext = BaseContext & { readonly composition: TCompositionState }
  type MachineEvent = ControllerEvent<TDocument, TCommand, TPageCreateEvent, TProject, TProjectOperation, TCompositionEvent>
  const isProjectOperationEvent = (event: MachineEvent): event is Readonly<{ type: 'project.operation'; operation: TProjectOperation }> => event.type === 'project.operation'
  const isProjectAccessErrorEvent = (event: MachineEvent): event is Readonly<{ type: 'project.access.error'; message: string }> => event.type === 'project.access.error'
  const isProjectAccessRecoveryEvent = (event: MachineEvent): event is Readonly<{ type: 'project.access.recovery'; message: string }> => event.type === 'project.access.recovery'
  const isPageSelectEvent = (event: MachineEvent): event is Readonly<{ type: 'page.select'; pageId: PageId }> => event.type === 'page.select'
  const isChapterSelectEvent = (event: MachineEvent): event is Readonly<{ type: 'chapter.select'; chapterId: ChapterId }> => event.type === 'chapter.select'
  const isPageCreateEvent = (event: MachineEvent): event is TPageCreateEvent => event.type === 'page.create'
  const isSyncStatusEvent = (event: MachineEvent): event is Readonly<{ type: 'document.sync.status'; status: DocumentSyncStatus }> => event.type === 'document.sync.status'
  const isMediaSourceRegisterEvent = (event: MachineEvent): event is Readonly<{ type: 'media.source.register'; mediaId: MediaId; source: string }> => event.type === 'media.source.register'
  const isDocumentReplaceEvent = (event: MachineEvent): event is Readonly<{ type: 'document.replace'; document: TDocument }> => event.type === 'document.replace'
  const isMediaMergeEvent = (event: MachineEvent): event is Readonly<{ type: 'document.sync.merge'; projectId: string; canonicalMediaId: MediaId; duplicateMediaId: MediaId }> => event.type === 'document.sync.merge'
  const isProjectSummaryRefreshEvent = (event: MachineEvent): event is Readonly<{ type: 'project.summary.refresh'; project: TProject }> => event.type === 'project.summary.refresh'
  const isProjectSyncWarningEvent = (event: MachineEvent): event is Readonly<{ type: 'project.sync.warning'; message: string }> => event.type === 'project.sync.warning'
  const isLocalCopyAvailabilityEvent = (event: MachineEvent): event is Readonly<{ type: 'project.local-copy.availability'; projectId: string; available: boolean }> => event.type === 'project.local-copy.availability'
  const isDocumentApplyEvent = (event: MachineEvent): event is Readonly<{ type: 'document.apply'; command: TCommand; historyGroupKey?: string; recordHistory?: boolean }> => event.type === 'document.apply'
  const isHistoryUndoEvent = (event: MachineEvent): event is Readonly<{ type: 'history.undo' }> => event.type === 'history.undo'
  const isHistoryRedoEvent = (event: MachineEvent): event is Readonly<{ type: 'history.redo' }> => event.type === 'history.redo'
  const isEditorAccessActivateEvent = (event: MachineEvent): event is Readonly<{ type: 'editor.access.activate' }> => event.type === 'editor.access.activate'
  const isEditorAccessSuspendEvent = (event: MachineEvent): event is Readonly<{ type: 'editor.access.suspend' }> => event.type === 'editor.access.suspend'
  const queuedEventTypes = new Set<string>(services.queuedEventTypes)
  const additionalEventTypes = new Set<string>(services.additionalEventTypes)

  const persistDocumentChange = fromPromise<PreparedDocumentChange<TChange>, DocumentChangeWorkerInput<TDocument, TChange, TStore>>(
    async ({ input, signal }) => services.changes.prepare(input.operation, input.document, input.store, signal),
  )
  const performProjectOperation = fromPromise<
    ProjectOperationResult<TDocument, TProject>,
    ProjectOperationWorkerInput<TDocument, TProject, TProjectOperation, TProjectSession>
  >(async ({ input }) => {
    if (input.session === null) throw new Error('La gestion des projets n’est pas configurée.')
    return input.session.perform(input.operation, input.document, input.activeProject, input.editAccess, input.hadEditAccess)
  })

  const recordCommand = (
    context: MachineContext,
    command: TCommand,
    metadata: ControllerHistoryMetadata<TSelection>,
  ): Partial<MachineContext> => {
    const document = metadata.mediaMerge === undefined
      ? services.document.applyCommand(context.document, command)
      : services.document.mergeMedia(
        context.document,
        metadata.mediaMerge.canonicalMediaId,
        metadata.mediaMerge.duplicateMediaIds,
      )
    if (document === null) return {}
    const selection = services.selection.afterCommand(
      document,
      command,
      context.selection,
      metadata.selectCreatedPage,
      metadata.selectionAfter,
    )
    const before: DocumentHistoryPosition<TDocument, TSelection> = {
      document: context.document,
      selection: metadata.selectionBefore ?? context.selection,
    }
    const after: DocumentHistoryPosition<TDocument, TSelection> = { document, selection }
    return {
      document,
      selection,
      historyRestore: null,
      history: metadata.recordHistory
        ? recordDocumentHistory(context.history, before, after, metadata.groupKey, metadata.recordedAt)
        : metadata.mediaMerge === undefined
          ? context.history
          : rebaseMediaMergeHistory(
            context.history,
            metadata.mediaMerge.canonicalMediaId,
            metadata.mediaMerge.duplicateMediaIds,
            (snapshot, canonicalMediaId, duplicateMediaIds) => services.document.mergeMedia(snapshot, canonicalMediaId, duplicateMediaIds) ?? snapshot,
          ),
    }
  }

  const commitQueuedChange = (context: MachineContext, output: PreparedDocumentChange<TChange>): Partial<MachineContext> => {
    const metadata = services.changes.historyMetadata(output.operation, context.selection)
    if (metadata.kind === 'undo' || metadata.kind === 'redo') {
      return { ...applyHistoryMovement(context, metadata.kind), documentChanges: context.documentChanges.slice(1) }
    }
    const command = services.changes.commandForChange(output.operation, output.mediaCreated, context.document)
    return {
      ...recordCommand(context, command, metadata),
      mediaSources: addMediaSource(context.mediaSources, output.mediaSource),
      documentChanges: context.documentChanges.slice(1),
    }
  }

  return setup({
    types: {
      context: {} as MachineContext,
      events: {} as MachineEvent,
      input: {} as ControllerMachineInput<TStore, TProjectSession> | undefined,
    },
    actions: {
      enqueueDocumentChange: assign(({ context, event }) => {
        const operation = services.changes.documentChangeForEvent(event, Date.now())
        if (operation === null) return {}
        return { documentChanges: [...context.documentChanges, operation] }
      }),
      discardDocumentChange: assign(({ context }) => ({ documentChanges: context.documentChanges.slice(1) })),
      beginProjectOperation: assign(({ context, event }) => {
        if (!isProjectOperationEvent(event)) return {}
        return {
          pendingProjectOperation: event.operation,
          projectOperationHadAccess: context.editAccess === 'active',
          projectStatus: services.isBootstrapOperation(event.operation) ? 'loading' : 'busy',
          projectError: null,
          projectErrorSource: null,
          accessRecoveryAvailable: false,
          editAccess: 'waiting',
        }
      }),
      startProjectLock: ({ context }) => {
        if (context.projectStatus === 'opening' && context.activeProject !== null) {
          context.projectSession?.startLock(context.activeProject.id)
        }
      },
      markProjectAccessError: assign(({ event }) => {
        if (!isProjectAccessErrorEvent(event)) return {}
        return {
          projectStatus: 'error' as const,
          projectError: event.message,
          projectErrorSource: 'access' as const,
          accessRecoveryAvailable: false,
          editAccess: 'waiting' as const,
        }
      }),
      markProjectAccessRecovery: assign(({ event }) => {
        if (!isProjectAccessRecoveryEvent(event)) return {}
        return {
          projectStatus: 'error' as const,
          projectError: event.message,
          projectErrorSource: 'recovery' as const,
          accessRecoveryAvailable: true,
          editAccess: 'waiting' as const,
        }
      }),
      suspendEditorAccess: assign(({ context }) => {
        if (context.projectErrorSource !== 'access') return { editAccess: 'waiting' as const }
        return {
          editAccess: 'waiting' as const,
          projectError: null,
          projectErrorSource: null,
          projectStatus: context.activeProject === null ? 'list' as const : 'active' as const,
          accessRecoveryAvailable: false,
        }
      }),
      activateEditorAccess: assign(({ context }) => ({
        editAccess: 'active' as const,
        projectStatus: context.activeProject === null ? context.projectStatus : 'active' as const,
        projectError: null,
        projectErrorSource: null,
        accessRecoveryAvailable: false,
      })),
      clearProjectOperationAccess: assign({ projectOperationHadAccess: false }),
      handleAdditionalEvent: assign(({ context, event }) => services.handleAdditionalEvent(context, event)),
      selectPage: assign(({ context, event }) => {
        if (!isPageSelectEvent(event)) return {}
        return { selection: services.selection.selectPage(context.document, context.selection, event.pageId), historyRestore: null }
      }),
      selectChapter: assign(({ context, event }) => {
        if (!isChapterSelectEvent(event)) return {}
        return { selection: services.selection.selectChapter(context.document, context.selection, event.chapterId), historyRestore: null }
      }),
      applyDocumentCommand: assign(({ context, event }) => {
        const operation = services.changes.documentChangeForEvent(event, Date.now())
        if (operation === null) return {}
        const metadata = services.changes.historyMetadata(operation, context.selection)
        if (metadata.kind !== 'commit') return {}
        return recordCommand(context, services.changes.commandForChange(operation, false, context.document), metadata)
      }),
      createPage: assign(({ context, event }) => {
        if (!isPageCreateEvent(event)) return {}
        const operation = services.changes.documentChangeForEvent(event, Date.now())
        if (operation === null) return {}
        const metadata = services.changes.historyMetadata(operation, context.selection)
        return recordCommand(context, services.document.createPageCommand(context.document, event), metadata)
      }),
      undo: assign(({ context }) => applyHistoryMovement(context, 'undo')),
      redo: assign(({ context }) => applyHistoryMovement(context, 'redo')),
      setSyncStatus: assign(({ event }) => isSyncStatusEvent(event) ? { syncStatus: event.status } : {}),
      registerMediaSource: assign(({ context, event }) => isMediaSourceRegisterEvent(event)
        ? { mediaSources: { ...context.mediaSources, [event.mediaId]: event.source } } : {}),
      replaceDocument: assign(({ context, event }) => {
        if (!isDocumentReplaceEvent(event)) return {}
        return {
          document: event.document,
          selection: services.selection.afterReplace(event.document, context.selection),
          mediaSources: {},
          history: EMPTY_DOCUMENT_HISTORY,
          historyRestore: null,
          syncStatus: 'pending' as DocumentSyncStatus,
        }
      }),
      mergeDocumentMedia: assign(({ context, event }) => {
        if (!isMediaMergeEvent(event)
          || context.activeProject?.id !== event.projectId
          || context.document.id !== event.projectId) return {}
        const document = services.document.mergeMedia(context.document, event.canonicalMediaId, [event.duplicateMediaId])
        if (document === null) return {}
        return {
          document,
          history: rebaseMediaMergeHistory(
            context.history,
            event.canonicalMediaId,
            [event.duplicateMediaId],
            (snapshot, canonicalMediaId, duplicateMediaIds) => services.document.mergeMedia(snapshot, canonicalMediaId, duplicateMediaIds) ?? snapshot,
          ),
        }
      }),
      refreshProjectSummary: assign(({ context, event }) => {
        if (!isProjectSummaryRefreshEvent(event)) return {}
        return {
          activeProject: context.activeProject?.id === event.project.id ? event.project : context.activeProject,
          projects: context.projects.some((project) => project.id === event.project.id)
            ? context.projects.map((project) => project.id === event.project.id ? event.project : project)
            : [...context.projects, event.project],
        }
      }),
      projectReaderReady: assign(({ context }) => ({
        projectStatus: context.activeProject !== null && context.projectStatus === 'opening' ? 'active' as const : context.projectStatus,
      })),
      projectSyncWarning: assign(({ event }) => isProjectSyncWarningEvent(event)
        ? { projectError: event.message, projectErrorSource: 'sync' as const }
        : {}),
      localCopyAvailability: assign(({ context, event }) => {
        if (!isLocalCopyAvailabilityEvent(event)) return {}
        return { recoverableLocalCopy: context.activeProject?.id === event.projectId ? event.available : context.recoverableLocalCopy }
      }),
      handleRootEvent: assign(({ context, event }) => {
        if (isMediaSourceRegisterEvent(event)) return { mediaSources: { ...context.mediaSources, [event.mediaId]: event.source } }
        if (isSyncStatusEvent(event)) return { syncStatus: event.status }
        if (isPageSelectEvent(event)) return {
          selection: services.selection.selectPage(context.document, context.selection, event.pageId),
          historyRestore: null,
        }
        if (isChapterSelectEvent(event)) return {
          selection: services.selection.selectChapter(context.document, context.selection, event.chapterId),
          historyRestore: null,
        }
        if (isDocumentReplaceEvent(event)) return {
          document: event.document,
          selection: services.selection.afterReplace(event.document, context.selection),
          mediaSources: {},
          history: EMPTY_DOCUMENT_HISTORY,
          historyRestore: null,
          syncStatus: 'pending' as const,
        }
        if (isMediaMergeEvent(event)) {
          if (context.activeProject?.id !== event.projectId || context.document.id !== event.projectId) return {}
          const document = services.document.mergeMedia(context.document, event.canonicalMediaId, [event.duplicateMediaId])
          if (document === null) return {}
          return {
            document,
            history: rebaseMediaMergeHistory(
              context.history,
              event.canonicalMediaId,
              [event.duplicateMediaId],
              (snapshot, canonicalMediaId, duplicateMediaIds) => services.document.mergeMedia(snapshot, canonicalMediaId, duplicateMediaIds) ?? snapshot,
            ),
          }
        }
        if (isProjectSummaryRefreshEvent(event)) return {
          activeProject: context.activeProject?.id === event.project.id ? event.project : context.activeProject,
          projects: context.projects.some((project) => project.id === event.project.id)
            ? context.projects.map((project) => project.id === event.project.id ? event.project : project)
            : [...context.projects, event.project],
        }
        if (event.type === 'project.reader.ready') return {
          projectStatus: context.activeProject !== null && context.projectStatus === 'opening' ? 'active' as const : context.projectStatus,
        }
        if (isProjectAccessErrorEvent(event)) return {
          projectStatus: 'error' as const,
          projectError: event.message,
          projectErrorSource: 'access' as const,
          accessRecoveryAvailable: false,
          editAccess: 'waiting' as const,
        }
        if (isProjectAccessRecoveryEvent(event)) return {
          projectStatus: 'error' as const,
          projectError: event.message,
          projectErrorSource: 'recovery' as const,
          accessRecoveryAvailable: true,
          editAccess: 'waiting' as const,
        }
        if (isProjectSyncWarningEvent(event)) return { projectError: event.message, projectErrorSource: 'sync' as const }
        if (isLocalCopyAvailabilityEvent(event)) return {
          recoverableLocalCopy: context.activeProject?.id === event.projectId ? event.available : context.recoverableLocalCopy,
        }
        if (event.type === 'project.access.retry') {
          context.projectSession?.retryAccess?.()
          return {}
        }
        if (event.type === 'project.access.force') {
          context.projectSession?.forceAccess?.()
          return {}
        }
        if (additionalEventTypes.has(event.type)) return services.handleAdditionalEvent(context, event)
        return {}
      }),
      retryAccess: ({ context }) => context.projectSession?.retryAccess?.(),
      forceAccess: ({ context }) => context.projectSession?.forceAccess?.(),
    },
    guards: {
      hasPendingDocumentChanges: ({ context }) => context.documentChanges.length > 0,
      hasEditAccess: ({ context }) => context.editAccess === 'active',
      hasActiveImport: ({ context }) => services.changes.isImportChange(context.documentChanges[0]),
      canApplyDocumentCommand: ({ context, event }) => context.editAccess === 'active' && isDocumentApplyEvent(event),
      canCreatePage: ({ context, event }) => context.editAccess === 'active' && isPageCreateEvent(event),
      canUndo: ({ context, event }) => context.editAccess === 'active' && isHistoryUndoEvent(event),
      canRedo: ({ context, event }) => context.editAccess === 'active' && isHistoryRedoEvent(event),
      canEnqueueDocumentChange: ({ context, event }) => context.editAccess === 'active' && queuedEventTypes.has(event.type),
      canBeginProjectOperation: ({ event }) => isProjectOperationEvent(event),
      canSuspendEditorAccess: ({ event }) => isEditorAccessSuspendEvent(event),
      canActivateEditorAccess: ({ event }) => isEditorAccessActivateEvent(event),
      canCancelImport: ({ context, event }) => event.type === 'import.cancel' && services.changes.isImportChange(context.documentChanges[0]),
    },
    actors: { persistDocumentChange, performProjectOperation },
  }).createMachine({
    id: 'elce-app',
    context: ({ input }) => {
      const document = services.document.createInitialDocument()
      const base: BaseContext = {
        document,
        selection: services.selection.initial(document),
        mediaSources: {},
        syncStatus: 'pending',
        editAccess: 'waiting',
        documentStore: input?.documentStore ?? null,
        documentChanges: [],
        history: EMPTY_DOCUMENT_HISTORY,
        historyRestore: null,
        projectSession: input?.projectSession ?? null,
        projects: [],
        activeProject: null,
        projectStatus: 'loading',
        projectError: null,
        projectErrorSource: null,
        accessRecoveryAvailable: false,
        recoverableLocalCopy: false,
        pendingProjectOperation: null,
        projectOperationHadAccess: false,
      }
      return { ...base, composition: services.createInitialCompositionState(input, document) }
    },
    initial: 'suspended',
    on: { '*': { actions: 'handleRootEvent' } },
    states: {
      suspended: {
        on: {
          '*': [
            { guard: 'canBeginProjectOperation', actions: 'beginProjectOperation', target: 'projectOperation' },
            {
              guard: 'canActivateEditorAccess',
              actions: 'activateEditorAccess',
              target: 'ready',
            },
            { guard: 'canSuspendEditorAccess', actions: 'suspendEditorAccess' },
          ],
        },
      },
      ready: {
        on: {
          '*': [
            { guard: 'canBeginProjectOperation', actions: 'beginProjectOperation', target: 'projectOperation' },
            { guard: 'canSuspendEditorAccess', actions: 'suspendEditorAccess', target: 'suspended' },
            { guard: 'canApplyDocumentCommand', actions: 'applyDocumentCommand' },
            { guard: 'canCreatePage', actions: 'createPage' },
            { guard: 'canUndo', actions: 'undo' },
            { guard: 'canRedo', actions: 'redo' },
            { guard: 'canEnqueueDocumentChange', actions: 'enqueueDocumentChange', target: 'processingDocumentChange' },
          ],
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
            actions: assign(({ context, event }) => commitQueuedChange(context, event.output)),
            target: 'nextDocumentChange',
          },
          onError: { actions: 'discardDocumentChange', target: 'nextDocumentChange' },
        },
        on: {
          '*': [
            { guard: 'canCancelImport', actions: 'discardDocumentChange', target: 'nextDocumentChange' },
            { guard: 'canBeginProjectOperation', actions: 'beginProjectOperation' },
            { guard: 'canSuspendEditorAccess', actions: 'suspendEditorAccess' },
            { guard: 'canApplyDocumentCommand', actions: 'enqueueDocumentChange' },
            { guard: 'canCreatePage', actions: 'enqueueDocumentChange' },
            { guard: 'canUndo', actions: 'enqueueDocumentChange' },
            { guard: 'canRedo', actions: 'enqueueDocumentChange' },
            { guard: 'canEnqueueDocumentChange', actions: 'enqueueDocumentChange' },
          ],
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
            actions: [
              assign(({ context, event }) => {
                const output = event.output
                const document = output.document ?? context.document
                const replaced = output.document !== null
                return {
                  document,
                  history: replaced ? EMPTY_DOCUMENT_HISTORY : context.history,
                  selection: replaced ? services.selection.initial(document) : context.selection,
                  historyRestore: null,
                  mediaSources: replaced ? {} : context.mediaSources,
                  projects: output.projects,
                  activeProject: output.activeProject,
                  projectStatus: output.status,
                  projectError: output.projectError ?? null,
                  projectErrorSource: output.projectError == null ? null : 'operation' as const,
                  accessRecoveryAvailable: false,
                  recoverableLocalCopy: output.activeProject?.id === context.activeProject?.id ? context.recoverableLocalCopy : false,
                  pendingProjectOperation: null,
                  projectOperationHadAccess: false,
                  editAccess: context.projectOperationHadAccess ? output.editAccess : 'waiting' as const,
                }
              }),
              'startProjectLock',
            ],
          },
          onError: {
            target: 'resumeProjectAccess',
            actions: assign(({ context, event }) => ({
              projectStatus: context.activeProject === null ? 'list' as const : 'active' as const,
              projectError: errorMessage(event.error),
              projectErrorSource: 'operation' as const,
              pendingProjectOperation: null,
              editAccess: context.projectOperationHadAccess ? 'active' as const : 'waiting' as const,
              projectOperationHadAccess: false,
            })),
          },
        },
        on: {
          '*': [{
            guard: 'canSuspendEditorAccess',
            actions: ['suspendEditorAccess', 'clearProjectOperationAccess'],
          }],
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
}

/** Restores the document and selection owned by the next history entry. */
function applyHistoryMovement<TDocument, TChange, TSelection, TProject, TProjectOperation, TStore, TProjectSession>(
  context: ControllerContext<TDocument, TChange, TSelection, TProject, TProjectOperation, TStore, TProjectSession>,
  kind: 'undo' | 'redo',
): Partial<ControllerContext<TDocument, TChange, TSelection, TProject, TProjectOperation, TStore, TProjectSession>> {
  const movement = kind === 'undo' ? undoDocumentHistory(context.history) : redoDocumentHistory(context.history)
  return movement === null ? {} : {
    document: movement.position.document,
    selection: movement.position.selection,
    history: movement.history,
    historyRestore: { selection: movement.position.selection },
  }
}

/** Adds a media URL only when the import created and persisted that resource. */
function addMediaSource(
  mediaSources: Readonly<Record<MediaId, string>>,
  addition: Readonly<{ mediaId: MediaId; source: string }> | null,
): Readonly<Record<MediaId, string>> {
  return addition === null ? mediaSources : { ...mediaSources, [addition.mediaId]: addition.source }
}

/** Converts an operation failure into a readable status without hiding its cause. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
