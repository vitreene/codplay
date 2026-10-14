/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { BDC_LOCATION, BDC_TYPE, CAROUSEL_PLAYBACK_MODE, CHAPTER_TYPE, DEFAULT_PRESET_ID, ELCE_EVENTS, PAGE_LOCATION, PAGE_TYPE, QUESTION_TYPE } from '../config/document-config'
import { applyDocumentCommand, createCardBdcCommand, createCarouselBdcCommand, createChapterCommand, createDefaultPageCommand, createEvaluationResultBdcCommand, createPageCommand, createQuestionBdcCommand, createSectionBdcCommand, createStandaloneCardBdcCommand, createStatisticalGraphBdcCommand, createStatisticalGraphCarouselBdcCommand } from '../domain/commands/document-commands'
import { createInitialDocument } from '../domain/document/document-model'
import { ElceQuestionService } from '../domain/question/question-service'
import { ElcePlayerComposition, createPageSceneCatalog } from './elce-player-composition'
import type { ElcePageSceneCache } from './player-composition-types'

type IntersectionEntry = Pick<IntersectionObserverEntry, 'target' | 'intersectionRatio' | 'isIntersecting'>
type PointerMovement = Readonly<{ movementX?: number; movementY?: number }>

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
    this.deliverBatch([entry])
  }

  deliverBatch(entries: readonly IntersectionEntry[]): void {
    this.callback(entries.map((entry) => entry as IntersectionObserverEntry), this as unknown as IntersectionObserver)
  }
}

/** Runs pending CodPlay frames once so a queued public event reaches Sighty. */
function flushPendingFrames(pendingFrames: FrameRequestCallback[], timestamp = 0): void {
  const callbacks = pendingFrames.splice(0)
  for (const callback of callbacks) callback(timestamp)
}

/** Dispatches one pointer sample through the real browser capture source. */
function dispatchPointerEvent(target: EventTarget, type: string, movement: PointerMovement = {}): void {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    clientX: { value: 0 },
    clientY: { value: 0 },
    movementX: { value: movement.movementX ?? 0 },
    movementY: { value: movement.movementY ?? 0 },
  })
  target.dispatchEvent(event)
}

