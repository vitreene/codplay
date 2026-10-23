import type { Actor } from 'xstate'
import { ExclusiveSyncSession } from '@codplay/exclusive-sync'
import type { ConfirmedValue } from '@codplay/exclusive-sync'
import { createStableId, createInitialDocument, ElceDocument } from '../../domain/document/document-model'
import type { ElceDocument as ElceDocumentModel } from '../../domain/document/document-model'
import type { ElceProjectSummary } from '../../infrastructure/project-api/project-api-types'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'
import { ElceProjectApiClient, ElceProjectApiError } from '../../infrastructure/project-api/project-api-client'
import type { controllerMachine } from '../controller/controller-machine'
import { attachDocumentPersistence } from '../controller/document-persistence'
import type { AttachedDocumentPersistence } from '../controller/document-persistence'
import { ProjectEditorLock } from '../sync/project-editor-lock'
import { ProjectSyncCoordinator } from '../sync/project-sync-coordinator'
import type { ProjectSessionOperation, ProjectSessionPort, ProjectSessionResult } from './project-session-types'

const ACTIVE_PROJECT_SESSION_KEY = 'elce-active-project'
const EDIT_PAGE_SESSION_KEY = 'elce-edit-page-id'
const READER_REFRESH_MS = 2000

interface PreparedProject {
  readonly project: ElceProjectSummary
  readonly document: ElceDocumentModel
}

/** Coordinates the browser resources that follow the XState-owned active project. */
export class ProjectSessionCoordinator implements ProjectSessionPort {
  private readonly store: ElceDocumentStore
  private readonly api: ElceProjectApiClient
  private readonly session: Storage | null
  private pageId: string
  private readonly pageInstanceId: string
  private readonly identityReady: Promise<void>
  private readonly pageIdentityChannel: BroadcastChannel | null
  private controller: Actor<typeof controllerMachine> | null = null
  private sync: ProjectSyncCoordinator | null = null
  private persistence: AttachedDocumentPersistence | null = null
  private lock: ProjectEditorLock | null = null
  private activeProjectId: string | null = null
  private exclusive: ExclusiveSyncSession<ElceDocumentModel> | null = null
  private readerTimer: ReturnType<typeof setInterval> | null = null
  private readonly independentCopies = new Set<string>()
  private forceNextAcquire = false

  public constructor(
    store: ElceDocumentStore,
    api: ElceProjectApiClient = new ElceProjectApiClient(),
    session: Storage | null = typeof sessionStorage === 'undefined' ? null : sessionStorage,
  ) {
    this.store = store
    this.api = api
    this.session = session
    this.pageId = editPageId(session)
    this.pageInstanceId = crypto.randomUUID()
    this.pageIdentityChannel = typeof window === 'undefined' || typeof BroadcastChannel === 'undefined'
      ? null : new BroadcastChannel('elce-page-identities')
    this.pageIdentityChannel?.addEventListener('message', this.onPageIdentityMessage)
    this.identityReady = this.pageIdentityChannel === null ? Promise.resolve() : new Promise((resolve) => {
      this.pageIdentityChannel!.postMessage({ type: 'probe', pageId: this.pageId, senderId: this.pageInstanceId })
      setTimeout(resolve, 75)
    })
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
    _editAccess: 'waiting' | 'active',
    hadEditAccess: boolean,
  ): Promise<ProjectSessionResult> {
    switch (operation.kind) {
      case 'bootstrap':
        return this.bootstrap(operation.rememberedProjectId)
      case 'refresh':
        return this.projectList(activeProject, hadEditAccess)
      case 'create':
        return this.createProject(document, hadEditAccess)
      case 'save-as':
        return this.saveAs(document, activeProject, operation.name)
      case 'save-local-as':
        return this.saveLocalAs(activeProject, operation.name)
      case 'open':
        return this.openProject(operation.projectId, document, activeProject, hadEditAccess)
      case 'close':
        return this.closeProject(document, activeProject, hadEditAccess)
      case 'delete':
        return this.deleteProject(operation.projectId, document, activeProject, hadEditAccess)
    }
  }

