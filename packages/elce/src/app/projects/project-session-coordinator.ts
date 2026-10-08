import type { Actor } from 'xstate'
import { createStableId, createInitialDocument, ElceDocument } from '../../domain/document/document-model'
import type { ElceDocument as ElceDocumentModel } from '../../domain/document/document-model'
import type { ElceProjectSummary } from '../../infrastructure/project-api/project-api-types'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import type { controllerMachine } from '../controller/controller-machine'
import { attachDocumentPersistence } from '../controller/document-persistence'
import type { AttachedDocumentPersistence } from '../controller/document-persistence'
import { ProjectEditorLock } from '../sync/project-editor-lock'
import { ProjectSyncCoordinator } from '../sync/project-sync-coordinator'
import type { ProjectSessionOperation, ProjectSessionPort, ProjectSessionResult } from './project-session-types'

const ACTIVE_PROJECT_SESSION_KEY = 'elce-active-project'

interface PreparedProject {
  readonly project: ElceProjectSummary
  readonly document: ElceDocumentModel
}

/** Coordinates the browser resources that follow the XState-owned active project. */
export class ProjectSessionCoordinator implements ProjectSessionPort {
  private readonly store: ElceDocumentStore
  private readonly api: ElceProjectApiClient
  private readonly session: Storage | null
  private controller: Actor<typeof controllerMachine> | null = null
  private sync: ProjectSyncCoordinator | null = null
  private persistence: AttachedDocumentPersistence | null = null
  private lock: ProjectEditorLock | null = null
  private activeProjectId: string | null = null

  public constructor(
    store: ElceDocumentStore,
    api: ElceProjectApiClient = new ElceProjectApiClient(),
    session: Storage | null = typeof sessionStorage === 'undefined' ? null : sessionStorage,
  ) {
    this.store = store
    this.api = api
    this.session = session
  }

  /** Reads the project previously selected in this browser tab. */
  public rememberedProjectId(): string | null {
    return this.session?.getItem(ACTIVE_PROJECT_SESSION_KEY) ?? null
  }

  /** Attaches the single application actor before any project event is sent. */
  public async attach(controller: Actor<typeof controllerMachine>): Promise<void> {
    this.controller = controller
    this.sync = new ProjectSyncCoordinator(controller, this.store, this.api)
    await this.sync.suspend()
  }

  /** Executes one project operation requested through the application actor. */
  public async perform(
    operation: ProjectSessionOperation,
    document: ElceDocumentModel,
    activeProject: ElceProjectSummary | null,
    editAccess: 'waiting' | 'active',
    hadEditAccess: boolean,
  ): Promise<ProjectSessionResult> {
    switch (operation.kind) {
      case 'bootstrap':
        return this.bootstrap(operation.rememberedProjectId)
      case 'refresh':
        return this.projectList(activeProject, hadEditAccess)
      case 'create':
        return this.createProject(document, editAccess === 'active')
      case 'open':
        return this.openProject(operation.projectId, document, activeProject, editAccess, hadEditAccess)
      case 'close':
        return this.closeProject(document, activeProject, editAccess)
      case 'delete':
        return this.deleteProject(operation.projectId, document, activeProject, editAccess, hadEditAccess)
    }
  }

  /** Starts access to the project after XState has installed its document. */
  public startLock(projectId: string): void {
    const controller = this.requireController()
    this.lock = new ProjectEditorLock(projectId, {
      onAccessWaiting: () => controller.send({ type: 'editor.access.suspend' }),
      onAccessGranted: async () => {
        if (this.persistence === null) {
          this.persistence = await attachDocumentPersistence(controller, this.store, {
            mediaSourceUrl: (documentId, mediaId) => this.api.mediaUrl(documentId, mediaId),
            onLocalSave: (nextDocument) => this.sync?.schedule(nextDocument),
          })
        } else {
          await this.persistence.restoreCurrentDocument()
        }
        controller.send({ type: 'editor.access.activate' })
        this.sync?.resume(controller.getSnapshot().context.document)
      },
      onAccessSuspending: async () => {
        controller.send({ type: 'editor.access.suspend' })
        await this.sync?.suspend()
        await waitForControllerQuiescence(controller)
        await this.persistence?.flushLocalChanges()
      },
      onAccessError: (error) => {
        controller.send({ type: 'project.access.error', message: errorMessage(error) })
        console.error('Le verrou d’édition Elcé n’a pas pu être transféré.', error)
      },
    })
    this.lock.start()
  }