/** Waits for the player event queue to apply a native interaction. */
async function waitForPlayerActions(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 35))
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
    expect(stage.querySelector('.elce-player-layout__content-slot')?.tagName).toBe('SECTION')
    expect(stage.querySelector('.elce-player-layout__content-slot')?.id).toBe('elce-document-content-region')
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
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
    })

    await composition.initialize()

    const viewElements = stage.querySelectorAll<HTMLElement>('.elce-carousel-view')
    const navigationDots = stage.querySelectorAll<HTMLButtonElement>('.elce-carousel-dot')
    expect(stage.querySelector('.elce-card--carousel')).not.toBeNull()
    expect(viewElements).toHaveLength(2)
    expect(viewElements[0]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(viewElements[1]?.classList.contains('elce-carousel-view--hidden')).toBe(true)
    expect(viewElements[0]?.querySelector(':scope > h2.elce-card-text-short__title')).toBeNull()
    expect(viewElements[0]?.querySelector('h2 h2, p p, footer footer')).toBeNull()

    navigationDots[1]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 40))

    expect(viewElements[0]?.classList.contains('elce-carousel-view--hidden')).toBe(true)
    expect(viewElements[1]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(navigationDots[1]?.getAttribute('aria-current')).toBe('true')
    expect(navigationDots[1]?.getAttribute('aria-label')).toBe('Aller à la vue 2')
  })

  it('emits a standalone Diapo Card completion and unlocks the next page from the selected preview start', async () => {
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
      name: 'Après Diapo Carte',
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
    expect(stage.querySelector('.elce-player-menu__page-button--page-after-diapo-card')?.getAttribute('data-locked'))
      .toBe('false')
    nextButton?.click()
    await flushCompositionFrames(pendingFrames)
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Après Diapo Carte')
  })

  it('emits the shared Page-bottom event and unlocks the next page from the selected preview start', async () => {
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
      name: 'Après Diapo Carousel',
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))
    const carousel = documentModel.bdcs.find((bdc) => bdc.id === diapoCommand.bdcId)!.carousel!
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.carousel.update',
      bdcId: diapoCommand.bdcId,
      carousel: {
        ...carousel,
        playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC,
        defaultViewDurationMs: 5_000,
      },
    })
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
    expect(stage.querySelector('.elce-player-menu__page-button--page-after-diapo-carousel')?.getAttribute('data-locked'))
      .toBe('false')
    nextButton?.click()
    await flushCompositionFrames(pendingFrames)
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Après Diapo Carousel')
  })

  it('publishes Diapo Quiz completion after validation and unlocks the next page from the selected preview start', async () => {
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
      name: 'Après Diapo Quiz',
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
    expect(stage.querySelector('.elce-player-menu__page-button--page-after-diapo-question')?.getAttribute('data-locked'))
      .toBe('false')
    expect(stage.querySelector('.elce-card--question')).not.toBeNull()
    expect(publicEvents).toContainEqual(expect.objectContaining({
      name: ELCE_EVENTS.PAGE_FINISHED,
      sourceSceneKey: `scene-${diapoCommand.pageId}`,
      data: { pageId: diapoCommand.pageId },
    }))
    nextButton?.click()
    await flushCompositionFrames(pendingFrames)
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Après Diapo Quiz')
  })

  it('mounts Card BDC media through its selected layout in the real player composition', async () => {
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-carousel-card',  name: 'card.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
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

  it('mounts Carousel Card images in the real Diapo player composition', async () => {
    const initialDocument = createInitialDocument()
    const withMedia = applyDocumentCommand(initialDocument, {
      type: 'media.add',
      media: { id: 'media-diapo-carousel-card', name: 'diapo-card.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
    })
    const diapoCommand = createDefaultPageCommand(
      withMedia,
      { kind: PAGE_LOCATION.SCENARIO },
      'Diapo Carousel image',
      PAGE_TYPE.DIAPO,
    )
    let documentModel = applyDocumentCommand(withMedia, diapoCommand)
    const carousel = documentModel.bdcs.find((bdc) => bdc.id === diapoCommand.bdcId)!
    const cardBdcId = carousel.carousel!.cards[0]!.bdcId
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.card.layout.set',
      bdcId: cardBdcId,
      layoutId: DEFAULT_PRESET_ID.PHOTO,
    })
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.card.media.set',
      bdcId: cardBdcId,
      mediaId: 'media-diapo-carousel-card',
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    const source = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22%3E%3C/svg%3E'
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      startPageId: diapoCommand.pageId,
      mediaSources: { 'media-diapo-carousel-card': source },
    })
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    await composition.initialize()

    const image = stage.querySelector<HTMLImageElement>('.elce-diapo-carousel-root .elce-carousel-view--visible img')
    expect(image?.getAttribute('src')).toBe(source)
    const photoView = image?.closest('.elce-carousel-view')
    const carouselRoot = stage.querySelector('.elce-diapo-carousel-root')
    const contentSlot = stage.querySelector('.elce-player-layout__content-slot')
    const imagePath: Element[] = []
    for (let element: Element | null = image ?? null; element !== null; element = element.parentElement) {
      imagePath.push(element)
      if (element === contentSlot) break
    }

    expect(contentSlot?.tagName).toBe('SECTION')
    expect(contentSlot?.classList.contains('elce-player-layout__content')).toBe(true)
    expect(stage.querySelector('.elce-diapo-host')).toBeNull()
    expect(photoView?.parentElement).toBe(carouselRoot)
    expect(carouselRoot?.parentElement).toBe(contentSlot)
    expect(imagePath.at(-1)).toBe(contentSlot)
    expect(imagePath.length).toBeLessThanOrEqual(6)

    const imageRoot = photoView?.querySelector<HTMLElement>('[data-elce-viewport-content="image"]')
    const viewportHost = stage.querySelector<HTMLElement>('.elce-viewport-expansion-host')
    expect(imageRoot).not.toBeNull()
    dispatchPointerEvent(imageRoot!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    expect(imageRoot?.parentElement).toBe(viewportHost)

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--closed')).toBe(true)
    expect(document.activeElement).toBe(imageRoot)
  })

  it('keeps a Diapo Carousel composition unchanged after navigating away and back', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    const initialDocument = createInitialDocument()
    const chapterId = initialDocument.chapters[0]!.id
    let documentModel = applyDocumentCommand(initialDocument, {
      type: 'media.add',
      media: { id: 'media-diapo-replay', name: 'diapo-replay.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
    })
    const diapoCommand = createDefaultPageCommand(
      documentModel,
      { kind: PAGE_LOCATION.CHAPTER, chapterId },
      'Diapo Carousel',
      PAGE_TYPE.DIAPO,
    )
    documentModel = applyDocumentCommand(documentModel, diapoCommand)
    const carousel = documentModel.bdcs.find((bdc) => bdc.id === diapoCommand.bdcId)!
    const photoCardId = carousel.carousel!.cards[0]!.bdcId
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.card.layout.set',
      bdcId: photoCardId,
      layoutId: DEFAULT_PRESET_ID.PHOTO,
    })
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.card.media.set',
      bdcId: photoCardId,
      mediaId: 'media-diapo-replay',
    })
    documentModel = applyDocumentCommand(documentModel, createCardBdcCommand(
      'bdc-diapo-replay-card-2',
      carousel.id,
      1,
      DEFAULT_PRESET_ID.TEXT_SHORT,
    ))
    documentModel = applyDocumentCommand(documentModel, createPageCommand({
      pageId: 'page-after-diapo-replay',
      bdcId: 'bdc-after-diapo-replay',
      name: 'Page C',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId },
    }))

    const stage = document.createElement('div')
    document.body.append(stage)
    const source = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22%3E%3C/svg%3E'
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      startPageId: 'page-a',
      mediaSources: { 'media-diapo-replay': source },
    })

    await composition.initialize()
    await flushCompositionFrames(pendingFrames)

    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')
    const pageBButton = Array.from(stage.querySelectorAll<HTMLButtonElement>('.elce-player-menu__page-button'))
      .find((button) => button.textContent === 'Diapo Carousel')
    const pageCButton = stage.querySelector<HTMLButtonElement>('.elce-player-menu__page-button--page-after-diapo-replay')
    const pageAMarker = stage.querySelector('#page-a-bottom-marker')
    const pageAObserver = ControlledIntersectionObserver.instances.find((observer) => observer.targets.has(pageAMarker as Element))
    expect(pageBButton?.getAttribute('data-locked')).toBe('true')
    expect(pageCButton?.getAttribute('data-locked')).toBe('true')
    pageAObserver?.deliver({ target: pageAMarker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)
    expect(nextButton?.disabled).toBe(false)
    expect(pageBButton?.getAttribute('data-locked')).toBe('false')

    nextButton?.click()
    await flushCompositionFrames(pendingFrames)
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Diapo Carousel')
    expect(nextButton?.disabled).toBe(true)
    expect(pageCButton?.getAttribute('data-locked')).toBe('true')
    const carouselRoot = stage.querySelector('.elce-diapo-carousel-root')
    const finalView = stage.querySelectorAll<HTMLElement>('.elce-carousel-view')[1]
    const finalDot = stage.querySelectorAll<HTMLButtonElement>('.elce-carousel-dot')[1]
    const completionMarker = finalView?.querySelector('.elce-carousel-completion-marker')
    const completionObserver = ControlledIntersectionObserver.instances.find((observer) => observer.targets.has(completionMarker as Element))
    expect(carouselRoot).not.toBeNull()
    expect(completionObserver).toBeDefined()
    expect(nextButton?.disabled).toBe(true)
    expect(pageCButton?.getAttribute('data-locked')).toBe('true')

    finalDot?.click()
    await flushCompositionFrames(pendingFrames)
    completionObserver?.deliver({ target: completionMarker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)
    expect(pageCButton?.getAttribute('data-locked')).toBe('false')
    expect(nextButton?.disabled).toBe(false)
    const diapoStructureBeforeLeaving = Array.from(carouselRoot?.querySelectorAll('*') ?? [])
      .map((element) => [element.tagName, element.id, element.textContent])
    const mediaSourcesBeforeLeaving = Array.from(carouselRoot?.querySelectorAll('img') ?? [])
      .map((image) => image.getAttribute('src'))
    nextButton?.click()
    await flushCompositionFrames(pendingFrames)
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page C')

    const previousButton = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button:not(.elce-player-navigation__button--next)')
    expect(previousButton?.disabled).toBe(false)
    previousButton?.click()
    await flushCompositionFrames(pendingFrames)
    const returnedCarousel = stage.querySelector('.elce-diapo-carousel-root')
    const returnedImage = returnedCarousel?.querySelector('img')
    const contentSlot = stage.querySelector('.elce-player-layout__content-slot')
    let imagePathLength = 0
    for (let element: Element | null = returnedImage ?? null; element !== null; element = element.parentElement) {
      imagePathLength += 1
      if (element === contentSlot) break
    }

    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Diapo Carousel')
    expect(Array.from(returnedCarousel?.querySelectorAll('*') ?? [])
      .map((element) => [element.tagName, element.id, element.textContent]))
      .toEqual(diapoStructureBeforeLeaving)
    expect(Array.from(returnedCarousel?.querySelectorAll('img') ?? [])
      .map((image) => image.getAttribute('src')))
      .toEqual(mediaSourcesBeforeLeaving)
    expect(returnedCarousel?.querySelector('.elce-carousel-view--visible')?.id)
      .toBe(`${diapoCommand.pageId}-${carousel.id}-card-${photoCardId}`)
    expect(returnedImage?.getAttribute('src')).toBe(source)
    expect(imagePathLength).toBeLessThanOrEqual(6)
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
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
    })

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

  it('switches an automatic Carousel to manual when a point is selected', async () => {
    const initialDocument = createInitialDocument()
    let withCarousel = applyDocumentCommand(initialDocument, createCarouselBdcCommand('bdc-carousel-auto-points', 'page-a', 1))
    withCarousel = applyDocumentCommand(withCarousel, createCardBdcCommand('bdc-carousel-auto-points-card-2', 'bdc-carousel-auto-points', 1, DEFAULT_PRESET_ID.TEXT_SHORT))
    const carousel = withCarousel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-auto-points')!.carousel!
    const documentModel = applyDocumentCommand(withCarousel, {
      type: 'bdc.carousel.update',
      bdcId: 'bdc-carousel-auto-points',
      carousel: {
        ...carousel,
        playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC,
        defaultViewDurationMs: 300,
        repeatCount: 1,
      },
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()

    const views = stage.querySelectorAll<HTMLElement>('.elce-carousel-view')
    const dots = stage.querySelectorAll<HTMLButtonElement>('.elce-carousel-dot')
    expect(dots[1]?.disabled).toBe(false)

    await new Promise<void>((resolve) => setTimeout(resolve, 350))
    expect(views[1]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    dots[1]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 40))
    await new Promise<void>((resolve) => setTimeout(resolve, 300))

    expect(views[0]?.classList.contains('elce-carousel-view--hidden')).toBe(true)
    expect(views[1]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(Array.from(views).filter((view) => view.classList.contains('elce-carousel-view--visible'))).toHaveLength(1)
    expect(dots[0]?.getAttribute('aria-current')).toBe('false')
    expect(dots[1]?.getAttribute('aria-current')).toBe('true')
    expect(dots[1]?.getAttribute('aria-label')).toBe('Aller à la vue 2')

    dots[0]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 40))
    await new Promise<void>((resolve) => setTimeout(resolve, 300))

    expect(views[0]?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(views[1]?.classList.contains('elce-carousel-view--hidden')).toBe(true)
    expect(Array.from(views).filter((view) => view.classList.contains('elce-carousel-view--visible'))).toHaveLength(1)
    expect(dots[0]?.getAttribute('aria-current')).toBe('true')
    expect(dots[1]?.getAttribute('aria-current')).toBe('false')
    expect(documentModel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-auto-points')?.carousel?.playbackMode)
      .toBe(CAROUSEL_PLAYBACK_MODE.AUTOMATIC)
  })

  it('stops automatic progression after selecting a Diapo Carousel point', async () => {
    const initialDocument = createInitialDocument()
    const diapoCommand = createDefaultPageCommand(
      initialDocument,
      { kind: PAGE_LOCATION.SCENARIO },
      'Diapo Carousel automatique',
      PAGE_TYPE.DIAPO,
    )
    let documentModel = applyDocumentCommand(initialDocument, diapoCommand)
    documentModel = applyDocumentCommand(documentModel, createCardBdcCommand(
      'bdc-diapo-carousel-auto-card-2',
      diapoCommand.bdcId,
      1,
      DEFAULT_PRESET_ID.TEXT_SHORT,
    ))
    const carousel = documentModel.bdcs.find((bdc) => bdc.id === diapoCommand.bdcId)!.carousel!
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.carousel.update',
      bdcId: diapoCommand.bdcId,
      carousel: {
        ...carousel,
        playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC,
        defaultViewDurationMs: 300,
        repeatCount: 1,
      },
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      startPageId: diapoCommand.pageId,
    })

    await composition.initialize()

    const views = stage.querySelectorAll<HTMLElement>('.elce-carousel-view')
    const dots = stage.querySelectorAll<HTMLButtonElement>('.elce-carousel-dot')
    await new Promise<void>((resolve) => setTimeout(resolve, 350))
    expect(views[1]?.classList.contains('elce-carousel-view--visible')).toBe(true)

    dots[1]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 40))
    await new Promise<void>((resolve) => setTimeout(resolve, 300))

    expect(Array.from(views).filter((view) => view.classList.contains('elce-carousel-view--visible')))
      .toEqual([views[1]])
    expect(dots[0]?.getAttribute('aria-current')).toBe('false')
    expect(dots[1]?.getAttribute('aria-current')).toBe('true')

    dots[0]?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 40))

    expect(Array.from(views).filter((view) => view.classList.contains('elce-carousel-view--visible')))
      .toEqual([views[0]])
    expect(dots[0]?.getAttribute('aria-current')).toBe('true')
    expect(dots[1]?.getAttribute('aria-current')).toBe('false')
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
    await flushCompositionFrames(pendingFrames)

    const marker = stage.querySelector('#page-a-bottom-marker')
    const observer = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(marker as Element))
    expect(observer).toBeDefined()
    observer?.deliver({ target: marker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)

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
    await flushCompositionFrames(pendingFrames)

    const marker = stage.querySelector('#page-a-bottom-marker')
    const observer = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(marker as Element))
    expect(marker).not.toBeNull()
    expect(observer).toBeDefined()
    observer?.deliver({ target: marker as Element, intersectionRatio: 0, isIntersecting: false })
    observer?.deliver({ target: marker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)

    expect(stage.querySelector('.elce-player-navigation__button--next')?.hasAttribute('disabled')).toBe(false)
  })

  it('records scroll-end when an anchored Card outro shares its observer batch with the bottom marker', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    let documentModel = createInitialDocument()
    documentModel = applyDocumentCommand(documentModel, {
      type: 'media.add',
      media: { id: 'media-scroll-card', name: 'scroll-card.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.anchor.create',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-scroll-card',
      presetId: DEFAULT_PRESET_ID.PHOTO,
      media: { id: 'media-scroll-card', name: 'scroll-card.png', mimeType: 'image/png', size: 10, caption: '' },
      partId: 'page-a:bdc-scroll-card:anchor',
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Avant ' },
            { type: 'elceAnchor', attrs: { bdcId: 'bdc-scroll-card', partId: 'page-a:bdc-scroll-card:anchor' } },
            { type: 'text', text: ' après' },
          ],
        }],
      },
      markup: '<p id="section-scroll-text">Avant <span id="page-a:bdc-scroll-card:anchor" data-elce-anchor="true" data-bdc-id="bdc-scroll-card" data-part="page-a:bdc-scroll-card:anchor" style="display:inline-block;position:relative;padding-bottom:12rem;"></span> après</p>',
    })
    documentModel = applyDocumentCommand(documentModel, createPageCommand({
      pageId: 'page-b',
      bdcId: 'bdc-section-2',
      name: 'Page B',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
    }))

    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      mediaSources: { 'media-scroll-card': 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' },
    })
    await composition.initialize()
    await flushCompositionFrames(pendingFrames)

    const marker = stage.querySelector('#page-a-bottom-marker')
    const card = stage.querySelector('.elce-flux-card-root')
    const observer = ControlledIntersectionObserver.instances.find((candidate) => (
      candidate.targets.has(marker as Element) && candidate.targets.has(card as Element)
    ))
    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')
    const pageBButton = stage.querySelector<HTMLButtonElement>('.elce-player-menu__page-button--page-b')

    expect(observer).toBeDefined()
    expect(nextButton?.disabled).toBe(true)
    expect(pageBButton?.getAttribute('data-locked')).toBe('true')

    observer?.deliverBatch([
      { target: card as Element, intersectionRatio: 1, isIntersecting: true },
      { target: marker as Element, intersectionRatio: 0, isIntersecting: false },
    ])
    observer?.deliverBatch([
      { target: card as Element, intersectionRatio: 0, isIntersecting: false },
      { target: marker as Element, intersectionRatio: 1, isIntersecting: true },
    ])
    await flushCompositionFrames(pendingFrames)

    expect(nextButton?.disabled).toBe(false)
    expect(pageBButton?.getAttribute('data-locked')).toBe('false')
    pageBButton?.click()
    await flushCompositionFrames(pendingFrames)

    expect(stage.querySelector('#page-b-scrollport')).not.toBeNull()
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

  it('routes a page-button click in the table of contents through Sighty', async () => {
    const initialDocument = createInitialDocument()
    const documentModel = applyDocumentCommand(initialDocument, createPageCommand({
      pageId: 'page-b',
      bdcId: 'bdc-section-2',
      name: 'Page B',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
    }))
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel, startPageId: 'page-b' })

    await composition.initialize()

    const pageAButton = stage.querySelector<HTMLButtonElement>('.elce-player-menu__page-button--page-a')
    expect(stage.querySelector('#page-b-scrollport')).not.toBeNull()
    expect(pageAButton).not.toBeNull()
    pageAButton?.click()
    await waitForPlayerActions()

    expect(stage.querySelector('#page-a-scrollport')).not.toBeNull()
    expect(stage.querySelector('#page-b-scrollport')).toBeNull()
  })

  it('continues from a directly previewed Evaluation question to the next question after its Sighty gates', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    const { documentModel, pageFId, precedingQuestionPageId } = createEvaluationQuestionPages('Page D')
    if (precedingQuestionPageId === undefined) throw new Error('The fixture has no preceding Evaluation question.')

    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel, startPageId: precedingQuestionPageId })

    await composition.initialize()
    await flushCompositionFrames(pendingFrames)

    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')
    const pageFButton = Array.from(stage.querySelectorAll<HTMLButtonElement>('.elce-player-menu__page-button'))
      .find((button) => button.textContent === 'Page F')
    const pageGButton = Array.from(stage.querySelectorAll<HTMLButtonElement>('.elce-player-menu__page-button'))
      .find((button) => button.textContent === 'Page G')
    const answer = stage.querySelector<HTMLInputElement>('.elce-card--question input[type="radio"]')
    const validateButton = stage.querySelector<HTMLButtonElement>('.elce-question-validate')
    const pageDMarker = stage.querySelector(`#${precedingQuestionPageId}-bottom-marker`)
    const pageDObserver = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(pageDMarker as Element))

    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page D')
    expect(nextButton?.disabled).toBe(true)
    expect(pageFButton?.getAttribute('data-locked')).toBe('true')
    expect(pageGButton?.getAttribute('data-locked')).toBe('true')
    expect(answer).not.toBeNull()
    expect(validateButton).not.toBeNull()
    expect(pageDObserver).toBeDefined()

    answer?.click()
    await flushCompositionFrames(pendingFrames)
    validateButton?.click()
    await flushCompositionFrames(pendingFrames)
    pageDObserver?.deliver({ target: pageDMarker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)

    expect(nextButton?.disabled).toBe(false)
    expect(pageFButton?.getAttribute('data-locked')).toBe('false')
    expect(pageGButton?.getAttribute('data-locked')).toBe('true')
    nextButton?.click()
    await flushCompositionFrames(pendingFrames)
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page F')
    expect(nextButton?.disabled).toBe(true)
    expect(pageGButton?.getAttribute('data-locked')).toBe('true')
    expect(stage.querySelector(`#${pageFId}-scrollport`)).not.toBeNull()
  })

  it('keeps Next disabled on a directly previewed Evaluation question while its next page is inaccessible', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
    const { documentModel, pageFId } = createEvaluationQuestionPages()
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel, startPageId: pageFId })

    await composition.initialize()
    await flushCompositionFrames(pendingFrames)

    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')
    const pageGButton = Array.from(stage.querySelectorAll<HTMLButtonElement>('.elce-player-menu__page-button'))
      .find((button) => button.textContent === 'Page G')
    const answer = stage.querySelector<HTMLInputElement>('.elce-card--question input[type="radio"]')
    const validateButton = stage.querySelector<HTMLButtonElement>('.elce-question-validate')
    const marker = stage.querySelector(`#${pageFId}-bottom-marker`)
    const observer = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(marker as Element))

    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page F')
    expect(pageGButton?.getAttribute('data-locked')).toBe('true')
    expect(nextButton?.disabled).toBe(true)
    expect(answer).not.toBeNull()
    expect(validateButton).not.toBeNull()
    expect(observer).toBeDefined()

    answer?.click()
    await flushCompositionFrames(pendingFrames)
    validateButton?.click()
    await flushCompositionFrames(pendingFrames)
    observer?.deliver({ target: marker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)

    expect(pageGButton?.getAttribute('data-locked')).toBe('true')
    expect(nextButton?.disabled).toBe(true)
    nextButton?.click()
    await flushCompositionFrames(pendingFrames)
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page F')
  })

  it('navigates from a completed Evaluation question to its accessible next page', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
    const { documentModel, pageFId } = createEvaluationQuestionPages()
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()
    await flushCompositionFrames(pendingFrames)

    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')
    const pageFButton = Array.from(stage.querySelectorAll<HTMLButtonElement>('.elce-player-menu__page-button'))
      .find((button) => button.textContent === 'Page F')
    const pageAMarker = stage.querySelector('#page-a-bottom-marker')
    const pageAObserver = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(pageAMarker as Element))
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page A')
    expect(pageFButton?.getAttribute('data-locked')).toBe('true')
    expect(nextButton?.disabled).toBe(true)

    pageAObserver?.deliver({ target: pageAMarker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)
    expect(pageFButton?.getAttribute('data-locked')).toBe('false')
    expect(nextButton?.disabled).toBe(false)
    nextButton?.click()
    await flushCompositionFrames(pendingFrames)
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page F')

    const answer = stage.querySelector<HTMLInputElement>('.elce-card--question input[type="radio"]')
    const validateButton = stage.querySelector<HTMLButtonElement>('.elce-question-validate')
    const pageFMarker = stage.querySelector(`#${pageFId}-bottom-marker`)
    const pageFObserver = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(pageFMarker as Element))
    const pageGButton = Array.from(stage.querySelectorAll<HTMLButtonElement>('.elce-player-menu__page-button'))
      .find((button) => button.textContent === 'Page G')
    expect(answer).not.toBeNull()
    expect(validateButton).not.toBeNull()
    expect(pageFObserver).toBeDefined()

    answer?.click()
    await flushCompositionFrames(pendingFrames)
    validateButton?.click()
    await flushCompositionFrames(pendingFrames)
    pageFObserver?.deliver({ target: pageFMarker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)

    expect(pageGButton?.getAttribute('data-locked')).toBe('false')
    expect(nextButton?.disabled).toBe(false)
    nextButton?.click()
    await flushCompositionFrames(pendingFrames)
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page G')
    const resultCards = stage.querySelectorAll<HTMLElement>('.elce-card--evaluation-result')
    const resultCard = resultCards[0]
    expect(resultCards).toHaveLength(1)
    expect(resultCard?.querySelector('.elce-evaluation-result__branch--success')).not.toBeNull()
    expect(resultCard?.querySelector('.elce-evaluation-result__branch--failure')).toBeNull()
    expect(resultCard?.closest('.elce-flux-article')).not.toBeNull()
    expect(resultCard?.textContent).toContain('Évaluation réussie.')
  })

  it('shows the failure branch on the Result page from the Sighty Evaluation state', async () => {
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
    const { documentModel, pageFId } = createEvaluationQuestionPages()
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel })

    await composition.initialize()
    await flushCompositionFrames(pendingFrames)

    const pageAMarker = stage.querySelector('#page-a-bottom-marker')
    const pageAObserver = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(pageAMarker as Element))
    pageAObserver?.deliver({ target: pageAMarker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)
    stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')?.click()
    await flushCompositionFrames(pendingFrames)

    const answers = stage.querySelectorAll<HTMLInputElement>('.elce-card--question input[type="radio"]')
    const validateButton = stage.querySelector<HTMLButtonElement>('.elce-question-validate')
    const pageFMarker = stage.querySelector(`#${pageFId}-bottom-marker`)
    const pageFObserver = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(pageFMarker as Element))
    answers[1]?.click()
    await flushCompositionFrames(pendingFrames)
    validateButton?.click()
    await flushCompositionFrames(pendingFrames)
    pageFObserver?.deliver({ target: pageFMarker as Element, intersectionRatio: 1, isIntersecting: true })
    await flushCompositionFrames(pendingFrames)
    stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')?.click()
    await flushCompositionFrames(pendingFrames)

    const resultCards = stage.querySelectorAll<HTMLElement>('.elce-card--evaluation-result')
    const resultCard = resultCards[0]
    expect(stage.querySelector('.elce-player-title')?.textContent).toBe('Page G')
    expect(resultCards).toHaveLength(1)
    expect(resultCard?.querySelector('.elce-evaluation-result__branch--failure')).not.toBeNull()
    expect(resultCard?.querySelector('.elce-evaluation-result__branch--success')).toBeNull()
    expect(resultCard?.closest('.elce-flux-article')).not.toBeNull()
    expect(resultCard?.textContent).toContain('Évaluation à reprendre.')
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
    expect(section?.querySelector(':scope > h2')?.textContent).toBe('Introduction')
    expect(section?.querySelector('#page-a-bdc-section-1-title-host')).toBeNull()
    expect(section?.textContent?.indexOf('Introduction')).toBeLessThan(section?.textContent?.indexOf('Texte') ?? -1)
  })

  it('mounts a simple image bdc through the real CodPlay img component', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const documentModel = createCardWithMedia(withMedia, 'bdc-image-1', 'media-image-1')
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      mediaSources: { 'media-image-1': 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' },
    })
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    await composition.initialize()

    expect(stage.querySelector('.elce-carousel-photo__media img')).not.toBeNull()
  })

  it('opens a direct image in the viewport and closes it with Escape through the real player', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    const withMedia = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-expanded-image', name: 'expanded.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
    })
    const documentModel = createCardWithMedia(withMedia, 'bdc-expanded-image', 'media-expanded-image')
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      mediaSources: {
        'media-expanded-image': 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 3%22%3E%3C/svg%3E',
      },
    })
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    await composition.initialize()

    const imageRoot = stage.querySelector<HTMLElement>('[data-elce-viewport-content="image"]')
    const viewportHost = stage.querySelector<HTMLElement>('.elce-viewport-expansion-host')
    const scrollport = stage.querySelector<HTMLElement>('.elce-flux-scrollport')
    expect(imageRoot).not.toBeNull()
    const focusImage = vi.spyOn(imageRoot!, 'focus')
    expect(viewportHost).not.toBeNull()
    expect(viewportHost?.id).toMatch(/-frame$/)
    expect(viewportHost?.style.position).toBe('fixed')
    expect(viewportHost?.style.inset).toBe('0px')
    expect(viewportHost?.style.width).toBe('100vw')
    expect(viewportHost?.style.height).toBe('100vh')
    expect(scrollport).not.toBeNull()
    dispatchPointerEvent(imageRoot!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()

    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)
    expect(scrollport?.classList.contains('elce-viewport-scroll-locked')).toBe(true)
    expect(viewportHost?.getAttribute('aria-hidden')).toBe('false')

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await waitForPlayerActions()

    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--closing')).toBe(true)
    expect(scrollport?.classList.contains('elce-viewport-scroll-locked')).toBe(true)
    dispatchPointerEvent(viewportHost!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)
    expect(scrollport?.classList.contains('elce-viewport-scroll-locked')).toBe(true)
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)
    expect(scrollport?.classList.contains('elce-viewport-scroll-locked')).toBe(true)

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--closed')).toBe(true)
    expect(scrollport?.classList.contains('elce-viewport-scroll-locked')).toBe(false)
    expect(focusImage).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(imageRoot)
  })

  it('moves only a direct Graph visualization and leaves its title and commentary in place', async () => {
    let documentModel = applyDocumentCommand(
      createInitialDocument(),
      createStatisticalGraphBdcCommand('bdc-expanded-graph', 'page-a', 0),
    )
    const graph = documentModel.bdcs.find((bdc) => bdc.id === 'bdc-expanded-graph')
    if (graph?.statisticalGraph == null) throw new Error('The fixture Graph has no content.')
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.statistical-graph.update',
      bdcId: graph.id,
      statisticalGraph: {
        ...graph.statisticalGraph,
        title: 'Ventes par région',
        editorialText: 'Les ventes progressent au nord.',
      },
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel })
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    await composition.initialize()

    const graphRoot = stage.querySelector<HTMLElement>('[data-elce-viewport-content="graph"]')
    const figure = stage.querySelector<HTMLElement>('.elce-statistical-graph')
    const viewportHost = stage.querySelector<HTMLElement>('.elce-viewport-expansion-host')
    const scrollport = stage.querySelector<HTMLElement>('.elce-flux-scrollport')
    expect(graphRoot).not.toBeNull()
    expect(graphRoot?.parentElement).toBe(figure?.querySelector('.elce-statistical-graph__visual'))
    expect(figure?.textContent).toContain('Ventes par région')
    expect(figure?.textContent).toContain('Les ventes progressent au nord.')

    dispatchPointerEvent(graphRoot!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()

    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)
    expect(scrollport?.classList.contains('elce-viewport-scroll-locked')).toBe(true)
    expect(graphRoot?.parentElement?.closest('.elce-viewport-expansion-host')).toBe(viewportHost)
    expect(graphRoot?.querySelector('svg')).not.toBeNull()
    expect(graphRoot?.querySelector('.elce-statistical-graph__table--visually-hidden')).not.toBeNull()
    expect(figure?.textContent).toContain('Ventes par région')
    expect(figure?.textContent).toContain('Les ventes progressent au nord.')

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()

    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--closed')).toBe(true)
    expect(scrollport?.classList.contains('elce-viewport-scroll-locked')).toBe(false)
    expect(graphRoot?.parentElement).toBe(figure?.querySelector('.elce-statistical-graph__visual'))
    expect(document.activeElement).toBe(graphRoot)
  })

  it('expands a Graph view inside a Carousel and keeps its text with the selected view', async () => {
    let documentModel = applyDocumentCommand(
      createInitialDocument(),
      createCarouselBdcCommand('bdc-graph-carousel', 'page-a', 1),
    )
    documentModel = applyDocumentCommand(documentModel, createStatisticalGraphCarouselBdcCommand(
      'bdc-carousel-graph', 'bdc-graph-carousel', 0,
    ))
    documentModel = applyDocumentCommand(documentModel, createCardBdcCommand(
      'bdc-carousel-image', 'bdc-graph-carousel', 2, DEFAULT_PRESET_ID.PHOTO,
    ))
    documentModel = applyDocumentCommand(documentModel, {
      type: 'media.add',
      media: { id: 'media-carousel-graph-image', name: 'graph-carousel.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
    })
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.card.media.set', bdcId: 'bdc-carousel-image', mediaId: 'media-carousel-graph-image',
    })
    const graph = documentModel.bdcs.find((bdc) => bdc.id === 'bdc-carousel-graph')
    if (graph?.statisticalGraph == null) throw new Error('The fixture Carousel Graph has no content.')
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.statistical-graph.update',
      bdcId: graph.id,
      statisticalGraph: {
        ...graph.statisticalGraph,
        title: 'Ventes par région',
        editorialText: 'Les ventes progressent au nord.',
      },
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      mediaSources: {
        'media-carousel-graph-image': 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 3%22%3E%3C/svg%3E',
      },
    })
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    await composition.initialize()

    const graphRoot = stage.querySelector<HTMLElement>('.elce-carousel-view--visible [data-elce-viewport-content="graph"]')
    const graphView = graphRoot?.closest<HTMLElement>('.elce-carousel-view')
    const figure = graphRoot?.closest<HTMLElement>('.elce-statistical-graph')
    const viewportHost = stage.querySelector<HTMLElement>('.elce-viewport-expansion-host')
    const previousButton = stage.querySelector<HTMLButtonElement>('.elce-viewport-expansion__arrow--previous')
    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-viewport-expansion__arrow--next')
    expect(graphRoot).not.toBeNull()
    expect(graphView?.id).toContain('bdc-carousel-graph')
    expect(previousButton).not.toBeNull()
    expect(nextButton).not.toBeNull()

    dispatchPointerEvent(graphRoot!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()

    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)
    expect(graphRoot?.closest('.elce-viewport-expansion-host')).toBe(viewportHost)
    expect(graphRoot?.querySelector('svg')).not.toBeNull()
    expect(figure?.textContent).toContain('Ventes par région')
    expect(figure?.textContent).toContain('Les ventes progressent au nord.')

    dispatchPointerEvent(nextButton!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    expect(stage.querySelector('.elce-carousel-view--visible')?.id).toContain('bdc-carousel-image')
    expect(viewportHost?.querySelector('[data-elce-viewport-content="image"]')).not.toBeNull()
    expect(graphView?.classList.contains('elce-carousel-view--hidden')).toBe(true)

    dispatchPointerEvent(previousButton!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    expect(stage.querySelector('.elce-carousel-view--visible')?.id).toContain('bdc-carousel-graph')
    expect(graphRoot?.closest('.elce-viewport-expansion-host')).toBe(viewportHost)
    expect(graphView?.classList.contains('elce-carousel-view--visible')).toBe(true)

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()

    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--closed')).toBe(true)
    expect(graphView?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(graphRoot?.closest('.elce-carousel-view')).toBe(graphView)
    expect(document.activeElement).toBe(graphRoot)
  })

  it('expands only the visualization of a Graph anchored in a Flux Section', async () => {
    let documentModel = applyDocumentCommand(
      createInitialDocument(),
      createStatisticalGraphBdcCommand('bdc-anchor-graph', 'page-a', 1),
    )
    const graph = documentModel.bdcs.find((bdc) => bdc.id === 'bdc-anchor-graph')
    if (graph?.statisticalGraph == null) throw new Error('The fixture anchored Graph has no content.')
    documentModel = applyDocumentCommand(documentModel, { type: 'bdc.move', bdcId: graph.id, placement: { kind: BDC_LOCATION.CATALOG } })
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.statistical-graph.update',
      bdcId: graph.id,
      statisticalGraph: {
        ...graph.statisticalGraph,
        title: 'Ventes ancrées',
        editorialText: 'Commentaire ancré.',
      },
    })
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.anchor.attach',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: graph.id,
      markup: '<p id="section-anchor-graph-text">Avant <span id="page-a:bdc-anchor-graph:anchor" data-elce-anchor="true" data-bdc-id="bdc-anchor-graph" data-part="page-a:bdc-anchor-graph:anchor" style="display:inline-block;position:relative;padding-bottom:12rem;"></span> après</p>',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: 'Avant ' },
          { type: 'elceAnchor', attrs: { bdcId: graph.id, partId: 'page-a:bdc-anchor-graph:anchor' } },
          { type: 'text', text: ' après' },
        ] }],
      },
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({ stage, document: documentModel })
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    await composition.initialize()

    const flowSlot = stage.querySelector<HTMLElement>('.elce-flow-slot')
    const graphRoot = flowSlot?.querySelector<HTMLElement>('[data-elce-viewport-content="graph"]')
    const figure = graphRoot?.closest<HTMLElement>('.elce-statistical-graph')
    const sectionText = stage.querySelector<HTMLElement>('#section-anchor-graph-text')
    const viewportHost = stage.querySelector<HTMLElement>('.elce-viewport-expansion-host')
    expect(graphRoot).not.toBeNull()
    expect(sectionText?.textContent).toContain('Avant')
    expect(sectionText?.textContent).toContain('après')

    dispatchPointerEvent(graphRoot!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()

    expect(graphRoot?.closest('.elce-viewport-expansion-host')).toBe(viewportHost)
    expect(figure?.textContent).toContain('Ventes ancrées')
    expect(figure?.textContent).toContain('Commentaire ancré.')
    expect(sectionText?.textContent).toContain('Avant')
    expect(sectionText?.textContent).toContain('après')

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()

    expect(graphRoot?.closest('.elce-flow-slot')).toBe(flowSlot)
    expect(document.activeElement).toBe(graphRoot)
  })

  it('navigates only image views by arrow and swipe in an expanded Carousel', async () => {
    const initialDocument = createInitialDocument()
    let documentModel = applyDocumentCommand(initialDocument, {
      type: 'media.add',
      media: { id: 'media-carousel-expansion', name: 'carousel.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
    })
    documentModel = applyDocumentCommand(documentModel, createCarouselBdcCommand('bdc-expansion-carousel', 'page-a', 1))
    documentModel = applyDocumentCommand(documentModel, createCardBdcCommand(
      'bdc-expansion-text', 'bdc-expansion-carousel', 1, DEFAULT_PRESET_ID.TEXT_SHORT,
    ))
    documentModel = applyDocumentCommand(documentModel, createCardBdcCommand(
      'bdc-expansion-last-image', 'bdc-expansion-carousel', 2, DEFAULT_PRESET_ID.PHOTO,
    ))
    const firstImageBdcId = documentModel.bdcs.find((bdc) => bdc.id === 'bdc-expansion-carousel')!.carousel!.cards[0]!.bdcId
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.card.layout.set', bdcId: firstImageBdcId, layoutId: DEFAULT_PRESET_ID.PHOTO,
    })
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.card.media.set', bdcId: firstImageBdcId, mediaId: 'media-carousel-expansion',
    })
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.card.media.set', bdcId: 'bdc-expansion-last-image', mediaId: 'media-carousel-expansion',
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      mediaSources: {
        'media-carousel-expansion': 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 3%22%3E%3C/svg%3E',
      },
    })
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    await composition.initialize()

    const viewportHost = stage.querySelector<HTMLElement>('.elce-viewport-expansion-host')
    const firstImageRoot = stage.querySelector<HTMLElement>('.elce-carousel-view--visible [data-elce-viewport-content="image"]')
    const nextButton = stage.querySelector<HTMLButtonElement>('.elce-viewport-expansion__arrow--next')
    const scrollport = stage.querySelector<HTMLElement>('.elce-flux-scrollport')
    expect(firstImageRoot).not.toBeNull()
    expect(nextButton).not.toBeNull()
    expect(scrollport).not.toBeNull()
    dispatchPointerEvent(firstImageRoot!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    expect(nextButton?.disabled).toBe(false)
    expect(scrollport?.classList.contains('elce-viewport-scroll-locked')).toBe(true)

    dispatchPointerEvent(nextButton!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    await new Promise<void>((resolve) => setTimeout(resolve, 360))

    expect(stage.querySelector('.elce-carousel-view--visible')?.id).toContain('bdc-expansion-last-image')
    const lastImageRoot = viewportHost?.querySelector<HTMLElement>('[data-elce-viewport-content="image"]')
    expect(lastImageRoot).not.toBeNull()
    expect(firstImageRoot?.getAttribute('aria-pressed')).toBe('false')
    expect(lastImageRoot?.getAttribute('aria-pressed')).toBe('true')
    expect(nextButton?.disabled).toBe(true)

    dispatchPointerEvent(viewportHost!, 'pointerdown')
    dispatchPointerEvent(window, 'pointermove', { movementX: 64 })
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    await new Promise<void>((resolve) => setTimeout(resolve, 360))

    expect(stage.querySelector('.elce-carousel-view--visible')?.id).toContain(firstImageBdcId)
    expect(firstImageRoot?.getAttribute('aria-pressed')).toBe('true')
    expect(lastImageRoot?.getAttribute('aria-pressed')).toBe('false')
    expect(nextButton?.disabled).toBe(false)
    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--closed')).toBe(true)
    expect(scrollport?.classList.contains('elce-viewport-scroll-locked')).toBe(false)
    expect(stage.querySelector('.elce-carousel-view--visible')?.id).toContain(firstImageBdcId)
    expect(document.activeElement).toBe(stage.querySelector('.elce-carousel-view--visible [data-elce-viewport-content="image"]'))
  })

  it('pauses an automatic Carousel while expanded and resumes it on close without a manual selection', async () => {
    const initialDocument = createInitialDocument()
    let documentModel = applyDocumentCommand(initialDocument, {
      type: 'media.add',
      media: { id: 'media-auto-expansion', name: 'auto-expansion.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
    })
    documentModel = applyDocumentCommand(documentModel, createCarouselBdcCommand('bdc-auto-expansion', 'page-a', 1))
    documentModel = applyDocumentCommand(documentModel, createCardBdcCommand(
      'bdc-auto-expansion-last', 'bdc-auto-expansion', 1, DEFAULT_PRESET_ID.PHOTO,
    ))
    const carousel = documentModel.bdcs.find((bdc) => bdc.id === 'bdc-auto-expansion')!
    const firstImageBdcId = carousel.carousel!.cards[0]!.bdcId
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.carousel.update',
      bdcId: 'bdc-auto-expansion',
      carousel: { ...carousel.carousel!, playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC, defaultViewDurationMs: 180, repeatCount: 0 },
    })
    for (const bdcId of [firstImageBdcId, 'bdc-auto-expansion-last']) {
      documentModel = applyDocumentCommand(documentModel, { type: 'bdc.card.layout.set', bdcId, layoutId: DEFAULT_PRESET_ID.PHOTO })
      documentModel = applyDocumentCommand(documentModel, { type: 'bdc.card.media.set', bdcId, mediaId: 'media-auto-expansion' })
    }
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      mediaSources: {
        'media-auto-expansion': 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 3%22%3E%3C/svg%3E',
      },
    })
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    await composition.initialize()

    const viewportHost = stage.querySelector<HTMLElement>('.elce-viewport-expansion-host')
    const views = Array.from(stage.querySelectorAll<HTMLElement>('.elce-carousel-view'))
    const firstView = views.find((view) => view.id.includes(firstImageBdcId))
    const firstImage = firstView?.querySelector<HTMLElement>('[data-elce-viewport-content="image"]')
    const secondView = views.find((view) => view.id.includes('bdc-auto-expansion-last'))
    expect(firstImage).not.toBeNull()
    expect(firstView?.classList.contains('elce-carousel-view--visible')).toBe(true)
    dispatchPointerEvent(firstImage!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)

    await new Promise<void>((resolve) => setTimeout(resolve, 240))
    expect(firstView?.classList.contains('elce-carousel-view--visible')).toBe(true)
    expect(secondView?.classList.contains('elce-carousel-view--hidden')).toBe(true)

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()
    await new Promise<void>((resolve) => setTimeout(resolve, 260))

    expect(secondView?.classList.contains('elce-carousel-view--visible')).toBe(true)

    const secondImage = secondView?.querySelector<HTMLElement>('[data-elce-viewport-content="image"]')
    expect(secondImage).not.toBeNull()
    dispatchPointerEvent(secondImage!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)

    dispatchPointerEvent(viewportHost!, 'pointerdown')
    dispatchPointerEvent(window, 'pointermove', { movementX: 64 })
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    expect(firstView?.classList.contains('elce-carousel-view--visible')).toBe(true)

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()
    await new Promise<void>((resolve) => setTimeout(resolve, 260))

    expect(firstView?.classList.contains('elce-carousel-view--visible')).toBe(true)
  })

  it('mounts an image bdc inside its exported text anchor', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-image-1',  name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const documentModel = applyDocumentCommand(withMedia, {
      type: 'bdc.anchor.create',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      presetId: DEFAULT_PRESET_ID.PHOTO,
      media: { id: 'media-image-1', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
      partId: 'page-a:bdc-image-1:anchor',
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
    expect(flowSlot?.querySelector('.elce-carousel-photo__media img')).not.toBeNull()
    const anchoredCard = flowSlot?.querySelector<HTMLElement>('.elce-flux-card-root')
    expect(anchoredCard?.parentElement).toBe(flowSlot)
    expect(anchoredCard?.style.height).toBe('auto')
    expect(anchoredCard?.style.aspectRatio).toBe('4 / 3')

    const imageRoot = flowSlot?.querySelector<HTMLElement>('[data-elce-viewport-content="image"]')
    const viewportHost = stage.querySelector<HTMLElement>('.elce-viewport-expansion-host')
    const flowReservation = flowSlot?.getAttribute('style')
    expect(imageRoot).not.toBeNull()
    dispatchPointerEvent(imageRoot!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    expect(flowSlot?.getAttribute('style')).toBe(flowReservation)

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--closed')).toBe(true)
    expect(imageRoot?.closest('.elce-flux-card-root')).not.toBeNull()
    expect(document.activeElement).toBe(imageRoot)
  })

  it('opens and closes a direct Diapo image through the shared viewport move', async () => {
    const initialDocument = createInitialDocument()
    const withMedia = applyDocumentCommand(initialDocument, {
      type: 'media.add',
      media: { id: 'media-diapo-direct-expansion', name: 'diapo-direct.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
    })
    const diapoCommand = createDefaultPageCommand(
      withMedia,
      { kind: PAGE_LOCATION.SCENARIO },
      'Diapo image directe',
      PAGE_TYPE.DIAPO,
    )
    let documentModel = applyDocumentCommand(withMedia, diapoCommand)
    documentModel = applyDocumentCommand(documentModel, { type: 'bdc.carousel.delete', bdcId: diapoCommand.bdcId })
    documentModel = applyDocumentCommand(documentModel, createStandaloneCardBdcCommand(
      'bdc-diapo-direct-expansion', diapoCommand.pageId, DEFAULT_PRESET_ID.PHOTO,
    ))
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.card.media.set', bdcId: 'bdc-diapo-direct-expansion', mediaId: 'media-diapo-direct-expansion',
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      startPageId: diapoCommand.pageId,
      mediaSources: {
        'media-diapo-direct-expansion': 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 3%22%3E%3C/svg%3E',
      },
    })
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    await composition.initialize()

    const imageRoot = stage.querySelector<HTMLElement>('[data-elce-viewport-content="image"]')
    const viewportHost = stage.querySelector<HTMLElement>('.elce-viewport-expansion-host')
    expect(imageRoot).not.toBeNull()
    dispatchPointerEvent(imageRoot!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--closed')).toBe(true)
    expect(document.activeElement).toBe(imageRoot)
  })

  it('opens and closes a Diapo Question illustration in its owning story', async () => {
    const initialDocument = createInitialDocument()
    const withMedia = applyDocumentCommand(initialDocument, {
      type: 'media.add',
      media: { id: 'media-diapo-question-expansion', name: 'question.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
    })
    const diapoCommand = createDefaultPageCommand(
      withMedia,
      { kind: PAGE_LOCATION.SCENARIO },
      'Diapo Question image',
      PAGE_TYPE.DIAPO,
    )
    let documentModel = applyDocumentCommand(withMedia, diapoCommand)
    documentModel = applyDocumentCommand(documentModel, { type: 'bdc.carousel.delete', bdcId: diapoCommand.bdcId })
    documentModel = applyDocumentCommand(documentModel, createQuestionBdcCommand(
      'bdc-diapo-question-expansion', diapoCommand.pageId, 0,
    ))
    documentModel = applyDocumentCommand(documentModel, {
      type: 'bdc.question.media.set', bdcId: 'bdc-diapo-question-expansion', mediaId: 'media-diapo-question-expansion',
    })
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new ElcePlayerComposition({
      stage,
      document: documentModel,
      startPageId: diapoCommand.pageId,
      mediaSources: {
        'media-diapo-question-expansion': 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 3%22%3E%3C/svg%3E',
      },
    })
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)

    await composition.initialize()

    const imageRoot = stage.querySelector<HTMLElement>('[data-elce-viewport-content="image"]')
    const viewportHost = stage.querySelector<HTMLElement>('.elce-viewport-expansion-host')
    expect(imageRoot).not.toBeNull()
    dispatchPointerEvent(imageRoot!, 'pointerdown')
    dispatchPointerEvent(window, 'pointerup')
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--open')).toBe(true)

    viewportHost?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Escape', key: 'Escape' }))
    await new Promise<void>((resolve) => setTimeout(resolve, 360))
    viewportHost?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    await waitForPlayerActions()
    expect(viewportHost?.classList.contains('elce-viewport-expansion-host--closed')).toBe(true)
    expect(document.activeElement).toBe(imageRoot)
  })

  it('mounts a simple video bdc through the real CodPlay media component', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const stage = document.createElement('div')
    document.body.append(stage)
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-video-1',  name: 'video.mp4', mimeType: 'video/mp4', size: 10, caption: '' },
    })
    const documentModel = createCardWithMedia(withMedia, 'bdc-video-1', 'media-video-1')
    composition = new ElcePlayerComposition({ stage, document: documentModel, mediaSources: { 'media-video-1': 'blob:video-1' } })

    await composition.initialize()

    expect(stage.querySelector('.elce-carousel-photo__media video')).not.toBeNull()
  })

  it('stops an independent video on page exit and reuses it at zero on return', async () => {
    let frameTime = performance.now()
    const paused = new WeakMap<HTMLMediaElement, boolean>()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      paused.set(this, false)
      return Promise.resolve()
    })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
      paused.set(this, true)
    })
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(function (this: HTMLMediaElement) {
      return paused.get(this) ?? true
    })
    const pendingFrames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback)
      return pendingFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
    let documentModel = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'owned-video', name: 'owned.mp4', mimeType: 'video/mp4', size: 10, caption: '' },
    })
    documentModel = createCardWithMedia(documentModel, 'owned-card', 'owned-video')
    documentModel = applyDocumentCommand(documentModel, createPageCommand({
      pageId: 'page-b', bdcId: 'owned-section-b', name: 'Page B',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
    }))
    const stage = document.createElement('div')
    document.body.append(stage)
    const errors: string[] = []
    composition = new ElcePlayerComposition({
      stage, document: documentModel, mediaSources: { 'owned-video': 'blob:owned-video' },
      onLog: (message, level) => { if (level === 'error') errors.push(message) },
    })
    await composition.initialize()
    const video = stage.querySelector('video')!
    const source = video.src
    await video.play()
    video.currentTime = 3.8
    const marker = stage.querySelector('#page-a-bottom-marker')!
    const observer = ControlledIntersectionObserver.instances.find((candidate) => candidate.targets.has(marker))!
    observer.deliver({ target: marker, intersectionRatio: 1, isIntersecting: true })
    await vi.waitFor(() => {
      frameTime += 50
      flushPendingFrames(pendingFrames, frameTime)
      expect(stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')?.disabled).toBe(false)
    })
    stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button--next')!.click()
    await new Promise((resolve) => setTimeout(resolve, 100))
    flushPendingFrames(pendingFrames, frameTime += 50)
    await vi.waitFor(() => {
      frameTime += 50
      flushPendingFrames(pendingFrames, frameTime)
      expect(stage.querySelector('#page-b-scrollport')).not.toBeNull()
      expect(video.paused).toBe(true)
      expect(video.currentTime).toBe(0)
    })
    await new Promise((resolve) => setTimeout(resolve, 100))
    flushPendingFrames(pendingFrames, frameTime += 50)
    const previous = stage.querySelector<HTMLButtonElement>('.elce-player-navigation__button:not(.elce-player-navigation__button--next)')!
    expect(previous.disabled).toBe(false)
    previous.click()
    await new Promise((resolve) => setTimeout(resolve, 100))
    await vi.waitFor(() => {
      frameTime += 50
      flushPendingFrames(pendingFrames, frameTime)
      expect(stage.querySelector('#page-a-scrollport')).not.toBeNull()
    })
    expect(stage.querySelector('video')).toBe(video)
    expect(video.src).toBe(source)
    expect(video.currentTime).toBe(0)
    expect(video.paused).toBe(true)
    expect(errors).toEqual([])
  })
})

