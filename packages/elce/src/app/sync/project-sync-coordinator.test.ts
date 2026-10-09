import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyDocumentCommand } from '../../domain/commands/document-commands'
import { createInitialDocument } from '../../domain/document/document-model'
import type { ElceDocument as ElceDocumentModel } from '../../domain/document/document-model'
import type { DocumentSyncState, ElceDocumentStore, MediaBlob } from '../../infrastructure/indexed-db/document-store-types'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import { createActor } from 'xstate'
import { controllerMachine } from '../controller/controller-machine'
import { ProjectSyncCoordinator } from './project-sync-coordinator'

class MemoryDocumentStore implements ElceDocumentStore {
  public readonly media = new Map<string, Blob>()
  public document: ElceDocumentModel | null = null
  public syncState: DocumentSyncState | null = null

  public async loadDocument(): Promise<ElceDocumentModel | null> {
    return this.document
  }

  public async saveDocument(document: ElceDocumentModel): Promise<void> {
    this.document = document
    const current = await this.loadSyncState(document.id)
    await this.saveSyncState({ ...current, status: 'pending' })
  }

  public async saveDocumentAndDeleteMedia(document: ElceDocumentModel, mediaIds: readonly string[]): Promise<void> {
    await this.saveDocument(document)
    for (const mediaId of mediaIds) this.media.delete(mediaId)
  }

  public async deleteDocument(documentId: string): Promise<void> {
    if (this.document?.id === documentId) this.document = null
    this.syncState = null
  }

  public async deleteMedia(mediaIds: readonly string[]): Promise<void> {
    for (const mediaId of mediaIds) this.media.delete(mediaId)
  }

  public async loadSyncState(documentId: string): Promise<DocumentSyncState> {
    return this.syncState?.documentId === documentId
      ? this.syncState
      : { documentId, remoteRevision: null, uploadedMediaIds: [], status: 'pending' }
  }

  public async saveSyncState(syncState: DocumentSyncState): Promise<void> {
    this.syncState = syncState
  }

  public async saveMedia(media: MediaBlob): Promise<void> {
    this.media.set(media.id, media.blob)
  }

