/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { BDC_LOCATION, BDC_TYPE, CAROUSEL_PLAYBACK_MODE, CHAPTER_TYPE, DEFAULT_PRESET_ID, ELCE_EVENTS, MEDIA_TYPE, PAGE_LOCATION, PAGE_TYPE, QUESTION_TYPE } from '../config/document-config'
import { applyDocumentCommand, createCardBdcCommand, createCarouselBdcCommand, createChapterCommand, createDefaultPageCommand, createPageCommand, createQuestionBdcCommand, createStandaloneCardBdcCommand } from '../app/commands/document-commands'
import { createInitialDocument } from '../domain/document-model'
import { ElceQuestionService } from '../domain/question-service'
import { ElcePlayerComposition, createPageSceneCatalog } from './elce-player-composition'
import type { ElcePageSceneCache } from './player-composition-types'

type IntersectionEntry = Pick<IntersectionObserverEntry, 'target' | 'intersectionRatio' | 'isIntersecting'>

/** Delivers deterministic native-shaped intersection callbacks to the real adapter. */
class ControlledIntersectionObserver {
  static readonly instances: ControlledIntersectionObserver[] = []
  readonly targets = new Set<Element>()
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    ControlledIntersectionObserver.instances.push(this)
  }

  observe(target: Element): void {
    this.targets.add(target)
  }

  disconnect(): void {
    this.targets.clear()
  }

  deliver(entry: IntersectionEntry): void {
    this.callback([entry as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

/** Runs pending CodPlay frames once so a queued public event reaches Sighty. */
function flushPendingFrames(pendingFrames: FrameRequestCallback[], timestamp = 0): void {
  const callbacks = pendingFrames.splice(0)
  for (const callback of callbacks) callback(timestamp)
}

describe('Elcé player composition', () => {
  let composition: ElcePlayerComposition | undefined

  afterEach(() => {
    ControlledIntersectionObserver.instances.length = 0
    composition?.destroy()
    composition = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reuses unchanged page scenes across organization changes and rebuilds only an edited page scene', () => {
    const initial = createInitialDocument()
    const pageCommand = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO })
    const withPages = applyDocumentCommand(initial, pageCommand)
    const cache: ElcePageSceneCache = new Map()
    const first = createPageSceneCatalog(withPages, {}, cache)
    const moved = applyDocumentCommand(withPages, {
      type: 'page.move',
      pageId: pageCommand.pageId,
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: withPages.chapters[0]!.id },
    })
    const reordered = createPageSceneCatalog(moved, {}, cache)

    expect(reordered.scenes['scene-page-a']).toBe(first.scenes['scene-page-a'])
    expect(reordered.scenes[`scene-${pageCommand.pageId}`]).toBe(first.scenes[`scene-${pageCommand.pageId}`])

    const sectionBdc = moved.bdcs.find((bdc) => bdc.id === moved.pages[0]?.bdcIds[0])!
    const edited = applyDocumentCommand(moved, {
      type: 'bdc.section.update',
      bdcId: sectionBdc.id,
      title: 'Titre corrigé',
      markup: '<p>Contenu corrigé</p>',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contenu corrigé' }] }] },
    })
    const synchronized = createPageSceneCatalog(edited, {}, cache)

    expect(synchronized.scenes['scene-page-a']).not.toBe(reordered.scenes['scene-page-a'])
    expect(synchronized.scenes[`scene-${pageCommand.pageId}`]).toBe(reordered.scenes[`scene-${pageCommand.pageId}`])
  })

  it('mounts the layout, slot and Flux page through Sighty and CodPlay', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: createInitialDocument() })

    await composition.initialize()

    expect(stage.querySelector('.elce-player-layout')).not.toBeNull()
    expect(stage.querySelector('.elce-player-content-slot')).not.toBeNull()
    expect(stage.querySelector('.elce-player-layout__menu')).not.toBeNull()
    expect(stage.querySelector('.elce-player-layout__title')).not.toBeNull()
    expect(stage.querySelector('.elce-player-layout__navigation')).not.toBeNull()
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page A')
    expect(stage.querySelector('.elce-player-navigation__button--next')).not.toBeNull()
    expect(stage.querySelector('.elce-player-menu__page-button')?.getAttribute('data-active')).toBe('true')
    expect(stage.querySelector('.elce-flux-scrollport')).not.toBeNull()
    expect(stage.querySelector('.elce-flux-article')).not.toBeNull()
  })

  it('plays the default Question BDC of a page created in an Evaluation chapter', async () => {
    const initialDocument = createInitialDocument()
    const withEvaluation = applyDocumentCommand(initialDocument, createChapterCommand(
      initialDocument,
      undefined,
      CHAPTER_TYPE.EVALUATION,
    ))
    const evaluationChapter = withEvaluation.chapters.at(-1)!
    const pageCommand = createDefaultPageCommand(withEvaluation, {
      kind: PAGE_LOCATION.CHAPTER,
      chapterId: evaluationChapter.id,
    })
    const documentModel = applyDocumentCommand(withEvaluation, pageCommand)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel, startPageId: pageCommand.pageId })

    await composition.initialize()

    expect(stage.querySelector('.elce-card--question')).not.toBeNull()
    expect(stage.querySelector('.elce-card--section')).toBeNull()
    expect(stage.querySelectorAll('input[type="radio"]')).toHaveLength(2)
  })

  it('plays a Carousel BDC and switches its view through the CodPlay dot event', async () => {
    const initialDocument = createInitialDocument()
    let withCarousel = applyDocumentCommand(initialDocument, createCarouselBdcCommand('bdc-carousel-1', 'page-a', 1))
    withCarousel = applyDocumentCommand(withCarousel, createCardBdcCommand('bdc-carousel-card-2', 'bdc-carousel-1', 1, DEFAULT_PRESET_ID.TEXT_SHORT))
    const carousel = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-1')!.carousel!
    const documentModel = applyDocumentCommand(withCarousel, {
      type: 'bdc.carousel.update',
      bdcId: 'bdc-carousel-1',
      carousel,
    })
    expect(carousel.playbackMode).toBe(CAROUSEL_PLAYBACK_MODE.MANUAL)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()

    const viewElements = stage.querySelectorAll<HTMLElement>('.elce-carousel-view')
    const navigationDots = stage.querySelectorAll<HTMLButtonElement>('.elce-carousel-dot')
    expect(stage.querySelector('.elce-card--carousel')).not.toBeNull()
    expect(viewElements).toHaveLength(2)
    expect(viewElements[0]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(viewElements[1]?.classList.contains('elce-carousel-view--hidden')).toBe(true)

    navigationDots[1]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 40))

    expect(viewElements[0]?.classList.contains('elce-carousel-view--hidden')).toBe(true)
    expect(viewElements[1]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(navigationDots[1]?.getAttribute('aria-current')).toBe('true')
    expect(navigationDots[1]?.getAttribute('aria-label')).toBe('Aller à la vue 2')
  })

  it('emits a standalone Diapo Card completion immediately and unlocks Next', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const initialDocument = createInitialDocument()
    const diapoCommand = createDefaultPageCommand(
      initialDocument,
      { kind: PAGE_LOCATION.SCENARIO },
      'Diapo Carte',
      PAGE_TYPE.DIAPO,
    )
    let documentModel = applyDocumentCommand(initialDocument, diapoCommand)
    documentModel = applyDocumentCommand(documentModel, { type: 'bdc.carousel.delete', bdcId: diapoCommand.bdcId })
    documentModel = applyDocumentCommand(documentModel, createStandaloneCardBdcCommand(
      'bdc-diapo-standalone-card',
      diapoCommand.pageId,
      DEFAULT_PRESET_ID.TEXT_SHORT,
    ))
    documentModel = applyDocumentCommand(documentModel, createPageCommand({
      pageId: 'page-after-diapo-card',
      bdcId: 'bdc-after-diapo-card',
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel, startPageId: diapoCommand.pageId })
    const publicEvents: { name: string; sourceSceneKey?: string; data?: unknown }[] = []
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
    const runtime = (composition as unknown as {
      readonly sighty: { readonly runtime: {
        readonly events: { onEvent(listener: (event: { name: string; sourceSceneKey?: string; data?: unknown }) => void): () => void }
        getInstance(sceneKey: string): {
          readonly events: { onEvent(listener: (event: { name: string }) => void): () => void }
          readonly diagnostic: { onTrace(listener: (event: { name: string }) => void): () => void }
          readonly telco: { getState(): { status: string; sequenceEnded: boolean; timelineMs: number } }
        } | undefined
        initialize(): Promise<void>
      } }
    }).sighty.runtime
    const instanceEvents: string[] = []
    const traceEvents: string[] = []
    runtime.events.onEvent((event) => publicEvents.push(event))
    await runtime.initialize()
    const pageInstance = runtime.getInstance(`scene-${diapoCommand.pageId}`)!
    pageInstance.events.onEvent((event) => instanceEvents.push(event.name))
    pageInstance.diagnostic.onTrace((event) => traceEvents.push(event.name))

    await composition.initialize()
    const marker = stage.querySelector(`#${diapoCommand.pageId}-diapo-bottom-marker`)
    const observer = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(marker as Element))
    expect(marker).not.toBeNull()
    expect(observer).toBeDefined()
    observer?.deliver({ target: marker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)

    const pageState = runtime.getInstance(`scene-${diapoCommand.pageId}`)?.telco.getState()
    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')
    expect(pageState?.status).toBe('playing')
    expect(pageState?.sequenceEnded).toBe(false)
    expect(traceEvents).toContain(ELCE_EVENTS.PAGE_FINISHED)
    expect(instanceEvents).toContain(ELCE_EVENTS.PAGE_FINISHED)
    expect(stage.querySelector('.elce-card--text-short')).not.toBeNull()
    expect((stage.querySelector('.elce-diapo-host') as HTMLElement | null)?.style.overflowY).toBe('hidden')
    expect(stage.querySelector('.elce-flux-scrollport')).toBeNull()
    expect(publicEvents).toContainEqual(expect.objectContaining({
      name: ELCE_EVENTS.PAGE_FINISHED,
      sourceSceneKey: `scene-${diapoCommand.pageId}`,
      data: { pageId: diapoCommand.pageId },
    }))
    expect(nextButton?.disabled).toBe(false)
    expect(stage.querySelector('.elce-card--text-short')).not.toBeNull()
  })

  it('emits the shared Page-bottom event when the final manual Diapo Carousel view appears', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
    const initialDocument = createInitialDocument()
    const diapoCommand = createDefaultPageCommand(
      initialDocument,
      { kind: PAGE_LOCATION.SCENARIO },
      'Diapo Carousel',
      PAGE_TYPE.DIAPO,
    )
    let documentModel = applyDocumentCommand(initialDocument, diapoCommand)
    documentModel = applyDocumentCommand(documentModel, createCardBdcCommand(
      'bdc-diapo-carousel-card-2',
      diapoCommand.bdcId,
      1,
      DEFAULT_PRESET_ID.TEXT_SHORT,
    ))
    documentModel = applyDocumentCommand(documentModel, createPageCommand({
      pageId: 'page-after-diapo-carousel',
      bdcId: 'bdc-after-diapo-carousel',
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel, startPageId: diapoCommand.pageId })
    const publicEvents: { name: string; sourceSceneKey?: string; data?: unknown }[] = []
    const runtime = (composition as unknown as {
      readonly sighty: { readonly runtime: {
        readonly events: { onEvent(listener: (event: { name: string; sourceSceneKey?: string; data?: unknown }) => void): void }
      } }
    }).sighty.runtime
    runtime.events.onEvent((event) => publicEvents.push(event))

    await composition.initialize()
    await flushCompositionFrames(pendingFrames)

    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')
    const finalView = stage.querySelectorAll<HTMLElement>('.elce-carousel-view')[1]
    const finalDot = stage.querySelectorAll<HTMLButtonElement>('.elce-carousel-dot')[1]
    const marker = finalView?.querySelector('.elce-carousel-completion-marker')
    const observer = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(marker as Element))
    expect(nextButton?.disabled).toBe(true)
    expect(finalView?.classList.contains('elce-carousel-view--hidden')).toBe(true)
    expect(marker).not.toBeNull()
    expect(observer).toBeDefined()

    finalDot?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 40))
    expect(finalView?.classList.contains('elce-carousel-view--visible')).toBe(true)
    observer?.deliver({ target: marker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)

    expect(publicEvents).toContainEqual(expect.objectContaining({
      name: ELCE_EVENTS.PAGE_FINISHED,
      sourceSceneKey: `scene-${diapoCommand.pageId}`,
      data: { pageId: diapoCommand.pageId },
    }))
    expect(publicEvents.some((event) => event.name === ELCE_EVENTS.SCENE_END)).toBe(false)
    expect(nextButton?.disabled).toBe(false)
  })

  it('unlocks a Diapo Quiz only after validation and keeps its Question mounted', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const initialDocument = createInitialDocument()
    const diapoCommand = createDefaultPageCommand(
      initialDocument,
      { kind: PAGE_LOCATION.SCENARIO },
      'Diapo Quiz',
      PAGE_TYPE.DIAPO,
    )
    let documentModel = applyDocumentCommand(initialDocument, diapoCommand)
    documentModel = applyDocumentCommand(documentModel, { type: 'bdc.carousel.delete', bdcId: diapoCommand.bdcId })
    documentModel = applyDocumentCommand(documentModel, createQuestionBdcCommand(
      'bdc-diapo-question',
      diapoCommand.pageId,
      0,
    ))
    documentModel = applyDocumentCommand(documentModel, createPageCommand({
      pageId: 'page-after-diapo-question',
      bdcId: 'bdc-after-diapo-question',
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel, startPageId: diapoCommand.pageId })
    const publicEvents: { name: string; sourceSceneKey?: string; data?: unknown }[] = []
    const runtime = (composition as unknown as {
      readonly sighty: { readonly runtime: {
        readonly events: { onEvent(listener: (event: { name: string; sourceSceneKey?: string; data?: unknown }) => void): () => void }
      } }
    }).sighty.runtime
    runtime.events.onEvent((event) => publicEvents.push(event))

    await composition.initialize()
    await flushCompositionFrames(pendingFrames)

    const answers = Array.from(stage.querySelectorAll<HTMLInputElement>('.elce-card--question input'))
    const validateButton = stage.querySelector<HTMLButtonElement>('.elce-question-validate')
    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')
    expect(answers).toHaveLength(2)
    expect(nextButton?.disabled).toBe(true)

    answers[0]?.click()
    await flushCompositionFrames(pendingFrames)
    expect(validateButton?.disabled).toBe(false)
    expect(nextButton?.disabled).toBe(true)

    validateButton?.click()
    await flushCompositionFrames(pendingFrames)
    expect(stage.querySelector('.elce-question-feedback')?.textContent).toMatch(/Bonne réponse|Réponse incorrecte/)
    expect(nextButton?.disabled).toBe(false)
    expect(stage.querySelector('.elce-card--question')).not.toBeNull()
    expect(publicEvents).toContainEqual(expect.objectContaining({
      name: ELCE_EVENTS.PAGE_FINISHED,
      sourceSceneKey: `scene-${diapoCommand.pageId}`,
      data: { pageId: diapoCommand.pageId },
    }))
  })

  it('mounts Card BDC media through its selected layout in the real player composition', async () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-carousel-card', type: MEDIA_TYPE.IMAGE, name: 'card.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
    })
    const withCarousel = applyDocumentCommand(withMedia, createCarouselBdcCommand('bdc-carousel-card-media', 'page-a', 1))
    const cardBdcId = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-card-media')!.carousel!.cards[0]!.bdcId
    const withImageLayout = applyDocumentCommand(withCarousel, {
      type: 'bdc.card.layout.set',
      bdcId: cardBdcId,
      layoutId: DEFAULT_PRESET_ID.TEXT_IMAGE,
    })
    const documentModel = applyDocumentCommand(withImageLayout, {
      type: 'bdc.card.media.set',
      bdcId: cardBdcId,
      mediaId: 'media-carousel-card',
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    const source = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22%3E%3C/svg%3E'
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      mediaSources: { 'media-carousel-card': source },
    })

    await composition.initialize()

    const image = stage.querySelector<HTMLImageElement>('.elce-carousel-view--visible .elce-carousel-media img')
    expect(image?.getAttribute('src')).toBe(source)
    expect(stage.querySelector('.elce-carousel-view--visible')?.contains(image)).toBe(true)
  })

  it('advances an automatic Carousel through its compiled Capsule Automation times', async () => {
    const initialDocument = createInitialDocument()
    let withCarousel = applyDocumentCommand(initialDocument, createCarouselBdcCommand('bdc-carousel-auto', 'page-a', 1))
    withCarousel = applyDocumentCommand(withCarousel, createCardBdcCommand('bdc-carousel-auto-card-2', 'bdc-carousel-auto', 1, DEFAULT_PRESET_ID.TEXT_SHORT))
    const carousel = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-auto')!.carousel!
    const documentModel = applyDocumentCommand(withCarousel, {
      type: 'bdc.carousel.update',
      bdcId: 'bdc-carousel-auto',
      carousel: {
        ...carousel,
        playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC,
        defaultViewDurationMs: 300,
        repeatCount: 0,
      },
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()
    await new Promise<void>((resolve) => setTimeout(resolve, 450))

    const views = stage.querySelectorAll<HTMLElement>('.elce-carousel-view')
    const dots = stage.querySelectorAll<HTMLButtonElement>('.elce-carousel-dot')
    expect(views[0]?.classList.contains('elce-carousel-view--hidden')).toBe(true)
    expect(views[1]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(dots[0]?.getAttribute('aria-current')).toBe('false')
    expect(dots[1]?.getAttribute('aria-current')).toBe('true')
  })

  it('repeats an automatic Carousel by the configured number of additional passes', async () => {
    const initialDocument = createInitialDocument()
    let withCarousel = applyDocumentCommand(initialDocument, createCarouselBdcCommand('bdc-carousel-repeat', 'page-a', 1))
    withCarousel = applyDocumentCommand(withCarousel, createCardBdcCommand('bdc-carousel-repeat-card-2', 'bdc-carousel-repeat', 1, DEFAULT_PRESET_ID.TEXT_SHORT))
    const carousel = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-repeat')!.carousel!
    const documentModel = applyDocumentCommand(withCarousel, {
      type: 'bdc.carousel.update',
      bdcId: 'bdc-carousel-repeat',
      carousel: {
        ...carousel,
        playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC,
        defaultViewDurationMs: 60,
        repeatCount: 1,
      },
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()
    const views = stage.querySelectorAll<HTMLElement>('.elce-carousel-view')
    const dots = stage.querySelectorAll<HTMLButtonElement>('.elce-carousel-dot')

    await new Promise<void>((resolve) => setTimeout(resolve, 85))
    expect(views[1]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    expect(views[0]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    await new Promise<void>((resolve) => setTimeout(resolve, 65))
    expect(views[1]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    expect(views[1]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(dots[1]?.getAttribute('aria-current')).toBe('true')
  })

  it('selects the matching view when an automatic Carousel point is clicked', async () => {
    const initialDocument = createInitialDocument()
    let withCarousel = applyDocumentCommand(initialDocument, createCarouselBdcCommand('bdc-carousel-auto-points', 'page-a', 1))
    withCarousel = applyDocumentCommand(withCarousel, createCardBdcCommand('bdc-carousel-auto-points-card-2', 'bdc-carousel-auto-points', 1, DEFAULT_PRESET_ID.TEXT_SHORT))
    const carousel = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-auto-points')!.carousel!
    const documentModel = applyDocumentCommand(withCarousel, {
      type: 'bdc.carousel.update',
      bdcId: 'bdc-carousel-auto-points',
      carousel: { ...carousel, playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC },
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()

    const views = stage.querySelectorAll<HTMLElement>('.elce-carousel-view')
    const dots = stage.querySelectorAll<HTMLButtonElement>('.elce-carousel-dot')
    expect(dots[1]?.disabled).toBe(false)
    dots[1]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 40))

    expect(views[0]?.classList.contains('elce-carousel-view--hidden')).toBe(true)
    expect(views[1]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(dots[1]?.getAttribute('aria-current')).toBe('true')
    expect(dots[1]?.getAttribute('aria-label')).toBe('Aller à la vue 2')
  })

  it('renders each chapter label once through its CodPlay perso', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: createInitialDocument() })

    await composition.initialize()

    const chapterHeading = stage.querySelector('#elce-menu-chapter-heading-chapter-1')
    expect(chapterHeading?.querySelectorAll('.elce-player-menu__chapter-button')).toHaveLength(1)
    expect(chapterHeading?.textContent?.trim()).toBe('Chapitre 1')
  })

  it('routes the initial visible bottom marker through CodPlay for a short Flux page', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
    const stage = document.createElement('div')
    document.body.append(stage)
    const documentModel = applyDocumentCommand(
      createInitialDocument(),
      createPageCommand({
        pageId: 'page-b',
        bdcId: 'bdc-section-2',
        placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
      }),
    )
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()

    const marker = stage.querySelector('#page-a-bottom-marker')
    const observer = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(marker as Element))
    expect(observer).toBeDefined()
    observer?.deliver({ target: marker as Element, intersectionRatio: 1, isIntersecting: true })
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))

    expect(stage.querySelector('.elce-player-navigation__button--next')?.hasAttribute('disabled')).toBe(false)
  })

  it('enables the next page when CodPlay observes the bottom marker after a long scroll', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
    const stage = document.createElement('div')
    document.body.append(stage)
    const documentModel = applyDocumentCommand(
      createInitialDocument(),
      createPageCommand({
        pageId: 'page-b',
        bdcId: 'bdc-section-2',
        placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
      }),
    )
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()

    const marker = stage.querySelector('#page-a-bottom-marker')
    const observer = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(marker as Element))
    expect(marker).not.toBeNull()
    expect(observer).toBeDefined()
    observer?.deliver({ target: marker as Element, intersectionRatio: 0, isIntersecting: false })
    observer?.deliver({ target: marker as Element, intersectionRatio: 1, isIntersecting: true })
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))

    expect(stage.querySelector('.elce-player-navigation__button--next')?.hasAttribute('disabled')).toBe(false)
  })

  it('starts the selected page in the Sighty content slot', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    const documentModel = applyDocumentCommand(
      createInitialDocument(),
      createPageCommand({
        pageId: 'page-b',
        bdcId: 'bdc-section-2',
        placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
      }),
    )
    composition = new ElcePlayerComposition({ stage, document: documentModel, startPageId: 'page-b' })

    await composition.initialize()

    expect(stage.querySelector('#page-b-scrollport')).not.toBeNull()
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page B')
    expect(stage.querySelector('#page-a-scrollport')).toBeNull()
  })

  it('validates a wrong Question answer in CodPlay, then requires scroll-end before Next', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
    const stage = document.createElement('div')
    document.body.append(stage)
    const questionService = new ElceQuestionService()
    const withSecondPage = applyDocumentCommand(
      createInitialDocument(),
      createPageCommand({
        pageId: 'page-b',
        bdcId: 'bdc-section-2',
        placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
      }),
    )
    const withThirdPage = applyDocumentCommand(withSecondPage, createPageCommand({
      pageId: 'page-c',
      bdcId: 'bdc-section-3',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
    }))
    const withQuestion = applyDocumentCommand(withThirdPage, {
      type: 'bdc.create',
      bdcId: 'bdc-question-1',
      bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a', index: 1 },
    })
    const defaultQuestion = withQuestion.bdcs.find((bdc) => bdc.id === 'bdc-question-1')!.question!
    const authoredQuestion = questionService.setPrompt(
      questionService.changeType(defaultQuestion, QUESTION_TYPE.TRUE_FALSE),
      'La Terre est-elle plate ?',
    )
    let documentModel = applyDocumentCommand(withQuestion, {
      type: 'bdc.question.update',
      bdcId: 'bdc-question-1',
      question: authoredQuestion,
    })
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.create',
      bdcId: 'bdc-question-2',
      bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-b', index: 1 },
    })
    const choiceDefaults = documentModel.bdcs.find((bdc) => bdc.id === 'bdc-question-2')!.question!
    const choiceQuestion = questionService.setPrompt(
      questionService.changeType(choiceDefaults, QUESTION_TYPE.CHOICE),
      'Choisissez la réponse exacte.',
    )
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.question.update',
      bdcId: 'bdc-question-2',
      question: choiceQuestion,
    })
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.create',
      bdcId: 'bdc-question-3',
      bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-c', index: 1 },
    })
    const multipleDefaults = documentModel.bdcs.find((bdc) => bdc.id === 'bdc-question-3')!.question!
    let multipleQuestion = questionService.changeType(multipleDefaults, QUESTION_TYPE.MULTIPLE_CHOICE)
    multipleQuestion = questionService.addAnswer(multipleQuestion)
    const secondMultipleAnswer = multipleQuestion.answers[1]
    if (secondMultipleAnswer === undefined) throw new Error('Le preset Choix multiple doit contenir deux réponses.')
    multipleQuestion = questionService.setAnswerCorrect(multipleQuestion, secondMultipleAnswer.id, true)
    multipleQuestion = questionService.setPrompt(multipleQuestion, 'Choisissez toutes les réponses exactes.')
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.question.update',
      bdcId: 'bdc-question-3',
      question: multipleQuestion,
    })
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()

    const answerInputs = Array.from(stage.querySelectorAll<HTMLInputElement>('#page-a-article .elce-card--question input'))
    const validateButton = stage.querySelector<HTMLButtonElement>('#page-a-article .elce-question-validate')
    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')
    const marker = stage.querySelector('#page-a-bottom-marker')
    const observer = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(marker as Element))
    expect(stage.querySelector('.elce-card--question legend')?.textContent)
      .toBe('La Terre est-elle plate ?')
    expect(answerInputs).toHaveLength(2)
    expect(validateButton?.disabled).toBe(true)
    expect(nextButton?.disabled).toBe(true)
    expect(observer).toBeDefined()
    expectQuestionCorrectionHidden(stage.querySelector('#page-a-article')!)

    answerInputs[1]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    expect(validateButton?.disabled).toBe(false)
    expect(nextButton?.disabled).toBe(true)
    expectQuestionCorrectionHidden(stage.querySelector('#page-a-article')!)

    validateButton?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    expect(stage.querySelector('.elce-question-feedback')?.textContent).toBe('Réponse incorrecte.')
    expectQuestionCorrection(stage.querySelector('#page-a-article')!, { correct: 0, incorrect: 1, missedCorrect: 1 })
    expect(answerInputs.every((input) => input.disabled)).toBe(true)
    expect(nextButton?.disabled).toBe(true)

    observer?.deliver({ target: marker as Element, intersectionRatio: 1, isIntersecting: true })
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    expect(nextButton?.disabled).toBe(false)

    nextButton?.click()
    for (let pass = 0; pass < 4; pass += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 35))
      flushPendingFrames(pendingFrames)
    }
    expect(stage.querySelector('#page-b-scrollport')).not.toBeNull()
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page B')

    const choiceInputs = Array.from(stage.querySelectorAll<HTMLInputElement>('#page-b-article .elce-card--question input'))
    const choiceValidate = stage.querySelector<HTMLButtonElement>('#page-b-article .elce-question-validate')
    expect(choiceInputs.map((input) => input.type)).toEqual(['radio', 'radio'])
    expectQuestionCorrectionHidden(stage.querySelector('#page-b-article')!)
    choiceInputs[1]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    expect(choiceInputs.map((input) => input.checked)).toEqual([false, true])
    expectQuestionCorrectionHidden(stage.querySelector('#page-b-article')!)
    choiceInputs[0]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    choiceValidate?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    expect(stage.querySelector('#page-b-article .elce-question-feedback')?.textContent).toBe('Bonne réponse.')
    expectQuestionCorrection(stage.querySelector('#page-b-article')!, { correct: 1, incorrect: 0, missedCorrect: 0 })

    const markerB = stage.querySelector('#page-b-bottom-marker')
    const observerB = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(markerB as Element))
    observerB?.deliver({ target: markerB as Element, intersectionRatio: 1, isIntersecting: true })
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    expect(nextButton?.disabled).toBe(false)
    nextButton?.click()
    for (let pass = 0; pass < 4; pass += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 35))
      flushPendingFrames(pendingFrames)
    }
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page C')

    const multipleInputs = Array.from(stage.querySelectorAll<HTMLInputElement>('#page-c-article .elce-card--question input'))
    const multipleValidate = stage.querySelector<HTMLButtonElement>('#page-c-article .elce-question-validate')
    expect(multipleInputs.map((input) => input.type)).toEqual(['checkbox', 'checkbox', 'checkbox'])
    expectQuestionCorrectionHidden(stage.querySelector('#page-c-article')!)
    multipleInputs[0]?.click()
    multipleInputs[1]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    expectQuestionCorrectionHidden(stage.querySelector('#page-c-article')!)
    multipleValidate?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    expect(stage.querySelector('#page-c-article .elce-question-feedback')?.textContent).toBe('Bonne réponse.')
    expectQuestionCorrection(stage.querySelector('#page-c-article')!, { correct: 2, incorrect: 0, missedCorrect: 0 })

    const chapterMenuButton = stage.querySelector<HTMLButtonElement>('.elce-player-menu__chapter-button')
    expect(chapterMenuButton).not.toBeNull()
    chapterMenuButton?.click()
    for (let pass = 0; pass < 4; pass += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 35))
      flushPendingFrames(pendingFrames)
    }
    const replayedInputs = Array.from(stage.querySelectorAll<HTMLInputElement>('#page-a-article .elce-card--question input'))
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page A')
    expect(stage.querySelector('#page-a-article .elce-question-feedback')?.hasAttribute('hidden')).toBe(true)
    expect(stage.querySelector<HTMLButtonElement>('#page-a-article .elce-question-validate')?.disabled).toBe(true)
    expect(replayedInputs).toHaveLength(2)
    expect(replayedInputs.every((input) => !input.disabled && !input.checked)).toBe(true)
    expectQuestionCorrectionHidden(stage.querySelector('#page-a-article')!)
  })

  it('mounts a standalone page from its own root entry in the layout content slot', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    const documentModel = applyDocumentCommand(
      createInitialDocument(),
      createPageCommand({
        pageId: 'page-root',
        bdcId: 'bdc-section-root',
        placement: { kind: PAGE_LOCATION.SCENARIO },
      }),
    )
    composition = new ElcePlayerComposition({ stage, document: documentModel, startPageId: 'page-root' })

    await composition.initialize()

    expect(stage.querySelector('#page-root-scrollport')).not.toBeNull()
    expect(stage.querySelector('#page-a-scrollport')).toBeNull()
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page B')
  })

  it('keeps a Section title before its text in the rendered page', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    const documentModel = applyDocumentCommand(createInitialDocument(), {
      type: 'bdc.section.update',
      bdcId: 'bdc-section-1',
      title: 'Introduction',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texte' }] }] },
      markup: '<p id="section-text-1">Texte</p>',
    })
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()

    const section = stage.querySelector('#page-a-bdc-section-1')
    expect(section?.querySelector('#page-a-bdc-section-1-title-host h2')?.textContent).toBe('Introduction')
    expect(section?.textContent?.indexOf('Introduction')).toBeLessThan(section?.textContent?.indexOf('Texte') ?? -1)
  })

  it('mounts a simple image bdc through the real CodPlay img component', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const documentModel = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      mediaId: 'media-image-1',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      mediaSources: { 'media-image-1': 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' },
    })

    await composition.initialize()

    expect(stage.querySelector('.elce-flux-image img')).not.toBeNull()
  })

  it('mounts an image bdc inside its exported text anchor', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const withImage = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      mediaId: 'media-image-1',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const documentModel = applyDocumentCommand(withImage, {
      type: 'bdc.section.update',
      bdcId: 'bdc-section-1',
      title: '',
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Avant ' },
            { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
            { type: 'text', text: ' après' },
          ],
        }],
      },
      markup: '<p id="section-text-1">Avant <span id="page-a:bdc-image-1:anchor" data-elce-anchor="true" data-bdc-id="bdc-image-1" data-part="page-a:bdc-image-1:anchor" style="display:inline-block;position:relative;padding-bottom:12rem;"></span> après</p>',
    })
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      mediaSources: { 'media-image-1': 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' },
    })

    await composition.initialize()

    const flowSlot = stage.querySelector('.elce-flow-slot')
    expect(flowSlot).not.toBeNull()
    expect(stage.querySelector('[data-elce-anchor="true"]')).toBeNull()
    expect(stage.querySelector('[data-bdc-id="bdc-image-1"]')).toBeNull()
    expect(flowSlot?.querySelector('.elce-flux-image img')).not.toBeNull()
    expect(flowSlot?.querySelector('.elce-flux-image')?.parentElement).toBe(flowSlot)
  })

  it('mounts a simple video bdc through the real CodPlay media component', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const stage = document.createElement('div')
    document.body.append(stage)
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-video-1', type: 'video', name: 'video.mp4', mimeType: 'video/mp4', size: 10, caption: '' },
    })
    const documentModel = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-video-1',
      bdcType: BDC_TYPE.VIDEO,
      presetId: 'video-basic',
      mediaId: 'media-video-1',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    composition = new ElcePlayerComposition({ stage, document: documentModel, mediaSources: { 'media-video-1': 'blob:video-1' } })

    await composition.initialize()

    expect(stage.querySelector('.elce-flux-video video')).not.toBeNull()
  })
})

