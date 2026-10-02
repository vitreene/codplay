import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { applyDocumentCommand } from '../commands/document-commands'
import { createInitialDocument } from '../../domain/document-model'
import type { ElceDocument } from '../../domain/document-model'
import type { ElceDocumentStore, MediaBlob } from '../../infrastructure/indexed-db/document-store-types'
import { controllerMachine } from './controller-machine'
import { attachDocumentPersistence } from './document-persistence'

class MemoryDocumentStore implements ElceDocumentStore {
  public document: ElceDocument | null = null
  public readonly media = new Map<string, Blob>()

  public async loadDocument(): Promise<ElceDocument | null> {
    return this.document
  }

  public async saveDocument(document: ElceDocument): Promise<void> {
    this.document = document
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
})
