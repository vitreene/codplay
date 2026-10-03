import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { BDC_LOCATION, BDC_TYPE, DEFAULT_PRESET_ID, MEDIA_TYPE } from '../../config/document-config'
import { applyDocumentCommand } from '../commands/document-commands'
import { createInitialDocument } from '../../domain/document-model'
import type { ElceDocument } from '../../domain/document-model'
import type { ElceDocumentStore, MediaBlob } from '../../infrastructure/indexed-db/document-store-types'
import { controllerMachine } from './controller-machine'
import { attachDocumentPersistence } from './document-persistence'

class MemoryDocumentStore implements ElceDocumentStore {
  public document: ElceDocument | null = null
  public readonly media = new Map<string, Blob>()
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

  public async saveMedia(media: MediaBlob): Promise<void> {
    this.media.set(media.id, media.blob)
  }

  public async loadMedia(mediaId: string): Promise<Blob | null> {
    return this.media.get(mediaId) ?? null
  }
}

describe('Elcé document persistence boundary', () => {
  it('restores the document and persists later controller commits', async () => {
    const stored = applyDocumentCommand(createInitialDocument(), { type: 'document.rename', name: 'Document restauré' })
    const store = new MemoryDocumentStore()
    store.document = stored
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()

    const detach = await attachDocumentPersistence(actor, store)

    expect(actor.getSnapshot().context.document.data.name).toBe('Document restauré')
    actor.send({ type: 'page.create' })
    await Promise.resolve()

    expect(store.document?.pages).toHaveLength(2)
    detach()
    actor.stop()
  })

  it('persists a media merge and its blob deletions as one store operation', async () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-canonical', type: MEDIA_TYPE.VIDEO, name: 'sample-video.mp4', mimeType: 'video/mp4', size: 3, caption: '' },
    })
    const withDuplicate = applyDocumentCommand(withMedia, {
      type: 'media.add',
      media: { id: 'media-duplicate', type: MEDIA_TYPE.VIDEO, name: 'duplicate.mp4', mimeType: 'video/mp4', size: 3, caption: '' },
    })
    const withBdc = applyDocumentCommand(withDuplicate, {
      type: 'bdc.create',
      bdcId: 'bdc-video-existing',
      bdcType: BDC_TYPE.VIDEO,
      presetId: DEFAULT_PRESET_ID.VIDEO,
      mediaId: 'media-duplicate',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const store = new MemoryDocumentStore()
    store.document = withBdc
    store.media.set('media-canonical', new Blob(['one']))
    store.media.set('media-duplicate', new Blob(['one']))
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    actor.start()
    const detach = await attachDocumentPersistence(actor, store)

    actor.send({
      type: 'document.apply',
      command: { type: 'media.merge', canonicalMediaId: 'media-canonical', duplicateMediaIds: ['media-duplicate'] },
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(store.atomicMediaDeletions).toEqual([['media-duplicate']])
    expect(store.document?.bdcs.find((bdc) => bdc.id === 'bdc-video-existing')?.mediaId).toBe('media-canonical')
    expect(store.media.has('media-duplicate')).toBe(false)
    expect(store.media.has('media-canonical')).toBe(true)
    detach()
    actor.stop()
  })
})
