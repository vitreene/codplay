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
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

class MemoryProjectStore implements ElceDocumentStore {
  public readonly documents = new Map<string, ElceDocumentModel>()
  public readonly checkpoints = new Map<string, DocumentSyncState>()
  public readonly media = new Map<string, Blob>()
  public readonly deletedProjects: string[] = []
  public readonly loadErrors = new Map<string, Error>()

  public async loadDocument(documentId: string): Promise<ElceDocumentModel | null> {
    const error = this.loadErrors.get(documentId)
    if (error !== undefined) throw error
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
    this.loadErrors.delete(documentId)
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
  it('replaces a cloned reload identity when another living tab answers its probe', async () => {
    const channels = new Set<EventTarget & { postMessage(data: unknown): void; close(): void }>()
    class IdentityChannel extends EventTarget {
      public constructor(_name: string) { super(); channels.add(this) }
      public postMessage(data: unknown): void {
        for (const channel of channels) if (channel !== this) channel.dispatchEvent(new MessageEvent('message', { data }))
      }
      public close(): void { channels.delete(this) }
    }
    const session = (): Storage => {
      const values = new Map([['elce-edit-page-id', 'copied-page']])
      return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value) },
        removeItem: (key) => { values.delete(key) },
        clear: () => { values.clear() },
        key: (index) => [...values.keys()][index] ?? null,
        get length() { return values.size },
      }
    }
    const ids = ['instance-a', 'instance-b', 'new-page-b']
    vi.stubGlobal('window', new EventTarget())
    vi.stubGlobal('BroadcastChannel', IdentityChannel)
    vi.stubGlobal('performance', { getEntriesByType: () => [{ type: 'reload' }] })
    vi.stubGlobal('crypto', { randomUUID: () => ids.shift() })
    const firstStorage = session()
    const secondStorage = session()
    const first = new ProjectSessionCoordinator(new MemoryProjectStore(), undefined, firstStorage)
    const second = new ProjectSessionCoordinator(new MemoryProjectStore(), undefined, secondStorage)
    expect(firstStorage.getItem('elce-edit-page-id')).toBe('copied-page')
    expect(secondStorage.getItem('elce-edit-page-id')).toBe('new-page-b')
    await first.dispose()
    await second.dispose()
  })

  it('closes the outgoing identity channel before the same tab reload probes it', async () => {
    const channels = new Set<EventTarget & { postMessage(data: unknown): void; close(): void }>()
    class IdentityChannel extends EventTarget {
      public constructor(_name: string) { super(); channels.add(this) }
      public postMessage(data: unknown): void {
        for (const channel of channels) if (channel !== this) channel.dispatchEvent(new MessageEvent('message', { data }))
      }
      public close(): void { channels.delete(this) }
    }
    const values = new Map([['elce-edit-page-id', 'reloaded-page']])
    const session: Storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value) },
      removeItem: (key) => { values.delete(key) },
      clear: () => { values.clear() },
      key: (index) => [...values.keys()][index] ?? null,
      get length() { return values.size },
    }
    const ids = ['old-instance', 'new-instance', 'unexpected-new-page']
    vi.stubGlobal('window', new EventTarget())
    vi.stubGlobal('BroadcastChannel', IdentityChannel)
    vi.stubGlobal('performance', { getEntriesByType: () => [{ type: 'reload' }] })
    vi.stubGlobal('crypto', { randomUUID: () => ids.shift() })
    const outgoing = new ProjectSessionCoordinator(new MemoryProjectStore(), undefined, session)

    const disposing = outgoing.dispose()
    const reloaded = new ProjectSessionCoordinator(new MemoryProjectStore(), undefined, session)
    await new Promise((resolve) => setTimeout(resolve, 90))

    expect(session.getItem('elce-edit-page-id')).toBe('reloaded-page')
    await disposing
    await reloaded.dispose()
  })

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

  it('uses the captured edit right while XState suspends author commands for a project operation', async () => {
    const remote = new Map<string, ElceDocumentModel>()
    const current = documentForProject('current-project', 'Courant')
    remote.set(current.id, current)
    const store = new MemoryProjectStore()
    store.documents.set(current.id, current)
    store.checkpoints.set(current.id, {
      documentId: current.id,
      remoteRevision: 0,
      uploadedMediaIds: [],
      status: 'pending',
    })
    const { coordinator } = createCoordinator(remote, store)
    const currentSummary = summaryFor(current)
    await coordinator.perform({ kind: 'open', projectId: current.id }, createInitialDocument(), null, 'waiting', false)

    const created = await coordinator.perform({ kind: 'create' }, current, currentSummary, 'waiting', true)

    expect(created.status).toBe('opening')
    expect(created.document).not.toBeNull()
    expect(remote.has(created.document!.id)).toBe(true)
  })

  it('deletes the active project after synchronizing when the captured edit right was active', async () => {
    const remote = new Map<string, ElceDocumentModel>()
    const current = documentForProject('current-project', 'Courant')
    remote.set(current.id, current)
    const store = new MemoryProjectStore()
    store.documents.set(current.id, current)
    store.checkpoints.set(current.id, {
      documentId: current.id,
      remoteRevision: 0,
      uploadedMediaIds: [],
      status: 'pending',
    })
    const { coordinator, api } = createCoordinator(remote, store)
    const currentSummary = summaryFor(current)
    await coordinator.perform({ kind: 'open', projectId: current.id }, createInitialDocument(), null, 'waiting', false)
    await api.acquireEditAccess(current.id, 'test-page')

    const deleted = await coordinator.perform({ kind: 'delete', projectId: current.id }, current, currentSummary, 'waiting', true)

    expect(deleted.status).toBe('list')
    expect(deleted.activeProject).toBeNull()
    expect(remote.has(current.id)).toBe(false)
    expect(store.deletedProjects).toEqual([current.id])
  })

  it('replaces an unsupported local cache with the confirmed server document', async () => {
    const serverProject = documentForProject('old-project', 'Document serveur')
    const currentProject = documentForProject('current-project', 'Projet courant')
    const staleCache = documentForProject('old-project', 'Cache ancien')
    const remote = new Map([[currentProject.id, currentProject], [serverProject.id, serverProject]])
    const store = new MemoryProjectStore()
    store.documents.set(staleCache.id, staleCache)
    store.loadErrors.set(staleCache.id, new Error('Version de document Elcé non supportée : 2'))
    const session = createMemorySession({ 'elce-active-project': currentProject.id })
    const { coordinator, request } = createCoordinator(remote, store, new Map(), { online: true }, session)

    await coordinator.perform(
      { kind: 'bootstrap', rememberedProjectId: currentProject.id },
      createInitialDocument(),
      null,
      'waiting',
      false,
    )
    const restored = await coordinator.perform(
      { kind: 'open', projectId: serverProject.id },
      currentProject,
      summaryFor(currentProject),
      'waiting',
      false,
    )

    expect(restored).toMatchObject({
      projects: [summaryFor(currentProject), summaryFor(serverProject)],
      activeProject: summaryFor(serverProject),
      document: serverProject,
      status: 'opening',
      projectError: null,
    })
    expect(request.mock.calls.some(([input]) => new URL(input.toString()).pathname === `/api/projects/${serverProject.id}`)).toBe(true)
    expect(store.documents.get(serverProject.id)?.data).toEqual(serverProject.data)
    expect(store.checkpoints.get(serverProject.id)).toMatchObject({
      remoteRevision: 0,
      uploadedMediaIds: [],
      status: 'synced',
    })
    expect(store.deletedProjects).toEqual([serverProject.id])
    expect(store.documents.has(currentProject.id)).toBe(true)
    expect(coordinator.rememberedProjectId()).toBe(serverProject.id)
  })

  it('keeps an unsupported local cache when its server copy cannot be read', async () => {
    const currentProject = documentForProject('current-project', 'Projet courant')
    const serverProject = documentForProject('old-project', 'Document serveur')
    const staleCache = documentForProject('old-project', 'Cache ancien')
    const remote = new Map([[currentProject.id, currentProject], [serverProject.id, serverProject]])
    const store = new MemoryProjectStore()
    store.documents.set(staleCache.id, staleCache)
    store.loadErrors.set(staleCache.id, new Error('Version de document Elcé non supportée : 2'))
    const network = { online: true, failedProjectReadId: serverProject.id }
    const session = createMemorySession({ 'elce-active-project': currentProject.id })
    const { coordinator } = createCoordinator(remote, store, new Map(), network, session)

    await coordinator.perform(
      { kind: 'bootstrap', rememberedProjectId: currentProject.id },
      createInitialDocument(),
      null,
      'waiting',
      false,
    )

    await expect(coordinator.perform(
      { kind: 'open', projectId: serverProject.id },
      currentProject,
      summaryFor(currentProject),
      'waiting',
      false,
    )).rejects.toThrow()

    expect(store.documents.get(serverProject.id)).toBe(staleCache)
    expect(store.deletedProjects).toEqual([])
    expect(coordinator.rememberedProjectId()).toBe(currentProject.id)
  })

  it('retains edit access after deleting a different, inactive project', async () => {
    const remote = new Map<string, ElceDocumentModel>()
    const current = documentForProject('current-project', 'Courant')
    const inactive = documentForProject('inactive-project', 'Inactif')
    remote.set(current.id, current)
    remote.set(inactive.id, inactive)
    const store = new MemoryProjectStore()
    const { coordinator, request } = createCoordinator(remote, store)
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
    expect(request.mock.calls.some(([url, init]) => init?.method === 'DELETE' && new URL(url.toString()).pathname.endsWith('/edit-access'))).toBe(false)
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

  it('keeps the source grant after three failed publication attempts and releases it on network recovery', async () => {
    const initial = documentForProject('source-network-failure', 'Version confirmée')
    const remote = new Map([[initial.id, initial]])
    const store = new MemoryProjectStore()
    const network = { online: true }
    const { coordinator, request } = createCoordinator(remote, store, new Map(), network)
    const browser = installFakeBrowserEvents()
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    const reportError = vi.spyOn(console, 'error').mockImplementation(() => {})
    actor.start()
    await coordinator.attach(actor)
    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: initial.id } })
    await vi.waitFor(() => expect(browser.locks.request).toHaveBeenCalledTimes(1))
    browser.grantAccess(0)
    await vi.waitFor(() => expect(actor.getSnapshot().context.editAccess).toBe('active'))

    actor.send({ type: 'document.apply', command: { type: 'document.rename', name: 'Travail en attente' } })
    await vi.waitFor(() => expect(store.documents.get(initial.id)?.data.name).toBe('Travail en attente'))
    network.online = false
    browser.setFocused(false)
    browser.window.dispatchEvent(new Event('blur'))
    await vi.waitFor(() => expect(actor.getSnapshot().context.projectError).toContain('serveur est injoignable'))
    expect(remote.get(initial.id)?.data.name).toBe('Version confirmée')

    network.online = true
    const competing = await request(new URL(`http://elce.test/api/projects/${initial.id}/edit-access`), {
      method: 'POST', body: JSON.stringify({ pageId: 'page-b' }),
    })
    expect(competing.status).toBe(409)
    browser.window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(remote.get(initial.id)?.data.name).toBe('Travail en attente'))
    await vi.waitFor(() => expect(request.mock.calls.some(([url, init]) => init?.method === 'DELETE'
      && new URL(url.toString()).pathname.endsWith('/edit-access'))).toBe(true))

    reportError.mockRestore()
    await coordinator.dispose()
    actor.stop()
  })

  it('does not retry an invalid document rejection and keeps the local pending copy', async () => {
    const initial = documentForProject('invalid-document-save', 'Version confirmée')
    const remote = new Map([[initial.id, initial]])
    const store = new MemoryProjectStore()
    const network = { online: true, invalidDocumentSave: true }
    const { coordinator, request } = createCoordinator(remote, store, new Map(), network)
    const browser = installFakeBrowserEvents()
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    const reportError = vi.spyOn(console, 'error').mockImplementation(() => {})
    actor.start()
    await coordinator.attach(actor)

    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: initial.id } })
    await vi.waitFor(() => expect(browser.locks.request).toHaveBeenCalledTimes(1))
    browser.grantAccess(0)
    await vi.waitFor(() => expect(actor.getSnapshot().context.editAccess).toBe('active'))

    actor.send({ type: 'document.apply', command: { type: 'document.rename', name: 'Brouillon à conserver' } })
    await vi.waitFor(() => expect(store.documents.get(initial.id)?.data.name).toBe('Brouillon à conserver'))
    browser.setFocused(false)
    browser.window.dispatchEvent(new Event('blur'))
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledWith(
      'La synchronisation locale Elcé a échoué.',
      expect.objectContaining({
        code: 'invalid_request',
        diagnosticId: 'diagnostic-test-save',
        diagnosticReason: 'document_invariants_rejected',
      }),
    ))
    await vi.waitFor(() => expect(actor.getSnapshot().context.projectError)
      .toContain('[diagnostic diagnostic-test-save: document_invariants_rejected]'))
    await new Promise<void>((resolve) => setTimeout(resolve, 600))

    const documentSaveCalls = request.mock.calls.filter(([input, init]) =>
      init?.method === 'PUT' && new URL(input.toString()).pathname.endsWith('/document'))
    expect(documentSaveCalls).toHaveLength(1)
    expect(store.documents.get(initial.id)?.data.name).toBe('Brouillon à conserver')
    expect(store.checkpoints.get(initial.id)).toMatchObject({ remoteRevision: 0, status: 'pending' })
    expect(remote.get(initial.id)?.data.name).toBe('Version confirmée')

    network.invalidDocumentSave = false
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

  it('surfaces the existing recovery controls when another window keeps the native lock pending', async () => {
    const initial = documentForProject('pending-native-lock', 'Projet en lecture')
    const remote = new Map([[initial.id, initial]])
    const store = new MemoryProjectStore()
    const { coordinator } = createCoordinator(remote, store)
    const browser = installFakeBrowserEvents(true)
    vi.useFakeTimers()
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    actor.start()
    await coordinator.attach(actor)

    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: initial.id } })
    await vi.waitFor(() => expect(actor.getSnapshot().context.activeProject?.id).toBe(initial.id))
    await vi.waitFor(() => expect(browser.locks.request).toHaveBeenCalledOnce())
    expect(actor.getSnapshot().context.accessRecoveryAvailable).toBe(false)

    await vi.advanceTimersByTimeAsync(5000)

    expect(actor.getSnapshot().context.editAccess).toBe('waiting')
    expect(actor.getSnapshot().context.accessRecoveryAvailable).toBe(true)
    expect(actor.getSnapshot().context.projectError)
      .toBe('L’accès attend toujours la libération du verrou d’un autre onglet.')

    await coordinator.dispose()
    actor.stop()
  })

  it('grants interaction priority to a synchronized reader after installing the latest server revision', async () => {
    const initial = documentForProject('priority-reader', 'Version affichée')
    const latest = documentForProject(initial.id, 'Dernière version serveur')
    const remote = new Map([[initial.id, initial]])
    const revisions = new Map([[initial.id, 0]])
    const store = new MemoryProjectStore()
    const network = { online: true, occupiedProjectId: initial.id }
    const { coordinator, request } = createCoordinator(remote, store, revisions, network)
    const browser = installFakeBrowserEvents(false)
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    actor.start()
    await coordinator.attach(actor)

    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: initial.id } })
    await vi.waitFor(() => expect(actor.getSnapshot().context.activeProject?.id).toBe(initial.id))
    remote.set(initial.id, latest)
    revisions.set(initial.id, 1)
    browser.setFocused(true)
    browser.window.dispatchEvent(new Event('pointerdown'))

    await vi.waitFor(() => expect(actor.getSnapshot().context.editAccess).toBe('active'))
    expect(actor.getSnapshot().context.document.data.name).toBe('Dernière version serveur')
    expect(actor.getSnapshot().context.activeProject?.revision).toBe(1)
    const forceRequest = request.mock.calls.find(([url, init]) => init?.method === 'POST'
      && new URL(url.toString()).pathname.endsWith('/edit-access')
      && JSON.parse(String(init.body)).force === true)
    expect(forceRequest).toBeDefined()

    await coordinator.dispose()
    actor.stop()
  })

  it('keeps a reader with a pending local copy from taking interaction priority', async () => {
    const source = documentForProject('priority-reader-pending', 'Version serveur')
    const local = documentForProject(source.id, 'Version locale en attente')
    const remote = new Map([[source.id, source]])
    const store = new MemoryProjectStore()
    store.documents.set(source.id, local)
    store.checkpoints.set(source.id, {
      documentId: source.id, remoteRevision: 0, uploadedMediaIds: [], status: 'pending',
    })
    const network = { online: true, occupiedProjectId: source.id }
    const { coordinator, request } = createCoordinator(remote, store, new Map(), network)
    const browser = installFakeBrowserEvents(false)
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    actor.start()
    await coordinator.attach(actor)

    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: source.id } })
    await vi.waitFor(() => expect(actor.getSnapshot().context.recoverableLocalCopy).toBe(true))
    browser.setFocused(true)
    browser.window.dispatchEvent(new Event('keydown'))
    await vi.waitFor(() => expect(actor.getSnapshot().context.document.data.name).toBe('Version serveur'))

    expect(actor.getSnapshot().context.editAccess).toBe('waiting')
    expect(request.mock.calls.some(([url, init]) => init?.method === 'POST'
      && new URL(url.toString()).pathname.endsWith('/edit-access')
      && JSON.parse(String(init.body)).force === true)).toBe(false)
    expect(store.documents.get(source.id)?.data.name).toBe('Version locale en attente')

    await coordinator.dispose()
    actor.stop()
  })

  it('opens Save As as an independent editable copy of the confirmed reader document', async () => {
    const source = documentForProject('source-project', 'Document confirmé')
    const remote = new Map([[source.id, source]])
    const store = new MemoryProjectStore()
    const { coordinator } = createCoordinator(remote, store)
    const browser = installFakeBrowserEvents(false)
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    actor.start()
    await coordinator.attach(actor)
    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: source.id } })
    await vi.waitFor(() => expect(actor.getSnapshot().context.activeProject?.id).toBe(source.id))
    expect(actor.getSnapshot().context.editAccess).toBe('waiting')

    actor.send({ type: 'project.operation', operation: { kind: 'save-as', name: 'Copie indépendante' } })
    await vi.waitFor(() => expect(actor.getSnapshot().context.activeProject?.id).not.toBe(source.id))
    const copyId = actor.getSnapshot().context.activeProject!.id
    expect(actor.getSnapshot().context.document.data.name).toBe('Copie indépendante')
    expect(store.checkpoints.get(copyId)).toMatchObject({ independentCopyOf: source.id, status: 'pending' })
    expect(remote.get(source.id)?.data.name).toBe('Document confirmé')

    browser.setFocused(true)
    browser.window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(browser.locks.request).toHaveBeenCalledTimes(1))
    browser.grantAccess(0)
    await vi.waitFor(() => expect(actor.getSnapshot().context.editAccess).toBe('active'))
    expect(remote.get(copyId)?.data.name).toBe('Copie indépendante')

    await coordinator.dispose()
    actor.stop()
  })

  it('preserves a conflicted local cache separately from the confirmed reader version', async () => {
    const source = documentForProject('source-conflict', 'Version serveur')
    const local = documentForProject(source.id, 'Version locale non publiée')
    const remote = new Map([[source.id, source]])
    const store = new MemoryProjectStore()
    store.documents.set(source.id, local)
    store.checkpoints.set(source.id, { documentId: source.id, remoteRevision: 0, uploadedMediaIds: [], status: 'conflict' })
    const { coordinator } = createCoordinator(remote, store)
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    actor.start()
    await coordinator.attach(actor)
    const opened = await coordinator.perform({ kind: 'open', projectId: source.id }, createInitialDocument(), null, 'waiting', false)
    expect(opened.document?.data.name).toBe('Version serveur')

    const copied = await coordinator.perform({ kind: 'save-local-as', name: 'Sauvetage local' }, opened.document!, opened.activeProject, 'waiting', false)
    expect(copied.document?.data.name).toBe('Sauvetage local')
    expect(copied.document?.id).not.toBe(source.id)
    expect(store.documents.get(source.id)?.data.name).toBe('Version locale non publiée')
    expect(remote.get(source.id)?.data.name).toBe('Version serveur')
    await coordinator.dispose()
    actor.stop()
  })

  it('offers recovery for a conflicted cache while displaying the confirmed reader document', async () => {
    const source = documentForProject('source-reader-conflict', 'Version serveur')
    const local = documentForProject(source.id, 'Version locale en conflit')
    const remote = new Map([[source.id, source]])
    const store = new MemoryProjectStore()
    store.documents.set(source.id, local)
    store.checkpoints.set(source.id, { documentId: source.id, remoteRevision: 0, uploadedMediaIds: [], status: 'conflict' })
    const { coordinator } = createCoordinator(remote, store)
    installFakeBrowserEvents(false)
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    actor.start()
    await coordinator.attach(actor)

    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: source.id } })
    await vi.waitFor(() => expect(actor.getSnapshot().context.recoverableLocalCopy).toBe(true))
    expect(actor.getSnapshot().context.document.data.name).toBe('Version serveur')
    expect(actor.getSnapshot().context.editAccess).toBe('waiting')

    await coordinator.dispose()
    actor.stop()
  })

  it('keeps an independent Save As copy editable when the server is unavailable', async () => {
    const source = documentForProject('source-offline', 'Version serveur')
    const remote = new Map([[source.id, source]])
    const store = new MemoryProjectStore()
    const network = { online: true }
    const { coordinator } = createCoordinator(remote, store, new Map(), network)
    const browser = installFakeBrowserEvents(false)
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    actor.start()
    await coordinator.attach(actor)
    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: source.id } })
    await vi.waitFor(() => expect(actor.getSnapshot().context.activeProject?.id).toBe(source.id))

    network.online = false
    actor.send({ type: 'project.operation', operation: { kind: 'save-as', name: 'Copie de secours' } })
    await vi.waitFor(() => expect(actor.getSnapshot().context.activeProject?.id).not.toBe(source.id))
    const copyId = actor.getSnapshot().context.activeProject!.id
    browser.setFocused(true)
    browser.window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(browser.locks.request).toHaveBeenCalledTimes(1))
    browser.grantAccess(0)
    await vi.waitFor(() => expect(actor.getSnapshot().context.editAccess).toBe('active'))
    actor.send({ type: 'document.apply', command: { type: 'document.rename', name: 'Travail local' } })
    await vi.waitFor(() => expect(store.documents.get(copyId)?.data.name).toBe('Travail local'))
    expect(remote.get(source.id)?.data.name).toBe('Version serveur')
    expect(remote.has(copyId)).toBe(false)

    network.online = true
    browser.window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(remote.get(copyId)?.data.name).toBe('Travail local'))
    await vi.waitFor(() => expect(store.checkpoints.get(copyId)?.status).toBe('synced'))
    expect(actor.getSnapshot().context.editAccess).toBe('active')

    await coordinator.dispose()
    actor.stop()
  })

  it('shows a reloaded rescue copy while it waits for focus without enabling editing', async () => {
    const copy = documentForProject('reloaded-rescue-copy', 'Copie locale')
    const store = new MemoryProjectStore()
    store.documents.set(copy.id, copy)
    store.checkpoints.set(copy.id, {
      documentId: copy.id, remoteRevision: null, uploadedMediaIds: [], status: 'pending',
      independentCopyOf: 'source-project',
    })
    const { coordinator } = createCoordinator(new Map(), store)
    const browser = installFakeBrowserEvents(false)
    const actor = createActor(controllerMachine, { input: { documentStore: store, projectSession: coordinator } })
    actor.start()
    await coordinator.attach(actor)

    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: copy.id } })
    await vi.waitFor(() => expect(actor.getSnapshot().context.projectStatus).toBe('active'))
    expect(actor.getSnapshot().context.document.data.name).toBe('Copie locale')
    expect(actor.getSnapshot().context.editAccess).toBe('waiting')
    expect(browser.locks.request).not.toHaveBeenCalled()

    await coordinator.dispose()
    actor.stop()
  })
})

