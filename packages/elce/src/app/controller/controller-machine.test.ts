import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { assertDocumentInvariants } from '../commands/document-commands'
import { BDC_LOCATION, BDC_TYPE, CATALOG_REFERENCE, CATALOG_TAB, DEFAULT_PRESET_ID, PAGE_LOCATION } from '../../config/document-config'
import type { ElceDocumentStore, MediaBlob } from '../../infrastructure/indexed-db/document-store-types'
import { ElceAnchorDropService } from '../../domain/anchor/anchor-drop-service'
import { ElceMediaResourceService } from '../../domain/media/media-resource-service'
import type { ElceSectionChange } from '../../domain/anchor/anchor-types'
import { controllerMachine } from './controller-machine'

class PendingMediaStore implements ElceDocumentStore {
  public readonly pending: Array<{ media: MediaBlob; resolve: () => void }> = []
  public readonly media = new Map<string, Blob>()

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
    return new Promise((resolve) => this.pending.push({
      media,
      resolve: () => {
        this.media.set(media.id, media.blob)
        resolve()
      },
    }))
  }

  public async loadMedia(mediaId: string): Promise<Blob | null> {
    return this.media.get(mediaId) ?? null
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

    actor.send({ type: 'page.create', placement: { kind: PAGE_LOCATION.SCENARIO } })

    expect(actor.getSnapshot().context.document.pages).toHaveLength(2)
    expect(actor.getSnapshot().context.document.pages[1]).toMatchObject({ name: 'Page B', chapterId: null })
    expect(actor.getSnapshot().context.document.scenarioPageIds).toEqual([
      'page-a',
      actor.getSnapshot().context.document.pages[1]?.id,
    ])
    expect(actor.getSnapshot().context.selectedPageId).toBe(actor.getSnapshot().context.document.pages[1]?.id)

    actor.send({ type: 'page.create', placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' }, name: 'Page nommée' })

    expect(actor.getSnapshot().context.document.pages[2]).toMatchObject({ name: 'Page nommée', chapterId: 'chapter-1' })
    expect(actor.getSnapshot().context.document.chapters[0]?.pageIds).toEqual(['page-a', actor.getSnapshot().context.document.pages[2]?.id])
    expect(actor.getSnapshot().context.document.scenarioPageIds).toEqual([
      'page-a',
      actor.getSnapshot().context.document.pages[2]?.id,
      actor.getSnapshot().context.document.pages[1]?.id,
    ])
    assertDocumentInvariants(actor.getSnapshot().context.document)

    actor.stop()
  })

  it('owns chapter selection and clears it when a page is selected', () => {
    const actor = createActor(controllerMachine, { input: {} })
    actor.start()
    actor.send({ type: 'chapter.select', chapterId: 'chapter-1' })

    expect(actor.getSnapshot().context.selectedChapterId).toBe('chapter-1')

    actor.send({ type: 'page.select', pageId: 'page-a' })
    expect(actor.getSnapshot().context.selectedChapterId).toBeNull()
    expect(actor.getSnapshot().context.selectedPageId).toBe('page-a')

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
        media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
      },
    })
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.create',
        bdcId: 'bdc-catalog-image-1',
        bdcType: BDC_TYPE.CARD,
        presetId: 'photo-basic',
        placement: { kind: BDC_LOCATION.CATALOG },
      },
    })
    actor.send({ type: 'document.apply', command: { type: 'bdc.card.media.set', bdcId: 'bdc-catalog-image-1', mediaId: 'media-image-1' } })
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
    ])
    expect(actor.getSnapshot().context.document.bdcs[0]?.section?.markup).toContain('data-elce-anchor="true"')
    expect(actor.getSnapshot().context.document.medias.map((media) => media.name)).toEqual(['one.png', 'two.png'])
    assertDocumentInvariants(actor.getSnapshot().context.document)
    actor.stop()
  })

  it('deduplicates identical file drops while creating a fresh unique bdc for each placement', async () => {
    const store = new PendingMediaStore()
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    const service = new ElceAnchorDropService()
    const firstFile = new File(['same image bytes'], 'first-name.png', { type: 'image/png' })
    const secondFile = new File(['same image bytes'], 'renamed-copy.png', { type: 'image/png' })
    const firstTarget = service.createFileDropTarget(firstFile, 'page-a')
    const secondTarget = service.createFileDropTarget(secondFile, 'page-a')
    if (firstTarget === null || secondTarget === null) throw new Error('Les fichiers de test doivent être acceptés.')
    actor.start()

    actor.send({ type: 'section.change', sectionBdcId: 'bdc-section-1', change: fileDrop(firstFile, firstTarget, 'premier') })
    await flush()
    store.pending[0]?.resolve()
    await flush()

    actor.send({
      type: 'section.change',
      sectionBdcId: 'bdc-section-1',
      change: fileDrop(secondFile, secondTarget, 'second', { target: firstTarget, text: 'premier' }),
    })
    await flush()

    const document = actor.getSnapshot().context.document
    const imageBdcs = document.bdcs.filter((bdc) => bdc.type === BDC_TYPE.CARD)
    expect(store.pending).toHaveLength(1)
    expect(store.media.size).toBe(1)
    expect(document.medias).toHaveLength(1)
    expect(document.medias[0]?.name).toBe('first-name.png')
    expect(imageBdcs).toHaveLength(2)
    expect(imageBdcs[0]?.id).not.toBe(imageBdcs[1]?.id)
    expect(imageBdcs.map((bdc) => bdc.card?.mediaId)).toEqual([document.medias[0]?.id, document.medias[0]?.id])
    expect(actor.getSnapshot().context.mediaSources[document.medias[0]!.id]).toMatch(/^blob:/)
    assertDocumentInvariants(document)
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
        presetId: 'photo-basic',
        media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
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
        media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
      },
    })
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.create',
        bdcId: 'bdc-catalog-image-1',
        bdcType: BDC_TYPE.CARD,
        presetId: 'photo-basic',
        placement: { kind: BDC_LOCATION.CATALOG },
      },
    })
    actor.send({ type: 'document.apply', command: { type: 'bdc.card.media.set', bdcId: 'bdc-catalog-image-1', mediaId: 'media-image-1' } })

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
    expect(document.pages[0]?.bdcIds).toEqual(['bdc-section-1'])
    expect(document.bdcs.filter((bdc) => bdc.type === BDC_TYPE.CARD && bdc.pageId === null && bdc.parentBdcId === 'bdc-section-1').map((bdc) => bdc.card?.mediaId))
      .toEqual(['media-image-1', 'media-image-1'])
    expect(document.data.catalogBdcIds).toEqual(['bdc-catalog-image-1'])
    expect(actor.getSnapshot().context.document.medias.map((media) => media.id)).toEqual(['media-image-1'])
    expect(store.pending).toHaveLength(0)
    assertDocumentInvariants(document)
    actor.stop()
  })

  it('imports a Question illustration through the serialized XState command path', async () => {
    const store = new PendingMediaStore()
    const actor = createActor(controllerMachine, { input: { documentStore: store } })
    const mediaImport = new ElceMediaResourceService().createImport(new File(['picture'], 'picture.png', { type: 'image/png' }))
    if (mediaImport === null) throw new Error('Le service média doit accepter le fichier image de test.')
    actor.start()
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.create',
        bdcId: 'bdc-question-1',
        bdcType: BDC_TYPE.QUESTION,
        presetId: DEFAULT_PRESET_ID.QUESTION,
        placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
      },
    })

    actor.send({
      type: 'question.media.file.import',
      bdcId: 'bdc-question-1',
      file: mediaImport.file,
      media: mediaImport.media,
    })
    await flush()

    expect(store.pending.map(({ media }) => media.id)).toEqual([mediaImport.media.id])
    expect(actor.getSnapshot().context.document.medias).toEqual([])
    store.pending[0]?.resolve()
    await flush()

    const document = actor.getSnapshot().context.document
    expect(document.medias).toEqual([mediaImport.media])
    expect(document.bdcs.find((bdc) => bdc.id === 'bdc-question-1')?.question?.mediaId).toBe(mediaImport.media.id)
    expect(document.data.catalogBdcIds).toEqual([])
    expect(actor.getSnapshot().context.mediaSources[mediaImport.media.id]).toMatch(/^blob:/)

    actor.send({ type: 'page.create', placement: { kind: PAGE_LOCATION.SCENARIO } })
    const secondPage = actor.getSnapshot().context.document.pages[1]
    if (secondPage === undefined) throw new Error('La page de test doit être créée.')
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.create',
        bdcId: 'bdc-question-2',
        bdcType: BDC_TYPE.QUESTION,
        presetId: DEFAULT_PRESET_ID.QUESTION,
        placement: { kind: BDC_LOCATION.PAGE, pageId: secondPage.id },
      },
    })
    const duplicateImport = new ElceMediaResourceService().createImport(new File(['picture'], 'another-name.png', { type: 'image/png' }))
    if (duplicateImport === null) throw new Error('Le fichier image identique doit être accepté.')
    actor.send({
      type: 'question.media.file.import',
      bdcId: 'bdc-question-2',
      file: duplicateImport.file,
      media: duplicateImport.media,
    })
    await flush()

    const afterDuplicateImport = actor.getSnapshot().context.document
    expect(store.pending).toHaveLength(1)
    expect(store.media.size).toBe(1)
    expect(afterDuplicateImport.medias).toEqual([mediaImport.media])
    expect(afterDuplicateImport.bdcs.filter((bdc) => bdc.type === BDC_TYPE.QUESTION).map((bdc) => bdc.question?.mediaId))
      .toEqual([mediaImport.media.id, mediaImport.media.id])
    assertDocumentInvariants(document)
    assertDocumentInvariants(afterDuplicateImport)
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
        media: { id: 'media-image-1',  name: 'photo.png', mimeType: 'image/png', size: 10, caption: '' },
      },
    })
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.create',
        bdcId: 'bdc-image-1',
        bdcType: BDC_TYPE.CARD,
        presetId: 'photo-basic',
        placement: { kind: BDC_LOCATION.CATALOG },
      },
    })
    actor.send({ type: 'document.apply', command: { type: 'bdc.card.media.set', bdcId: 'bdc-image-1', mediaId: 'media-image-1' } })

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
    expect(document.pages[0]?.bdcIds).toEqual(['bdc-section-1'])
    expect(document.data.catalogBdcIds).toEqual([])
    expect(document.bdcs.find((bdc) => bdc.id === 'bdc-image-1')).toMatchObject({
      pageId: null,
      parentBdcId: 'bdc-section-1',
      card: { mediaId: 'media-image-1' },
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
        presetId: 'photo-basic',
        media: { id: 'media-image-1',  name: 'photo.png', mimeType: 'image/png', size: 10, caption: '' },
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
      parentBdcId: null,
      card: { mediaId: 'media-image-1' },
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
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}
