import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { assertDocumentInvariants } from '../commands/document-commands'
import type { ElceDocumentStore, MediaBlob } from '../../infrastructure/indexed-db/document-store-types'
import { ElceAnchorDropService } from '../../domain/anchor-drop-service'
import type { ElceSectionChange } from '../../domain/anchor-types'
import { controllerMachine } from './controller-machine'

class PendingMediaStore implements ElceDocumentStore {
  public readonly pending: Array<{ media: MediaBlob; resolve: () => void }> = []

  public async loadDocument(): Promise<null> {
    return null
  }

  public async saveDocument(): Promise<void> {
    return undefined
  }

  public saveMedia(media: MediaBlob): Promise<void> {
    return new Promise((resolve) => this.pending.push({ media, resolve }))
  }

  public async loadMedia(): Promise<null> {
    return null
  }
}

describe('Elcé controller', () => {
  it('starts with the application ready for a document', () => {
    const actor = createActor(controllerMachine, { input: {} })

    actor.start()

    expect(actor.getSnapshot().value).toBe('ready')
    expect(actor.getSnapshot().context.document.id).toBe('elce-document')
    expect(actor.getSnapshot().context.document.pages).toHaveLength(1)

    actor.send({ type: 'page.create', name: 'Page nommée' })

    expect(actor.getSnapshot().context.document.pages).toHaveLength(2)
    expect(actor.getSnapshot().context.document.pages[1]?.name).toBe('Page nommée')
    assertDocumentInvariants(actor.getSnapshot().context.document)

    actor.stop()
  })

  it('serializes anchor drops in the XState command path', async () => {
    const store = new PendingMediaStore()
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    const service = new ElceAnchorDropService()
    const firstFile = new File(['one'], 'one.png', { type: 'image/png' })
    const secondFile = new File(['two'], 'two.png', { type: 'image/png' })
    const firstTarget = service.createFileDropTarget(firstFile, 'page-a')
    const secondTarget = service.createFileDropTarget(secondFile, 'page-a')
    if (firstTarget === null || secondTarget === null) throw new Error('Les cibles de test doivent être acceptées.')
    actor.start()

    actor.send({ type: 'section.change', sectionBdcId: 'bdc-section-1', change: fileDrop(firstFile, firstTarget, 'one') })
    actor.send({ type: 'section.change', sectionBdcId: 'bdc-section-1', change: fileDrop(secondFile, secondTarget, 'two') })
    await flush()

    expect(store.pending.map(({ media }) => media.id)).toEqual([firstTarget.media.id])
    expect(actor.getSnapshot().context.document.bdcs).toHaveLength(1)

    store.pending[0]?.resolve()
    await flush()
    expect(store.pending.map(({ media }) => media.id)).toEqual([firstTarget.media.id, secondTarget.media.id])
    expect(actor.getSnapshot().context.document.bdcs).toHaveLength(2)

    store.pending[1]?.resolve()
    await flush()
    expect(actor.getSnapshot().context.document.bdcs).toHaveLength(3)
    expect(actor.getSnapshot().context.document.pages[0]?.bdcIds).toEqual([
      'bdc-section-1',
      firstTarget.bdcId,
      secondTarget.bdcId,
    ])
    expect(actor.getSnapshot().context.document.bdcs[0]?.section?.markup).toContain('data-elce-anchor="true"')
    expect(actor.getSnapshot().context.document.medias.map((media) => media.name)).toEqual(['one.png', 'two.png'])
    assertDocumentInvariants(actor.getSnapshot().context.document)
    actor.stop()
  })
})

function fileDrop(
  file: File,
  target: NonNullable<ReturnType<ElceAnchorDropService['createFileDropTarget']>>,
  text: string,
): ElceSectionChange {
  return {
    kind: 'file-drop',
    file,
    target,
    title: '',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    markup: `<p>${text}<span data-elce-anchor="true" data-bdc-id="${target.bdcId}"></span></p>`,
  }
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}
