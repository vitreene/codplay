import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { BDC_LOCATION, BDC_TYPE, DEFAULT_PRESET_ID, PAGE_LOCATION } from '../../config/document-config'
import { applyDocumentCommand } from '../../domain/commands/document-commands'
import { createInitialDocument } from '../../domain/document/document-model'
import type { ElceDocument } from '../../domain/document/document-model'
import type { ElceDocumentStore, MediaBlob } from '../../infrastructure/indexed-db/document-store-types'
import { controllerMachine } from './controller-machine'
import { attachDocumentPersistence } from './document-persistence'

class MemoryDocumentStore implements ElceDocumentStore {
  public document: ElceDocument | null = null
  public readonly media = new Map<string, Blob>()
  public readonly syncStates = new Map<string, {
    documentId: string
    remoteRevision: number | null
    uploadedMediaIds: readonly string[]
    status: 'pending' | 'synced' | 'conflict'
  }>()
  public atomicMediaDeletions: string[][] = []

  public async loadDocument(): Promise<ElceDocument | null> {
    return this.document
  }

  public async saveDocument(document: ElceDocument): Promise<void> {
    this.document = document
  }

  public async saveDocumentAndDeleteMedia(document: ElceDocument, mediaIds: readonly string[]): Promise<void> {
    this.document = document
    this.atomicMediaDeletions.push([...mediaIds])
    for (const mediaId of mediaIds) this.media.delete(mediaId)
  }

  public async deleteDocument(documentId: string): Promise<void> {
    if (this.document?.id === documentId) this.document = null
    this.syncStates.delete(documentId)
  }

  public async loadSyncState(documentId: string) {
    return this.syncStates.get(documentId) ?? { documentId, remoteRevision: null, uploadedMediaIds: [], status: 'pending' as const }
  }

  public async saveSyncState(syncState: {
    documentId: string
    remoteRevision: number | null
    uploadedMediaIds: readonly string[]
    status: 'pending' | 'synced' | 'conflict'
  }): Promise<void> {
    this.syncStates.set(syncState.documentId, syncState)
  }

  public async deleteMedia(mediaIds: readonly string[]): Promise<void> {
    for (const mediaId of mediaIds) this.media.delete(mediaId)
  }

  public async saveMedia(media: MediaBlob): Promise<void> {
    this.media.set(media.id, media.blob)
  }

  public async loadMedia(mediaId: string): Promise<Blob | null> {
    return this.media.get(mediaId) ?? null
  }
}