/** Confirms CodPlay keeps every answer correction idle before validation or after reset. */
function expectQuestionCorrectionHidden(container: ParentNode): void {
  expect(container.querySelector('.input__correction-icon.is-correct')).toBeNull()
  expect(container.querySelector('.input__correction-icon.is-incorrect')).toBeNull()
  expect(container.querySelector('.input__correction-icon.is-missed-correct')).toBeNull()
}

/** Gives public CodPlay events and Sighty presentation updates several frames to settle. */
async function flushCompositionFrames(pendingFrames: FrameRequestCallback[]): Promise<void> {
  for (let pass = 0; pass < 3; pass += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames, pass * 25)
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 25))
}

/** Confirms CodPlay displays the expected answer corrections after validation. */
function expectQuestionCorrection(
  container: ParentNode,
  expected: Readonly<{ correct: number; incorrect: number; missedCorrect: number }>,
): void {
  expect(container.querySelectorAll('.input__correction-icon.is-correct')).toHaveLength(expected.correct)
  expect(container.querySelectorAll('.input__correction-icon.is-incorrect')).toHaveLength(expected.incorrect)
  expect(container.querySelectorAll('.input__correction-icon.is-missed-correct')).toHaveLength(expected.missedCorrect)
  expect(container.textContent?.includes('✓')).toBe(expected.correct + expected.missedCorrect > 0)
  expect(container.textContent?.includes('×')).toBe(expected.incorrect > 0)
}
