import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialDocument, ElceDocument } from '../../domain/document/document-model'
import type { ElceDocument as ElceDocumentModel } from '../../domain/document/document-model'
import type { ElceProjectSummary } from '../../infrastructure/project-api/project-api-types'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import type { DocumentSyncState, ElceDocumentStore, MediaBlob } from '../../infrastructure/indexed-db/document-store-types'
import { createActor } from 'xstate'
import { controllerMachine } from '../controller/controller-machine'
import { ProjectSessionCoordinator } from './project-session-coordinator'

afterEach(() => {
  vi.unstubAllGlobals()
})

class MemoryProjectStore implements ElceDocumentStore {
  public readonly documents = new Map<string, ElceDocumentModel>()
  public readonly checkpoints = new Map<string, DocumentSyncState>()
  public readonly media = new Map<string, Blob>()
  public readonly deletedProjects: string[] = []

  public async loadDocument(documentId: string): Promise<ElceDocumentModel | null> {
    return this.documents.get(documentId) ?? null
  }

  public async saveDocument(document: ElceDocumentModel): Promise<void> {
    this.documents.set(document.id, document)
    const previous = await this.loadSyncState(document.id)
    await this.saveSyncState({ ...previous, status: 'pending' })
  }

  public async saveDocumentAndDeleteMedia(document: ElceDocumentModel, mediaIds: readonly string[]): Promise<void> {
    await this.saveDocument(document)
    for (const mediaId of mediaIds) this.media.delete(mediaId)
  }

  public async deleteDocument(documentId: string): Promise<void> {
    this.deletedProjects.push(documentId)
    this.documents.delete(documentId)
    this.checkpoints.delete(documentId)
  }

  public async deleteMedia(mediaIds: readonly string[]): Promise<void> {
    for (const mediaId of mediaIds) this.media.delete(mediaId)
  }

  public async loadSyncState(documentId: string): Promise<DocumentSyncState> {
    return this.checkpoints.get(documentId) ?? {
      documentId,
      remoteRevision: null,
      uploadedMediaIds: [],
      status: 'pending',
    }
  }

  public async saveSyncState(state: DocumentSyncState): Promise<void> {
    this.checkpoints.set(state.documentId, state)
  }

  public async saveMedia(media: MediaBlob): Promise<void> {
    this.media.set(media.id, media.blob)
  }

  public async loadMedia(mediaId: string): Promise<Blob | null> {
    return this.media.get(mediaId) ?? null
  }
}