  /** Releases browser resources when the tab closes. */
  public async dispose(): Promise<void> {
    await this.lock?.stop()
    this.lock = null
    this.persistence?.detach()
    this.persistence = null
    this.sync?.destroy()
    this.sync = null
    this.controller = null
  }

  /** Loads the server list and restores only this tab's remembered project. */
  private async bootstrap(rememberedProjectId: string | null): Promise<ProjectSessionResult> {
    const projects = await this.api.listProjects()
    const remembered = rememberedProjectId === null ? null : projects.find((entry) => entry.id === rememberedProjectId) ?? null
    const initialPocProject = projects.find((entry) => entry.id === 'elce-document') ?? null
    const target = remembered ?? initialPocProject
    if (target === null) return result(projects, null, null, 'list', 'waiting')
    const prepared = await this.prepareProject(target)
    this.rememberProject(prepared.project.id)
    this.activeProjectId = prepared.project.id
    return result(
      projects.map((entry) => entry.id === prepared.project.id ? prepared.project : entry),
      prepared.project,
      prepared.document,
      'opening',
      'waiting',
    )
  }

  /** Refreshes the server list without changing the active document or lock. */
  private async projectList(activeProject: ElceProjectSummary | null, hadEditAccess: boolean): Promise<ProjectSessionResult> {
    const projects = await this.api.listProjects()
    const active = activeProject === null ? null : projects.find((entry) => entry.id === activeProject.id) ?? activeProject
    return result(projects, active, null, active === null ? 'list' : 'active', hadEditAccess ? 'active' : 'waiting')
  }

  /** Creates a fresh server project and switches only after the current one is saved. */
  private async createProject(document: ElceDocumentModel, hadEditAccess: boolean): Promise<ProjectSessionResult> {
    await this.ensureCurrentProjectSynced(document, hadEditAccess)
    const projects = await this.api.listProjects()
    const newDocument = createProjectDocument(projects)
    const revision = await this.api.createProject(newDocument)
    await this.store.saveDocument(newDocument)
    await this.store.saveSyncState({
      documentId: newDocument.id,
      remoteRevision: revision,
      uploadedMediaIds: [],
      status: 'synced',
    })
    await this.releaseCurrentProject(false)
    const project = { id: newDocument.id, name: newDocument.data.name, revision }
    const nextProjects = [...projects.filter((entry) => entry.id !== project.id), project]
    this.rememberProject(project.id)
    this.activeProjectId = project.id
    return result(nextProjects, project, newDocument, 'opening', 'waiting')
  }

  /** Prepares the target before releasing the current project, then changes lock. */
  private async openProject(
    projectId: string,
    document: ElceDocumentModel,
    activeProject: ElceProjectSummary | null,
    editAccess: 'waiting' | 'active',
    hadEditAccess: boolean,
  ): Promise<ProjectSessionResult> {
    const projects = await this.api.listProjects()
    const summary = projects.find((entry) => entry.id === projectId)
    if (summary === undefined) throw new Error('Ce projet n’existe plus sur le serveur.')
    if (this.activeProjectId === projectId && activeProject?.id === projectId) {
      return result(projects, summary, null, 'active', hadEditAccess ? 'active' : editAccess)
    }

    const prepared = await this.prepareProject(summary)
    await this.ensureCurrentProjectSynced(document, hadEditAccess)
    await this.releaseCurrentProject(false)
    this.rememberProject(projectId)
    this.activeProjectId = projectId
    return result(projects, prepared.project, prepared.document, 'opening', 'waiting')
  }

  /** Saves the active project before returning to the server project list. */
  private async closeProject(
    document: ElceDocumentModel,
    activeProject: ElceProjectSummary | null,
    editAccess: 'waiting' | 'active',
  ): Promise<ProjectSessionResult> {
    if (activeProject === null || this.activeProjectId === null) {
      return this.projectList(null, false)
    }
    await this.ensureCurrentProjectSynced(document, editAccess === 'active')
    const projects = await this.api.listProjects()
    await this.releaseCurrentProject(true)
    return result(projects, null, null, 'list', 'waiting')
  }

  /** Deletes on the server first and removes only the selected local cache. */
  private async deleteProject(
    projectId: string,
    document: ElceDocumentModel,
    activeProject: ElceProjectSummary | null,
    editAccess: 'waiting' | 'active',
    hadEditAccess: boolean,
  ): Promise<ProjectSessionResult> {
    const deletingActive = activeProject?.id === projectId
    if (deletingActive) await this.ensureCurrentProjectSynced(document, editAccess === 'active')
    await this.api.deleteProject(projectId)
    if (deletingActive) await this.releaseCurrentProject(true)
    else await this.store.deleteDocument(projectId)
    const projects = (await this.api.listProjects()).filter((entry) => entry.id !== projectId)
    if (deletingActive) return result(projects, null, null, 'list', 'waiting')
    return result(projects, activeProject, null, activeProject === null ? 'list' : 'active', hadEditAccess ? 'active' : editAccess)
  }

