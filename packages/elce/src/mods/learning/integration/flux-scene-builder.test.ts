import { describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
} from '@codplay/component-v2'
import { BDC_TYPE, DEFAULT_PRESET_ID, PAGE_TYPE } from '../learning-definition'
import { CAROUSEL_PLAYBACK_MODE } from '../../../resources/bdcs/carousel/carousel-config'
import { CAROUSEL_TRANSITION } from '../../../resources/revelation/revelation-config'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import { ELCE_EVENTS } from '../reading/learning-reading-events'
import {
  EVALUATION_RESULT_ACTION,
  EVALUATION_RESULT_BRANCH,
} from '../evaluation/learning-evaluation-config'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { QUESTION_TYPE } from '../../../resources/bdcs/question/question-config'
import { MEDIA_TYPE } from '../../../core/media/media-config'
import { BDC_LOCATION } from '../../../core/document/content-location'
import { anchorNameFor } from '../../../domain/anchor/anchor-position'
import { applyDocumentCommand, createCardBdcCommand, createChapterCommand, createCarouselBdcCommand, createDefaultPageCommand, createEvaluationResultBdcCommand } from '../../../domain/commands/document-commands'
import { learningDocumentService } from '../document/learning-document-service'
import { ElceQuestionService } from '../../../resources/bdcs/question/domain/question-service'
import { ElceCarouselService } from '../../../resources/bdcs/carousel/domain/carousel-service'
import { ELCE_EDITOR_SETTINGS } from '../../../config/editor-settings'
import { ElceEditorSettingsResolver } from '../../../domain/editor-settings/editor-settings-resolver'
import type { RevelationTransitionDefaults } from '../../../resources/revelation/revelation-types'
import type { FluxSceneBuildOptions } from '../../../resources/pages/flux/flux-scene-builder-types'
import { buildFluxScene as projectFluxScene } from '../../../resources/pages/flux/flux-scene-builder'
import { createLearningSceneBuilders } from '../reading/learning-scene-builders'
import { createLearningAdditionalBdcBuilder } from '../evaluation/reading/learning-additional-bdc-builder'

const editorSettingsResolver = new ElceEditorSettingsResolver()

/** Adds test-owned editor settings before exercising the real scene projection. */
function buildFluxSceneForTest(
  page: Parameters<typeof projectFluxScene>[0],
  bdcs: Parameters<typeof projectFluxScene>[1],
  options: Omit<FluxSceneBuildOptions, 'editorSettings' | 'presetBuilder' | 'cardBdcSceneBuilder' | 'carouselSceneBuilder'> & { readonly revelationDefaults?: RevelationTransitionDefaults } = {},
) {
  const { revelationDefaults, ...sceneOptions } = options
  const editorSettings = editorSettingsResolver.resolvePage(
    page,
    bdcs,
    revelationDefaults ?? ELCE_EDITOR_SETTINGS.revelation.projectDefaults,
  )
  return projectFluxScene(page, bdcs, { ...sceneOptions, ...createLearningSceneBuilders(), editorSettings })
}