describe('Elcé project session lifecycle', () => {
  it('creates a uniquely identified project and closes it without deleting the server copy', async () => {
    const remote = new Map<string, ElceDocumentModel>()
    const store = new MemoryProjectStore()
    const { coordinator } = createCoordinator(remote, store)
    const emptyDocument = createInitialDocument()

    const created = await coordinator.perform({ kind: 'create' }, emptyDocument, null, 'waiting', false)

    expect(created.status).toBe('opening')
    expect(created.activeProject).toMatchObject({ name: 'Projet 1', revision: 0 })
    expect(created.document?.id).not.toBe('elce-document')
    expect(remote.has(created.document!.id)).toBe(true)
    expect(store.checkpoints.get(created.document!.id)).toMatchObject({ remoteRevision: 0, status: 'synced' })

    const closed = await coordinator.perform({ kind: 'close' }, created.document!, created.activeProject, 'waiting', false)

    expect(closed.status).toBe('list')
    expect(closed.activeProject).toBeNull()
    expect(remote.has(created.document!.id)).toBe(true)
    expect(store.documents.has(created.document!.id)).toBe(false)
    expect(store.deletedProjects).toEqual([created.document!.id])
  })

  it('retains edit access after deleting a different, inactive project', async () => {
    const remote = new Map<string, ElceDocumentModel>()
    const current = documentForProject('current-project', 'Courant')
    const inactive = documentForProject('inactive-project', 'Inactif')
    remote.set(current.id, current)
    remote.set(inactive.id, inactive)
    const store = new MemoryProjectStore()
    const { coordinator } = createCoordinator(remote, store)
    const currentSummary = summaryFor(current)
    const inactiveSummary = summaryFor(inactive)
    await coordinator.perform({ kind: 'open', projectId: current.id }, createInitialDocument(), null, 'waiting', false)

    const deleted = await coordinator.perform({ kind: 'delete', projectId: inactive.id }, current, currentSummary, 'waiting', true)

    expect(deleted.projects.map((project) => project.id)).toEqual([current.id])
    expect(deleted.activeProject).toEqual(currentSummary)
    expect(deleted.editAccess).toBe('active')
    expect(deleted.status).toBe('active')
    expect(remote.has(inactive.id)).toBe(false)
    expect(remote.has(current.id)).toBe(true)
    expect(store.deletedProjects).toEqual([inactive.id])
    expect(inactiveSummary.id).toBe(inactive.id)
  })

  it('does not create a project during bootstrap when the server list is empty', async () => {
    const remote = new Map<string, ElceDocumentModel>()
    const store = new MemoryProjectStore()
    const { coordinator, request } = createCoordinator(remote, store)

    const bootstrapped = await coordinator.perform(
      { kind: 'bootstrap', rememberedProjectId: null },
      createInitialDocument(),
      null,
      'waiting',
      false,
    )

    expect(bootstrapped).toMatchObject({ projects: [], activeProject: null, document: null, status: 'list' })
    expect(remote.size).toBe(0)
    expect(request.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(['GET'])
  })

  it('pushes on blur and installs a newer server revision when focus returns', async () => {
    const initial = documentForProject('elce-document', 'Version initiale')
    const remote = new Map([[initial.id, initial]])
    const revisions = new Map([[initial.id, 0]])
    const store = new MemoryProjectStore()
    const { coordinator } = createCoordinator(remote, store, revisions)
    const browser = installFakeBrowserEvents()
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    actor.start()
    await coordinator.attach(actor)

    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await vi.waitFor(() => expect(browser.locks.request).toHaveBeenCalledTimes(1))

    const firstRemoteUpdate = documentForProject(initial.id, 'Enregistré dans l’autre navigateur')
    remote.set(initial.id, firstRemoteUpdate)
    revisions.set(initial.id, 1)
    browser.grantAccess(0)
    await vi.waitFor(() => expect(actor.getSnapshot().context.document.data.name).toBe(firstRemoteUpdate.data.name))
    await vi.waitFor(() => expect(actor.getSnapshot().context.editAccess).toBe('active'))

    actor.send({ type: 'document.apply', command: { type: 'document.rename', name: 'Sauvegardé au blur' } })
    browser.setFocused(false)
    browser.window.dispatchEvent(new Event('blur'))
    await vi.waitFor(() => expect(remote.get(initial.id)?.data.name).toBe('Sauvegardé au blur'))
    await vi.waitFor(() => expect(actor.getSnapshot().context.editAccess).toBe('waiting'))
    expect(revisions.get(initial.id)).toBe(2)

    const secondRemoteUpdate = documentForProject(initial.id, 'Modifié dans le second navigateur')
    remote.set(initial.id, secondRemoteUpdate)
    revisions.set(initial.id, 3)
    browser.setFocused(true)
    browser.window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(browser.locks.request).toHaveBeenCalledTimes(2))
    browser.grantAccess(1)

    await vi.waitFor(() => expect(actor.getSnapshot().context.document.data.name).toBe(secondRemoteUpdate.data.name))
    await vi.waitFor(() => expect(actor.getSnapshot().context.editAccess).toBe('active'))
    expect(store.checkpoints.get(initial.id)).toMatchObject({ remoteRevision: 3, status: 'synced' })

    await coordinator.dispose()
    actor.stop()
  })

  it('waits for window focus before requesting project edit access', async () => {
    const initial = documentForProject('elce-document', 'Fenêtre en arrière-plan')
    const remote = new Map([[initial.id, initial]])
    const revisions = new Map([[initial.id, 0]])
    const store = new MemoryProjectStore()
    const { coordinator } = createCoordinator(remote, store, revisions)
    const browser = installFakeBrowserEvents(false)
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    actor.start()
    await coordinator.attach(actor)

    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await vi.waitFor(() => expect(actor.getSnapshot().context.activeProject?.id).toBe(initial.id))
    expect(browser.locks.request).not.toHaveBeenCalled()
    expect(actor.getSnapshot().context.editAccess).toBe('waiting')

    browser.setFocused(true)
    browser.window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(browser.locks.request).toHaveBeenCalledTimes(1))
    browser.grantAccess(0)
    await vi.waitFor(() => expect(actor.getSnapshot().context.editAccess).toBe('active'))

    await coordinator.dispose()
    actor.stop()
  })
})

