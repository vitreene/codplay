import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'
import { createInitialDocument, ElceDocument } from '../../domain/document/document-model'
import type { ElceDocument as ElceDocumentModel } from '../../domain/document/document-model'
import type { ElceProjectSummary } from '../../infrastructure/project-api/project-api-types'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import type { DocumentSyncState, ElceDocumentStore, MediaBlob } from '../../infrastructure/indexed-db/document-store-types'
import { ProjectSyncCoordinator } from '../sync/project-sync-coordinator'
import { attachDocumentPersistence } from './document-persistence'
import type { AttachedDocumentPersistence } from './document-persistence'
import type { ProjectSessionOperation, ProjectSessionPort, ProjectSessionResult } from '../projects/project-session-types'
import { controllerMachine } from './controller-machine'

interface ProjectSessionInvocation {
  readonly operation: ProjectSessionOperation
  readonly document: ElceDocumentModel
  readonly activeProject: ElceProjectSummary | null
  readonly editAccess: 'waiting' | 'active'
  readonly hadEditAccess: boolean
}

class ProjectSessionFixture implements ProjectSessionPort {
  public result: ProjectSessionResult = {
    projects: [],
    activeProject: null,
    document: null,
    status: 'list',
    editAccess: 'waiting',
  }
  public failure: Error | null = null
  public readonly operations: ProjectSessionOperation[] = []
  public readonly calls: ProjectSessionInvocation[] = []
  public readonly startedLocks: string[] = []
  public performHandler: ((invocation: ProjectSessionInvocation) => Promise<ProjectSessionResult>) | null = null

  public rememberedProjectId(): string | null {
    return null
  }

  /** Records the active document supplied to the serialized project operation. */
  public async perform(
    operation: ProjectSessionOperation,
    document: ElceDocumentModel,
    activeProject: ElceProjectSummary | null,
    editAccess: 'waiting' | 'active',
    hadEditAccess: boolean,
  ): Promise<ProjectSessionResult> {
    this.operations.push(operation)
    const invocation = { operation, document, activeProject, editAccess, hadEditAccess }
    this.calls.push(invocation)
    if (this.performHandler !== null) return this.performHandler(invocation)
    if (this.failure !== null) throw this.failure
    return this.result
  }

  public startLock(projectId: string): void {
    this.startedLocks.push(projectId)
  }

  public async dispose(): Promise<void> {}
}

/** Holds one local document write so a project operation must wait for it. */
class DeferredDocumentStore implements ElceDocumentStore {
  public readonly documents = new Map<string, ElceDocumentModel>()
  public readonly checkpoints = new Map<string, DocumentSyncState>()
  public readonly media = new Map<string, Blob>()
  public deferNextSave = false
  public pendingSave: { readonly document: ElceDocumentModel; readonly resolve: () => void } | null = null

  /** Loads only the cache entry matching the requested project. */
  public async loadDocument(documentId: string): Promise<ElceDocumentModel | null> {
    return this.documents.get(documentId) ?? null
  }

  /** Saves a document and marks it pending unless the test is holding this write. */
  public async saveDocument(document: ElceDocumentModel): Promise<void> {
    if (!this.deferNextSave) {
      this.persistDocument(document)
      return
    }
    this.deferNextSave = false
    await new Promise<void>((resolve) => {
      this.pendingSave = {
        document,
        resolve: () => {
          this.persistDocument(document)
          this.pendingSave = null
          resolve()
        },
      }
    })
  }

  /** Saves one document and removes its obsolete media in the same operation. */
  public async saveDocumentAndDeleteMedia(document: ElceDocumentModel, mediaIds: readonly string[]): Promise<void> {
    this.persistDocument(document)
    for (const mediaId of mediaIds) this.media.delete(mediaId)
  }

  /** Removes only the requested project cache and checkpoint. */
  public async deleteDocument(documentId: string): Promise<void> {
    this.documents.delete(documentId)
    this.checkpoints.delete(documentId)
  }

  /** Removes the requested local media blobs. */
  public async deleteMedia(mediaIds: readonly string[]): Promise<void> {
    for (const mediaId of mediaIds) this.media.delete(mediaId)
  }

  /** Loads the project's last known server revision and pending status. */
  public async loadSyncState(documentId: string): Promise<DocumentSyncState> {
    return this.checkpoints.get(documentId) ?? {
      documentId,
      remoteRevision: null,
      uploadedMediaIds: [],
      status: 'pending',
    }
  }

  /** Saves the project's sync checkpoint. */
  public async saveSyncState(state: DocumentSyncState): Promise<void> {
    this.checkpoints.set(state.documentId, state)
  }

  /** Persists the imported media bytes by their stable media identity. */
  public async saveMedia(media: MediaBlob): Promise<void> {
    this.media.set(media.id, media.blob)
  }

