import { describe, expect, it } from 'vitest'
import { BDC_LOCATION, BDC_TYPE, CARD_LAYOUT_IDS, CHAPTER_TYPE, DEFAULT_EVALUATION_SETTINGS, DEFAULT_PRESET_ID, EVALUATION_RESULT_ACTION, EVALUATION_RETRY_SCOPE, PAGE_LOCATION, PAGE_TYPE, QUESTION_TYPE } from '../../config/document-config'
import { createInitialDocument, ElceDocument } from '../../domain/document/document-model'
import type { BdcPlacement } from './document-command-types'
import { ElceQuestionService } from '../../domain/question/question-service'
import {
  applyDocumentCommand,
  assertDocumentInvariants,
  createChapterCommand,
  createChapterMoveCommand,
  createCardBdcCommand,
  createCarouselBdcCommand,
  createDefaultPageCommand,
  createEvaluationResultBdcCommand,
  createPageCommand,
  createQuestionBdcCommand,
  createStandaloneCardBdcCommand,
} from './document-commands'

describe('Elcé document commands', () => {
  it('places a standalone Card in the ordered BDC sequence of a Flux page', () => {
    const initial = createInitialDocument()
    const page = initial.pages[0]
    if (page === undefined) throw new Error('Le document de test ne contient pas de page Flux.')
    expect(page.type).toBe(PAGE_TYPE.FLUX)

    const document = applyDocumentCommand(initial, createStandaloneCardBdcCommand('bdc-flux-card', page.id))

    expect(document.pages[0]?.bdcIds).toEqual([...page.bdcIds, 'bdc-flux-card'])
    expect(document.bdcs.find((bdc) => bdc.id === 'bdc-flux-card')).toMatchObject({
      type: BDC_TYPE.CARD,
      pageId: page.id,
      parentBdcId: null,
    })
    assertDocumentInvariants(document)
  })

  it('creates a Diapo with a default Carousel and its first Card child', () => {
    const initial = createInitialDocument()
    const command = createDefaultPageCommand(
      initial,
      { kind: PAGE_LOCATION.SCENARIO },
      'Diapo de test',
      PAGE_TYPE.DIAPO,
    )
    const document = applyDocumentCommand(initial, command)
    const page = document.pages.find((candidate) => candidate.id === command.pageId)
    const carousel = document.bdcs.find((candidate) => candidate.id === command.bdcId)

    expect(command.initialCardBdcId).toBeDefined()
    expect(page).toMatchObject({ type: PAGE_TYPE.DIAPO, name: 'Diapo de test', bdcIds: [command.bdcId] })
    expect(carousel).toMatchObject({
      type: BDC_TYPE.CAROUSEL,
      pageId: command.pageId,
      carousel: { cards: [{ bdcId: command.initialCardBdcId, durationMs: null }] },
    })
    expect(document.bdcs.find((candidate) => candidate.id === command.initialCardBdcId)).toMatchObject({
      type: BDC_TYPE.CARD,
      parentBdcId: command.bdcId,
      pageId: null,
    })
    assertDocumentInvariants(document)
  })

  it('keeps one direct Diapo BDC and permits a standalone Card or Quiz after removing the default Carousel', () => {
    const initial = createInitialDocument()
    const pageCommand = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO }, undefined, PAGE_TYPE.DIAPO)
    let document = applyDocumentCommand(initial, pageCommand)
    document = applyDocumentCommand(document, { type: 'bdc.carousel.delete', bdcId: pageCommand.bdcId })
    document = applyDocumentCommand(document, createStandaloneCardBdcCommand('bdc-diapo-card', pageCommand.pageId))

    expect(document.pages.find((page) => page.id === pageCommand.pageId)?.bdcIds).toEqual(['bdc-diapo-card'])
    expect(document.bdcs.find((bdc) => bdc.id === 'bdc-diapo-card')).toMatchObject({
      type: BDC_TYPE.CARD,
      pageId: pageCommand.pageId,
      parentBdcId: null,
      presetId: DEFAULT_PRESET_ID.TEXT_SHORT,
    })
    expect(() => applyDocumentCommand(document, createQuestionBdcCommand('bdc-diapo-question', pageCommand.pageId, 1)))
      .toThrow('Une Diapo ne peut contenir qu’un seul BDC direct')

    document = applyDocumentCommand(document, { type: 'bdc.card.delete', bdcId: 'bdc-diapo-card' })
    document = applyDocumentCommand(document, createQuestionBdcCommand('bdc-diapo-question', pageCommand.pageId, 0))
    expect(document.pages.find((page) => page.id === pageCommand.pageId)?.bdcIds).toEqual(['bdc-diapo-question'])
    expect(document.bdcs.find((bdc) => bdc.id === 'bdc-diapo-question')?.type).toBe(BDC_TYPE.QUESTION)
    assertDocumentInvariants(document)
  })

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
        
        name: 'image.png',
        mimeType: 'image/png',
        size: 12,
        caption: 'Une image',
      },
    })
    const withImage = createCardWithMedia(withMedia, 'bdc-image-1', DEFAULT_PRESET_ID.PHOTO, { kind: BDC_LOCATION.PAGE, pageId: 'page-a' }, 'media-1')
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
      media: { id: 'media-image',  name: 'image.jpg', mimeType: 'image/jpeg', size: 12, caption: '' },
    })
    const withMedia = [media('media-canonical', 'sample-video.mp4'), media('media-duplicate', 'LcXkmXyuZQ.mp4'), media('media-unused', 'sample-video-second.mp4')]
      .reduce((document, item) => applyDocumentCommand(document, { type: 'media.add', media: item }), withImage)
    const withCanonicalBdc = createCardWithMedia(withMedia, 'bdc-video-canonical', DEFAULT_PRESET_ID.PHOTO, { kind: BDC_LOCATION.PAGE, pageId: 'page-a' }, 'media-canonical')
    const withPageABdc = createCardWithMedia(withCanonicalBdc, 'bdc-video-a', DEFAULT_PRESET_ID.PHOTO, { kind: BDC_LOCATION.PAGE, pageId: 'page-a' }, 'media-duplicate')
    const beforeMerge = createCardWithMedia(withPageABdc, 'bdc-video-e', DEFAULT_PRESET_ID.PHOTO, { kind: BDC_LOCATION.PAGE, pageId: 'page-e' }, 'media-duplicate')
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
      .map((bdc) => bdc.card?.mediaId)).toEqual(['media-canonical', 'media-canonical'])
    expect(merged.pages.map((page) => ({ id: page.id, bdcIds: page.bdcIds }))).toEqual(preservedPlacements)
    assertDocumentInvariants(merged)
  })

  it('rejects merging media with different content metadata', () => {
    const withCanonical = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-canonical',  name: 'sample-video.mp4', mimeType: 'video/mp4', size: 100, caption: '' },
    })
    const withDuplicate = applyDocumentCommand(withCanonical, {
      type: 'media.add',
      media: { id: 'media-duplicate',  name: 'other.mp4', mimeType: 'video/mp4', size: 101, caption: '' },
    })

    expect(() => applyDocumentCommand(withDuplicate, {
      type: 'media.merge',
      canonicalMediaId: 'media-canonical',
      duplicateMediaIds: ['media-duplicate'],
    })).toThrow('Média incompatible avec la ressource canonique')
  })

  it('retains every Card field and media reference while layouts hide them', () => {
    const withVideo = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-video-carousel',  name: 'clip.mp4', mimeType: 'video/mp4', size: 100, caption: '' },
    })
    const withCarousel = applyDocumentCommand(withVideo, createCarouselBdcCommand('bdc-video-carousel', 'page-a', 1))
    const carousel = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-video-carousel')!.carousel!
    const cardBdcId = carousel.cards[0]!.bdcId
    const photoCard = applyDocumentCommand(withCarousel, {
      type: 'bdc.card.layout.set',
      bdcId: cardBdcId,
      layoutId: DEFAULT_PRESET_ID.PHOTO,
    })
    const withMedia = applyDocumentCommand(photoCard, {
      type: 'bdc.card.media.set',
      bdcId: cardBdcId,
      mediaId: 'media-video-carousel',
    })
    const authoredCard = withMedia.bdcs.find((bdc) => bdc.id === cardBdcId)!.card!
    const authoredDocument = applyDocumentCommand(withMedia, {
      type: 'bdc.card.update',
      bdcId: cardBdcId,
      card: {
        ...authoredCard,
        overline: 'Surtitre',
        title: 'Titre conservé',
        description: 'Description conservée',
        message: 'Message conservé',
        note: 'Note conservée',
        caption: 'Légende conservée',
        imagePosition: 'right',
      },
    })
    let current = authoredDocument
    for (const layoutId of CARD_LAYOUT_IDS) {
      current = applyDocumentCommand(current, { type: 'bdc.card.layout.set', bdcId: cardBdcId, layoutId })
      expect(current.bdcs.find((bdc) => bdc.id === cardBdcId)).toMatchObject({
        presetId: layoutId,
        parentBdcId: 'bdc-video-carousel',
        card: {
          mediaId: 'media-video-carousel',
          overline: 'Surtitre',
          title: 'Titre conservé',
          description: 'Description conservée',
          message: 'Message conservé',
          note: 'Note conservée',
          caption: 'Légende conservée',
          imagePosition: 'right',
        },
      })
    }
  })

  it('deletes one Card child while the Carousel retains its final child', () => {
    let document = applyDocumentCommand(createInitialDocument(), createCarouselBdcCommand('bdc-carousel-delete-card', 'page-a', 1))
    document = applyDocumentCommand(document, createCardBdcCommand(
      'bdc-card-to-delete', 'bdc-carousel-delete-card', 1, DEFAULT_PRESET_ID.TEXT_SHORT,
    ))
    const carousel = document.bdcs.find((bdc) => bdc.id === 'bdc-carousel-delete-card')!.carousel!
    const firstCardBdcId = carousel.cards[0]!.bdcId

    const remaining = applyDocumentCommand(document, { type: 'bdc.card.delete', bdcId: firstCardBdcId })

    expect(remaining.bdcs.some((bdc) => bdc.id === firstCardBdcId)).toBe(false)
    expect(remaining.bdcs.find((bdc) => bdc.id === 'bdc-carousel-delete-card')?.carousel?.cards)
      .toEqual([{ bdcId: 'bdc-card-to-delete', durationMs: null, introTransitionRef: null, outroTransitionRef: null }])
    expect(() => applyDocumentCommand(remaining, { type: 'bdc.card.delete', bdcId: 'bdc-card-to-delete' }))
      .toThrow('conserver au moins une carte')
    assertDocumentInvariants(remaining)
  })

  it('moves a Card BDC between Carousels without cloning its authored content', () => {
    let document = applyDocumentCommand(createInitialDocument(), createCarouselBdcCommand(
      'bdc-carousel-source', 'page-a', 1, 'bdc-card-source-first',
    ))
    document = applyDocumentCommand(document, createCardBdcCommand(
      'bdc-card-moved', 'bdc-carousel-source', 1, DEFAULT_PRESET_ID.TEXT_SHORT,
    ))
    document = applyDocumentCommand(document, createCarouselBdcCommand(
      'bdc-carousel-target', 'page-a', 2, 'bdc-card-target-first',
    ))
    const card = document.bdcs.find((bdc) => bdc.id === 'bdc-card-moved')!.card!
    document = applyDocumentCommand(document, {
      type: 'bdc.card.update',
      bdcId: 'bdc-card-moved',
      card: { ...card, title: 'Carte déplacée', note: 'Contenu conservé' },
    })
    document = applyDocumentCommand(document, {
      type: 'media.add',
      media: { id: 'media-moved-card',  name: 'carte.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    document = applyDocumentCommand(document, {
      type: 'bdc.card.media.set',
      bdcId: 'bdc-card-moved',
      mediaId: 'media-moved-card',
    })

    const moved = applyDocumentCommand(document, {
      type: 'bdc.move',
      bdcId: 'bdc-card-moved',
      placement: { kind: BDC_LOCATION.PARENT, parentBdcId: 'bdc-carousel-target', index: 1 },
    })

    expect(moved.bdcs.find((bdc) => bdc.id === 'bdc-carousel-source')?.carousel?.cards.map(({ bdcId }) => bdcId))
      .toEqual(['bdc-card-source-first'])
    expect(moved.bdcs.find((bdc) => bdc.id === 'bdc-carousel-target')?.carousel?.cards)
      .toEqual([
        { bdcId: 'bdc-card-target-first', durationMs: null, introTransitionRef: null, outroTransitionRef: null },
        { bdcId: 'bdc-card-moved', durationMs: null, introTransitionRef: null, outroTransitionRef: null },
      ])
    expect(moved.bdcs.find((bdc) => bdc.id === 'bdc-card-moved')).toMatchObject({
      type: BDC_TYPE.CARD,
      parentBdcId: 'bdc-carousel-target',
      pageId: null,
      presetId: DEFAULT_PRESET_ID.TEXT_SHORT,
      card: { mediaId: 'media-moved-card', title: 'Carte déplacée', note: 'Contenu conservé' },
    })
    assertDocumentInvariants(moved)
    expect(() => applyDocumentCommand(moved, {
      type: 'bdc.move',
      bdcId: 'bdc-card-source-first',
      placement: { kind: BDC_LOCATION.PARENT, parentBdcId: 'bdc-carousel-target', index: 0 },
    })).toThrow('Un BDC Carousel doit contenir au moins une carte.')
  })

  it('rejects evaluation data on a Card BDC', () => {
    let document = applyDocumentCommand(createInitialDocument(), createCarouselBdcCommand(
      'bdc-carousel-invariant', 'page-a', 1, 'bdc-card-invariant',
    ))
    const evaluationPage = createEvaluationPage(document)
    document = applyDocumentCommand(evaluationPage.document, createEvaluationResultBdcCommand(
      'bdc-evaluation-result-invariant', evaluationPage.pageId, 1,
    ))
    const evaluationResult = document.bdcs.find((bdc) => bdc.id === 'bdc-evaluation-result-invariant')!.evaluationResult
    const invalid = new ElceDocument({
      ...document.data,
      bdcs: document.bdcs.map((bdc) => bdc.id === 'bdc-card-invariant'
        ? { ...bdc, evaluationResult }
        : bdc),
    })

    expect(() => assertDocumentInvariants(invalid)).toThrow('Bdc Carte incomplet : bdc-card-invariant')
  })

  it('rebinds media references owned by Card BDCs during catalogue merges', () => {
    let document = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-card-canonical',  name: 'photo.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    document = applyDocumentCommand(document, {
      type: 'media.add',
      media: { id: 'media-card-duplicate',  name: 'renamed.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    document = applyDocumentCommand(document, createCarouselBdcCommand('bdc-carousel-media-merge', 'page-a', 1))
    const cardBdcId = document.bdcs.find((bdc) => bdc.id === 'bdc-carousel-media-merge')!.carousel!.cards[0]!.bdcId
    document = applyDocumentCommand(document, {
      type: 'bdc.card.media.set',
      bdcId: cardBdcId,
      mediaId: 'media-card-duplicate',
    })

    const merged = applyDocumentCommand(document, {
      type: 'media.merge',
      canonicalMediaId: 'media-card-canonical',
      duplicateMediaIds: ['media-card-duplicate'],
    })

    expect(merged.bdcs.find((bdc) => bdc.id === cardBdcId)?.card?.mediaId).toBe('media-card-canonical')
    expect(merged.medias.map((media) => media.id)).toContain('media-card-canonical')
    expect(merged.medias.map((media) => media.id)).not.toContain('media-card-duplicate')
    assertDocumentInvariants(merged)
  })

  it('removes Carousel children with their parent but keeps reusable media', () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-card-photo',  name: 'card.png', mimeType: 'image/png', size: 100, caption: '' },
    })
    const withCarousel = applyDocumentCommand(withMedia, createCarouselBdcCommand('bdc-carousel-parent', 'page-a', 1))
    const cardBdcId = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-parent')!.carousel!.cards[0]!.bdcId
    const withCardMedia = applyDocumentCommand(withCarousel, {
      type: 'bdc.card.media.set',
      bdcId: cardBdcId,
      mediaId: 'media-card-photo',
    })
    const deleted = applyDocumentCommand(withCardMedia, { type: 'bdc.carousel.delete', bdcId: 'bdc-carousel-parent' })

    expect(deleted.bdcs.some((bdc) => bdc.id === cardBdcId || bdc.id === 'bdc-carousel-parent')).toBe(false)
    expect(deleted.medias.map((media) => media.id)).toContain('media-card-photo')
    assertDocumentInvariants(deleted)
  })

  it('permanently deletes only an unused catalog bdc and retains its media', () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const withCatalogBdc = createCardWithMedia(withMedia, 'bdc-catalog-image-1', DEFAULT_PRESET_ID.PHOTO, { kind: BDC_LOCATION.CATALOG }, 'media-image-1')
    const deleted = applyDocumentCommand(withCatalogBdc, { type: 'bdc.delete', bdcId: 'bdc-catalog-image-1' })

    expect(deleted.bdcs.map((bdc) => bdc.id)).toEqual(['bdc-section-1'])
    expect(deleted.data.catalogBdcIds).toEqual([])
    expect(deleted.medias).toEqual(withCatalogBdc.medias)
    assertDocumentInvariants(deleted)

    const withPageBdc = createCardWithMedia(withMedia, 'bdc-page-image-1', DEFAULT_PRESET_ID.PHOTO, { kind: BDC_LOCATION.PAGE, pageId: 'page-a' }, 'media-image-1')
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

  it('rejects previously persisted document versions without migrating them', () => {
    const withRootPage = applyDocumentCommand(createInitialDocument(), createPageCommand({
      pageId: 'page-root',
      bdcId: 'bdc-section-root',
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))
    const { scenarioEntries: _scenarioEntries, ...legacyFields } = withRootPage.toJSON()
    for (const version of [1, 2, 3]) {
      expect(() => ElceDocument.fromJSON({ ...legacyFields, version } as never))
        .toThrow(`Version de document Elcé non supportée : ${version}`)
    }
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
      presetId: 'photo-basic',
      media: {
        id: 'media-image-1',
        
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
    expect(updated.pages[0]?.bdcIds).toEqual(['bdc-section-1'])
    expect(updated.bdcs.find((bdc) => bdc.id === 'bdc-image-1')).toMatchObject({ pageId: null, card: { mediaId: 'media-image-1' } })
    expect(updated.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.content).toEqual(content)
    assertDocumentInvariants(updated)
  })

  it('attaches an unused catalog bdc without cloning its media', () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const available = createCardWithMedia(withMedia, 'bdc-image-1', DEFAULT_PRESET_ID.PHOTO, { kind: BDC_LOCATION.CATALOG }, 'media-image-1')
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
    expect(attached.pages[0]?.bdcIds).toEqual(['bdc-section-1'])
    expect(attached.bdcs.find((bdc) => bdc.id === 'bdc-image-1')).toMatchObject({
      pageId: null,
      parentBdcId: 'bdc-section-1',
      card: { mediaId: 'media-image-1' },
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
    })).toThrow('n’est pas dans le catalogue')
  })

  it('rejects catalog anchor attachment to a non-Flux page', () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const available = createCardWithMedia(withMedia, 'bdc-image-1', DEFAULT_PRESET_ID.PHOTO, { kind: BDC_LOCATION.CATALOG }, 'media-image-1')
    const withDiapo = applyDocumentCommand(available, createPageCommand({
      pageId: 'page-diapo',
      bdcId: 'bdc-carousel-diapo',
      initialCardBdcId: 'bdc-card-diapo',
      pageType: PAGE_TYPE.DIAPO,
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))

    expect(() => applyDocumentCommand(withDiapo, {
      type: 'bdc.anchor.attach',
      sectionBdcId: 'bdc-section-1',
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
      presetId: 'photo-basic',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
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

    expect(moved.bdcs.find((bdc) => bdc.id === 'bdc-image-1')).toMatchObject({
      pageId: null,
      parentBdcId: 'bdc-section-1',
    })
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
      presetId: 'photo-basic',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
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
      presetId: 'photo-basic',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
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
      parentBdcId: null,
      card: { mediaId: 'media-image-1' },
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
      presetId: 'photo-basic',
      media: { id: 'media-video-1',  name: 'video.mp4', mimeType: 'video/mp4', size: 24, caption: '' },
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
      presetId: 'photo-basic',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
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

  it('creates one unique Result BDC with editable success and failure branches', () => {
    const evaluationPage = createEvaluationPage(createInitialDocument())
    const resultDocument = applyDocumentCommand(evaluationPage.document, createEvaluationResultBdcCommand(
      'bdc-result-1', evaluationPage.pageId, 1,
    ))
    const resultBdc = resultDocument.bdcs.find((bdc) => bdc.id === 'bdc-result-1')!
    const updated = applyDocumentCommand(resultDocument, {
      type: 'bdc.evaluation-result.update',
      bdcId: resultBdc.id,
      evaluationResult: {
        success: { message: 'Bravo !', action: EVALUATION_RESULT_ACTION.REPLAY },
        failure: { message: 'À reprendre.', action: EVALUATION_RESULT_ACTION.RETRY },
      },
    })

    expect(resultDocument.pages.find((page) => page.id === evaluationPage.pageId)?.bdcIds).toEqual([
      evaluationPage.defaultBdcId,
      'bdc-result-1',
    ])
    expect(resultDocument.data.catalogBdcIds).toEqual([])
    expect(resultBdc.evaluationResult).toEqual({
      success: { message: '', action: null },
      failure: { message: '', action: null },
    })
    expect(updated.bdcs.find((bdc) => bdc.id === resultBdc.id)?.evaluationResult).toEqual({
      success: { message: 'Bravo !', action: EVALUATION_RESULT_ACTION.REPLAY },
      failure: { message: 'À reprendre.', action: EVALUATION_RESULT_ACTION.RETRY },
    })
    expect(() => applyDocumentCommand(updated, {
      type: 'bdc.evaluation-result.update',
      bdcId: resultBdc.id,
      evaluationResult: {
        success: { message: '', action: EVALUATION_RESULT_ACTION.RETRY },
        failure: { message: '', action: null },
      },
    })).toThrow('La reprise est réservée à l’échec de l’évaluation.')
    const deleted = applyDocumentCommand(updated, {
      type: 'bdc.evaluation-result.delete',
      bdcId: resultBdc.id,
    })
    expect(deleted.pages.find((page) => page.id === evaluationPage.pageId)?.bdcIds).toEqual([evaluationPage.defaultBdcId])
    expect(deleted.bdcs.some((bdc) => bdc.id === resultBdc.id)).toBe(false)
    assertDocumentInvariants(deleted)
  })

  it('rejects a Result BDC outside an Evaluation chapter', () => {
    expect(() => applyDocumentCommand(createInitialDocument(), createEvaluationResultBdcCommand(
      'bdc-result-outside-evaluation', 'page-a', 0,
    ))).toThrow('Un BDC Résultat ne peut être créé que dans une page d’un chapitre Évaluation.')
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
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const illustrated = applyDocumentCommand(withMedia, {
      type: 'bdc.question.media.set',
      bdcId: 'bdc-question-1',
      mediaId: 'media-image-1',
    })

    expect(illustrated.bdcs).toHaveLength(2)
    expect(illustrated.bdcs.find((bdc) => bdc.id === 'bdc-question-1')?.question?.mediaId).toBe('media-image-1')
    expect(illustrated.data.catalogBdcIds).toEqual([])
    expect(illustrated.medias.map((media) => media.id)).toEqual(['media-image-1'])
  })
})

/** Creates a Card BDC and assigns its reusable resource through the Card command. */
function createCardWithMedia(
  document: ReturnType<typeof createInitialDocument>,
  bdcId: string,
  presetId: string,
  placement: BdcPlacement,
  mediaId: string,
): ReturnType<typeof createInitialDocument> {
  const created = applyDocumentCommand(document, {
    type: 'bdc.create',
    bdcId,
    bdcType: BDC_TYPE.CARD,
    presetId,
    placement,
  })
  return applyDocumentCommand(created, { type: 'bdc.card.media.set', bdcId, mediaId })
}

/** Creates a Flux page with its default Question inside a dedicated Evaluation chapter. */
function createEvaluationPage(document: ReturnType<typeof createInitialDocument>) {
  const withChapter = applyDocumentCommand(document, createChapterCommand(
    document,
    'Chapitre Évaluation de test',
    CHAPTER_TYPE.EVALUATION,
  ))
  const chapter = withChapter.chapters.at(-1)!
  const pageCommand = createDefaultPageCommand(
    withChapter,
    { kind: PAGE_LOCATION.CHAPTER, chapterId: chapter.id },
    'Page Évaluation de test',
    PAGE_TYPE.FLUX,
  )
  return {
    document: applyDocumentCommand(withChapter, pageCommand),
    pageId: pageCommand.pageId,
    defaultBdcId: pageCommand.bdcId,
  }
}
