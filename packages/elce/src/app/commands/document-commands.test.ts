import { describe, expect, it } from 'vitest'
import { BDC_LOCATION, BDC_TYPE, CHAPTER_TYPE, DEFAULT_EVALUATION_SETTINGS, DEFAULT_PRESET_ID, EVALUATION_RETRY_SCOPE, MEDIA_TYPE, PAGE_LOCATION, PAGE_TYPE, QUESTION_TYPE } from '../../config/document-config'
import { createInitialDocument, ElceDocument } from '../../domain/document-model'
import { ElceQuestionService } from '../../domain/question-service'
import {
  applyDocumentCommand,
  assertDocumentInvariants,
  createChapterCommand,
  createChapterMoveCommand,
  createPageCommand,
} from './document-commands'

describe('Elcé document commands', () => {
  it('renames a page and its chapter without changing document placement', () => {
    const initial = createInitialDocument()
    const renamedPage = applyDocumentCommand(initial, {
      type: 'page.rename',
      pageId: 'page-a',
      name: 'Présentation',
    })
    const renamedChapter = applyDocumentCommand(renamedPage, {
      type: 'chapter.rename',
      chapterId: 'chapter-1',
      name: 'Introduction',
    })

    expect(renamedChapter.pages[0]).toMatchObject({
      id: 'page-a',
      name: 'Présentation',
      chapterId: 'chapter-1',
    })
    expect(renamedChapter.chapters[0]).toMatchObject({
      id: 'chapter-1',
      name: 'Introduction',
      pageIds: ['page-a'],
    })
    expect(renamedChapter.bdcs).toEqual(initial.bdcs)
    expect(renamedChapter.data.scenarioEntries).toEqual(initial.data.scenarioEntries)
    expect(renamedChapter.data.catalogPageIds).toEqual(initial.data.catalogPageIds)
  })

  it('rejects blank page and chapter names', () => {
    const initial = createInitialDocument()

    expect(() => applyDocumentCommand(initial, { type: 'page.rename', pageId: 'page-a', name: '   ' }))
      .toThrow('Le nom de la page ne peut pas être vide')
    expect(() => applyDocumentCommand(initial, { type: 'chapter.rename', chapterId: 'chapter-1', name: '   ' }))
      .toThrow('Le nom du chapitre ne peut pas être vide')
  })

  it('stores Evaluation chapter options and keeps the 80 percent threshold fixed', () => {
    const initial = createInitialDocument()
    const evaluationChapter = applyDocumentCommand(initial, createChapterCommand(initial, undefined, CHAPTER_TYPE.EVALUATION))
    const updated = applyDocumentCommand(evaluationChapter, {
      type: 'chapter.evaluation.settings.update',
      chapterId: evaluationChapter.chapters[1]!.id,
      attemptLimit: 3,
      retryScope: EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS,
    })

    expect(evaluationChapter.chapters[1]).toMatchObject({
      evaluationThreshold: DEFAULT_EVALUATION_SETTINGS.threshold,
      evaluationAttemptLimit: DEFAULT_EVALUATION_SETTINGS.attemptLimit,
      evaluationRetryScope: DEFAULT_EVALUATION_SETTINGS.retryScope,
    })
    expect(updated.chapters[1]).toMatchObject({
      evaluationThreshold: DEFAULT_EVALUATION_SETTINGS.threshold,
      evaluationAttemptLimit: 3,
      evaluationRetryScope: EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS,
    })
    expect(() => applyDocumentCommand(updated, {
      type: 'chapter.evaluation.settings.update',
      chapterId: 'chapter-1',
      attemptLimit: 3,
      retryScope: EVALUATION_RETRY_SCOPE.ALL_QUESTIONS,
    })).toThrow('Les réglages d’évaluation ne s’appliquent pas')
    expect(() => applyDocumentCommand(updated, {
      type: 'chapter.evaluation.settings.update',
      chapterId: evaluationChapter.chapters[1]!.id,
      attemptLimit: 0,
      retryScope: EVALUATION_RETRY_SCOPE.ALL_QUESTIONS,
    })).toThrow('La limite de tentatives doit être un entier positif')
  })

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
    expect(catalogued.scenarioPageIds).toEqual(['page-a'])
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

  it('merges duplicate media while preserving every BDC and page placement', () => {
    /** Builds matching video metadata for the media-merge command test. */
    const media = (id: string, name: string) => ({
      id,
      type: MEDIA_TYPE.VIDEO,
      name,
      mimeType: 'video/mp4',
      size: 389062,
      caption: '',
    })
    const withPageE = applyDocumentCommand(createInitialDocument(), createPageCommand({
      pageId: 'page-e',
      bdcId: 'bdc-section-e',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
    }))
    const withImage = applyDocumentCommand(withPageE, {
      type: 'media.add',
      media: { id: 'media-image', type: MEDIA_TYPE.IMAGE, name: 'image.jpg', mimeType: 'image/jpeg', size: 12, caption: '' },
    })
    const withMedia = [media('media-canonical', 'sample-video.mp4'), media('media-duplicate', 'LcXkmXyuZQ.mp4'), media('media-unused', 'sample-video-second.mp4')]
      .reduce((document, item) => applyDocumentCommand(document, { type: 'media.add', media: item }), withImage)
    const withCanonicalBdc = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-video-canonical',
      bdcType: BDC_TYPE.VIDEO,
      presetId: DEFAULT_PRESET_ID.VIDEO,
      mediaId: 'media-canonical',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const withPageABdc = applyDocumentCommand(withCanonicalBdc, {
      type: 'bdc.create',
      bdcId: 'bdc-video-a',
      bdcType: BDC_TYPE.VIDEO,
      presetId: DEFAULT_PRESET_ID.VIDEO,
      mediaId: 'media-duplicate',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const beforeMerge = applyDocumentCommand(withPageABdc, {
      type: 'bdc.create',
      bdcId: 'bdc-video-e',
      bdcType: BDC_TYPE.VIDEO,
      presetId: DEFAULT_PRESET_ID.VIDEO,
      mediaId: 'media-duplicate',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-e' },
    })
    const preservedBdcIds = beforeMerge.bdcs.map((bdc) => bdc.id)
    const preservedPlacements = beforeMerge.pages.map((page) => ({ id: page.id, bdcIds: page.bdcIds }))
    const canonicalBdc = beforeMerge.bdcs.find((bdc) => bdc.id === 'bdc-video-canonical')

    const merged = applyDocumentCommand(beforeMerge, {
      type: 'media.merge',
      canonicalMediaId: 'media-canonical',
      duplicateMediaIds: ['media-duplicate', 'media-unused'],
    })

    expect(merged.medias.map((item) => item.id)).toEqual(['media-image', 'media-canonical'])
    expect(merged.bdcs.map((bdc) => bdc.id)).toEqual(preservedBdcIds)
    expect(merged.bdcs.find((bdc) => bdc.id === 'bdc-video-canonical')).toEqual(canonicalBdc)
    expect(merged.bdcs.filter((bdc) => bdc.id === 'bdc-video-a' || bdc.id === 'bdc-video-e')
      .map((bdc) => bdc.mediaId)).toEqual(['media-canonical', 'media-canonical'])
    expect(merged.pages.map((page) => ({ id: page.id, bdcIds: page.bdcIds }))).toEqual(preservedPlacements)
    assertDocumentInvariants(merged)
  })

  it('rejects merging media with different content metadata', () => {
    const withCanonical = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-canonical', type: MEDIA_TYPE.VIDEO, name: 'sample-video.mp4', mimeType: 'video/mp4', size: 100, caption: '' },
    })
    const withDuplicate = applyDocumentCommand(withCanonical, {
      type: 'media.add',
      media: { id: 'media-duplicate', type: MEDIA_TYPE.VIDEO, name: 'other.mp4', mimeType: 'video/mp4', size: 101, caption: '' },
    })

    expect(() => applyDocumentCommand(withDuplicate, {
      type: 'media.merge',
      canonicalMediaId: 'media-canonical',
      duplicateMediaIds: ['media-duplicate'],
    })).toThrow('Média incompatible avec la ressource canonique')
  })

  it('permanently deletes only an unused catalog bdc and retains its media', () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const withCatalogBdc = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-catalog-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      mediaId: 'media-image-1',
      placement: { kind: BDC_LOCATION.CATALOG },
    })
    const deleted = applyDocumentCommand(withCatalogBdc, { type: 'bdc.delete', bdcId: 'bdc-catalog-image-1' })

    expect(deleted.bdcs.map((bdc) => bdc.id)).toEqual(['bdc-section-1'])
    expect(deleted.data.catalogBdcIds).toEqual([])
    expect(deleted.medias).toEqual(withCatalogBdc.medias)
    assertDocumentInvariants(deleted)

    const withPageBdc = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-page-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      mediaId: 'media-image-1',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    expect(() => applyDocumentCommand(withPageBdc, { type: 'bdc.delete', bdcId: 'bdc-page-image-1' }))
      .toThrow('est utilisé par une page')
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

  it('migrates version 1 root pages before the existing chapter order', () => {
    const withRootPage = applyDocumentCommand(createInitialDocument(), createPageCommand({
      pageId: 'page-root',
      bdcId: 'bdc-section-root',
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))
    const { scenarioEntries: _scenarioEntries, ...legacyFields } = withRootPage.toJSON()
    const restored = ElceDocument.fromJSON({
      ...legacyFields,
      version: 1,
      scenarioPageIds: ['page-root'],
    })

    expect(restored.data.scenarioEntries).toEqual([
      { kind: 'page', pageId: 'page-root' },
      { kind: 'chapter', chapterId: 'chapter-1' },
    ])
    expect(restored.scenarioPageIds).toEqual(['page-root', 'page-a'])
  })

  it('moves a standalone page before and after chapter entries in the root sequence', () => {
    const withRootPage = applyDocumentCommand(createInitialDocument(), createPageCommand({
      pageId: 'page-root',
      bdcId: 'bdc-section-root',
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))
    const beforeChapter = applyDocumentCommand(withRootPage, {
      type: 'page.move',
      pageId: 'page-root',
      placement: { kind: PAGE_LOCATION.SCENARIO, index: 0 },
    })
    const afterChapter = applyDocumentCommand(beforeChapter, {
      type: 'page.move',
      pageId: 'page-root',
      placement: { kind: PAGE_LOCATION.SCENARIO, index: 2 },
    })

    expect(beforeChapter.data.scenarioEntries).toEqual([
      { kind: 'page', pageId: 'page-root' },
      { kind: 'chapter', chapterId: 'chapter-1' },
    ])
    expect(afterChapter.data.scenarioEntries).toEqual([
      { kind: 'chapter', chapterId: 'chapter-1' },
      { kind: 'page', pageId: 'page-root' },
    ])
    const withSecondChapter = applyDocumentCommand(afterChapter, {
      type: 'chapter.create',
      chapterId: 'chapter-2',
      name: 'Chapitre 2',
    })
    const secondChapterFirst = applyDocumentCommand(withSecondChapter, createChapterMoveCommand('chapter-2', 0))
    const secondChapterLast = applyDocumentCommand(secondChapterFirst, createChapterMoveCommand('chapter-2', 3))

    expect(secondChapterFirst.data.scenarioEntries).toEqual([
      { kind: 'chapter', chapterId: 'chapter-2' },
      { kind: 'chapter', chapterId: 'chapter-1' },
      { kind: 'page', pageId: 'page-root' },
    ])
    expect(secondChapterLast.data.scenarioEntries).toEqual([
      { kind: 'chapter', chapterId: 'chapter-1' },
      { kind: 'page', pageId: 'page-root' },
      { kind: 'chapter', chapterId: 'chapter-2' },
    ])
    assertDocumentInvariants(secondChapterLast)
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

  it('attaches an unused catalog bdc without cloning its media', () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const available = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      mediaId: 'media-image-1',
      placement: { kind: BDC_LOCATION.CATALOG },
    })
    const attached = applyDocumentCommand(available, {
      type: 'bdc.anchor.attach',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      markup: '<p>Avant <span data-bdc-id="bdc-image-1"></span> après</p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: 'Avant ' },
          { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
          { type: 'text', text: ' après' },
        ] }],
      },
    })

    expect(attached.data.catalogBdcIds).toEqual([])
    expect(attached.pages[0]?.bdcIds).toEqual(['bdc-section-1', 'bdc-image-1'])
    expect(attached.bdcs.find((bdc) => bdc.id === 'bdc-image-1')).toMatchObject({
      pageId: 'page-a',
      mediaId: 'media-image-1',
    })
    expect(attached.medias).toEqual(available.medias)
    assertDocumentInvariants(attached)
    expect(() => applyDocumentCommand(attached, {
      type: 'bdc.anchor.attach',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      markup: '<p></p>',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    })).toThrow('n’est plus disponible')
  })

  it('rejects catalog anchor attachment to a non-Flux page', () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const available = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      mediaId: 'media-image-1',
      placement: { kind: BDC_LOCATION.CATALOG },
    })
    const withDiapo = applyDocumentCommand(available, createPageCommand({
      pageId: 'page-diapo',
      bdcId: 'bdc-section-diapo',
      pageType: PAGE_TYPE.DIAPO,
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))

    expect(() => applyDocumentCommand(withDiapo, {
      type: 'bdc.anchor.attach',
      sectionBdcId: 'bdc-section-diapo',
      pageId: 'page-diapo',
      bdcId: 'bdc-image-1',
      markup: '<p></p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{
          type: 'elceAnchor',
          attrs: { bdcId: 'bdc-image-1', partId: 'page-diapo:bdc-image-1:anchor' },
        }] }],
      },
    })).toThrow('ne peut pas accueillir une ancre')
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

  it('deletes an anchored bdc without deleting its reusable media', () => {
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
    expect(removed.data.catalogBdcIds).toEqual([])
    expect(removed.bdcs.map((bdc) => bdc.id)).toEqual(['bdc-section-1'])
    expect(removed.medias).toHaveLength(1)
    assertDocumentInvariants(removed)
  })

  it('deletes a Section and its anchored bdcs while retaining their media', () => {
    const anchored = applyDocumentCommand(createInitialDocument(), {
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
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: 'Avant ' },
          { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
          { type: 'text', text: ' après' },
        ] }],
      },
    })

    const removed = applyDocumentCommand(anchored, { type: 'bdc.section.delete', bdcId: 'bdc-section-1' })

    expect(removed.pages[0]?.bdcIds).toEqual([])
    expect(removed.bdcs).toEqual([])
    expect(removed.medias.map((media) => media.id)).toEqual(['media-image-1'])
    assertDocumentInvariants(removed)
  })

  it('returns an anchored bdc to the catalog without recreating it or its media', () => {
    const anchored = applyDocumentCommand(createInitialDocument(), {
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
    })
    const returned = applyDocumentCommand(anchored, {
      type: 'bdc.anchor.return',
      sectionBdcId: 'bdc-section-1',
      anchorBdcId: 'bdc-image-1',
      markup: '<p>Avant après</p>',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Avant après' }] }] },
    })

    expect(returned.pages[0]?.bdcIds).toEqual(['bdc-section-1'])
    expect(returned.data.catalogBdcIds).toEqual(['bdc-image-1'])
    expect(returned.bdcs).toHaveLength(2)
    expect(returned.bdcs.find((bdc) => bdc.id === 'bdc-image-1')).toMatchObject({
      pageId: null,
      mediaId: 'media-image-1',
    })
    expect(returned.medias).toEqual(anchored.medias)
    expect(returned.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.content)
      .toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Avant après' }] }] })
    assertDocumentInvariants(returned)

    const reattached = applyDocumentCommand(returned, {
      type: 'bdc.anchor.attach',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      markup: '<p>Avant <span data-bdc-id="bdc-image-1"></span> après</p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: 'Avant ' },
          { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
          { type: 'text', text: ' après' },
        ] }],
      },
    })
    expect(reattached.bdcs.filter((bdc) => bdc.id === 'bdc-image-1')).toHaveLength(1)
    expect(reattached.data.catalogBdcIds).toEqual([])
    expect(reattached.medias).toEqual(anchored.medias)
    assertDocumentInvariants(reattached)
  })

  it('deletes a media bdc when an ordinary text update erases its anchor', () => {
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
    expect(edited.data.catalogBdcIds).toEqual([])
    expect(edited.bdcs.map((bdc) => bdc.id)).toEqual(['bdc-section-1'])
    expect(edited.medias.map((media) => media.id)).toEqual(['media-video-1'])
    expect(edited.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.content)
      .toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Avant après' }] }] })
    assertDocumentInvariants(edited)
    expect(() => applyDocumentCommand(anchored, { type: 'bdc.remove', bdcId: 'bdc-video-1' }))
      .toThrow('Le retour au catalogue du bdc ancré')
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

  it('creates one unique Question at its requested Flux position and enforces its answer rules', () => {
    const initial = createInitialDocument()
    const questionDocument = applyDocumentCommand(initial, {
      type: 'bdc.create',
      bdcId: 'bdc-question-1',
      bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a', index: 0 },
    })
    const questionBdc = questionDocument.bdcs.find((bdc) => bdc.id === 'bdc-question-1')!
    const questionService = new ElceQuestionService()
    const multiple = questionService.changeType(questionBdc.question!, QUESTION_TYPE.MULTIPLE_CHOICE)
    const invalid = {
      ...multiple,
      answers: multiple.answers.map((answer) => ({ ...answer, correct: false })),
    }

    expect(questionDocument.pages[0]?.bdcIds).toEqual(['bdc-question-1', 'bdc-section-1'])
    expect(questionDocument.data.catalogBdcIds).toEqual([])
    expect(questionBdc.question?.answers.map(({ label, correct }) => ({ label, correct }))).toEqual([
      { label: 'Oui', correct: true },
      { label: 'Non', correct: false },
    ])
    expect(() => applyDocumentCommand(questionDocument, {
      type: 'bdc.question.update',
      bdcId: questionBdc.id,
      question: invalid,
    })).toThrow('exige au moins une réponse juste')

    const updated = applyDocumentCommand(questionDocument, {
      type: 'bdc.question.update',
      bdcId: questionBdc.id,
      question: multiple,
    })
    expect(updated.pages[0]?.bdcIds).toEqual(['bdc-question-1', 'bdc-section-1'])
    expect(() => applyDocumentCommand(updated, {
      type: 'bdc.create',
      bdcId: 'bdc-question-2',
      bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })).toThrow('Une page ne peut contenir qu’une Question')
    assertDocumentInvariants(updated)
  })

  it('reuses a catalogue media for a Question without adding a reusable Question BDC', () => {
    const initial = applyDocumentCommand(createInitialDocument(), {
      type: 'bdc.create',
      bdcId: 'bdc-question-1',
      bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const illustrated = applyDocumentCommand(withMedia, {
      type: 'bdc.question.media.set',
      bdcId: 'bdc-question-1',
      mediaId: 'media-image-1',
    })

    expect(illustrated.bdcs).toHaveLength(2)
    expect(illustrated.bdcs.find((bdc) => bdc.id === 'bdc-question-1')?.mediaId).toBe('media-image-1')
    expect(illustrated.data.catalogBdcIds).toEqual([])
    expect(illustrated.medias.map((media) => media.id)).toEqual(['media-image-1'])
  })
})