  /** Loads media bytes only from the requested project cache. */
  public async loadMedia(mediaId: string): Promise<Blob | null> {
    return this.media.get(mediaId) ?? null
  }

  /** Commits a cached document and marks its remote copy as pending. */
  private persistDocument(document: ElceDocumentModel): void {
    this.documents.set(document.id, document)
    const previous = this.checkpoints.get(document.id)
    this.checkpoints.set(document.id, {
      documentId: document.id,
      remoteRevision: previous?.remoteRevision ?? null,
      uploadedMediaIds: previous?.uploadedMediaIds ?? [],
      status: 'pending',
    })
  }
}

describe('Elcé project operations in the application actor', () => {
  it('loads an empty server list without creating or activating the temporary document', async () => {
    const session = new ProjectSessionFixture()
    const actor = createActor(controllerMachine, { input: { projectSession: session } })
    actor.start()
    const temporaryDocumentId = actor.getSnapshot().context.document.id

    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await flushActor()

    expect(session.operations).toEqual([{ kind: 'bootstrap', rememberedProjectId: null }])
    expect(actor.getSnapshot().context.document.id).toBe(temporaryDocumentId)
    expect(actor.getSnapshot().context.activeProject).toBeNull()
    expect(actor.getSnapshot().context.projectStatus).toBe('list')
    expect(actor.getSnapshot().context.editAccess).toBe('waiting')
    expect(actor.getSnapshot().value).toBe('suspended')
    expect(session.startedLocks).toEqual([])
    actor.stop()
  })

  it('replaces the document before starting its project lock', async () => {
    const session = new ProjectSessionFixture()
    const project = { id: 'project-b', name: 'Projet B', revision: 4 } satisfies ElceProjectSummary
    const document = renamedDocument('project-b', 'Projet B')
    session.result = {
      projects: [project],
      activeProject: project,
      document,
      status: 'opening',
      editAccess: 'waiting',
    }
    const actor = createActor(controllerMachine, { input: { projectSession: session } })
    actor.start()

    actor.send({ type: 'project.operation', operation: { kind: 'open', projectId: project.id } })
    await flushActor()

    expect(actor.getSnapshot().context.document).toBe(document)
    expect(actor.getSnapshot().context.activeProject).toEqual(project)
    expect(actor.getSnapshot().context.projectStatus).toBe('opening')
    expect(session.startedLocks).toEqual([project.id])
    expect(actor.getSnapshot().value).toBe('suspended')

    actor.send({ type: 'editor.access.activate' })
    expect(actor.getSnapshot().context.projectStatus).toBe('active')
    expect(actor.getSnapshot().value).toBe('ready')
    actor.stop()
  })

  it('keeps the current document and edit access when a project request fails', async () => {
    const session = new ProjectSessionFixture()
    const currentProject = { id: 'current-project', name: 'Courant', revision: 2 } satisfies ElceProjectSummary
    const currentDocument = renamedDocument(currentProject.id, currentProject.name)
    session.result = {
      projects: [currentProject],
      activeProject: currentProject,
      document: currentDocument,
      status: 'opening',
      editAccess: 'waiting',
    }
    const actor = createActor(controllerMachine, { input: { projectSession: session } })
    actor.start()
    actor.send({ type: 'project.operation', operation: { kind: 'open', projectId: currentProject.id } })
    await flushActor()
    actor.send({ type: 'editor.access.activate' })
    session.failure = new Error('Serveur indisponible')
    actor.send({ type: 'project.operation', operation: { kind: 'open', projectId: 'target-project' } })
    await flushActor()

    expect(actor.getSnapshot().context.document.id).toBe(currentProject.id)
    expect(actor.getSnapshot().context.activeProject).toEqual(currentProject)
    expect(actor.getSnapshot().context.projectError).toBe('Serveur indisponible')
    expect(actor.getSnapshot().context.editAccess).toBe('active')
    expect(actor.getSnapshot().value).toBe('ready')
    actor.stop()
  })

  it.each([
    { kind: 'conflict', label: 'a sync conflict', error: 'Le document présente un conflit avec sa version serveur.' },
    { kind: 'network', label: 'a network error', error: 'Network unavailable' },
  ])('persists an in-flight edit and keeps the current project open after $label', async ({ kind, error }) => {
    const currentProject = { id: 'current-project', name: 'Courant', revision: 0 } satisfies ElceProjectSummary
    const targetProject = { id: 'target-project', name: 'Cible', revision: 0 } satisfies ElceProjectSummary
    const currentDocument = renamedDocument(currentProject.id, currentProject.name)
    const remoteDocument = renamedDocument(currentProject.id, 'Modifié sur le serveur')
    const store = new DeferredDocumentStore()
    store.documents.set(currentDocument.id, currentDocument)
    store.checkpoints.set(currentDocument.id, {
      documentId: currentDocument.id,
      remoteRevision: 0,
      uploadedMediaIds: [],
      status: 'synced',
    })
    const request = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(input.toString())
      if (init?.method === 'PUT') {
        if (kind === 'network') throw new Error(error)
        return Response.json({ error: 'revision_mismatch' }, { status: 412 })
      }
      if (url.pathname === `/api/projects/${currentProject.id}`) {
        return Response.json({
          project: { ...currentProject, name: remoteDocument.data.name, revision: 1 },
          document: remoteDocument.toJSON(),
        }, { headers: { ETag: '"1"' } })
      }
      throw new Error(`Requête inattendue : ${init?.method ?? 'GET'} ${url.pathname}`)
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const session = new ProjectSessionFixture()
    session.result = {
      projects: [currentProject, targetProject],
      activeProject: currentProject,
      document: currentDocument,
      status: 'opening',
      editAccess: 'waiting',
    }
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: session } })
    actor.start()
    actor.send({ type: 'project.operation', operation: { kind: 'open', projectId: currentProject.id } })
    await flushActor()

    const sync = new ProjectSyncCoordinator(actor, store, new ElceProjectApiClient('http://elce.test', request))
    let persistence: AttachedDocumentPersistence | null = null
    persistence = await attachDocumentPersistence(actor, store, {
      onLocalSave: (document) => sync.schedule(document),
    })
    actor.send({ type: 'editor.access.activate' })
    store.deferNextSave = true

    session.performHandler = async () => {
      await persistence?.flushLocalChanges()
      await sync.waitUntilCurrentDocumentSynced()
      return {
        projects: [currentProject, targetProject],
        activeProject: targetProject,
        document: renamedDocument(targetProject.id, targetProject.name),
        status: 'opening',
        editAccess: 'waiting',
      }
    }

    const section = actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section
    if (section === null || section === undefined) throw new Error('La fixture doit contenir une Section éditable.')
    actor.send({
      type: 'section.change',
      sectionBdcId: 'bdc-section-1',
      change: { kind: 'content', title: 'Édition en cours', content: section.content, markup: section.markup },
    })
    actor.send({ type: 'project.operation', operation: { kind: 'open', projectId: targetProject.id } })

    await vi.waitFor(() => expect(session.calls).toHaveLength(2))
    await vi.waitFor(() => expect(store.pendingSave).not.toBeNull())

    expect(actor.getSnapshot().context.pendingProjectOperation).toEqual({ kind: 'open', projectId: targetProject.id })
    expect(actor.getSnapshot().context.projectStatus).toBe('busy')
    expect(actor.getSnapshot().context.editAccess).toBe('waiting')
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.title).toBe('Édition en cours')
    expect(session.calls[1]?.document.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.title).toBe('Édition en cours')
    expect(request).not.toHaveBeenCalled()

    store.pendingSave?.resolve()
    await vi.waitFor(() => expect(actor.getSnapshot().context.projectError).toBe(error))

    expect(request.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(kind === 'conflict' ? ['PUT', 'GET'] : ['PUT'])
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
      bdcs: expect.arrayContaining([expect.objectContaining({ id: 'bdc-section-1', section: expect.objectContaining({ title: 'Édition en cours' }) })]),
    })
    expect(store.documents.get(currentProject.id)?.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.title).toBe('Édition en cours')
    expect(store.checkpoints.get(currentProject.id)).toMatchObject({
      remoteRevision: kind === 'conflict' ? 1 : 0,
      status: kind === 'conflict' ? 'conflict' : 'pending',
    })
    expect(actor.getSnapshot().context.document.id).toBe(currentProject.id)
    expect(actor.getSnapshot().context.activeProject).toEqual(currentProject)
    expect(actor.getSnapshot().context.editAccess).toBe('active')
    expect(actor.getSnapshot().context.syncStatus).toBe(kind === 'conflict' ? 'conflict' : 'pending')
    expect(actor.getSnapshot().value).toBe('ready')

    persistence.detach()
    sync.destroy()
    actor.stop()
    consoleError.mockRestore()
  })
})

/** Creates a test document whose identity and visible name match a project. */
function renamedDocument(id: string, name: string): ElceDocumentModel {
  const document = createInitialDocument().toJSON()
  return ElceDocument.fromJSON({ ...document, id, name })
}

/** Waits for the invoked XState promise actor to publish its result. */
async function flushActor(): Promise<void> {
  for (let turn = 0; turn < 4; turn += 1) await new Promise<void>((resolve) => setTimeout(resolve, 0))
}
