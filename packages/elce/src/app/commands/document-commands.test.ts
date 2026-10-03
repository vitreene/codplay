import { describe, expect, it } from 'vitest'
import { BDC_LOCATION, BDC_TYPE, PAGE_LOCATION } from '../../config/document-config'
import { createInitialDocument, ElceDocument } from '../../domain/document-model'
import {
  applyDocumentCommand,
  assertDocumentInvariants,
  createChapterCommand,
  createPageCommand,
} from './document-commands'

describe('Elcé document commands', () => {
  it('creates, moves and removes pages without sharing an assignment', () => {
    const initial = createInitialDocument()
    const withPage = applyDocumentCommand(
      initial,
      createPageCommand({
        pageId: 'page-b',
        bdcId: 'bdc-section-2',
        placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
      }),
    )
    const moved = applyDocumentCommand(withPage, {
      type: 'page.move',
      pageId: 'page-b',
      placement: { kind: PAGE_LOCATION.SCENARIO },
    })
    const catalogued = applyDocumentCommand(moved, { type: 'page.remove', pageId: 'page-b' })

    expect(catalogued.data.catalogPageIds).toEqual(['page-b'])
    expect(catalogued.data.scenarioPageIds).toEqual([])
    expect(catalogued.chapters[0]?.pageIds).toEqual(['page-a'])
    assertDocumentInvariants(catalogued)
  })

  it('removes a page and its bdc while retaining catalogue media', () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: {
        id: 'media-1',
        type: 'image',
        name: 'image.png',
        mimeType: 'image/png',
        size: 12,
        caption: 'Une image',
      },
    })
    const withImage = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      mediaId: 'media-1',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const deleted = applyDocumentCommand(withImage, { type: 'page.delete', pageId: 'page-a' })

    expect(deleted.pages).toHaveLength(0)
    expect(deleted.bdcs).toHaveLength(0)
    expect(deleted.medias).toHaveLength(1)
    assertDocumentInvariants(deleted)
  })

  it('keeps the requested order when a page is reordered in the same list', () => {
    const initial = createInitialDocument()
    const withPageB = applyDocumentCommand(initial, createPageCommand({
      pageId: 'page-b',
      bdcId: 'bdc-section-2',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
    }))
    const withPageC = applyDocumentCommand(withPageB, createPageCommand({
      pageId: 'page-c',
      bdcId: 'bdc-section-3',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
    }))

    const reordered = applyDocumentCommand(withPageC, {
      type: 'page.move',
      pageId: 'page-b',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1', index: 2 },
    })

    expect(reordered.chapters[0]?.pageIds).toEqual(['page-a', 'page-b', 'page-c'])
    assertDocumentInvariants(reordered)
  })

  it('rejects duplicate page identifiers and preserves a JSON round trip', () => {
    const document = createInitialDocument()

    expect(() =>
      applyDocumentCommand(
        document,
        createPageCommand({
          pageId: 'page-a',
          bdcId: 'bdc-section-2',
          placement: { kind: PAGE_LOCATION.CATALOG },
        }),
      ),
    ).toThrow('Page déjà présente')

    const restored = ElceDocument.fromJSON(JSON.parse(JSON.stringify(document.toJSON())))
    expect(restored.toJSON()).toEqual(document.toJSON())
  })

  it('stores the Section JSON source and its exported static markup', () => {
    const document = createInitialDocument()
    const content = {
      type: 'doc' as const,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonjour' }] }],
    }
    const updated = applyDocumentCommand(document, {
      type: 'bdc.section.update',
      bdcId: 'bdc-section-1',
      title: 'Introduction',
      content,
      markup: '<p>Bonjour</p>',
    })

    expect(updated.bdcs[0]?.section).toMatchObject({ title: 'Introduction', content, markup: '<p>Bonjour</p>' })
    assertDocumentInvariants(updated)
  })

  it('creates a media bdc and updates its anchor in one document command', () => {
    const document = createInitialDocument()
    const content = {
      type: 'doc' as const,
      content: [{
        type: 'paragraph' as const,
        content: [
          { type: 'text' as const, text: 'Avant ' },
          { type: 'elceAnchor' as const, attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
          { type: 'text' as const, text: ' après' },
        ],
      }],
    }
    const updated = applyDocumentCommand(document, {
      type: 'bdc.anchor.create',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      media: {
        id: 'media-image-1',
        type: 'image',
        name: 'image.png',
        mimeType: 'image/png',
        size: 10,
        caption: '',
      },
      partId: 'page-a:bdc-image-1:anchor',
      markup: '<p id="section-text-1">Avant <span id="page-a:bdc-image-1:anchor" data-elce-anchor="true"></span> après</p>',
      content,
    })

    expect(updated.medias.map((media) => media.id)).toEqual(['media-image-1'])
    expect(updated.pages[0]?.bdcIds).toEqual(['bdc-section-1', 'bdc-image-1'])
    expect(updated.bdcs.find((bdc) => bdc.id === 'bdc-image-1')).toMatchObject({ pageId: 'page-a', mediaId: 'media-image-1' })
    expect(updated.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.content).toEqual(content)
    assertDocumentInvariants(updated)
  })

  it('moves an anchored bdc through the same Section command boundary', () => {
    const document = createInitialDocument()
    const anchored = applyDocumentCommand(document, {
      type: 'bdc.anchor.create',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
      partId: 'page-a:bdc-image-1:anchor',
      markup: '<p id="section-text-1">Avant <span data-bdc-id="bdc-image-1"></span> après</p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Avant ' }, { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } }, { type: 'text', text: ' après' }] }],
      },
    })
    const moved = applyDocumentCommand(anchored, {
      type: 'bdc.anchor.move',
      sectionBdcId: 'bdc-section-1',
      anchorBdcId: 'bdc-image-1',
      markup: '<p id="section-text-1">Après <span data-bdc-id="bdc-image-1"></span> avant</p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Après ' }, { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } }, { type: 'text', text: ' avant' }] }],
      },
    })

    expect(moved.bdcs.find((bdc) => bdc.id === 'bdc-image-1')?.pageId).toBe('page-a')
    expect(moved.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.markup).toContain('Après')
    assertDocumentInvariants(moved)
  })

  it('returns an anchored bdc to the catalogue without removing its media', () => {
    const document = createInitialDocument()
    const anchored = applyDocumentCommand(document, {
      type: 'bdc.anchor.create',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
      partId: 'page-a:bdc-image-1:anchor',
      markup: '<p id="section-text-1"><span data-bdc-id="bdc-image-1"></span></p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } }] }],
      },
    })
    const removed = applyDocumentCommand(anchored, {
      type: 'bdc.anchor.remove',
      sectionBdcId: 'bdc-section-1',
      anchorBdcId: 'bdc-image-1',
      markup: '<p id="section-text-1"></p>',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    })

    expect(removed.pages[0]?.bdcIds).toEqual(['bdc-section-1'])
    expect(removed.data.catalogBdcIds).toEqual(['bdc-image-1'])
    expect(removed.medias).toHaveLength(1)
    assertDocumentInvariants(removed)
  })

  it('returns a media bdc when an ordinary text update erases its anchor', () => {
    const anchored = applyDocumentCommand(createInitialDocument(), {
      type: 'bdc.anchor.create',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-video-1',
      bdcType: BDC_TYPE.VIDEO,
      presetId: 'video-basic',
      media: { id: 'media-video-1', type: 'video', name: 'video.mp4', mimeType: 'video/mp4', size: 24, caption: '' },
      partId: 'page-a:bdc-video-1:anchor',
      markup: '<p>Avant <span data-bdc-id="bdc-video-1"></span> après</p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: 'Avant ' },
          { type: 'elceAnchor', attrs: { bdcId: 'bdc-video-1', partId: 'page-a:bdc-video-1:anchor' } },
          { type: 'text', text: ' après' },
        ] }],
      },
    })

    const edited = applyDocumentCommand(anchored, {
      type: 'bdc.section.update',
      bdcId: 'bdc-section-1',
      title: '',
      markup: '<p>Avant après</p>',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Avant après' }] }] },
    })

    expect(edited.pages[0]?.bdcIds).toEqual(['bdc-section-1'])
    expect(edited.data.catalogBdcIds).toEqual(['bdc-video-1'])
    expect(edited.medias.map((media) => media.id)).toEqual(['media-video-1'])
    expect(edited.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.content)
      .toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Avant après' }] }] })
    assertDocumentInvariants(edited)
    expect(() => applyDocumentCommand(anchored, { type: 'bdc.remove', bdcId: 'bdc-video-1' }))
      .toThrow('Retirer le bdc ancré')
  })

  it('rejects duplicate anchor references in ordinary Section updates', () => {
    const anchored = applyDocumentCommand(createInitialDocument(), {
      type: 'bdc.anchor.create',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
      partId: 'page-a:bdc-image-1:anchor',
      markup: '<p><span data-bdc-id="bdc-image-1"></span></p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } }] }],
      },
    })

    expect(() => applyDocumentCommand(anchored, {
      type: 'bdc.section.update',
      bdcId: 'bdc-section-1',
      title: '',
      markup: '<p><span></span><span></span></p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
          { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
        ] }],
      },
    })).toThrow('Un même bdc ne peut apparaître qu’une fois')
  })

  it('only deletes an empty chapter', () => {
    const initial = createInitialDocument()
    const added = applyDocumentCommand(initial, createChapterCommand(initial, 'Annexe'))

    expect(added.chapters).toHaveLength(2)
    const emptyDeleted = applyDocumentCommand(added, { type: 'chapter.delete', chapterId: added.chapters[1]!.id })
    expect(emptyDeleted.chapters.map((chapter) => chapter.name)).toEqual(['Chapitre 1'])

    expect(() => applyDocumentCommand(initial, { type: 'chapter.delete', chapterId: 'chapter-1' }))
      .toThrow('chapitre non vide')
  })
})