  /** Starts access to the project after XState has installed its document. */
  public startLock(projectId: string): void {
    const controller = this.requireController()
    let confirmedCache: ConfirmedValue<ElceDocumentModel> | null = null
    let recoveredGrant = false
    this.exclusive = new ExclusiveSyncSession<ElceDocumentModel>({
      acquire: async () => {
        await this.identityReady
        if (this.independentCopies.has(projectId)) await this.createIndependentRemoteCopy(projectId)
        const grant = await this.api.acquireEditAccess(projectId, this.pageId, this.forceNextAcquire)
        this.forceNextAcquire = false
        recoveredGrant = grant?.recovered ?? false
        return grant
      },
      release: async () => this.api.releaseEditAccess(projectId),
      stillHeld: async () => {
        const held = await this.api.stillHasEditAccess(projectId)
        if (!held) this.api.forgetEditAccess(projectId)
        return held
      },
      readConfirmed: async () => {
        const summary = (await this.api.listProjects()).find((entry) => entry.id === projectId)
        if (summary === undefined) throw new Error('Ce projet n’existe plus sur le serveur.')
        if (confirmedCache?.revision === summary.revision) return confirmedCache
        const remote = await this.api.readProject(projectId)
        confirmedCache = { value: remote.document, revision: remote.revision }
        return confirmedCache
      },
      publishPending: async () => {
        if (recoveredGrant) {
          await this.sync?.suspend()
          this.persistence?.detach()
          this.persistence = null
          const remote = await this.api.readProject(projectId)
          await this.store.saveDocument(remote.document)
          await this.store.saveSyncState({
            documentId: projectId,
            remoteRevision: remote.revision,
            uploadedMediaIds: remote.document.medias.map((media) => media.id),
            status: 'synced',
          })
          confirmedCache = { value: remote.document, revision: remote.revision }
          await this.installConfirmedProject(projectId, confirmedCache)
          recoveredGrant = false
        }
        if (this.persistence === null) {
          const checkpoint = await this.store.loadSyncState(projectId)
          if (checkpoint.status === 'synced' && checkpoint.remoteRevision !== null) {
            const remote = await this.api.readProject(projectId)
            if (remote.revision !== checkpoint.remoteRevision) {
              await this.store.saveDocument(remote.document)
              await this.store.saveSyncState({
                documentId: projectId,
                remoteRevision: remote.revision,
                uploadedMediaIds: remote.document.medias.map((media) => media.id),
                status: 'synced',
              })
              await this.installConfirmedProject(projectId, { value: remote.document, revision: remote.revision })
            }
          }
          this.persistence = await attachDocumentPersistence(controller, this.store, {
            mediaSourceUrl: (documentId, mediaId) => this.api.mediaUrl(documentId, mediaId),
            onLocalSave: (nextDocument) => this.sync?.schedule(nextDocument),
          })
        }
        await waitForControllerQuiescence(controller)
        await this.persistence.flushLocalChanges()
        const document = controller.getSnapshot().context.document
        this.sync?.resume(document)
        await retryPublish(() => this.sync!.waitUntilCurrentDocumentSynced(() => this.persistence!.flushLocalChanges()))
        await this.refreshLocalCopyAvailability(projectId)
      },
      installConfirmed: async (confirmed) => this.installConfirmedProject(projectId, confirmed),
      setEditable: (editable) => controller.send({ type: editable ? 'editor.access.activate' : 'editor.access.suspend' }),
    })
    this.lock = new ProjectEditorLock(projectId, {
      onAccessWaiting: () => controller.send({ type: 'editor.access.suspend' }),
      onAccessPriorityRequest: async () => {
        if (this.activeProjectId !== projectId || this.independentCopies.has(projectId) || this.exclusive === null) return false
        await this.exclusive.refreshReader()
        const checkpoint = await this.store.loadSyncState(projectId)
        return checkpoint.status === 'synced' && checkpoint.remoteRevision !== null
      },
      onAccessGranted: async (force = false) => {
        this.forceNextAcquire = force
        try {
          return await this.exclusive?.requestEdit() ?? false
        } catch (error) {
          if (this.independentCopies.has(projectId) && isCopyRecoveryError(error)) {
            if (this.persistence === null) {
              this.persistence = await attachDocumentPersistence(controller, this.store, {
                mediaSourceUrl: (documentId, mediaId) => this.api.mediaUrl(documentId, mediaId),
                onLocalSave: (nextDocument) => this.sync?.schedule(nextDocument),
              })
            }
            controller.send({ type: 'editor.access.activate' })
            controller.send({ type: 'project.sync.warning', message: copyRecoveryMessage(error) })
            return true
          }
          await this.sync?.suspend()
          this.persistence?.detach()
          this.persistence = null
          try {
            const remote = await this.api.readProject(projectId)
            confirmedCache = { value: remote.document, revision: remote.revision }
          } catch { /* The last confirmed reader revision remains available offline. */ }
          if (confirmedCache !== null) await this.installConfirmedProject(projectId, confirmedCache)
          throw error
        }
      },
      onAccessSuspending: async () => {
        controller.send({ type: 'editor.access.suspend' })
        await this.exclusive?.yieldEdit()
        await this.sync?.suspend()
        this.persistence?.detach()
        this.persistence = null
      },
      onAccessHeartbeat: async () => this.api.renewEditAccess(projectId),
      onAccessLost: async () => {
        controller.send({ type: 'editor.access.suspend' })
        await this.persistence?.flushLocalChanges()
        this.persistence?.detach()
        this.persistence = null
        void this.sync?.suspend().catch((error: unknown) => {
          console.warn('La synchronisation Elcé n’a pas pu être suspendue après la perte du droit.', error)
        })
      },
      onAccessRecoveryRequired: (error) => {
        controller.send({ type: 'project.access.recovery', message: accessRecoveryMessage(error) })
      },
      onAccessError: (error) => {
        if (isExpectedAccessTransition(error)) return
        controller.send({ type: 'project.access.error', message: errorMessage(error) })
        void this.refreshLocalCopyAvailability(projectId).catch(() => undefined)
        console.error('Le verrou d’édition Elcé n’a pas pu être transféré.', error)
      },
    })
    this.lock.start()
    void this.refreshLocalCopyAvailability(projectId).catch(() => undefined)
    if (this.independentCopies.has(projectId)) controller.send({ type: 'project.reader.ready' })
    if (typeof window !== 'undefined') window.addEventListener('focus', this.onReaderFocus)
    if (typeof window !== 'undefined') window.addEventListener('online', this.onCopyOnline)
    this.readerTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (this.independentCopies.has(projectId)) return
      if (this.exclusive?.hasGrant()) return
      void this.exclusive?.refreshReader().catch((error: unknown) => {
        console.warn('La lecture du projet Elcé a échoué.', error)
      })
      if (typeof document !== 'undefined' && document.hasFocus()) this.lock?.retry()
    }, READER_REFRESH_MS)
    if (!this.independentCopies.has(projectId)) void this.exclusive.refreshReader().catch((error: unknown) => {
      console.warn('La première lecture du projet Elcé a échoué.', error)
    })
  }

  /** Loads a newer confirmed server revision after this editor regains focus. */
  public async refreshFromServerOnFocus(): Promise<void> {
    await this.exclusive?.refreshReader()
  }

  /** Rechecks the visible confirmed revision and requests editing again. */
  public retryAccess(): void {
    void this.exclusive?.refreshReader().catch((error: unknown) => {
      this.controller?.send({ type: 'project.access.error', message: errorMessage(error) })
    })
    this.lock?.retry()
  }

  /** Uses the temporary emergency path to replace a blocked project grant. */
  public forceAccess(): void {
    void this.lock?.forceAccess()
  }

  /** Releases browser resources when the tab closes. */
  public async dispose(): Promise<void> {
    this.pageIdentityChannel?.removeEventListener('message', this.onPageIdentityMessage)
    this.pageIdentityChannel?.close()
    this.stopReaderRefresh()
    await this.lock?.stop()
    this.lock = null
    this.exclusive = null
    this.persistence?.detach()
    this.persistence = null
    this.sync?.destroy()
    this.sync = null
    this.controller = null
  }

  /** Loads the server list and restores only this tab's remembered project. */
  private async bootstrap(rememberedProjectId: string | null): Promise<ProjectSessionResult> {
    let unsupportedRememberedCacheError: unknown = null
    if (rememberedProjectId !== null) {
      try {
        const cached = await this.store.loadDocument(rememberedProjectId)
        const checkpoint = await this.store.loadSyncState(rememberedProjectId)
        if (cached !== null && checkpoint.independentCopyOf !== undefined && checkpoint.status !== 'synced') {
          this.independentCopies.add(rememberedProjectId)
          this.activeProjectId = rememberedProjectId
          const project = { id: cached.id, name: cached.data.name, revision: checkpoint.remoteRevision ?? 0 }
          return result([project], project, cached, 'opening', 'waiting')
        }
      } catch (error) {
        if (!isUnsupportedDocumentCacheError(error)) {
          const projects = await this.api.listProjects()
          return result(projects, null, null, 'list', 'waiting', errorMessage(error))
        }
        unsupportedRememberedCacheError = error
      }
    }
    const projects = await this.api.listProjects()
    const remembered = rememberedProjectId === null ? null : projects.find((entry) => entry.id === rememberedProjectId) ?? null
    if (unsupportedRememberedCacheError !== null && remembered === null) {
      return result(projects, null, null, 'list', 'waiting', errorMessage(unsupportedRememberedCacheError))
    }
    const initialPocProject = projects.find((entry) => entry.id === 'elce-document') ?? null
    const target = remembered ?? initialPocProject
    if (target === null) return result(projects, null, null, 'list', 'waiting')
    let prepared: PreparedProject
    try {
      prepared = await this.prepareProject(target)
    } catch (error) {
      return result(projects, null, null, 'list', 'waiting', errorMessage(error))
    }
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

  /** Creates an independent local copy and lets its own session publish it. */
  private async saveAs(
    document: ElceDocumentModel,
    source: ElceProjectSummary | null,
    name: string,
    abandonSource = false,
  ): Promise<ProjectSessionResult> {
    if (source === null || name.trim().length === 0) throw new Error('Un projet source et un nom sont nécessaires pour enregistrer une copie.')
    if (document.id !== source.id) throw new Error('Le document affiché ne correspond pas au projet source.')
    const copy = ElceDocument.fromJSON({ ...document.toJSON(), id: createStableId('elce-document'), name: name.trim() })
    await this.store.saveDocument(copy)
    await this.store.saveSyncState({
      documentId: copy.id,
      remoteRevision: null,
      uploadedMediaIds: [],
      status: 'pending',
      independentCopyOf: source.id,
      mediaSourceProjectIds: Object.fromEntries(copy.medias.map((media) => [media.id, source.id])),
    })
    this.independentCopies.add(copy.id)
    if (abandonSource) {
      await this.sync?.suspend()
      await this.exclusive?.releaseAfterIndependentCopy()
    }
    await this.releaseCurrentProject(false)
    const project = { id: copy.id, name: copy.data.name, revision: 0 }
    this.rememberProject(copy.id)
    this.activeProjectId = copy.id
    const projects = this.requireController().getSnapshot().context.projects
    return result([...projects, project], project, copy, 'opening', 'waiting')
  }

  /** Preserves a pending local cache before deliberately releasing its source right. */
  private async saveLocalAs(source: ElceProjectSummary | null, name: string): Promise<ProjectSessionResult> {
    if (source === null) throw new Error('Aucun projet actif ne possède de copie locale à conserver.')
    const checkpoint = await this.store.loadSyncState(source.id)
    const local = await this.store.loadDocument(source.id)
    if (local === null || checkpoint.status === 'synced') throw new Error('Aucune modification locale en attente à enregistrer sous un nouveau nom.')
    return this.saveAs(local, source, name, true)
  }

  /** Prepares the target before releasing the current project, then changes lock. */
  private async openProject(
    projectId: string,
    document: ElceDocumentModel,
    activeProject: ElceProjectSummary | null,
    hadEditAccess: boolean,
  ): Promise<ProjectSessionResult> {
    const projects = await this.api.listProjects()
    const summary = projects.find((entry) => entry.id === projectId)
    if (summary === undefined) throw new Error('Ce projet n’existe plus sur le serveur.')
    if (this.activeProjectId === projectId && activeProject?.id === projectId) {
      return result(projects, summary, null, 'active', hadEditAccess ? 'active' : 'waiting')
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
    hadEditAccess: boolean,
  ): Promise<ProjectSessionResult> {
    if (activeProject === null || this.activeProjectId === null) {
      return this.projectList(null, false)
    }
    await this.ensureCurrentProjectSynced(document, hadEditAccess)
    const projects = await this.api.listProjects()
    await this.releaseCurrentProject(true)
    return result(projects, null, null, 'list', 'waiting')
  }

  /** Deletes on the server first and removes only the selected local cache. */
  private async deleteProject(
    projectId: string,
    document: ElceDocumentModel,
    activeProject: ElceProjectSummary | null,
    hadEditAccess: boolean,
  ): Promise<ProjectSessionResult> {
    const deletingActive = activeProject?.id === projectId
    if (deletingActive) await this.ensureCurrentProjectSynced(document, hadEditAccess)
    await this.identityReady
    const temporaryGrant = deletingActive ? null : await this.api.acquireEditAccess(projectId, this.pageId)
    if (!deletingActive && temporaryGrant === null) throw new Error('Ce projet est en cours d’édition dans une autre page.')
    let deletedOnServer = false
    try {
      await this.api.deleteProject(projectId)
      deletedOnServer = true
    } finally {
      if (temporaryGrant !== null) {
        if (deletedOnServer) this.api.forgetEditAccess(projectId)
        else await this.api.releaseEditAccess(projectId)
      }
    }
    if (deletingActive) await this.releaseCurrentProject(true)
    else {
      await this.store.deleteDocument(projectId)
      if (this.rememberedProjectId() === projectId) this.forgetProject()
    }
    const projects = (await this.api.listProjects()).filter((entry) => entry.id !== projectId)
    if (deletingActive) return result(projects, null, null, 'list', 'waiting')
    return result(projects, activeProject, null, activeProject === null ? 'list' : 'active', hadEditAccess ? 'active' : 'waiting')
  }

  /** Loads the confirmed revision while preserving any unpublished local copy. */
  private async prepareProject(summary: ElceProjectSummary): Promise<PreparedProject> {
    let cached: ElceDocumentModel | null
    try {
      cached = await this.store.loadDocument(summary.id)
    } catch (error) {
      if (!isUnsupportedDocumentCacheError(error)) throw error

      const remote = await this.api.readProject(summary.id)
      await this.store.deleteDocument(summary.id)
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

    const checkpoint = await this.store.loadSyncState(summary.id)
    if (cached !== null && checkpoint.independentCopyOf !== undefined) {
      this.independentCopies.add(summary.id)
      return { project: { ...summary, name: cached.data.name }, document: cached }
    }
    if (cached !== null && checkpoint.status === 'synced' && checkpoint.remoteRevision === summary.revision) {
      return { project: { ...summary, name: cached.data.name }, document: cached }
    }

    const remote = await this.api.readProject(summary.id)
    if (cached !== null && checkpoint.status === 'synced' && checkpoint.remoteRevision === remote.revision) {
      return { project: { ...summary, name: cached.data.name, revision: remote.revision }, document: cached }
    }
    if (cached === null || checkpoint.status === 'synced') {
      await this.store.saveDocument(remote.document)
      await this.store.saveSyncState({
        documentId: remote.document.id,
        remoteRevision: remote.revision,
        uploadedMediaIds: remote.document.medias.map((media) => media.id),
        status: 'synced',
      })
    }
    return {
      project: { ...summary, name: remote.document.data.name, revision: remote.revision },
      document: remote.document,
    }
  }

  /** Waits for network acknowledgement while keeping the current lock intact. */
  private async ensureCurrentProjectSynced(document: ElceDocumentModel, shouldWait: boolean): Promise<void> {
    if (this.activeProjectId === null) return
    if (shouldWait) {
      const sync = this.sync
      if (sync === null) {
        await this.persistence?.flushLocalChanges()
        return
      }
      await sync.waitUntilCurrentDocumentSynced(async () => {
        await this.persistence?.flushLocalChanges()
      })
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
    this.stopReaderRefresh()
    await this.lock?.stop()
    this.lock = null
    this.exclusive = null
    await this.sync?.suspend()
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

  /** Installs a confirmed revision through the existing actor without publishing it. */
  private async installConfirmedProject(projectId: string, confirmed: ConfirmedValue<ElceDocumentModel>): Promise<void> {
    const controller = this.requireController()
    if (this.activeProjectId !== projectId) return
    const current = controller.getSnapshot().context.document
    const same = JSON.stringify(current.toJSON()) === JSON.stringify(confirmed.value.toJSON())
    if (!same) {
      if (this.persistence !== null) {
        await this.store.saveDocument(confirmed.value)
        await this.persistence.installServerDocument(confirmed.value, confirmed.value.medias.map((media) => media.id))
      } else {
        controller.send({ type: 'document.replace', document: confirmed.value })
      }
    }
    if (this.persistence === null) {
      for (const media of confirmed.value.medias) {
        controller.send({ type: 'media.source.register', mediaId: media.id, source: this.api.mediaUrl(projectId, media.id) })
      }
    }
    controller.send({ type: 'project.summary.refresh', project: {
      id: projectId, name: confirmed.value.data.name, revision: confirmed.revision,
    } })
    controller.send({ type: 'project.reader.ready' })
    controller.send({ type: 'document.sync.status', status: 'synced' })
  }

  /** Projects whether an unpublished local cache can be saved under a new project identity. */
  private async refreshLocalCopyAvailability(projectId: string): Promise<void> {
    if (this.activeProjectId !== projectId) return
    const [local, checkpoint] = await Promise.all([
      this.store.loadDocument(projectId),
      this.store.loadSyncState(projectId),
    ])
    this.controller?.send({
      type: 'project.local-copy.availability', projectId,
      available: local !== null && checkpoint.status !== 'synced',
    })
  }

  /** Stops the reader poll when its project closes or the coordinator is disposed. */
  private stopReaderRefresh(): void {
    if (this.readerTimer !== null) clearInterval(this.readerTimer)
    this.readerTimer = null
    if (typeof window !== 'undefined') window.removeEventListener('focus', this.onReaderFocus)
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onCopyOnline)
  }

  /** Refreshes the confirmed reader immediately when the page regains focus. */
  private readonly onReaderFocus = (): void => {
    if (this.activeProjectId !== null && this.independentCopies.has(this.activeProjectId)) return
    void this.exclusive?.refreshReader().catch((error: unknown) => {
      console.warn('La lecture du projet Elcé a échoué.', error)
    })
  }

  /** Retries publishing a local rescue copy through its normal exclusive session. */
  private readonly onCopyOnline = (): void => {
    const projectId = this.activeProjectId
    const controller = this.controller
    if (projectId === null || controller === null || !this.independentCopies.has(projectId)
      || controller.getSnapshot().context.editAccess !== 'active') return
    controller.send({ type: 'editor.access.suspend' })
    void this.exclusive?.requestEdit().catch((error: unknown) => {
      if (isCopyRecoveryError(error)) {
        controller.send({ type: 'editor.access.activate' })
        controller.send({ type: 'project.sync.warning', message: copyRecoveryMessage(error) })
      }
      else controller.send({ type: 'project.access.error', message: errorMessage(error) })
    })
  }

  /** Rejects a session-storage identity copied into a second living tab. */
  private readonly onPageIdentityMessage = (event: MessageEvent<unknown>): void => {
    const message = event.data
    if (typeof message !== 'object' || message === null) return
    const value = message as Record<string, unknown>
    if (value.type === 'probe' && value.pageId === this.pageId && value.senderId !== this.pageInstanceId) {
      this.pageIdentityChannel?.postMessage({ type: 'occupied', pageId: this.pageId, recipientId: value.senderId })
    }
    if (value.type === 'occupied' && value.pageId === this.pageId && value.recipientId === this.pageInstanceId) {
      this.pageId = crypto.randomUUID()
      this.session?.setItem(EDIT_PAGE_SESSION_KEY, this.pageId)
    }
  }

  /** Creates a new remote identity before attempting its independent edit grant. */
  private async createIndependentRemoteCopy(projectId: string): Promise<void> {
    const checkpoint = await this.store.loadSyncState(projectId)
    if (checkpoint.remoteRevision !== null) return
    const copy = await this.store.loadDocument(projectId)
    if (copy === null) throw new Error('La copie locale à enregistrer est introuvable.')
    let revision: number
    try {
      revision = await this.api.createProject(copy)
    } catch (error) {
      if (!(error instanceof ElceProjectApiError) || error.code !== 'project_already_exists') throw error
      const remote = await this.api.readProject(projectId)
      if (JSON.stringify(remote.document.toJSON()) !== JSON.stringify(copy.toJSON())) throw new Error('La copie distante ne correspond pas à la copie locale.')
      revision = remote.revision
    }
    await this.store.saveSyncState({ ...checkpoint, remoteRevision: revision, status: 'pending' })
  }
}

/** Limits local copy editing to recoverable network or missing-source-media failures. */
function isCopyRecoveryError(error: unknown): boolean {
  return error instanceof TypeError
    || error instanceof ElceProjectApiError && error.code === 'source_media_unavailable'
    || error instanceof Error && /network|fetch|média local/.test(error.message.toLowerCase())
}

/** Explains why a rescue copy remains local while preserving its editability. */
function copyRecoveryMessage(error: unknown): string {
  if (error instanceof ElceProjectApiError && error.code === 'source_media_unavailable') {
    return `Le média ${error.mediaId ?? ''} est introuvable dans le projet source. Remplacez-le dans cette copie pour terminer la synchronisation.`
  }
  if (error instanceof TypeError) return 'Réseau indisponible : cette copie reste locale jusqu’au retour de la connexion.'
  return errorMessage(error)
}

/** Reuses the page identity only for a recognized reload of this tab. */
function editPageId(session: Storage | null): string {
  const navigation = typeof performance === 'undefined' ? null : performance.getEntriesByType('navigation')[0]
  const reload = navigation != null && 'type' in navigation && navigation.type === 'reload'
  const previous = reload ? session?.getItem(EDIT_PAGE_SESSION_KEY) : null
  const id = previous ?? crypto.randomUUID()
  session?.setItem(EDIT_PAGE_SESSION_KEY, id)
  return id
}

/** Identifies a local cache format error that can be recovered from the server. */
function isUnsupportedDocumentCacheError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('Version de document Elcé non supportée :')
}

/** Retries transient publication failures without repeating a confirmed conflict. */
async function retryPublish(publish: () => Promise<void>): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await publish()
      return
    } catch (error) {
      if (error instanceof ElceProjectApiError
        && ['revision_mismatch', 'edit_access_lost', 'source_media_unavailable'].includes(error.code)) throw error
      if (error instanceof Error && /conflit/.test(error.message)) throw error
      lastError = error
      if (attempt < 2) await new Promise<void>((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
    }
  }
  throw lastError
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
  projectError: string | null = null,
): ProjectSessionResult {
  return { projects, activeProject, document, status, editAccess, projectError }
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
  if (error instanceof ElceProjectApiError) {
    switch (error.code) {
      case 'revision_mismatch':
        return 'Une version plus récente existe sur le serveur. Fermez l’autre édition avant de réessayer, ou enregistrez la copie locale sous un autre nom.'
      case 'edit_access_lost':
        return 'Cette page a perdu son droit d’édition. Réessayez l’accès ou enregistrez la copie locale sous un autre nom.'
      case 'edit_access_occupied':
        return 'Une autre page édite ce projet. Fermez cette édition, puis réessayez, ou utilisez « Enregistrer sous… ».'
    }
  }
  if (error instanceof TypeError) {
    return 'Le serveur est injoignable. Réessayez l’accès lorsque la connexion revient, ou utilisez « Enregistrer sous… ».'
  }
  return error instanceof Error ? error.message : String(error)
}

/** Recognizes ordinary access changes that should not be presented as errors. */
function isExpectedAccessTransition(error: unknown): boolean {
  if (error instanceof ElceProjectApiError) {
    return error.code === 'edit_access_lost' || error.code === 'edit_access_occupied'
  }
  return error instanceof Error && (error.message === 'edit_access_lost' || error.message === 'edit_access_occupied')
}

/** Replaces internal access codes with a recovery message after repeated requests. */
function accessRecoveryMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'edit_access_wait_timeout') {
    return 'L’accès attend toujours la libération du verrou d’un autre onglet.'
  }
  if (isExpectedAccessTransition(error)) {
    return 'L’accès n’a pas pu être repris après plusieurs tentatives.'
  }
  return errorMessage(error)
}
