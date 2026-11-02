import type { ChapterId, MediaId, PageId } from '../document/content-document-types'
import type { DocumentHistory } from '../history/document-history'

export type DocumentSyncStatus = 'pending' | 'synced' | 'conflict'
export type ProjectControllerStatus = 'loading' | 'list' | 'opening' | 'active' | 'busy' | 'error'
export type ProjectErrorSource = 'operation' | 'access' | 'recovery' | 'sync' | null

export interface ProjectOperationResult<TDocument, TProject> {
  readonly projects: readonly TProject[]
  readonly activeProject: TProject | null
  readonly document: TDocument | null
  readonly status: ProjectControllerStatus
  readonly editAccess: 'waiting' | 'active'
  readonly projectError?: string | null
}

export interface ControllerProjectSession<TDocument, TProject, TOperation> {
  perform(
    operation: TOperation,
    document: TDocument,
    activeProject: TProject | null,
    editAccess: 'waiting' | 'active',
    hadEditAccess: boolean,
  ): Promise<ProjectOperationResult<TDocument, TProject>>
  startLock(projectId: string): void
  retryAccess?(): void
  forceAccess?(): void
}

export interface ControllerMachineInput<TStore, TProjectSession> {
  readonly documentStore?: TStore
  readonly projectSession?: TProjectSession
}

export interface ControllerContext<
  TDocument,
  TChange,
  TSelection,
  TProject,
  TProjectOperation,
  TStore,
  TProjectSession,
> {
  readonly document: TDocument
  readonly selection: TSelection
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly syncStatus: DocumentSyncStatus
  readonly editAccess: 'waiting' | 'active'
  readonly documentStore: TStore | null
  readonly documentChanges: readonly TChange[]
  readonly history: DocumentHistory<TDocument, TSelection>
  readonly historyRestore: Readonly<{ selection: TSelection }> | null
  readonly projectSession: TProjectSession | null
  readonly projects: readonly TProject[]
  readonly activeProject: TProject | null
  readonly projectStatus: ProjectControllerStatus
  readonly projectError: string | null
  readonly projectErrorSource: ProjectErrorSource
  readonly accessRecoveryAvailable: boolean
  readonly recoverableLocalCopy: boolean
  readonly pendingProjectOperation: TProjectOperation | null
  readonly projectOperationHadAccess: boolean
}

/** Lists technical events that project and persistence services may send. */
export type ProjectControllerEvent<TDocument, TProject, TProjectOperation> =
  | Readonly<{ type: 'media.source.register'; mediaId: MediaId; source: string }>
  | Readonly<{ type: 'document.replace'; document: TDocument }>
  | Readonly<{ type: 'document.sync.status'; status: DocumentSyncStatus }>
  | Readonly<{ type: 'document.sync.merge'; projectId: string; canonicalMediaId: MediaId; duplicateMediaId: MediaId }>
  | Readonly<{ type: 'project.summary.refresh'; project: TProject }>
  | Readonly<{ type: 'project.reader.ready' }>
  | Readonly<{ type: 'editor.access.activate' | 'editor.access.suspend' }>
  | Readonly<{ type: 'project.operation'; operation: TProjectOperation }>
  | Readonly<{ type: 'project.access.error'; message: string }>
  | Readonly<{ type: 'project.access.recovery'; message: string }>
  | Readonly<{ type: 'project.sync.warning'; message: string }>
  | Readonly<{ type: 'project.local-copy.availability'; projectId: string; available: boolean }>
  | Readonly<{ type: 'project.access.retry' | 'project.access.force' }>

export type ControllerEvent<
  TDocument,
  TCommand,
  TPageCreateEvent extends Readonly<{ type: 'page.create' }>,
  TProject,
  TProjectOperation,
  TCompositionEvent extends Readonly<{ type: string }>,
> = ProjectControllerEvent<TDocument, TProject, TProjectOperation>
  | Readonly<{ type: 'document.apply'; command: TCommand; historyGroupKey?: string; recordHistory?: boolean }>
  | TPageCreateEvent
  | Readonly<{ type: 'page.select'; pageId: PageId }>
  | Readonly<{ type: 'chapter.select'; chapterId: ChapterId }>
  | Readonly<{ type: 'history.undo' | 'history.redo' }>
  | Readonly<{ type: 'import.cancel' }>
  | TCompositionEvent

export interface ProjectControllerSnapshotContext<TDocument, TSelection, TProject> {
  readonly document: TDocument
  readonly history: DocumentHistory<TDocument, TSelection>
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly activeProject: TProject | null
  readonly projects: readonly TProject[]
  readonly editAccess: 'waiting' | 'active'
  readonly documentChanges: Pick<readonly unknown[], 'length'>
}

export interface ProjectControllerSnapshot<TDocument, TSelection, TProject> {
  readonly context: ProjectControllerSnapshotContext<TDocument, TSelection, TProject>
}

/** Describes the XState actor operations used by project and persistence services. */
export interface ProjectControllerPort<TDocument, TSelection, TProject, TProjectOperation> {
  /** Sends one existing technical project or persistence event. */
  send(event: ProjectControllerEvent<TDocument, TProject, TProjectOperation>): void
  /** Reads the current actor-owned project and persistence state. */
  getSnapshot(): ProjectControllerSnapshot<TDocument, TSelection, TProject>
  /** Observes the same actor without keeping a second snapshot store. */
  subscribe(listener: (snapshot: ProjectControllerSnapshot<TDocument, TSelection, TProject>) => void): { unsubscribe(): void }
}

export type ControllerSelectionPageEvent = Readonly<{ type: 'page.select'; pageId: PageId }>
export type ControllerSelectionChapterEvent = Readonly<{ type: 'chapter.select'; chapterId: ChapterId }>