describe('Elcé document persistence boundary', () => {
  it('installs a confirmed server document without marking it as a local edit', async () => {
    const local = createInitialDocument()
    const media = { id: 'media-server', name: 'remote.webp', mimeType: 'image/webp', size: 3, caption: '' }
    const remote = applyDocumentCommand(
      applyDocumentCommand(local, { type: 'document.rename', name: 'Version distante' }),
      { type: 'media.add', media },
    )
    const store = new MemoryDocumentStore()
    store.document = local
    await store.saveSyncState({
      documentId: local.id,
      remoteRevision: 1,
      uploadedMediaIds: [],
      status: 'synced',
    })
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    const persistence = await attachDocumentPersistence(actor, store, {
      mediaSourceUrl: (documentId, mediaId) => `https://elce.test/api/projects/${documentId}/media/${mediaId}`,
    })
    actor.send({ type: 'editor.access.activate' })
    store.document = remote
    await store.saveSyncState({
      documentId: remote.id,
      remoteRevision: 2,
      uploadedMediaIds: [media.id],
      status: 'synced',
    })

    await persistence.installServerDocument(remote, [media.id])

    expect(actor.getSnapshot().context.document.data.name).toBe('Version distante')
    expect(actor.getSnapshot().context.syncStatus).toBe('synced')
    expect(actor.getSnapshot().context.mediaSources[media.id]).toBe(
      `https://elce.test/api/projects/${remote.id}/media/${media.id}`,
    )
    expect(store.document).toBe(remote)

    persistence.detach()
    actor.stop()
  })

  it('restores the document and persists later controller commits', async () => {
    const stored = applyDocumentCommand(createInitialDocument(), { type: 'document.rename', name: 'Document restauré' })
    const store = new MemoryDocumentStore()
    store.document = stored
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()

    const persistence = await attachDocumentPersistence(actor, store)
    actor.send({ type: 'editor.access.activate' })

    expect(actor.getSnapshot().context.document.data.name).toBe('Document restauré')
    actor.send({ type: 'page.create', placement: { kind: PAGE_LOCATION.SCENARIO } })
    await Promise.resolve()

    expect(store.document?.pages).toHaveLength(2)
    persistence.detach()
    actor.stop()
  })

  it('persists a media merge and its blob deletions as one store operation', async () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-canonical',  name: 'sample-video.mp4', mimeType: 'video/mp4', size: 3, caption: '' },
    })
    const withDuplicate = applyDocumentCommand(withMedia, {
      type: 'media.add',
      media: { id: 'media-duplicate',  name: 'duplicate.mp4', mimeType: 'video/mp4', size: 3, caption: '' },
    })
    const withBdc = applyDocumentCommand(withDuplicate, {
      type: 'bdc.create',
      bdcId: 'bdc-video-existing',
      bdcType: BDC_TYPE.CARD,
      presetId: DEFAULT_PRESET_ID.PHOTO,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const withCardMedia = applyDocumentCommand(withBdc, {
      type: 'bdc.card.media.set',
      bdcId: 'bdc-video-existing',
      mediaId: 'media-duplicate',
    })
    const store = new MemoryDocumentStore()
    store.document = withCardMedia
    store.media.set('media-canonical', new Blob(['one']))
    store.media.set('media-duplicate', new Blob(['one']))
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    const persistence = await attachDocumentPersistence(actor, store)
    actor.send({ type: 'editor.access.activate' })

    actor.send({
      type: 'document.apply',
      command: { type: 'media.merge', canonicalMediaId: 'media-canonical', duplicateMediaIds: ['media-duplicate'] },
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(store.atomicMediaDeletions).toEqual([['media-duplicate']])
    expect(store.document?.bdcs.find((bdc) => bdc.id === 'bdc-video-existing')?.card?.mediaId).toBe('media-canonical')
    expect(store.media.has('media-duplicate')).toBe(false)
    expect(store.media.has('media-canonical')).toBe(true)
    persistence.detach()
    actor.stop()
  })

  it('restores the shared active-document cache before granting a second window edit access', async () => {
    const store = new MemoryDocumentStore()
    const firstActor = createActor(controllerMachine, { input: { documentStore: store } })
    firstActor.start()
    const firstPersistence = await attachDocumentPersistence(firstActor, store)
    firstActor.send({ type: 'editor.access.activate' })
    firstActor.send({ type: 'document.apply', command: { type: 'document.rename', name: 'Dernière copie locale' } })
    await firstPersistence.flushLocalChanges()

    const secondActor = createActor(controllerMachine, { input: { documentStore: store } })
    secondActor.start()
    const secondPersistence = await attachDocumentPersistence(secondActor, store)

    expect(secondActor.getSnapshot().context.document.data.name).toBe('Dernière copie locale')
    secondActor.send({ type: 'page.create', placement: { kind: PAGE_LOCATION.SCENARIO } })
    expect(secondActor.getSnapshot().context.document.pages).toHaveLength(1)

    secondActor.send({ type: 'editor.access.activate' })
    expect(secondActor.getSnapshot().context.editAccess).toBe('active')
    secondActor.send({ type: 'page.create', placement: { kind: PAGE_LOCATION.SCENARIO } })
    expect(secondActor.getSnapshot().context.document.pages).toHaveLength(2)

    firstPersistence.detach()
    secondPersistence.detach()
    firstActor.stop()
    secondActor.stop()
  })
})