  /** Chooses a confirmed local copy or refreshes it from the server. */
  private async prepareProject(summary: ElceProjectSummary): Promise<PreparedProject> {
    const cached = await this.store.loadDocument(summary.id)
    const checkpoint = await this.store.loadSyncState(summary.id)
    if (cached !== null && (checkpoint.status === 'pending' || checkpoint.status === 'conflict')) {
      return { project: { ...summary, name: cached.data.name }, document: cached }
    }

    const remote = await this.api.readProject(summary.id)
    if (cached !== null && checkpoint.remoteRevision === remote.revision) {
      return { project: { ...summary, name: cached.data.name, revision: remote.revision }, document: cached }
    }

    await this.store.saveDocument(remote.document)
    await this.store.saveSyncState({
      documentId: remote.document.id,
      remoteRevision: remote.revision,
      uploadedMediaIds: remote.document.medias.map((media) => media.id),
      status: 'synced',
    })
    return {
      project: { ...summary, name: remote.document.data.name, revision: remote.revision },
      document: remote.document,
    }
  }

  /** Waits for network acknowledgement while keeping the current lock intact. */
  private async ensureCurrentProjectSynced(document: ElceDocumentModel, shouldWait: boolean): Promise<void> {
    if (this.activeProjectId === null) return
    if (shouldWait) {
      await this.persistence?.flushLocalChanges()
      await this.sync?.waitUntilCurrentDocumentSynced()
      return
    }
    const checkpoint = await this.store.loadSyncState(document.id)
    if (checkpoint.status !== 'synced' || checkpoint.remoteRevision === null) {
      throw new Error('Le projet courant doit reprendre son accès avant de pouvoir être changé.')
    }
  }

  /** Suspends and detaches the current project's browser resources. */
  private async releaseCurrentProject(deleteCache: boolean): Promise<void> {
    const projectId = this.activeProjectId
    if (projectId === null) return
    await this.sync?.suspend()
    await this.lock?.stop()
    this.lock = null
    this.persistence?.detach()
    this.persistence = null
    if (deleteCache) await this.store.deleteDocument(projectId)
    this.activeProjectId = null
    this.forgetProject()
  }

  /** Requires the actor that owns the application's XState state. */
  private requireController(): Actor<typeof controllerMachine> {
    if (this.controller === null) throw new Error('Le contrôleur Elcé n’est pas raccordé au gestionnaire de projets.')
    return this.controller
  }

  /** Stores the active project for this tab without sharing it with other tabs. */
  private rememberProject(projectId: string): void {
    this.session?.setItem(ACTIVE_PROJECT_SESSION_KEY, projectId)
  }

  /** Clears this tab's project selection after an explicit close or deletion. */
  private forgetProject(): void {
    this.session?.removeItem(ACTIVE_PROJECT_SESSION_KEY)
  }
}

/** Creates the default editable document with a new project identity and name. */
function createProjectDocument(projects: readonly ElceProjectSummary[]): ElceDocumentModel {
  const usedNames = new Set(projects.map((project) => project.name))
  let index = 1
  while (usedNames.has(`Projet ${index}`)) index += 1
  const initial = createInitialDocument().toJSON()
  return ElceDocument.fromJSON({ ...initial, id: createStableId('elce-document'), name: `Projet ${index}` })
}

/** Builds the actor result for a completed project operation. */
function result(
  projects: readonly ElceProjectSummary[],
  activeProject: ElceProjectSummary | null,
  document: ElceDocumentModel | null,
  status: ProjectSessionResult['status'],
  editAccess: ProjectSessionResult['editAccess'],
): ProjectSessionResult {
  return { projects, activeProject, document, status, editAccess }
}

/** Waits for imports and local writes to settle before a lock handoff. */
function waitForControllerQuiescence(controller: Actor<typeof controllerMachine>): Promise<void> {
  const isQuiescent = () => controller.getSnapshot().context.editAccess === 'waiting'
    && controller.getSnapshot().context.documentChanges.length === 0
  if (isQuiescent()) return Promise.resolve()

  return new Promise((resolve) => {
    const subscription = controller.subscribe(() => {
      if (!isQuiescent()) return
      subscription.unsubscribe()
      resolve()
    })
  })
}

/** Converts browser and network failures to a short user-facing message. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