describe('Elcé Flux scene builder', () => {
  it('creates one scrollport, one article and one story per Section', () => {
    const document = learningDocumentService.createInitialDocument()
    const page = document.pages[0]!
    const build = buildFluxSceneForTest(page, document.bdcs)

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
    const initial = learningDocumentService.createInitialDocument()
    const withTitle = applyDocumentCommand(initial, {
      type: 'bdc.section.update',
      bdcId: 'bdc-section-1',
      title: 'Introduction',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texte' }] }] },
      markup: '<p id="section-text-1">Texte</p>',
    })
    const build = buildFluxSceneForTest(withTitle.pages[0]!, withTitle.bdcs)
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
    const document = learningDocumentService.createInitialDocument()
    const build = buildFluxSceneForTest(document.pages[0]!, document.bdcs)
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
    const document = learningDocumentService.createInitialDocument()

    expect(() => buildFluxSceneForTest({ ...document.pages[0]!, type: PAGE_TYPE.DIAPO }, document.bdcs))
      .toThrow('page Diapo')
  })

  it('projects a simple image bdc to one img perso and comment anchors', () => {
    const initial = learningDocumentService.createInitialDocument()
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
    const build = buildFluxSceneForTest(withImage.pages[0]!, withImage.bdcs, {
      mediaSources: { 'media-image-1': 'blob:image-1' },
      mediaTypes: { 'media-image-1': MEDIA_TYPE.IMAGE },
    })

    const pagePersos = build.sceneDoc.stories['page-a-page']?.persos ?? []
    expect(pagePersos).toHaveLength(6)
    expect(pagePersos[3]).toMatchObject({
      type: 'layout',
      initial: {
        markup: expect.stringContaining('<!-- data-part="page-a:bdc-image-1:card:bdc-image-1:media" -->'),
        move: { target: 'page-a:bdc-image-1:card:mount' },
      },
      emit: { observe: {
        root: 'page-a-scrollport',
        zone: { threshold: 0 },
        enter: [{ name: 'page-a-bdc-image-1-card:enter' }],
        leave: [{ name: 'page-a-bdc-image-1-card:leave' }],
      } },
    })
    expect(pagePersos[3]?.initial).not.toHaveProperty('style')
    expect(pagePersos[3]?.actions).toBeUndefined()
    expect(pagePersos[4]).toMatchObject({
      type: 'img',
      initial: {
        src: 'blob:image-1',
        style: { opacity: 1, x: 0 },
        move: { target: 'page-a:bdc-image-1:card:bdc-image-1:media' },
      },
      actions: {
        'page-a-bdc-image-1-card:enter': { style: {
          opacity: { from: 0, to: 1, duration: 300 },
          x: { from: -250, to: 0, duration: 300 },
        } },
        'page-a-bdc-image-1-card:leave': { style: {
          opacity: { to: 0, duration: 300 },
          x: { to: 250, duration: 300 },
        } },
      },
    })
    expect(pagePersos[5]).toMatchObject({ type: 'layout', id: 'page-a-page-viewport-expansion-host' })
  })

  it('mounts an image bdc at the exported anchor inside the text flow', () => {
    const initial = learningDocumentService.createInitialDocument()
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
    const build = buildFluxSceneForTest(anchored.pages[0]!, anchored.bdcs, {
      mediaSources: { 'media-image-1': 'blob:image-1' },
      mediaTypes: { 'media-image-1': MEDIA_TYPE.IMAGE },
      appearanceClassNamesByTarget: { 'bdc:bdc-image-1': 'bdc appearance-test density-normal' },
      revelationDefaults: {
        intro: CAROUSEL_TRANSITION.SWIPE_RIGHT,
        outro: CAROUSEL_TRANSITION.SWIPE_LEFT,
      },
    })
    const pageStory = build.sceneDoc.stories['page-a-page']
    const articleInitial = pageStory?.persos[1]?.initial
    const articleMarkup = articleInitial !== undefined && 'markup' in articleInitial ? String(articleInitial.markup) : ''

    expect(articleMarkup).toContain('class="elce-flow-slot elce-flow-slot-')
    expect(articleMarkup).not.toContain('data-elce-anchor="true"')
    expect(articleMarkup).not.toContain('page-a-bdc-image-1-media-host')
    expect(articleInitial).toMatchObject({
      flowReservations: [{
        partId: 'page-a:bdc-image-1:anchor',
        blockSize: 'calc(12rem + 2rem + 2rem)',
      }],
    })
    expect(pageStory?.persos[3]).toMatchObject({
      type: 'layout',
      initial: {
        className: expect.stringContaining('elce-flux-card-root'),
        move: { target: 'page-a:bdc-image-1:anchor' },
      },
      emit: { observe: {
        root: 'page-a-scrollport',
        zone: { threshold: 0 },
        enter: [{ name: 'page-a-bdc-image-1-card:enter' }],
        leave: [{ name: 'page-a-bdc-image-1-card:leave' }],
      } },
    })
    expect(pageStory?.persos[3]?.initial).toMatchObject({
      className: expect.stringContaining('appearance-test'),
    })
    expect(pageStory?.persos[3]?.initial).not.toHaveProperty('style')
    expect(pageStory?.persos[3]?.actions).toBeUndefined()
    expect(build.styleSheets.join('\n')).toContain(`position-anchor: ${anchorNameFor('page-a:bdc-image-1:anchor')}`)
    expect(build.styleSheets.join('\n')).toContain('z-index: 1;')
    expect(pageStory?.persos[4]).toMatchObject({
      type: 'img',
      initial: {
        src: 'blob:image-1',
        style: { opacity: 1, x: 0 },
        move: { target: 'page-a:bdc-section-1:card:bdc-image-1:media' },
      },
      actions: {
        'page-a-bdc-image-1-card:enter': { style: {
          opacity: { from: 0, to: 1, duration: 300 },
          x: { from: -250, to: 0, duration: 300 },
        } },
        'page-a-bdc-image-1-card:leave': { style: {
          opacity: { to: 0, duration: 300 },
          x: { to: -250, duration: 300 },
        } },
      },
    })
  })

  it('keeps the reveal on the root for a Card without media', () => {
    const initial = learningDocumentService.createInitialDocument()
    const createdCard = applyDocumentCommand(initial, {
      type: 'bdc.create',
      bdcId: 'bdc-text-card',
      bdcType: BDC_TYPE.CARD,
      presetId: DEFAULT_PRESET_ID.TEXT_SHORT,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const persos = buildFluxSceneForTest(createdCard.pages[0]!, createdCard.bdcs).sceneDoc.stories['page-a-page']?.persos ?? []

    expect(persos.find((perso) => perso.id === 'page-a-bdc-text-card-card')).toMatchObject({
      initial: { style: { opacity: 1, x: 0 } },
      actions: {
        'page-a-bdc-text-card-card:enter': { style: { x: { from: -250, to: 0, duration: 300 } } },
      },
    })
  })

  it('projects a simple video bdc to one media perso with native controls', () => {
    const initial = learningDocumentService.createInitialDocument()
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
    const build = buildFluxSceneForTest(withVideo.pages[0]!, withVideo.bdcs, {
      mediaSources: { 'media-video-1': 'blob:video-1' },
      mediaTypes: { 'media-video-1': MEDIA_TYPE.VIDEO },
    })
    const videoPerso = build.sceneDoc.stories['page-a-page']?.persos[4]

    expect(videoPerso).toMatchObject({
      type: 'media',
      initial: {
        tag: 'video', src: 'blob:video-1', controls: true, sync: 'independent',
        style: { opacity: 1, x: 0 },
        move: { target: 'page-a:bdc-video-1:card:bdc-video-1:media' },
      },
      actions: {
        'page-a-bdc-video-1-card:enter': { style: {
          opacity: { from: 0, to: 1, duration: 300 },
          x: { from: -250, to: 0, duration: 300 },
        } },
      },
    })
  })

  it('projects Question inputs, instructions, validation, and reset as a CodPlay story', () => {
    const questionService = new ElceQuestionService()
    const withQuestion = applyDocumentCommand(learningDocumentService.createInitialDocument(), {
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
    const build = buildFluxSceneForTest(documentModel.pages[0]!, documentModel.bdcs)
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
      expect.objectContaining({ on: ELCE_EVENTS.QUESTION_RESET }),
    ]))
    const result = codplay.build({ scene: build.sceneDoc })
    expect(result.ok).toBe(true)
    codplay.destroy()
  })

  it.each([MEDIA_TYPE.IMAGE, MEDIA_TYPE.VIDEO])('projects the Question %s illustration with its existing viewport commands', (mediaType) => {
    const withMedia = applyDocumentCommand(learningDocumentService.createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-question-image', name: 'question', mimeType: mediaType === MEDIA_TYPE.IMAGE ? 'image/png' : 'video/mp4', size: 10, caption: '' },
    })
    const withQuestion = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-question-image',
      bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a', index: 0 },
    })
    const question = withQuestion.bdcs.find((bdc) => bdc.id === 'bdc-question-image')!.question!
    const withIllustration = applyDocumentCommand(withQuestion, {
      type: 'bdc.question.update',
      bdcId: 'bdc-question-image',
      question: { ...question, mediaId: 'media-question-image' },
    })
    const build = buildFluxSceneForTest(withIllustration.pages[0]!, withIllustration.bdcs, {
      mediaSources: { 'media-question-image': 'blob:question-image' },
      mediaTypes: { 'media-question-image': mediaType },
    })
    const image = build.sceneDoc.stories['page-a-page']?.persos.find((perso) => perso.type === (mediaType === MEDIA_TYPE.IMAGE ? 'img' : 'media'))

    expect(image).toMatchObject({
      type: mediaType === MEDIA_TYPE.IMAGE ? 'img' : 'media',
      initial: {
        src: 'blob:question-image',
        ...(mediaType === MEDIA_TYPE.IMAGE
          ? { img: { className: 'elce-flux-image__native' } }
          : { sync: 'independent', controls: true }),
      },
      emit: mediaType === MEDIA_TYPE.IMAGE ? { observe: {
        root: 'page-a-scrollport',
        initial: 'enter',
        enter: [{ name: `${image?.id}:enter`, once: true }],
      } } : { observe: {
        root: 'page-a-scrollport',
        enter: [{ name: `${image?.id}:fully-visible` }],
        leave: [{ name: `${image?.id}:half-hidden` }],
      } },
      actions: mediaType === MEDIA_TYPE.IMAGE ? {
        [`${image?.id}:enter`]: expect.objectContaining({ style: expect.any(Object) }),
      } : {
        [`${image?.id}:fully-visible`]: { broadcast: { type: 'START' } },
        [`${image?.id}:half-hidden`]: { broadcast: { type: 'PAUSE' } },
      },
    })
    if (mediaType === MEDIA_TYPE.IMAGE) expect(image?.emit).not.toHaveProperty('observe.leave')
  })

  it('projects identified Card BDCs through AutoCapsule, CodPlay stories, and reusable media persos', () => {
    const carouselService = new ElceCarouselService()
    const initial = learningDocumentService.createInitialDocument()
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
    const build = buildFluxSceneForTest(documentModel.pages[0]!, documentModel.bdcs, {
      mediaSources: { 'media-carousel-image': 'blob:carousel-image' },
      mediaTypes: { 'media-carousel-image': MEDIA_TYPE.IMAGE },
      appearanceClassNamesByTarget: {
        [`bdc:${firstCardBdcId}`]: 'card-text-image bdc appearance-card-first density-normal',
        'bdc:bdc-card-2': 'card-image-caption bdc appearance-card-second density-normal',
      },
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
    expect(carouselStory?.persos.find((perso) => perso.id.endsWith(`-card-${firstCardBdcId}`))?.initial).toMatchObject({
      className: expect.stringContaining('appearance-card-first'),
    })
    expect(carouselStory?.persos.find((perso) => perso.id.endsWith('-card-bdc-card-2'))?.initial).toMatchObject({
      className: expect.stringContaining('appearance-card-second'),
    })
    expect(carouselStory?.persos).toEqual(expect.arrayContaining([
      expect.objectContaining({ initial: expect.objectContaining({ content: 'Première carte', move: { target: `page-a:bdc-carousel-1:card:${firstCardBdcId}:title` } }) }),
      expect.objectContaining({ initial: expect.objectContaining({ content: 'Légende de l’image', move: { target: 'page-a:bdc-carousel-1:card:bdc-card-2:caption' } }) }),
      expect.objectContaining({ initial: expect.objectContaining({ move: { target: `page-a:bdc-carousel-1:carousel:capsule` }, className: expect.stringContaining('elce-carousel-view--image-right') }) }),
    ]))
    expect(carouselStory?.persos.find((perso) => perso.id === 'card-bdc-card-2-media-media-carousel-image')).toMatchObject({
      type: 'img',
      initial: { src: 'blob:carousel-image', move: { target: 'page-a:bdc-carousel-1:card:bdc-card-2:image' } },
    })
    expect(carouselStory?.persos.find((perso) => perso.id === `card-${firstCardBdcId}-media-media-carousel-image`)).toMatchObject({
      type: 'img',
      initial: { src: 'blob:carousel-image', move: { target: `page-a:bdc-carousel-1:card:${firstCardBdcId}:image` } },
    })
    expect(carouselStory?.persos.some((perso) => perso.id === 'page-a-bdc-carousel-1-viewport-expansion-host')).toBe(true)
    expect(build.styleSheets[0]).toContain('ac-grid-carousel')
    expect(codplay.build({ scene: build.sceneDoc }).ok).toBe(true)
    codplay.destroy()
  })

  it('keeps hidden Card media and content when a layout changes', () => {
    const initial = learningDocumentService.createInitialDocument()
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
    const hiddenBuild = buildFluxSceneForTest(textOnlyDocument.pages[0]!, textOnlyDocument.bdcs, {
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
    const restoredBuild = buildFluxSceneForTest(textImageDocument.pages[0]!, textImageDocument.bdcs, {
      mediaSources: { 'media-hidden-image': 'blob:hidden-image' },
      mediaTypes: { 'media-hidden-image': MEDIA_TYPE.IMAGE },
    })
    const restoredStory = restoredBuild.sceneDoc.stories['page-a-bdc-hidden-media']
    expect(restoredStory?.persos).toEqual(expect.arrayContaining([
      expect.objectContaining({ initial: expect.objectContaining({ content: 'Titre gardé' }) }),
    ]))
    expect(restoredStory?.persos).toEqual(expect.arrayContaining([
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
    const initial = learningDocumentService.createInitialDocument()
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
    const scene = buildFluxSceneForTest(documentModel.pages[0]!, documentModel.bdcs).sceneDoc
    const eventimes = scene.stories['page-a-bdc-repeat-10']?.eventimes ?? []
    const firstCardIntro = `page-a:bdc-repeat-10:card:${firstCardBdcId}:intro`

    expect(automaticCarousel.repeatCount).toBe(10)
    expect(eventimes.filter((eventime) => eventime.name === firstCardIntro).map((eventime) => eventime.startAt))
      .toEqual(Array.from({ length: 10 }, (_, index) => (index + 1) * 2000))
    expect(eventimes).toHaveLength(42)
  })

  it('projects one Result BDC with success and failure persos through CodPlay', () => {
    const initial = learningDocumentService.createInitialDocument()
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
    const emptyBuild = buildFluxSceneForTest(emptyPage, withResult.bdcs, {
      buildAdditionalBdc: createLearningAdditionalBdcBuilder(
        withResult,
        createLearningSceneBuilders().presetBuilder,
      ),
    })
    const emptySuccessStory = emptyBuild.sceneDoc.stories[`${pageCommand.pageId}-bdc-result-1-success`]
    const emptyFailureStory = emptyBuild.sceneDoc.stories[`${pageCommand.pageId}-bdc-result-1-failure`]
    expect(emptySuccessStory?.persos.some((perso) => perso.id.endsWith('-message'))).toBe(false)
    expect(emptyFailureStory?.persos.some((perso) => perso.id.endsWith('-message'))).toBe(false)
    const configured = applyDocumentCommand(withResult, {
      type: 'bdc.evaluation-result.update',
      bdcId: 'bdc-result-1',
      evaluationResult: {
        success: { message: 'Bravo !', action: EVALUATION_RESULT_ACTION.REPLAY },
        failure: { message: 'À reprendre.', action: EVALUATION_RESULT_ACTION.RETRY },
      },
    })
    const page = configured.pages.find((candidate) => candidate.id === pageCommand.pageId)!
    const build = buildFluxSceneForTest(page, configured.bdcs, {
      buildAdditionalBdc: createLearningAdditionalBdcBuilder(
        configured,
        createLearningSceneBuilders().presetBuilder,
      ),
    })
    const successStory = build.sceneDoc.stories[`${page.id}-bdc-result-1-success`]
    const failureStory = build.sceneDoc.stories[`${page.id}-bdc-result-1-failure`]
    const pageStory = build.sceneDoc.stories[`${page.id}-page`]
    const successPersos = successStory?.persos ?? []
    const failurePersos = failureStory?.persos ?? []
    const successLayout = successPersos[0]
    const failureLayout = failurePersos[0]
    const articleInitial = pageStory?.persos.find((perso) => perso.id === `${page.id}-article`)?.initial
    const articleMarkup = articleInitial !== undefined && 'markup' in articleInitial ? String(articleInitial.markup) : ''
    const mountPartId = `${page.id}:bdc-result-1:evaluation-result`
    const mountMarker = `<!-- data-part="${mountPartId}" -->`
    const successAction = successPersos.find((perso) => perso.id === 'bdc-result-1-success-action')
    const failureAction = failurePersos.find((perso) => perso.id === 'bdc-result-1-failure-action')
    const codplay = new CodPlay({
      pauseOnDocumentHidden: false,
      engine: {
        idle: false,
        components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
        modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
      },
    })

    expect(successPersos.map((perso) => perso.id)).toEqual([
      'bdc-result-1-success-result-card',
      'bdc-result-1-success-message',
      'bdc-result-1-success-action',
    ])
    expect(failurePersos.map((perso) => perso.id)).toEqual([
      'bdc-result-1-failure-result-card',
      'bdc-result-1-failure-message',
      'bdc-result-1-failure-action',
    ])
    expect(successLayout?.initial).toMatchObject({
      move: '@off',
      markup: expect.stringContaining('elce-evaluation-result__branch--success'),
    })
    expect(successLayout?.actions).toEqual({
      [ELCE_EVENTS.EVALUATION_RESULT_SUCCESS]: { move: { target: mountPartId } },
    })
    expect(failureLayout?.initial).toMatchObject({
      move: '@off',
      markup: expect.stringContaining('elce-evaluation-result__branch--failure'),
    })
    expect(failureLayout?.actions).toEqual({
      [ELCE_EVENTS.EVALUATION_RESULT_FAILURE]: { move: { target: mountPartId } },
    })
    expect(articleMarkup.split(mountMarker)).toHaveLength(2)
    expect(articleMarkup).not.toContain('elce-card--evaluation-result')
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
