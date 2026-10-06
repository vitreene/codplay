import { describe, expect, it } from 'vitest'
import { BDC_TYPE, CAROUSEL_PLAYBACK_MODE, DEFAULT_PRESET_ID, ELCE_EVENTS, PAGE_LOCATION, PAGE_TYPE } from '../../config/document-config'
import { applyDocumentCommand, createCardBdcCommand, createDefaultPageCommand, createQuestionBdcCommand, createStandaloneCardBdcCommand } from '../../app/commands/document-commands'
import { createInitialDocument } from '../../domain/document-model'
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
    const carouselStory = build.sceneDoc.stories[`${page.id}-${carousel.id}`]
    const host = pageStory?.persos[1]?.initial
    const hostMarkup = host !== undefined && 'markup' in host ? String(host.markup) : ''
    const completionMarker = carouselStory?.persos.find((perso) => perso.id.endsWith('-completion-marker'))

    expect(page.type).toBe(PAGE_TYPE.DIAPO)
    expect(carousel.type).toBe(BDC_TYPE.CAROUSEL)
    expect(pageStory?.persos[0]).toMatchObject({
      type: 'scroll-container',
      initial: {
        className: 'elce-diapo-host',
        style: { width: '100%', height: '100%', overflowY: 'hidden' },
      },
    })
    expect(host).toMatchObject({
      className: 'elce-diapo-content',
      style: { width: '100%', height: '100%', overflow: 'hidden' },
    })
    expect(hostMarkup).toContain(`id="${page.id}-diapo-content"`)
    expect(hostMarkup).toContain('elce-carousel-capsule--scene')
    expect(hostMarkup).not.toContain('aspect-ratio:')
    expect(hostMarkup).not.toContain('elce-flux-scrollport')
    expect(carouselStory?.persos[0]).toMatchObject({
      id: `${page.id}-${carousel.id}-diapo-end-scrollport`,
      type: 'scroll-container',
    })
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
    const carouselStory = build.sceneDoc.stories[`${page.id}-${command.bdcId}`]
    const finalCardId = automaticContent.cards.at(-1)?.bdcId
    const finalCardIntro = carouselStory?.eventimes?.filter((eventime) => eventime.name === `${page.id}:${command.bdcId}:card:${finalCardId}:intro`) ?? []
    const completionMarker = carouselStory?.persos.find((perso) => perso.id.endsWith('-completion-marker'))

    expect(finalCardIntro).toHaveLength(2)
    expect(completionMarker?.emit?.observe).toMatchObject({
      root: `${page.id}-${command.bdcId}-diapo-end-scrollport`,
      enter: [{ name: ELCE_EVENTS.PAGE_FINISHED, data: { pageId: page.id }, visibility: 'public' }],
    })
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
    expect(markup).toContain(`data-part="${page.id}:bottom"`)
    expect(story?.persos.some((perso) => perso.id === `${page.id}:${card.id}-card-${card.id}-title`)).toBe(true)
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
    expect(story?.listen).toContainEqual({
      on: `${page.id}:bdc-diapo-question:reset`,
      straps: [`${page.id}:bdc-diapo-question:reset-question`],
    })
    expect(build.questionReset).toEqual({ eventName: `${page.id}:bdc-diapo-question:reset` })
  })
})
