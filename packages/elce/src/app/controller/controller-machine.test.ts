import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { assertDocumentInvariants } from '../commands/document-commands'
import { BDC_LOCATION, BDC_TYPE, CATALOG_REFERENCE, CATALOG_TAB } from '../../config/document-config'
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

  public async saveDocumentAndDeleteMedia(): Promise<void> {
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
    expect(actor.getSnapshot().context.catalogTab).toBe(CATALOG_TAB.AVAILABLE_BDCS)

    actor.send({ type: 'page.create', name: 'Page nommée' })

    expect(actor.getSnapshot().context.document.pages).toHaveLength(2)
    expect(actor.getSnapshot().context.document.pages[1]?.name).toBe('Page nommée')
    assertDocumentInvariants(actor.getSnapshot().context.document)

    actor.stop()
  })

  it('owns the catalog tab and permanent catalog-bdc deletion through XState', () => {
    const actor = createActor(controllerMachine, { input: {} })
    actor.start()
    actor.send({ type: 'catalog.tab.select', tabId: CATALOG_TAB.MEDIA })
    actor.send({
      type: 'document.apply',
      command: {
        type: 'media.add',
        media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
      },
    })
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.create',
        bdcId: 'bdc-catalog-image-1',
        bdcType: BDC_TYPE.IMAGE,
        presetId: 'image-basic',
        mediaId: 'media-image-1',
        placement: { kind: BDC_LOCATION.CATALOG },
      },
    })
    actor.send({ type: 'document.apply', command: { type: 'bdc.delete', bdcId: 'bdc-catalog-image-1' } })

    expect(actor.getSnapshot().context.catalogTab).toBe(CATALOG_TAB.MEDIA)
    expect(actor.getSnapshot().context.document.data.catalogBdcIds).toEqual([])
    expect(actor.getSnapshot().context.document.bdcs.map((bdc) => bdc.id)).toEqual(['bdc-section-1'])
    expect(actor.getSnapshot().context.document.medias.map((media) => media.id)).toEqual(['media-image-1'])
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
    actor.send({ type: 'section.change', sectionBdcId: 'bdc-section-1', change: fileDrop(secondFile, secondTarget, 'two', { target: firstTarget, text: 'one' }) })
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

  it('deletes an anchored bdc when the editor removes it through an ordinary text update', async () => {
    const actor = createActor(controllerMachine, { input: {} })
    actor.start()
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.anchor.create',
        sectionBdcId: 'bdc-section-1',
        pageId: 'page-a',
        bdcId: 'bdc-image-1',
        bdcType: BDC_TYPE.IMAGE,
        presetId: 'image-basic',
        media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
        partId: 'page-a:bdc-image-1:anchor',
        markup: '<p>Avant <span data-bdc-id="bdc-image-1"></span> après</p>',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [
            { type: 'text', text: 'Avant ' },
            { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
            { type: 'text', text: ' après' },
          ] }],
        },
      },
    })

    actor.send({
      type: 'section.change',
      sectionBdcId: 'bdc-section-1',
      change: {
        kind: 'content',
        title: '',
        markup: '<p>Avant après</p>',
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Avant après' }] }] },
      },
    })
    await flush()

    expect(actor.getSnapshot().context.document.pages[0]?.bdcIds).toEqual(['bdc-section-1'])
    expect(actor.getSnapshot().context.document.data.catalogBdcIds).toEqual([])
    expect(actor.getSnapshot().context.document.bdcs.map((bdc) => bdc.id)).toEqual(['bdc-section-1'])
    expect(actor.getSnapshot().context.document.medias.map((media) => media.id)).toEqual(['media-image-1'])
    assertDocumentInvariants(actor.getSnapshot().context.document)
    actor.stop()
  })

  it('creates unique bdcs for reused media through XState without copying the media', async () => {
    const store = new PendingMediaStore()
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    const service = new ElceAnchorDropService()
    actor.start()
    actor.send({
      type: 'document.apply',
      command: {
        type: 'media.add',
        media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
      },
    })
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.create',
        bdcId: 'bdc-catalog-image-1',
        bdcType: BDC_TYPE.IMAGE,
        presetId: 'image-basic',
        mediaId: 'media-image-1',
        placement: { kind: BDC_LOCATION.CATALOG },
      },
    })

    const mediaTarget = service.createCatalogDropTarget(
      actor.getSnapshot().context.document,
      { kind: CATALOG_REFERENCE.MEDIA, mediaId: 'media-image-1' },
      'page-a',
      'bdc-section-1',
    )
    if (mediaTarget === null) throw new Error('Le média existant doit être réutilisable.')
    actor.send({ type: 'section.change', sectionBdcId: 'bdc-section-1', change: catalogDrop(mediaTarget, 'Image réutilisée') })
    await flush()

    const secondMediaTarget = service.createCatalogDropTarget(
      actor.getSnapshot().context.document,
      { kind: CATALOG_REFERENCE.MEDIA, mediaId: 'media-image-1' },
      'page-a',
      'bdc-section-1',
    )
    if (secondMediaTarget === null) throw new Error('Le même média doit pouvoir créer une deuxième instance de bdc.')
    actor.send({
      type: 'section.change',
      sectionBdcId: 'bdc-section-1',
      change: catalogDrop(secondMediaTarget, 'Deuxième usage', { target: mediaTarget, text: 'Image réutilisée' }),
    })
    await flush()

    const document = actor.getSnapshot().context.document
    expect(secondMediaTarget.bdcId).not.toBe(mediaTarget.bdcId)
    expect(document.pages[0]?.bdcIds).toEqual(['bdc-section-1', mediaTarget.bdcId, secondMediaTarget.bdcId])
    expect(document.bdcs.filter((bdc) => bdc.type === BDC_TYPE.IMAGE && bdc.pageId === 'page-a').map((bdc) => bdc.mediaId))
      .toEqual(['media-image-1', 'media-image-1'])
    expect(document.data.catalogBdcIds).toEqual(['bdc-catalog-image-1'])
    expect(actor.getSnapshot().context.document.medias.map((media) => media.id)).toEqual(['media-image-1'])
    expect(store.pending).toHaveLength(0)
    assertDocumentInvariants(document)
    actor.stop()
  })

  it('attaches an available catalog bdc through the XState anchor command path', async () => {
    const actor = createActor(controllerMachine, { input: {} })
    const service = new ElceAnchorDropService()
    actor.start()
    actor.send({
      type: 'document.apply',
      command: {
        type: 'media.add',
        media: { id: 'media-image-1', type: 'image', name: 'photo.png', mimeType: 'image/png', size: 10, caption: '' },
      },
    })
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.create',
        bdcId: 'bdc-image-1',
        bdcType: BDC_TYPE.IMAGE,
        presetId: 'image-basic',
        mediaId: 'media-image-1',
        placement: { kind: BDC_LOCATION.CATALOG },
      },
    })

    const target = service.createCatalogDropTarget(
      actor.getSnapshot().context.document,
      { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-image-1' },
      'page-a',
      'bdc-section-1',
    )
    if (target === null) throw new Error('Le BDC disponible doit pouvoir être déposé dans la Section.')
    actor.send({ type: 'section.change', sectionBdcId: 'bdc-section-1', change: catalogDrop(target, 'Image existante') })
    await flush()

    const document = actor.getSnapshot().context.document
    expect(document.pages[0]?.bdcIds).toEqual(['bdc-section-1', 'bdc-image-1'])
    expect(document.data.catalogBdcIds).toEqual([])
    expect(document.bdcs.find((bdc) => bdc.id === 'bdc-image-1')).toMatchObject({
      pageId: 'page-a',
      mediaId: 'media-image-1',
    })
    expect(document.medias.map((media) => media.id)).toEqual(['media-image-1'])
    expect(service.createCatalogDropTarget(
      document,
      { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-image-1' },
      'page-a',
      'bdc-section-1',
    )).toBeNull()
    assertDocumentInvariants(document)
    actor.stop()
  })

  it('returns an anchored bdc to the available catalog through XState', async () => {
    const actor = createActor(controllerMachine, { input: {} })
    actor.start()
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.anchor.create',
        sectionBdcId: 'bdc-section-1',
        pageId: 'page-a',
        bdcId: 'bdc-image-1',
        bdcType: BDC_TYPE.IMAGE,
        presetId: 'image-basic',
        media: { id: 'media-image-1', type: 'image', name: 'photo.png', mimeType: 'image/png', size: 10, caption: '' },
        partId: 'page-a:bdc-image-1:anchor',
        markup: '<p>Avant <span data-bdc-id="bdc-image-1"></span> après</p>',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [
            { type: 'text', text: 'Avant ' },
            { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
            { type: 'text', text: ' après' },
          ] }],
        },
      },
    })
    actor.send({
      type: 'section.change',
      sectionBdcId: 'bdc-section-1',
      change: {
        kind: 'anchor-return',
        anchorBdcId: 'bdc-image-1',
        title: '',
        markup: '<p>Avant après</p>',
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Avant après' }] }] },
      },
    })
    await flush()

    const document = actor.getSnapshot().context.document
    expect(document.pages[0]?.bdcIds).toEqual(['bdc-section-1'])
    expect(document.data.catalogBdcIds).toEqual(['bdc-image-1'])
    expect(document.bdcs.find((bdc) => bdc.id === 'bdc-image-1')).toMatchObject({
      pageId: null,
      mediaId: 'media-image-1',
    })
    expect(document.medias.map((media) => media.id)).toEqual(['media-image-1'])
    assertDocumentInvariants(document)
    actor.stop()
  })
})