/** Creates the API fake and lifecycle coordinator used by the tests. */
function createCoordinator(
  remote: Map<string, ElceDocumentModel>,
  store: MemoryProjectStore,
  revisions: Map<string, number> = new Map(),
): Readonly<{ coordinator: ProjectSessionCoordinator; request: ReturnType<typeof vi.fn<typeof fetch>> }> {
  const request = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = new URL(input.toString())
    switch (`${init?.method ?? 'GET'} ${url.pathname}`) {
      case 'GET /api/projects':
        return Response.json({ projects: [...remote.values()].map((document) => summaryFor(document, revisions.get(document.id) ?? 0)) })
      case 'POST /api/projects': {
        const data = JSON.parse(String(init?.body)) as Parameters<typeof ElceDocument.fromJSON>[0]
        const document = ElceDocument.fromJSON(data)
        remote.set(document.id, document)
        revisions.set(document.id, 0)
        return Response.json({ project: summaryFor(document, 0) }, { status: 201, headers: { ETag: '"0"' } })
      }
      case `GET /api/projects/${decodeURIComponent(url.pathname.split('/').at(-1) ?? '')}`: {
        const projectId = decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
        const document = remote.get(projectId)
        if (document === undefined) return Response.json({ error: 'project_not_found' }, { status: 404 })
        const revision = revisions.get(projectId) ?? 0
        return Response.json({ project: summaryFor(document, revision), document: document.toJSON() }, {
          headers: { ETag: `"${revision}"` },
        })
      }
      case `PUT /api/projects/${decodeURIComponent(url.pathname.split('/').at(-2) ?? '')}/document`: {
        const projectId = decodeURIComponent(url.pathname.split('/').at(-2) ?? '')
        const currentRevision = revisions.get(projectId) ?? 0
        if (init?.headers === undefined || new Headers(init.headers).get('If-Match') !== `"${currentRevision}"`) {
          return Response.json({ error: 'revision_mismatch' }, { status: 412 })
        }
        const data = JSON.parse(String(init.body)) as Parameters<typeof ElceDocument.fromJSON>[0]
        const document = ElceDocument.fromJSON(data)
        const revision = currentRevision + 1
        remote.set(projectId, document)
        revisions.set(projectId, revision)
        return Response.json({ project: summaryFor(document, revision) }, { headers: { ETag: `"${revision}"` } })
      }
      case `DELETE /api/projects/${decodeURIComponent(url.pathname.split('/').at(-1) ?? '')}`: {
        const projectId = decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
        remote.delete(projectId)
        revisions.delete(projectId)
        return new Response(null, { status: 204 })
      }
      default:
        throw new Error(`Requête non prévue dans ce test : ${init?.method ?? 'GET'} ${url.pathname}`)
    }
  })
  return {
    coordinator: new ProjectSessionCoordinator(store, new ElceProjectApiClient('http://elce.test', request), null),
    request,
  }
}

/** Builds a project identity and generated name for a compact test fixture. */
function documentForProject(id: string, name: string): ElceDocumentModel {
  return ElceDocument.fromJSON({ ...createInitialDocument().toJSON(), id, name })
}

/** Maps the stable document identity to its server-owned project summary. */
function summaryFor(document: ElceDocumentModel, revision = 0): ElceProjectSummary {
  return { id: document.id, name: document.data.name, revision }
}

/** Supplies focus, blur, document visibility, and manually granted Web Locks to lifecycle tests. */
function installFakeBrowserEvents(initialFocus = true): Readonly<{
  locks: { request: ReturnType<typeof vi.fn> }
  window: EventTarget
  setFocused(focused: boolean): void
  grantAccess(index: number): void
}> {
  const windowTarget = new EventTarget()
  let focused = initialFocus
  const documentTarget = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
    hasFocus: () => focused,
  })
  const grants: Array<() => void> = []
  const request = vi.fn((_name: string, _options: unknown, callback: (lock: unknown) => Promise<void>) => new Promise<void>((resolve, reject) => {
    grants.push(() => {
      Promise.resolve(callback({ name: _name })).then(resolve, reject)
    })
  }))
  class FakeBroadcastChannel extends EventTarget {
    public constructor(_name: string) { super() }
    public postMessage(_message: unknown): void {}
    public close(): void {}
  }

  vi.stubGlobal('window', windowTarget)
  vi.stubGlobal('document', documentTarget)
  vi.stubGlobal('navigator', { locks: { request } })
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  vi.stubGlobal('crypto', { randomUUID: () => 'test-editor' })
  return {
    locks: { request },
    window: windowTarget,
    setFocused: (nextFocused) => { focused = nextFocused },
    grantAccess: (index) => grants[index]?.(),
  }
}