/** Creates the API fake and lifecycle coordinator used by the tests. */
function createCoordinator(
  remote: Map<string, ElceDocumentModel>,
  store: MemoryProjectStore,
  revisions: Map<string, number> = new Map(),
  network: {
    online: boolean
    failedProjectReadId?: string
    occupiedProjectId?: string
    invalidDocumentSave?: boolean
  } = { online: true },
  session: Storage | null = null,
): Readonly<{
  coordinator: ProjectSessionCoordinator
  api: ElceProjectApiClient
  request: ReturnType<typeof vi.fn<typeof fetch>>
}> {
  const grants = new Map<string, string>()
  const request = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    if (!network.online) throw new TypeError('Network unavailable')
    const url = new URL(input.toString())
    const accessMatch = /^\/api\/projects\/([^/]+)\/edit-access$/.exec(url.pathname)
    if (accessMatch !== null) {
      const projectId = decodeURIComponent(accessMatch[1])
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { readonly force?: boolean }
        if (body.force === true) {
          grants.set(projectId, 'forced-test-grant')
          return Response.json({ grantId: 'forced-test-grant' })
        }
        if (grants.has(projectId)) return Response.json({ error: 'edit_access_occupied' }, { status: 409 })
        grants.set(projectId, 'test-grant')
        return Response.json({ grantId: 'test-grant' })
      }
      const held = grants.get(projectId) === new Headers(init?.headers).get('X-Elce-Edit-Grant')
      if (init?.method === 'DELETE') {
        if (!held) return Response.json({ error: 'edit_access_lost' }, { status: 409 })
        grants.delete(projectId)
        return new Response(null, { status: 204 })
      }
      return Response.json({ held })
    }
    switch (`${init?.method ?? 'GET'} ${url.pathname}`) {
      case 'GET /api/projects':
        return Response.json({ projects: [...remote.values()].map((document) => summaryFor(document, revisions.get(document.id) ?? 0)) })
      case 'POST /api/projects': {
        const data = JSON.parse(String(init?.body)) as Parameters<typeof ElceDocument.fromJSON>[0]
        const document = ElceDocument.fromJSON(data)
        if (remote.has(document.id)) return Response.json({ error: 'project_already_exists' }, { status: 409 })
        remote.set(document.id, document)
        revisions.set(document.id, 0)
        return Response.json({ project: summaryFor(document, 0) }, { status: 201, headers: { ETag: '"0"' } })
      }
      case `GET /api/projects/${decodeURIComponent(url.pathname.split('/').at(-1) ?? '')}`: {
        const projectId = decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
        if (network.failedProjectReadId === projectId) return Response.json({ error: 'temporary_read_failure' }, { status: 503 })
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
        if (network.invalidDocumentSave === true) {
          return Response.json({
            error: 'invalid_request',
            diagnosticId: 'diagnostic-test-save',
            diagnosticReason: 'document_invariants_rejected',
          }, { status: 400 })
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
  if (network.occupiedProjectId !== undefined) grants.set(network.occupiedProjectId, 'other-page-grant')
  const api = new ElceProjectApiClient('http://elce.test', request)
  return { coordinator: new ProjectSessionCoordinator(store, api, session), api, request }
}

/** Creates tab storage with the selected project remembered for restoration. */
function createMemorySession(initialValues: Record<string, string>): Storage {
  const values = new Map(Object.entries(initialValues))
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
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