  public async loadMedia(mediaId: string): Promise<Blob | null> {
    return this.media.get(mediaId) ?? null
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Elcé project synchronization', () => {
  it('sends the latest locally saved revision immediately when a window blurs', async () => {
    const document = applyDocumentCommand(createInitialDocument(), { type: 'document.rename', name: 'Sauvegarde au blur' })
    const store = new MemoryDocumentStore()
    await store.saveDocument(document)
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { project: { id: document.id, name: document.data.name, revision: 0 } },
      { status: 201, headers: { ETag: '"0"' } },
    ))
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    actor.send({ type: 'document.replace', document })
    const coordinator = new ProjectSyncCoordinator(actor, store, new ElceProjectApiClient('http://127.0.0.1:5181', request))

    coordinator.schedule(document)
    await coordinator.flushNow()

    expect(request).toHaveBeenCalledOnce()
    expect(store.syncState).toMatchObject({ remoteRevision: 0, status: 'synced' })

    coordinator.destroy()
    actor.stop()
  })

  it('does not queue a duplicate retry when blur arrives during a failed network write', async () => {
    const document = applyDocumentCommand(createInitialDocument(), { type: 'document.rename', name: 'Sauvegarde hors ligne' })
    const store = new MemoryDocumentStore()
    await store.saveDocument(document)
    let rejectRequest: (error: unknown) => void = () => {}
    const pendingRequest = new Promise<Response>((_resolve, reject) => { rejectRequest = reject })
    const request = vi.fn<typeof fetch>().mockReturnValue(pendingRequest)
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    actor.send({ type: 'document.replace', document })
    const coordinator = new ProjectSyncCoordinator(actor, store, new ElceProjectApiClient('http://127.0.0.1:5181', request))
    const reportError = vi.spyOn(console, 'error').mockImplementation(() => {})

    coordinator.schedule(document)
    const blurFlush = coordinator.flushNow()
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    const overlappingBlurFlush = coordinator.flushNow()
    rejectRequest(new TypeError('Network unavailable'))

    await Promise.all([blurFlush, overlappingBlurFlush])
    expect(request).toHaveBeenCalledOnce()
    expect(store.syncState).toMatchObject({ status: 'pending' })
    reportError.mockRestore()
    coordinator.destroy()
    actor.stop()
  })

  it('creates the server document before uploading and then serves the image from its URL', async () => {
    const media = { id: 'media-photo', name: 'photo.webp', mimeType: 'image/webp', size: 3, caption: '' }
    const document = applyDocumentCommand(createInitialDocument(), { type: 'media.add', media })
    const store = new MemoryDocumentStore()
    store.document = document
    store.media.set(media.id, new Blob(['img'], { type: media.mimeType }))
    const request = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(input.toString())
      switch (init?.method) {
        case 'POST':
          return Response.json({ project: { id: document.id, name: document.data.name, revision: 0 } }, {
            status: 201,
            headers: { ETag: '"0"' },
          })
        case 'PUT':
          return Response.json({ media: { id: media.id, url: `/api/projects/${document.id}/media/${media.id}` } }, { status: 201 })
        default:
          throw new Error(`Requête inattendue : ${url.pathname}`)
      }
    })
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    const coordinator = new ProjectSyncCoordinator(actor, store, new ElceProjectApiClient('http://127.0.0.1:5181', request))

    coordinator.schedule(document)
    await waitForSync()

    expect(request.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'PUT'])
    expect(store.media.has(media.id)).toBe(false)
    expect(store.syncState).toMatchObject({
      remoteRevision: 0,
      uploadedMediaIds: [media.id],
      status: 'synced',
    })
    expect(actor.getSnapshot().context.mediaSources[media.id]).toBe(
      `http://127.0.0.1:5181/api/projects/${document.id}/media/${media.id}`,
    )

    coordinator.destroy()
    actor.stop()
  })

  it('transfers video bytes while retaining their Blob in the active-document cache', async () => {
    const media = { id: 'media-video', name: 'sample-video.mp4', mimeType: 'video/mp4', size: 3, caption: '' }
    const document = applyDocumentCommand(createInitialDocument(), { type: 'media.add', media })
    const videoBlob = new Blob(['vid'], { type: media.mimeType })
    const store = new MemoryDocumentStore()
    store.document = document
    store.media.set(media.id, videoBlob)
    const request = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(input.toString())
      switch (init?.method) {
        case 'POST':
          return Response.json({ project: { id: document.id, name: document.data.name, revision: 0 } }, {
            status: 201,
            headers: { ETag: '"0"' },
          })
        case 'PUT':
          return Response.json({ media: { id: media.id, url: `/api/projects/${document.id}/media/${media.id}` } }, { status: 201 })
        default:
          throw new Error(`Requête inattendue : ${url.pathname}`)
      }
    })
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    actor.send({ type: 'media.source.register', mediaId: media.id, source: 'blob:video-local' })
    const coordinator = new ProjectSyncCoordinator(actor, store, new ElceProjectApiClient('http://127.0.0.1:5181', request))

    coordinator.schedule(document)
    await waitForSync()

    expect(request.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'PUT'])
    expect(store.media.get(media.id)).toBe(videoBlob)
    expect(store.syncState).toMatchObject({ uploadedMediaIds: [media.id], status: 'synced' })
    expect(actor.getSnapshot().context.mediaSources[media.id]).toBe('blob:video-local')

    coordinator.destroy()
    actor.stop()
  })

  it('waits for the server document and media acknowledgements before allowing a project change', async () => {
    const media = { id: 'media-before-switch', name: 'photo.webp', mimeType: 'image/webp', size: 3, caption: '' }
    const document = applyDocumentCommand(createInitialDocument(), { type: 'media.add', media })
    const store = new MemoryDocumentStore()
    store.document = document
    store.media.set(media.id, new Blob(['img'], { type: media.mimeType }))
    await store.saveDocument(document)
    let finishUpload!: (response: Response) => void
    const uploadResponse = new Promise<Response>((resolve) => { finishUpload = resolve })
    const request = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      switch (init?.method) {
        case 'POST':
          return Response.json({ project: { id: document.id, name: document.data.name, revision: 0 } }, {
            status: 201,
            headers: { ETag: '"0"' },
          })
        case 'PUT':
          return uploadResponse
        default:
          throw new Error(`Méthode inattendue : ${init?.method}`)
      }
    })
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    actor.send({ type: 'document.replace', document })
    const coordinator = new ProjectSyncCoordinator(actor, store, new ElceProjectApiClient('http://127.0.0.1:5181', request))

    coordinator.schedule(document)
    let completed = false
    const waitForSync = coordinator.waitUntilCurrentDocumentSynced().then(() => { completed = true })
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))

    expect(completed).toBe(false)
    finishUpload(Response.json({ media: { id: media.id, url: `/api/projects/${document.id}/media/${media.id}` } }, { status: 201 }))
    await waitForSync

    expect(completed).toBe(true)
    expect(store.syncState).toMatchObject({ status: 'synced', uploadedMediaIds: [media.id] })

    coordinator.destroy()
    actor.stop()
  })

  it('updates only the latest locally saved document against the confirmed ETag', async () => {
    const original = createInitialDocument()
    const renamed = applyDocumentCommand(original, { type: 'document.rename', name: 'Document actuel' })
    const store = new MemoryDocumentStore()
    await store.saveSyncState({
      documentId: original.id,
      remoteRevision: 2,
      uploadedMediaIds: [],
      status: 'synced',
    })
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { project: { id: renamed.id, name: renamed.data.name, revision: 3 } },
      { headers: { ETag: '"3"' } },
    ))
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    const coordinator = new ProjectSyncCoordinator(actor, store, new ElceProjectApiClient('http://127.0.0.1:5181', request))

    await store.saveDocument(renamed)
    coordinator.schedule(original)
    coordinator.schedule(renamed)
    await waitForSync()

    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', headers: { 'If-Match': '"2"' } })
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).name).toBe('Document actuel')
    expect(store.syncState).toMatchObject({ remoteRevision: 3, status: 'synced' })

    coordinator.destroy()
    actor.stop()
  })

  it('keeps a local conflict when the server revision changed independently', async () => {
    const local = applyDocumentCommand(createInitialDocument(), { type: 'document.rename', name: 'Local' })
    const remote = applyDocumentCommand(createInitialDocument(), { type: 'document.rename', name: 'Serveur' })
    const store = new MemoryDocumentStore()
    await store.saveSyncState({ documentId: local.id, remoteRevision: 4, uploadedMediaIds: [], status: 'pending' })
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: 'revision_mismatch' }, { status: 412 }))
      .mockResolvedValueOnce(Response.json(
        { project: { id: remote.id, name: remote.data.name, revision: 5 }, document: remote.toJSON() },
        { headers: { ETag: '"5"' } },
      ))
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    actor.send({ type: 'document.replace', document: local })
    const coordinator = new ProjectSyncCoordinator(actor, store, new ElceProjectApiClient('http://127.0.0.1:5181', request))

    await store.saveDocument(local)
    await store.saveSyncState({ documentId: local.id, remoteRevision: 4, uploadedMediaIds: [], status: 'pending' })
    coordinator.schedule(local)
    await expect(coordinator.waitUntilCurrentDocumentSynced()).rejects.toThrow('conflit')

    expect(request.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(['PUT', 'GET'])
    expect(store.syncState).toMatchObject({ remoteRevision: 5, status: 'conflict' })
    expect(actor.getSnapshot().context.syncStatus).toBe('conflict')

    coordinator.destroy()
    actor.stop()
  })

  it('keeps local changes queued while this window has yielded its editor lock', async () => {
    const original = createInitialDocument()
    const local = applyDocumentCommand(original, { type: 'document.rename', name: 'Cache locale actuelle' })
    const store = new MemoryDocumentStore()
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { project: { id: local.id, name: local.data.name, revision: 0 } },
      { status: 201, headers: { ETag: '"0"' } },
    ))
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    const coordinator = new ProjectSyncCoordinator(actor, store, new ElceProjectApiClient('http://127.0.0.1:5181', request))

    await coordinator.suspend()
    coordinator.schedule(local)
    await waitForSync()
    expect(request).not.toHaveBeenCalled()

    coordinator.resume(local)
    await waitForSync()
    expect(request).toHaveBeenCalledOnce()
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ name: 'Cache locale actuelle' })

    coordinator.destroy()
    actor.stop()
  })

  it('keeps a failed local sync pending and retries when the browser returns online', async () => {
    const document = createInitialDocument()
    const store = new MemoryDocumentStore()
    const onlineTarget = new EventTarget()
    vi.stubGlobal('window', onlineTarget)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const request = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(Response.json(
        { project: { id: document.id, name: document.data.name, revision: 0 } },
        { status: 201, headers: { ETag: '"0"' } },
      ))
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    actor.send({ type: 'document.replace', document })
    const coordinator = new ProjectSyncCoordinator(actor, store, new ElceProjectApiClient('http://127.0.0.1:5181', request))

    await store.saveDocument(document)
    coordinator.schedule(document)
    await expect(coordinator.waitUntilCurrentDocumentSynced()).rejects.toThrow('Network unavailable')
    expect(request).toHaveBeenCalledOnce()
    expect(actor.getSnapshot().context.syncStatus).toBe('pending')
    expect(store.syncState).toMatchObject({ documentId: document.id, status: 'pending' })

    onlineTarget.dispatchEvent(new Event('online'))
    await waitForSync()

    expect(request).toHaveBeenCalledTimes(2)
    expect(store.syncState).toMatchObject({ status: 'synced', remoteRevision: 0 })
    coordinator.destroy()
    actor.stop()
  })
})

/** Waits beyond the configured debounce so the queued network job can finish. */
async function waitForSync(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 600))
}
