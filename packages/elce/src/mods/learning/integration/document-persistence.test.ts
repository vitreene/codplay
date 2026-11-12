import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { BDC_TYPE, DEFAULT_PRESET_ID } from '../learning-definition'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { BDC_LOCATION } from '../../../core/document/content-location'
import { applyDocumentCommand } from '../../../domain/commands/document-commands'
import { learningDocumentService } from '../document/learning-document-service'
import type { LearningDocument } from '../document/learning-document'
import type { LearningDocumentStore as ElceDocumentStore } from '../persistence/learning-document-store'
import type { MediaBlob } from '../../../core/persistence/indexed-db/document-store-types'
import { learningControllerMachine as controllerMachine } from '../authoring/learning-controller-machine'
import { attachLearningDocumentPersistence as attachDocumentPersistence } from '../persistence/learning-document-persistence'
import { ElceMediaResourceService } from '../../../domain/media/media-resource-service'

class MemoryDocumentStore implements ElceDocumentStore {
  public document: LearningDocument | null = null
  public readonly media = new Map<string, Blob>()
  public readonly syncStates = new Map<string, {
    documentId: string
    remoteRevision: number | null
    uploadedMediaIds: readonly string[]
    status: 'pending' | 'synced' | 'conflict'
  }>()
  public atomicMediaDeletions: string[][] = []

  public async loadDocument(): Promise<LearningDocument | null> {
    return this.document
  }

  public async saveDocument(document: LearningDocument): Promise<void> {
    this.document = document
  }

  public async saveDocumentAndDeleteMedia(document: LearningDocument, mediaIds: readonly string[]): Promise<void> {
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
  it('keeps Undo on an unchanged focus restore and clears it for a newer installed server document', async () => {
    const store = new MemoryDocumentStore()
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    const persistence = await attachDocumentPersistence(actor, store)
    actor.send({ type: 'editor.access.activate' })
    actor.send({ type: 'document.apply', command: { type: 'document.rename', name: 'Édition locale' } })
    await persistence.flushLocalChanges()
    expect(actor.getSnapshot().context.history.past).toHaveLength(1)

    await persistence.restoreCurrentDocument()
    expect(actor.getSnapshot().context.history.past).toHaveLength(1)
    actor.send({ type: 'editor.access.suspend' })
    const remote = applyDocumentCommand(actor.getSnapshot().context.document, { type: 'document.rename', name: 'Révision distante' })
    await persistence.installServerDocument(remote, [])
    expect(actor.getSnapshot().context.history.past).toHaveLength(0)
    persistence.detach()
    actor.stop()
  })

  it('retains imported bytes through Undo and Redo, then releases them when Redo is abandoned', async () => {
    const store = new MemoryDocumentStore()
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    const persistence = await attachDocumentPersistence(actor, store)
    actor.send({ type: 'editor.access.activate' })
    actor.send({ type: 'document.apply', command: {
      type: 'bdc.create', bdcId: 'bdc-question-undo', bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    } })
    const imported = new ElceMediaResourceService().createImport(new File(['image bytes'], 'undo.png', { type: 'image/png' }))
    if (imported === null) throw new Error('Le fichier de test doit être accepté.')
    actor.send({ type: 'question.media.file.import', bdcId: 'bdc-question-undo', ...imported })
    await flushActor()
    await persistence.flushLocalChanges()
    expect(store.media.has(imported.media.id)).toBe(true)

    actor.send({ type: 'history.undo' })
    await persistence.flushLocalChanges()
    expect(store.document?.medias).toHaveLength(0)
    expect(store.media.has(imported.media.id)).toBe(true)

    actor.send({ type: 'history.redo' })
    await persistence.flushLocalChanges()
    expect(store.document?.medias.map((media) => media.id)).toEqual([imported.media.id])
    expect(store.media.has(imported.media.id)).toBe(true)

    actor.send({ type: 'history.undo' })
    actor.send({ type: 'document.apply', command: { type: 'document.rename', name: 'Nouvelle branche' } })
    await persistence.flushLocalChanges()
    expect(store.media.has(imported.media.id)).toBe(false)
    expect(actor.getSnapshot().context.history.future).toHaveLength(0)

    const abandoned = new ElceMediaResourceService().createImport(new File(['other bytes'], 'abandoned.png', { type: 'image/png' }))
    if (abandoned === null) throw new Error('Le second fichier de test doit être accepté.')
    actor.send({ type: 'question.media.file.import', bdcId: 'bdc-question-undo', ...abandoned })
    await flushActor()
    actor.send({ type: 'history.undo' })
    await persistence.flushLocalChanges()
    expect(store.media.has(abandoned.media.id)).toBe(true)
    persistence.detach()
    await Promise.resolve()
    expect(store.media.has(abandoned.media.id)).toBe(false)
    actor.stop()
  })

  it('releases an uploaded image cache when its import falls out of the bounded history', async () => {
    const store = new MemoryDocumentStore()
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    const persistence = await attachDocumentPersistence(actor, store, {
      mediaSourceUrl: (documentId, mediaId) => `https://elce.test/api/projects/${documentId}/media/${mediaId}`,
    })
    actor.send({ type: 'editor.access.activate' })
    actor.send({ type: 'document.apply', command: {
      type: 'bdc.create', bdcId: 'bdc-question-eviction', bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    } })
    const imported = new ElceMediaResourceService().createImport(new File(['image bytes'], 'eviction.png', { type: 'image/png' }))
    if (imported === null) throw new Error('Le fichier de test doit être accepté.')
    actor.send({ type: 'question.media.file.import', bdcId: 'bdc-question-eviction', ...imported })
    await flushActor()
    await persistence.flushLocalChanges()
    await store.saveSyncState({
      documentId: actor.getSnapshot().context.document.id,
      remoteRevision: 1,
      uploadedMediaIds: [imported.media.id],
      status: 'synced',
    })

    for (let index = 0; index < 100; index += 1) {
      actor.send({ type: 'document.apply', command: { type: 'document.rename', name: `Édition ${index}` } })
    }
    await persistence.flushLocalChanges()

    expect(store.media.has(imported.media.id)).toBe(false)
    expect(actor.getSnapshot().context.mediaSources[imported.media.id]).toBe(
      `https://elce.test/api/projects/${actor.getSnapshot().context.document.id}/media/${imported.media.id}`,
    )
    expect(actor.getSnapshot().context.history.past).toHaveLength(100)
    persistence.detach()
    actor.stop()
  })

  it('installs a confirmed server document without marking it as a local edit', async () => {
    const local = learningDocumentService.createInitialDocument()
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
    const stored = applyDocumentCommand(learningDocumentService.createInitialDocument(), { type: 'document.rename', name: 'Document restauré' })
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
    const withMedia = applyDocumentCommand(learningDocumentService.createInitialDocument(), {
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

/** Lets the asynchronous media worker and actor finish without relying on media timings. */
async function flushActor(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) await new Promise<void>((resolve) => setTimeout(resolve, 0))
}