/** Creates a directly placed Photo Card whose media reference belongs to Card data. */
function createCardWithMedia(document: ReturnType<typeof createInitialDocument>, bdcId: string, mediaId: string) {
  const created = applyDocumentCommand(document, {
    type: 'bdc.create',
    bdcId,
    bdcType: BDC_TYPE.CARD,
    presetId: 'photo-basic',
    placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
  })
  return applyDocumentCommand(created, { type: 'bdc.card.media.set', bdcId, mediaId })
}

/** Creates an Evaluation chapter with Page F and G, optionally preceded by another Question. */
function createEvaluationQuestionPages(precedingQuestionName?: string) {
  const initialDocument = createInitialDocument()
  let documentModel = applyDocumentCommand(initialDocument, createChapterCommand(
    initialDocument,
    'Évaluation',
    CHAPTER_TYPE.EVALUATION,
  ))
  const evaluationChapterId = documentModel.chapters.at(-1)!.id
  const placement = { kind: PAGE_LOCATION.CHAPTER, chapterId: evaluationChapterId } as const
  const precedingQuestion = precedingQuestionName === undefined
    ? undefined
    : createDefaultPageCommand(documentModel, placement, precedingQuestionName)
  if (precedingQuestion !== undefined) documentModel = applyDocumentCommand(documentModel, precedingQuestion)
  const pageF = createDefaultPageCommand(documentModel, placement, 'Page F')
  documentModel = applyDocumentCommand(documentModel, pageF)
  const pageG = createDefaultPageCommand(documentModel, placement, 'Page G')
  documentModel = applyDocumentCommand(documentModel, pageG)
  documentModel = applyDocumentCommand(documentModel, { type: 'bdc.question.delete', bdcId: pageG.bdcId })
  documentModel = applyDocumentCommand(documentModel, createSectionBdcCommand('bdc-result-text-g', pageG.pageId, 0))
  documentModel = applyDocumentCommand(documentModel, createEvaluationResultBdcCommand(
    'bdc-result-g',
    pageG.pageId,
    1,
  ))
  documentModel = applyDocumentCommand(documentModel, {
    type: 'bdc.evaluation-result.update',
    bdcId: 'bdc-result-g',
    evaluationResult: {
      success: { message: 'Évaluation réussie.', action: null },
      failure: { message: 'Évaluation à reprendre.', action: null },
    },
  })
  return {
    documentModel,
    pageFId: pageF.pageId,
    precedingQuestionPageId: precedingQuestion?.pageId,
  }
}

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
