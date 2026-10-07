import { describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
} from '@codplay/component-v2'
import { BDC_TYPE, CAROUSEL_PLAYBACK_MODE, CHAPTER_TYPE, DEFAULT_PRESET_ID, ELCE_EVENTS, EVALUATION_RESULT_ACTION, PAGE_LOCATION, PAGE_TYPE } from '../../config/document-config'
import { applyDocumentCommand, createCardBdcCommand, createChapterCommand, createDefaultPageCommand, createEvaluationResultBdcCommand, createQuestionBdcCommand, createStandaloneCardBdcCommand } from '../../app/commands/document-commands'
import { createInitialDocument } from '../../domain/document/document-model'
import { buildDiapoScene } from './diapo-scene-builder'

describe('Elcé Diapo scene builder', () => {
  it('builds a no-scroll stage and signals the visible single Carousel card', () => {
    const initial = createInitialDocument()
    const command = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO }, undefined, PAGE_TYPE.DIAPO)
    const document = applyDocumentCommand(initial, command)
    const page = document.pages.find((candidate) => candidate.id === command.pageId)!
    const build = buildDiapoScene(page, document.bdcs)
    const pageStory = build.sceneDoc.stories[`${page.id}-diapo-page`]
    const carousel = document.bdcs.find((bdc) => bdc.id === command.bdcId)!
    const carouselStory = pageStory
    const firstCardId = carousel.carousel?.cards[0]?.bdcId
    const firstCardPerso = carouselStory?.persos.find((perso) => perso.id === `${page.id}:${carousel.id}-card-${firstCardId}`)
    const firstCardMarkup = firstCardPerso?.initial !== undefined && 'markup' in firstCardPerso.initial
      ? String(firstCardPerso.initial.markup)
      : ''
    const carouselRoot = carouselStory?.persos.find((perso) => perso.id === `${page.id}-${carousel.id}-diapo-end-scrollport`)
    const navigationHost = carouselStory?.persos.find((perso) => perso.id === `${page.id}-${carousel.id}-navigation-host`)
    const completionMarker = carouselStory?.persos.find((perso) => perso.id.endsWith('-completion-marker'))

    expect(page.type).toBe(PAGE_TYPE.DIAPO)
    expect(carousel.type).toBe(BDC_TYPE.CAROUSEL)
    expect(carouselRoot).toMatchObject({
      type: 'scroll-container',
      initial: {
        tag: 'section',
        className: expect.stringContaining('elce-diapo-carousel-root'),
        move: '@root',
        style: { width: '100%', height: '100%', gridTemplateRows: 'minmax(0, 1fr) auto' },
      },
    })
    expect(carouselRoot?.initial).toMatchObject({
      className: expect.stringContaining('elce-carousel-capsule--scene'),
      attr: { 'data-intro-transition': expect.any(String), 'data-outro-transition': expect.any(String) },
    })
    expect(navigationHost?.initial).toMatchObject({
      className: 'elce-carousel__navigation',
      style: { gridRow: '2', gridColumn: '1' },
      markup: expect.stringContaining(`<nav id="${page.id}-${carousel.id}-navigation"`),
    })
    expect(firstCardMarkup).toContain(`<!-- data-part="${page.id}:${carousel.id}:card:${firstCardId}:root" -->`)
    expect(carouselRoot?.initial).not.toHaveProperty('style.aspectRatio')
    expect(carouselStory?.persos.some((perso) => perso.id === `${page.id}-diapo-content`)).toBe(false)
    expect(carouselStory?.persos.some((perso) => perso.id === `${page.id}-diapo-scrollport`)).toBe(false)
    expect(build.sceneDoc.stories).toHaveProperty(`${page.id}-diapo-page`)
    expect(Object.keys(build.sceneDoc.stories)).toHaveLength(1)
    expect(completionMarker?.emit?.observe).toMatchObject({
      root: `${page.id}-${carousel.id}-diapo-end-scrollport`,
      initial: 'enter',
      enter: [{ name: ELCE_EVENTS.PAGE_FINISHED, data: { pageId: page.id }, visibility: 'public' }],
    })
    expect(carouselStory?.eventimes?.some((eventime) => eventime.name === ELCE_EVENTS.PAGE_FINISHED)).toBe(false)
  })

  it('signals the last automatic view on its final pass', () => {
    const initial = createInitialDocument()
    const command = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO }, undefined, PAGE_TYPE.DIAPO)
    let document = applyDocumentCommand(initial, command)
    document = applyDocumentCommand(document, createCardBdcCommand(
      'bdc-diapo-card-2',
      command.bdcId,
      1,
      DEFAULT_PRESET_ID.TEXT_SHORT,
    ))
    const carousel = document.bdcs.find((bdc) => bdc.id === command.bdcId)!
    const automaticContent = { ...carousel.carousel!, playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC, repeatCount: 1 }
    document = applyDocumentCommand(document, {
      type: 'bdc.carousel.update',
      bdcId: command.bdcId,
      carousel: automaticContent,
    })
    const page = document.pages.find((candidate) => candidate.id === command.pageId)!
    const build = buildDiapoScene(page, document.bdcs)
    const carouselStory = build.sceneDoc.stories[`${page.id}-diapo-page`]
    const finalCardId = automaticContent.cards.at(-1)?.bdcId
    const finalCardIntro = carouselStory?.eventimes?.filter((eventime) => eventime.name === `${page.id}:${command.bdcId}:card:${finalCardId}:intro`) ?? []
    const completionMarker = carouselStory?.persos.find((perso) => perso.id.endsWith('-completion-marker'))

    expect(finalCardIntro).toHaveLength(2)
    expect(completionMarker?.emit?.observe).toMatchObject({
      root: `${page.id}-${command.bdcId}-diapo-end-scrollport`,
      enter: [{ name: ELCE_EVENTS.PAGE_FINISHED, data: { pageId: page.id }, visibility: 'public' }],
    })
  })

  it('uses the Photo wrapper as the visible view root in a Diapo Carousel', () => {
    const initial = createInitialDocument()
    const command = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO }, undefined, PAGE_TYPE.DIAPO)
    let document = applyDocumentCommand(initial, command)
    const carousel = document.bdcs.find((bdc) => bdc.id === command.bdcId)!
    const cardBdcId = carousel.carousel!.cards[0]!.bdcId
    document = applyDocumentCommand(document, {
      type: 'bdc.card.layout.set',
      bdcId: cardBdcId,
      layoutId: DEFAULT_PRESET_ID.PHOTO,
    })
    const page = document.pages.find((candidate) => candidate.id === command.pageId)!
    const build = buildDiapoScene(page, document.bdcs)
    const pageStory = build.sceneDoc.stories[`${page.id}-diapo-page`]
    const cardView = pageStory?.persos.find((perso) => perso.id === `${page.id}:${carousel.id}-card-${cardBdcId}`)
    const markup = cardView?.initial !== undefined && 'markup' in cardView.initial ? String(cardView.initial.markup) : ''

    expect(cardView?.initial).toMatchObject({
      className: expect.stringContaining('elce-carousel-photo__media'),
      move: { target: `${page.id}-${carousel.id}-diapo-end-scrollport` },
    })
    expect(markup).toContain(`<div id="${page.id}-${carousel.id}-card-${cardBdcId}" class="elce-carousel-photo__media">`)
    expect(markup).toContain(`<!-- data-part="${page.id}:${carousel.id}:card:${cardBdcId}:root" -->`)
    expect(markup).toContain(`<!-- data-part="${page.id}:${carousel.id}:card:${cardBdcId}:media" -->`)
    expect(markup).not.toContain('<article')
  })

  it('projects a standalone Card through the shared Card builder and finishes when it appears', () => {
    const initial = createInitialDocument()
    const pageCommand = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO }, undefined, PAGE_TYPE.DIAPO)
    let document = applyDocumentCommand(initial, pageCommand)
    document = applyDocumentCommand(document, { type: 'bdc.carousel.delete', bdcId: pageCommand.bdcId })
    document = applyDocumentCommand(document, createStandaloneCardBdcCommand(
      'bdc-diapo-card',
      pageCommand.pageId,
      DEFAULT_PRESET_ID.TEXT_IMAGE,
    ))
    const page = document.pages.find((candidate) => candidate.id === pageCommand.pageId)!
    const card = document.bdcs.find((bdc) => bdc.id === 'bdc-diapo-card')!
    const build = buildDiapoScene(page, document.bdcs)
    const story = build.sceneDoc.stories[`${page.id}-diapo-page`]
    const host = story?.persos[1]?.initial
    const markup = host !== undefined && 'markup' in host ? String(host.markup) : ''
    const completionMarker = story?.persos.find((perso) => perso.id.endsWith('-bottom-marker'))

    expect(markup).toContain('elce-card--text-image')
    expect(markup).toContain(`${page.id}:${card.id}:card:${card.id}:image`)
    expect(markup).toContain(`<!-- data-part="${page.id}:bottom" -->`)
    expect(story?.persos.some((perso) => perso.id === `${page.id}:${card.id}-card-${card.id}-title`)).toBe(false)
    expect(completionMarker?.emit?.observe).toMatchObject({
      root: `${page.id}-diapo-scrollport`,
      initial: 'enter',
      enter: [{ name: ELCE_EVENTS.PAGE_FINISHED, data: { pageId: page.id }, visibility: 'public' }],
    })
    expect(story?.eventimes).toBeUndefined()
    expect(markup).not.toContain('elce-flux-scrollport')
  })

  it('reuses the Question story and exposes its reset path in a Diapo', () => {
    const initial = createInitialDocument()
    const pageCommand = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO }, undefined, PAGE_TYPE.DIAPO)
    let document = applyDocumentCommand(initial, pageCommand)
    document = applyDocumentCommand(document, { type: 'bdc.carousel.delete', bdcId: pageCommand.bdcId })
    document = applyDocumentCommand(document, createQuestionBdcCommand('bdc-diapo-question', pageCommand.pageId, 0))
    const page = document.pages.find((candidate) => candidate.id === pageCommand.pageId)!
    const build = buildDiapoScene(page, document.bdcs)
    const story = build.sceneDoc.stories[`${page.id}-bdc-diapo-question`]
    const pageStory = build.sceneDoc.stories[`${page.id}-diapo-page`]
    const pageHost = pageStory?.persos[1]?.initial

    expect(pageHost).toMatchObject({
      markup: expect.stringContaining('elce-card--question'),
    })
    expect(story?.persos.filter((perso) => perso.type === 'input')).toHaveLength(2)
    expect(story?.persos.find((perso) => perso.id.endsWith(':prompt'))?.initial).toMatchObject({ tag: 'legend' })
    expect(story?.listen).toContainEqual({
      on: `${page.id}:bdc-diapo-question:reset`,
      straps: [`${page.id}:bdc-diapo-question:reset-question`],
    })
    expect(build.questionReset).toEqual({ eventName: `${page.id}:bdc-diapo-question:reset` })
  })

  it('projects one Result BDC as the only direct Diapo content in an Evaluation chapter', () => {
    const initial = createInitialDocument()
    const withChapter = applyDocumentCommand(initial, createChapterCommand(
      initial,
      'Évaluation Diapo',
      CHAPTER_TYPE.EVALUATION,
    ))
    const chapter = withChapter.chapters.at(-1)!
    const pageCommand = createDefaultPageCommand(
      withChapter,
      { kind: PAGE_LOCATION.CHAPTER, chapterId: chapter.id },
      'Diapo Résultat',
      PAGE_TYPE.DIAPO,
    )
    let document = applyDocumentCommand(withChapter, pageCommand)
    document = applyDocumentCommand(document, { type: 'bdc.carousel.delete', bdcId: pageCommand.bdcId })
    document = applyDocumentCommand(document, createEvaluationResultBdcCommand(
      'bdc-diapo-result', pageCommand.pageId, 0,
    ))
    document = applyDocumentCommand(document, {
      type: 'bdc.evaluation-result.update',
      bdcId: 'bdc-diapo-result',
      evaluationResult: {
        success: { message: 'Réussite', action: EVALUATION_RESULT_ACTION.REPLAY },
        failure: { message: 'Échec', action: EVALUATION_RESULT_ACTION.RETRY },
      },
    })
    const page = document.pages.find((candidate) => candidate.id === pageCommand.pageId)!
    const build = buildDiapoScene(page, document.bdcs, { chapterType: CHAPTER_TYPE.EVALUATION })
    const pageStory = build.sceneDoc.stories[`${page.id}-diapo-page`]
    const resultStory = build.sceneDoc.stories[`${page.id}-bdc-diapo-result`]
    const pageHost = pageStory?.persos.find((perso) => perso.id === `${page.id}-diapo-content`)
    const hostMarkup = pageHost?.initial !== undefined && 'markup' in pageHost.initial
      ? String(pageHost.initial.markup)
      : ''
    const resultCard = resultStory?.persos.find((perso) => perso.id === 'bdc-diapo-result-result-card')
    const completionMarker = pageStory?.persos.find((perso) => perso.id.endsWith('-bottom-marker'))
    const codplay = new CodPlay({
      pauseOnDocumentHidden: false,
      engine: {
        idle: false,
        components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
        modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
      },
    })

    expect(page.bdcIds).toEqual(['bdc-diapo-result'])
    expect(hostMarkup).toContain('elce-card--evaluation-result')
    expect(resultCard?.actions).toEqual({
      [ELCE_EVENTS.EVALUATION_RESULT_SUCCESS]: { className: 'elce-card--evaluation-result elce-evaluation-result--success' },
      [ELCE_EVENTS.EVALUATION_RESULT_FAILURE]: { className: 'elce-card--evaluation-result elce-evaluation-result--failure' },
    })
    expect(completionMarker?.emit?.observe).toMatchObject({
      root: `${page.id}-diapo-scrollport`,
      initial: 'enter',
      enter: [{ name: ELCE_EVENTS.PAGE_FINISHED, data: { pageId: page.id }, visibility: 'public' }],
    })
    expect(codplay.build({ scene: build.sceneDoc }).ok).toBe(true)
    codplay.destroy()
    expect(() => buildDiapoScene(page, document.bdcs)).toThrow('ne peut être projeté que dans une Diapo d’Évaluation')
  })
})
