import { describe, expect, it } from 'vitest'
import { CAROUSEL_TRANSITION } from '../../config/document-config'
import { ELCE_EDITOR_SETTINGS } from '../../config/editor-settings'
import { applyDocumentCommand, createCarouselBdcCommand, createStandaloneCardBdcCommand } from '../commands/document-commands'
import { createInitialDocument } from '../document/document-model'
import { ElceEditorSettingsResolver } from './editor-settings-resolver'

describe('ElceEditorSettingsResolver', () => {
  const resolver = new ElceEditorSettingsResolver()

  it('returns grouped hidden player settings to scene construction', () => {
    const document = createInitialDocument()
    expect(resolver.resolvePlayer()).toBe(ELCE_EDITOR_SETTINGS.player)
    expect(resolver.resolvePage(
      document.pages[0]!,
      document.bdcs,
      ELCE_EDITOR_SETTINGS.revelation.projectDefaults,
    ).player).toBe(ELCE_EDITOR_SETTINGS.player)
  })

  it('resolves project, parent, Carousel and placement values field by field', () => {
    const initial = createInitialDocument()
    const page = initial.pages[0]!
    const section = initial.bdcs.find((bdc) => bdc.type === 'section')!
    const withCarousel = applyDocumentCommand(initial, createCarouselBdcCommand('carousel-test', page.id, 1, 'card-test'))
    const carousel = withCarousel.bdcs.find((bdc) => bdc.id === 'carousel-test')!
    const card = withCarousel.bdcs.find((bdc) => bdc.id === 'card-test')!
    if (carousel.type !== 'carousel' || carousel.carousel == null || section.section == null) {
      throw new Error('Le fixture doit contenir une Section et un Carousel valides.')
    }

    const projectDefaults = { intro: CAROUSEL_TRANSITION.FADE, outro: CAROUSEL_TRANSITION.SWIPE_DOWN }
    const sectionWithDefaults = {
      ...section,
      section: { ...section.section, revelation: { intro: CAROUSEL_TRANSITION.SWIPE_LEFT, outro: null } },
    }
    const carouselWithOverrides = {
      ...carousel,
      pageId: null,
      parentBdcId: section.id,
      carousel: {
        ...carousel.carousel,
        revelation: { intro: null, outro: CAROUSEL_TRANSITION.ZOOM },
        cards: carousel.carousel.cards.map((entry) => ({
          ...entry,
          introTransitionRef: CAROUSEL_TRANSITION.SWIPE_RIGHT,
          outroTransitionRef: null,
        })),
      },
    }
    const pageWithSectionRoot = { ...page, bdcIds: [section.id] }
    const settings = resolver.resolvePage(
      pageWithSectionRoot,
      [sectionWithDefaults, carouselWithOverrides, card],
      projectDefaults,
    )

    expect(settings.revelation.byBdcId[section.id]).toEqual({
      intro: CAROUSEL_TRANSITION.SWIPE_LEFT,
      outro: CAROUSEL_TRANSITION.SWIPE_DOWN,
    })
    expect(settings.revelation.byBdcId[carousel.id]).toEqual({
      intro: CAROUSEL_TRANSITION.SWIPE_LEFT,
      outro: CAROUSEL_TRANSITION.ZOOM,
    })
    expect(settings.revelation.byBdcId[card.id]).toEqual({
      intro: CAROUSEL_TRANSITION.SWIPE_LEFT,
      outro: CAROUSEL_TRANSITION.ZOOM,
    })
    expect(settings.revelation.carouselsByBdcId[carousel.id]).toMatchObject({
      defaults: { intro: CAROUSEL_TRANSITION.SWIPE_LEFT, outro: CAROUSEL_TRANSITION.ZOOM },
      entries: {
        [card.id]: { intro: CAROUSEL_TRANSITION.SWIPE_RIGHT, outro: CAROUSEL_TRANSITION.ZOOM },
      },
    })
  })

  it('keeps null local values inherited from the project', () => {
    expect(resolver.resolveOverrides(
      { intro: CAROUSEL_TRANSITION.SWIPE_LEFT, outro: CAROUSEL_TRANSITION.FADE },
      { intro: null, outro: CAROUSEL_TRANSITION.ZOOM },
    )).toEqual({ intro: CAROUSEL_TRANSITION.SWIPE_LEFT, outro: CAROUSEL_TRANSITION.ZOOM })
  })

  it('keeps a horizontal Card transition from being covered by image movement', () => {
    const initial = createInitialDocument()
    const page = initial.pages[0]!
    const withCard = applyDocumentCommand(initial, createStandaloneCardBdcCommand('card-motion', page.id))
    const cardPage = withCard.pages[0]!
    const settings = resolver.resolvePage(cardPage, withCard.bdcs, {
      intro: CAROUSEL_TRANSITION.SWIPE_RIGHT,
      outro: CAROUSEL_TRANSITION.FADE,
    })

    expect(settings.revelation.cardMediaMotionByBdcId['card-motion']).toEqual({
      intro: null,
      outro: { fromTranslateX: '0%', toTranslateX: '-112%', duration: 820, ease: 'inCubic' },
      imageOpacity: 0.92,
      suppressCardOpacityTransitionForImages: true,
    })
  })
})
