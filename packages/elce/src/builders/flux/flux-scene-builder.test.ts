import { describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
} from '@codplay/component-v2'
import { BDC_LOCATION, BDC_TYPE, CAROUSEL_PLAYBACK_MODE, CHAPTER_TYPE, DEFAULT_PRESET_ID, ELCE_EVENTS, EVALUATION_RESULT_ACTION, EVALUATION_RESULT_BRANCH, MEDIA_TYPE, PAGE_LOCATION, PAGE_TYPE, QUESTION_TYPE } from '../../config/document-config'
import { anchorNameFor } from '../../anchor/anchor-position'
import { applyDocumentCommand, createCardBdcCommand, createChapterCommand, createCarouselBdcCommand, createDefaultPageCommand, createEvaluationResultBdcCommand } from '../../domain/commands/document-commands'
import { createInitialDocument } from '../../domain/document/document-model'
import { ElceQuestionService } from '../../domain/question/question-service'
import { ElceCarouselService } from '../../domain/carousel/carousel-service'
import { buildFluxScene } from './flux-scene-builder'

describe('Elcé Flux scene builder', () => {
  it('creates one scrollport, one article and one story per Section', () => {
    const document = createInitialDocument()
    const page = document.pages[0]!
    const build = buildFluxScene(page, document.bdcs)

    expect(build.sceneDoc.stories['page-a-page']?.persos.map((perso) => perso.id)).toEqual([
      'page-a-scrollport',
      'page-a-article',
      'page-a-bottom-marker',
    ])
    expect(build.storyIds).toEqual(['page-a-page', 'page-a-bdc-section-1'])
    expect(build.sceneDoc.stories['page-a-page']?.persos[1]?.initial).toMatchObject({
      markup: expect.stringContaining('id="page-a-article"'),
    })
    expect(build.sceneDoc.stories['page-a-bdc-section-1']?.persos).toHaveLength(0)
    expect(build.sceneDoc.stories['page-a-page']?.persos[2]?.emit?.observe).toMatchObject({
      initial: 'enter',
      enter: [{ name: ELCE_EVENTS.PAGE_FINISHED }],
    })
  })

  it('places a comment anchor before the exported Section text markup', () => {
    const initial = createInitialDocument()
    const withTitle = applyDocumentCommand(initial, {
      type: 'bdc.section.update',
      bdcId: 'bdc-section-1',
      title: 'Introduction',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texte' }] }] },
      markup: '<p id="section-text-1">Texte</p>',
    })
    const build = buildFluxScene(withTitle.pages[0]!, withTitle.bdcs)
    const articleInitial = build.sceneDoc.stories['page-a-page']?.persos[1]?.initial
    const articleMarkup = articleInitial !== undefined && 'markup' in articleInitial ? String(articleInitial.markup) : ''

    const titleHostPosition = articleMarkup.indexOf('<!-- data-part="page-a:bdc-section-1:section:title" -->')
    expect(titleHostPosition).toBeGreaterThanOrEqual(0)
    expect(titleHostPosition).toBeLessThan(articleMarkup.indexOf('<p id="section-text-1">Texte</p>'))
    expect(build.sceneDoc.stories['page-a-bdc-section-1']?.persos[0]?.initial).toMatchObject({
      content: 'Introduction',
      move: { target: 'page-a:bdc-section-1:section:title' },
    })
  })

  it('compiles through the CodPlay scene boundary with the optional scroll capability', () => {
    const document = createInitialDocument()
    const build = buildFluxScene(document.pages[0]!, document.bdcs)
    const codplay = new CodPlay({
      pauseOnDocumentHidden: false,
      engine: {
        idle: false,
        components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
        modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
      },
    })

    const result = codplay.build({ scene: build.sceneDoc })

    expect(result.ok).toBe(true)
    codplay.destroy()
  })

  it('resolves the configured non-Flux page case explicitly', () => {
    const document = createInitialDocument()

    expect(() => buildFluxScene({ ...document.pages[0]!, type: PAGE_TYPE.DIAPO }, document.bdcs))
      .toThrow('page Diapo')
  })

  it('projects a simple image bdc to one img perso and comment anchors', () => {
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const createdCard = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.CARD,
      presetId: 'photo-basic',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const withImage = applyDocumentCommand(createdCard, { type: 'bdc.card.media.set', bdcId: 'bdc-image-1', mediaId: 'media-image-1' })
    const build = buildFluxScene(withImage.pages[0]!, withImage.bdcs, {
      mediaSources: { 'media-image-1': 'blob:image-1' },
      mediaTypes: { 'media-image-1': MEDIA_TYPE.IMAGE },
    })

    const pagePersos = build.sceneDoc.stories['page-a-page']?.persos ?? []
    expect(pagePersos).toHaveLength(5)
    expect(pagePersos[3]).toMatchObject({
      type: 'layout',
      initial: {
        markup: expect.stringContaining('<!-- data-part="page-a:bdc-image-1:card:bdc-image-1:media" -->'),
        move: { target: 'page-a:bdc-image-1:card:mount' },
      },
    })
    expect(pagePersos[4]).toMatchObject({
      type: 'img',
      initial: { src: 'blob:image-1', move: { target: 'page-a:bdc-image-1:card:bdc-image-1:media' } },
    })
  })

  it('mounts an image bdc at the exported anchor inside the text flow', () => {
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const anchored = applyDocumentCommand(withMedia, {
      type: 'bdc.anchor.create',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      presetId: DEFAULT_PRESET_ID.PHOTO,
      media: { id: 'media-image-1', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
      partId: 'page-a:bdc-image-1:anchor',
      markup: '<p id="section-text-1">Avant <span id="page-a:bdc-image-1:anchor" data-elce-anchor="true" data-bdc-id="bdc-image-1" data-part="page-a:bdc-image-1:anchor" style="padding-bottom:12rem;"></span> après</p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: 'Avant ' },
          { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
          { type: 'text', text: ' après' },
        ] }],
      },
    })
    const build = buildFluxScene(anchored.pages[0]!, anchored.bdcs, {
      mediaSources: { 'media-image-1': 'blob:image-1' },
      mediaTypes: { 'media-image-1': MEDIA_TYPE.IMAGE },
    })
    const pageStory = build.sceneDoc.stories['page-a-page']
    const articleInitial = pageStory?.persos[1]?.initial
    const articleMarkup = articleInitial !== undefined && 'markup' in articleInitial ? String(articleInitial.markup) : ''

    expect(articleMarkup).toContain('class="elce-flow-slot"')
    expect(articleMarkup).not.toContain('data-elce-anchor="true"')
    expect(articleMarkup).not.toContain('page-a-bdc-image-1-media-host')
    expect(articleInitial).toMatchObject({
      flowReservations: [{
        partId: 'page-a:bdc-image-1:anchor',
        blockSize: 'calc(12rem + 1rem + 1rem)',
      }],
    })
    expect(pageStory?.persos[3]).toMatchObject({
      type: 'layout',
      initial: {
        className: expect.stringContaining('elce-flux-card-root'),
        style: expect.objectContaining({
          position: 'absolute',
          'position-anchor': anchorNameFor('page-a:bdc-image-1:anchor'),
          width: '100%',
          aspectRatio: '4 / 3',
        }),
        move: { target: 'page-a:bdc-image-1:anchor' },
      },
    })
    expect(pageStory?.persos[4]).toMatchObject({
      type: 'img',
      initial: {
        src: 'blob:image-1',
        move: { target: 'page-a:bdc-section-1:card:bdc-image-1:media' },
      },
    })
  })

  it('projects a simple video bdc to one media perso with native controls', () => {
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-video-1',  name: 'video.mp4', mimeType: 'video/mp4', size: 10, caption: '' },
    })
    const createdCard = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-video-1',
      bdcType: BDC_TYPE.CARD,
      presetId: 'photo-basic',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const withVideo = applyDocumentCommand(createdCard, { type: 'bdc.card.media.set', bdcId: 'bdc-video-1', mediaId: 'media-video-1' })
    const build = buildFluxScene(withVideo.pages[0]!, withVideo.bdcs, {
      mediaSources: { 'media-video-1': 'blob:video-1' },
      mediaTypes: { 'media-video-1': MEDIA_TYPE.VIDEO },
    })
    const videoPerso = build.sceneDoc.stories['page-a-page']?.persos[4]

    expect(videoPerso).toMatchObject({
      type: 'media',
      initial: { tag: 'video', src: 'blob:video-1', controls: true, move: { target: 'page-a:bdc-video-1:card:bdc-video-1:media' } },
    })
  })

  it('projects Question inputs, instructions, validation, and reset as a CodPlay story', () => {
    const questionService = new ElceQuestionService()
    const withQuestion = applyDocumentCommand(createInitialDocument(), {
      type: 'bdc.create',
      bdcId: 'bdc-question-1',
      bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a', index: 0 },
    })
    const createdQuestion = withQuestion.bdcs.find((bdc) => bdc.id === 'bdc-question-1')!.question!
    const multipleChoice = questionService.setPrompt(
      questionService.changeType(createdQuestion, QUESTION_TYPE.MULTIPLE_CHOICE),
      'Quels éléments sont corrects ?',
    )
    const documentModel = applyDocumentCommand(withQuestion, {
      type: 'bdc.question.update',
      bdcId: 'bdc-question-1',
      question: multipleChoice,
    })
    const build = buildFluxScene(documentModel.pages[0]!, documentModel.bdcs)
    const questionStory = build.sceneDoc.stories['page-a-bdc-question-1']
    const answerInputs = questionStory?.persos.filter((perso) => perso.type === 'input')
    const codplay = new CodPlay({
      pauseOnDocumentHidden: false,
      engine: {
        idle: false,
        components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
        modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
      },
    })

    expect(build.sceneDoc.stories['page-a-page']?.persos[1]?.initial).toMatchObject({
      markup: expect.stringContaining('<!-- data-part="page-a:bdc-question-1:question:answers" -->'),
    })
    expect(answerInputs).toHaveLength(2)
    expect(answerInputs?.map((perso) => perso.initial)).toEqual(expect.arrayContaining([
      expect.objectContaining({ inputType: 'checkbox', value: multipleChoice.answers[0]?.id }),
      expect.objectContaining({ inputType: 'checkbox', value: multipleChoice.answers[1]?.id }),
    ]))
    expect(questionStory?.persos.map((perso) => perso.initial)).toEqual(expect.arrayContaining([
      expect.objectContaining({ content: 'Quels éléments sont corrects ?' }),
      expect.objectContaining({ content: 'Plusieurs réponses possibles. Sélectionnez-les, puis validez.' }),
      expect.objectContaining({ tag: 'button', attr: { type: 'button', disabled: true } }),
    ]))
    expect(questionStory?.listen).toEqual(expect.arrayContaining([
      expect.objectContaining({ on: 'page-a:bdc-question-1:validate' }),
      expect.objectContaining({ on: 'page-a:bdc-question-1:reset' }),
    ]))
    const result = codplay.build({ scene: build.sceneDoc })
    expect(result.ok).toBe(true)
    codplay.destroy()
  })

  it('projects identified Card BDCs through AutoCapsule, CodPlay stories, and reusable media persos', () => {
    const carouselService = new ElceCarouselService()
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-carousel-image',  name: 'slide.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    let withCarousel = applyDocumentCommand(withMedia, createCarouselBdcCommand('bdc-carousel-1', 'page-a', 1))
    const createdCarousel = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-1')!.carousel!
    const firstCardBdcId = createdCarousel.cards[0]!.bdcId
    withCarousel = applyDocumentCommand(withCarousel, createCardBdcCommand(
      'bdc-card-2', 'bdc-carousel-1', 1, DEFAULT_PRESET_ID.IMAGE_CAPTION,
    ))
    withCarousel = applyDocumentCommand(withCarousel, {
      type: 'bdc.card.layout.set',
      bdcId: firstCardBdcId,
      layoutId: DEFAULT_PRESET_ID.TEXT_IMAGE,
    })
    const firstCard = withCarousel.bdcs.find((bdc) => bdc.id === firstCardBdcId)!.card!
    withCarousel = applyDocumentCommand(withCarousel, {
      type: 'bdc.card.update',
      bdcId: firstCardBdcId,
      card: { ...firstCard, title: 'Première carte', imagePosition: 'right' },
    })
    withCarousel = applyDocumentCommand(withCarousel, { type: 'bdc.card.media.set', bdcId: firstCardBdcId, mediaId: 'media-carousel-image' })
    const secondCard = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-card-2')!.card!
    withCarousel = applyDocumentCommand(withCarousel, {
      type: 'bdc.card.update',
      bdcId: 'bdc-card-2',
      card: { ...secondCard, caption: 'Légende de l’image' },
    })
    withCarousel = applyDocumentCommand(withCarousel, { type: 'bdc.card.media.set', bdcId: 'bdc-card-2', mediaId: 'media-carousel-image' })
    const carousel = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-1')!.carousel!
    const automaticCarousel = carouselService.setRepeatCount(
      carouselService.setPlaybackMode(
        carouselService.setDefaultViewDuration(carousel, 1000),
        CAROUSEL_PLAYBACK_MODE.AUTOMATIC,
      ),
      0,
    )
    const timedCarousel = carouselService.setCardDuration(automaticCarousel, 'bdc-card-2', 2500)
    const documentModel = applyDocumentCommand(withCarousel, {
      type: 'bdc.carousel.update',
      bdcId: 'bdc-carousel-1',
      carousel: timedCarousel,
    })
    const build = buildFluxScene(documentModel.pages[0]!, documentModel.bdcs, {
      mediaSources: { 'media-carousel-image': 'blob:carousel-image' },
      mediaTypes: { 'media-carousel-image': MEDIA_TYPE.IMAGE },
    })
    const carouselStory = build.sceneDoc.stories['page-a-bdc-carousel-1']
    const articleInitial = build.sceneDoc.stories['page-a-page']?.persos[1]?.initial
    const articleMarkup = String(articleInitial?.['markup'] ?? '')
    const codplay = new CodPlay({
      pauseOnDocumentHidden: false,
      engine: {
        idle: false,
        components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
        modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
      },
    })

    expect(documentModel.pages[0]?.bdcIds).toEqual(['bdc-section-1', 'bdc-carousel-1'])
    expect(articleMarkup.indexOf('elce-card--section')).toBeLessThan(articleMarkup.indexOf('elce-card--carousel'))
    expect(articleMarkup).not.toContain('page-a-bdc-carousel-1-frame')
    expect(articleMarkup).toMatch(/<section id="page-a-bdc-carousel-1"[^>]*>\s*<!-- data-part="page-a:bdc-carousel-1:carousel:frame" --><div id="page-a-bdc-carousel-1-capsule"/)
    expect(carouselStory?.eventimes).toEqual([
      { name: `page-a:bdc-carousel-1:card:${firstCardBdcId}:outro`, startAt: 1000 },
      { name: 'page-a:bdc-carousel-1:card:bdc-card-2:intro', startAt: 1000 },
    ])
    expect(carouselStory?.persos).toEqual(expect.arrayContaining([
      expect.objectContaining({ initial: expect.objectContaining({ content: 'Première carte', move: { target: `page-a:bdc-carousel-1:card:${firstCardBdcId}:title` } }) }),
      expect.objectContaining({ initial: expect.objectContaining({ content: 'Légende de l’image', move: { target: 'page-a:bdc-carousel-1:card:bdc-card-2:caption' } }) }),
      expect.objectContaining({ initial: expect.objectContaining({ move: { target: `page-a:bdc-carousel-1:carousel:capsule` }, className: expect.stringContaining('elce-carousel-view--image-right') }) }),
    ]))
    expect(build.sceneDoc.stories['page-a-page']?.persos.find((perso) => perso.id === 'card-bdc-card-2-media-media-carousel-image')).toMatchObject({
      type: 'img',
      initial: { src: 'blob:carousel-image', move: { target: 'page-a:bdc-carousel-1:card:bdc-card-2:image' } },
    })
    expect(build.sceneDoc.stories['page-a-page']?.persos.find((perso) => perso.id === `card-${firstCardBdcId}-media-media-carousel-image`)).toMatchObject({
      type: 'img',
      initial: { src: 'blob:carousel-image', move: { target: `page-a:bdc-carousel-1:card:${firstCardBdcId}:image` } },
    })
    expect(build.styleSheets[0]).toContain('ac-grid-carousel')
    expect(codplay.build({ scene: build.sceneDoc }).ok).toBe(true)
    codplay.destroy()
  })

  it('keeps hidden Card media and content when a layout changes', () => {
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-hidden-image',  name: 'hidden.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const withCarousel = applyDocumentCommand(withMedia, createCarouselBdcCommand('bdc-hidden-media', 'page-a', 1))
    let carousel = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-hidden-media')!.carousel!
    const cardBdcId = carousel.cards[0]!.bdcId
    let textOnlyDocument = applyDocumentCommand(withCarousel, { type: 'bdc.card.layout.set', bdcId: cardBdcId, layoutId: DEFAULT_PRESET_ID.PHOTO })
    textOnlyDocument = applyDocumentCommand(textOnlyDocument, { type: 'bdc.card.media.set', bdcId: cardBdcId, mediaId: 'media-hidden-image' })
    const card = textOnlyDocument.bdcs.find((bdc) => bdc.id === cardBdcId)!.card!
    textOnlyDocument = applyDocumentCommand(textOnlyDocument, {
      type: 'bdc.card.update',
      bdcId: cardBdcId,
      card: { ...card, title: 'Titre gardé', message: 'Message gardé', caption: 'Légende gardée' },
    })
    textOnlyDocument = applyDocumentCommand(textOnlyDocument, { type: 'bdc.card.layout.set', bdcId: cardBdcId, layoutId: DEFAULT_PRESET_ID.TEXT_SHORT })
    const hiddenBuild = buildFluxScene(textOnlyDocument.pages[0]!, textOnlyDocument.bdcs, {
      mediaSources: { 'media-hidden-image': 'blob:hidden-image' },
      mediaTypes: { 'media-hidden-image': MEDIA_TYPE.IMAGE },
    })
    const hiddenStory = hiddenBuild.sceneDoc.stories['page-a-bdc-hidden-media']
    expect(textOnlyDocument.bdcs.find((bdc) => bdc.id === cardBdcId)).toMatchObject({
      presetId: DEFAULT_PRESET_ID.TEXT_SHORT,
      card: { mediaId: 'media-hidden-image', title: 'Titre gardé', message: 'Message gardé', caption: 'Légende gardée' },
    })
    expect(hiddenStory).toBeDefined()
    expect(hiddenBuild.sceneDoc.stories['page-a-page']?.persos.some((perso) => perso.id.includes('media-hidden-image'))).toBe(false)

    const textImageDocument = applyDocumentCommand(textOnlyDocument, { type: 'bdc.card.layout.set', bdcId: cardBdcId, layoutId: DEFAULT_PRESET_ID.TEXT_IMAGE })
    const restoredBuild = buildFluxScene(textImageDocument.pages[0]!, textImageDocument.bdcs, {
      mediaSources: { 'media-hidden-image': 'blob:hidden-image' },
      mediaTypes: { 'media-hidden-image': MEDIA_TYPE.IMAGE },
    })
    const restoredStory = restoredBuild.sceneDoc.stories['page-a-bdc-hidden-media']
    expect(restoredStory?.persos).toEqual(expect.arrayContaining([
      expect.objectContaining({ initial: expect.objectContaining({ content: 'Titre gardé' }) }),
    ]))
    expect(restoredBuild.sceneDoc.stories['page-a-page']?.persos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `card-${cardBdcId}-media-media-hidden-image`, type: 'img' }),
    ]))

    const codplay = new CodPlay({
      pauseOnDocumentHidden: false,
      engine: {
        idle: false,
        components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
        modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
      },
    })
    expect(codplay.build({ scene: restoredBuild.sceneDoc }).ok).toBe(true)
    codplay.destroy()
  })

  it('resolves ten additional automatic passes as finite CodPlay eventimes', () => {
    const initial = createInitialDocument()
    const withCarousel = applyDocumentCommand(initial, createCarouselBdcCommand('bdc-repeat-10', 'page-a', 1))
    const carousel = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-repeat-10')!.carousel!
    const firstCardBdcId = carousel.cards[0]!.bdcId
    const withSecondCard = applyDocumentCommand(withCarousel, createCardBdcCommand(
      'bdc-repeat-10-card-2', 'bdc-repeat-10', 1, DEFAULT_PRESET_ID.TEXT_SHORT,
    ))
    const updatedCarousel = withSecondCard.bdcs.find((bdc) => bdc.id === 'bdc-repeat-10')!.carousel!
    const automaticCarousel = {
      ...updatedCarousel,
      playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC,
      defaultViewDurationMs: 1000,
      repeatCount: 10,
    }
    const documentModel = applyDocumentCommand(withSecondCard, {
      type: 'bdc.carousel.update',
      bdcId: 'bdc-repeat-10',
      carousel: automaticCarousel,
    })
    const scene = buildFluxScene(documentModel.pages[0]!, documentModel.bdcs).sceneDoc
    const eventimes = scene.stories['page-a-bdc-repeat-10']?.eventimes ?? []
    const firstCardIntro = `page-a:bdc-repeat-10:card:${firstCardBdcId}:intro`

    expect(automaticCarousel.repeatCount).toBe(10)
    expect(eventimes.filter((eventime) => eventime.name === firstCardIntro).map((eventime) => eventime.startAt))
      .toEqual(Array.from({ length: 10 }, (_, index) => (index + 1) * 2000))
    expect(eventimes).toHaveLength(42)
  })

  it('projects one Result BDC with success and failure persos through CodPlay', () => {
    const initial = createInitialDocument()
    const withChapter = applyDocumentCommand(initial, createChapterCommand(
      initial,
      'Évaluation de test',
      CHAPTER_TYPE.EVALUATION,
    ))
    const chapter = withChapter.chapters.at(-1)!
    const pageCommand = createDefaultPageCommand(
      withChapter,
      { kind: PAGE_LOCATION.CHAPTER, chapterId: chapter.id },
      'Page Évaluation',
      PAGE_TYPE.FLUX,
    )
    let withResult = applyDocumentCommand(withChapter, pageCommand)
    withResult = applyDocumentCommand(withResult, createEvaluationResultBdcCommand(
      'bdc-result-1', pageCommand.pageId, 1,
    ))
    const emptyPage = withResult.pages.find((candidate) => candidate.id === pageCommand.pageId)!
    const emptyBuild = buildFluxScene(emptyPage, withResult.bdcs)
    const emptyStory = emptyBuild.sceneDoc.stories[`${pageCommand.pageId}-bdc-result-1`]
    expect(emptyStory?.persos.some((perso) => perso.id.endsWith('-message'))).toBe(false)
    const configured = applyDocumentCommand(withResult, {
      type: 'bdc.evaluation-result.update',
      bdcId: 'bdc-result-1',
      evaluationResult: {
        success: { message: 'Bravo !', action: EVALUATION_RESULT_ACTION.REPLAY },
        failure: { message: 'À reprendre.', action: EVALUATION_RESULT_ACTION.RETRY },
      },
    })
    const page = configured.pages.find((candidate) => candidate.id === pageCommand.pageId)!
    const build = buildFluxScene(page, configured.bdcs)
    const resultStory = build.sceneDoc.stories[`${page.id}-bdc-result-1`]
    const resultPersos = resultStory?.persos ?? []
    const resultLayout = resultPersos[0]
    const successAction = resultPersos.find((perso) => perso.id === 'bdc-result-1-success-action')
    const failureAction = resultPersos.find((perso) => perso.id === 'bdc-result-1-failure-action')
    const codplay = new CodPlay({
      pauseOnDocumentHidden: false,
      engine: {
        idle: false,
        components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
        modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
      },
    })

    expect(resultPersos.map((perso) => perso.id)).toEqual([
      'bdc-result-1-result-card',
      'bdc-result-1-success-message',
      'bdc-result-1-success-action',
      'bdc-result-1-failure-message',
      'bdc-result-1-failure-action',
    ])
    expect(resultLayout?.initial).toMatchObject({ className: 'elce-card--evaluation-result elce-evaluation-result--pending' })
    expect(resultLayout?.actions).toEqual({
      [ELCE_EVENTS.EVALUATION_RESULT_SUCCESS]: { className: 'elce-card--evaluation-result elce-evaluation-result--success' },
      [ELCE_EVENTS.EVALUATION_RESULT_FAILURE]: { className: 'elce-card--evaluation-result elce-evaluation-result--failure' },
    })
    expect(successAction?.emit?.click).toMatchObject({
      event: {
        name: ELCE_EVENTS.EVALUATION_RESULT_ACTION,
        data: { branch: EVALUATION_RESULT_BRANCH.SUCCESS, action: EVALUATION_RESULT_ACTION.REPLAY },
      },
    })
    expect(failureAction?.emit?.click).toMatchObject({
      event: {
        name: ELCE_EVENTS.EVALUATION_RESULT_ACTION,
        data: { branch: EVALUATION_RESULT_BRANCH.FAILURE, action: EVALUATION_RESULT_ACTION.RETRY },
      },
    })
    expect(codplay.build({ scene: build.sceneDoc }).ok).toBe(true)
    codplay.destroy()
  })
})