function fileDrop(
  file: File,
  target: NonNullable<ReturnType<ElceAnchorDropService['createFileDropTarget']>>,
  text: string,
  previous?: Readonly<{ target: NonNullable<ReturnType<ElceAnchorDropService['createFileDropTarget']>>; text: string }>,
): ElceSectionChange {
  const previousNodes = previous === undefined
    ? []
    : [
        { type: 'text', text: previous.text },
        { type: 'elceAnchor', attrs: { bdcId: previous.target.bdcId, partId: previous.target.partId } },
      ]
  const previousMarkup = previous === undefined
    ? ''
    : `${previous.text}<span data-elce-anchor="true" data-bdc-id="${previous.target.bdcId}"></span>`
  return {
    kind: 'file-drop',
    file,
    target,
    title: '',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [
        ...previousNodes,
        { type: 'text', text },
        { type: 'elceAnchor', attrs: { bdcId: target.bdcId, partId: target.partId } },
      ] }],
    },
    markup: `<p>${previousMarkup}${text}<span data-elce-anchor="true" data-bdc-id="${target.bdcId}"></span></p>`,
  }
}

function catalogDrop(
  target: NonNullable<ReturnType<ElceAnchorDropService['createCatalogDropTarget']>>,
  text: string,
  previous?: Readonly<{
    target: NonNullable<ReturnType<ElceAnchorDropService['createCatalogDropTarget']>>
    text: string
  }>,
): ElceSectionChange {
  const previousContent = previous === undefined
    ? []
    : [
        { type: 'text', text: `${previous.text} ` },
        { type: 'elceAnchor', attrs: { bdcId: previous.target.bdcId, partId: previous.target.partId } },
        { type: 'text', text: ' ' },
      ]
  const previousMarkup = previous === undefined
    ? ''
    : `${previous.text} <span id="${previous.target.partId}" data-bdc-id="${previous.target.bdcId}"></span> `
  return {
    kind: 'catalog-drop',
    target,
    title: '',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [
        ...previousContent,
        { type: 'text', text: `${text} ` },
        { type: 'elceAnchor', attrs: { bdcId: target.bdcId, partId: target.partId } },
      ] }],
    },
    markup: `<p id="section-text-1">${previousMarkup}${text} <span id="${target.partId}" data-bdc-id="${target.bdcId}"></span></p>`,
  }
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}
