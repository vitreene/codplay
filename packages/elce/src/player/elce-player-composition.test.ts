/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { BDC_LOCATION, BDC_TYPE, PAGE_LOCATION } from '../config/document-config'
import { applyDocumentCommand, createPageCommand } from '../app/commands/document-commands'
import { createInitialDocument } from '../domain/document-model'
import { ElcePlayerComposition } from './elce-player-composition'

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
function flushPendingFrames(pendingFrames: FrameRequestCallback[]): void {
  const callbacks = pendingFrames.splice(0)
  for (const callback of callbacks) callback(0)
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

  it('mounts a page at the editor scenario root in the root content slot', async () => {
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

    const anchor = stage.querySelector('[data-bdc-id="bdc-image-1"]')
    expect(anchor).not.toBeNull()
    expect(anchor?.querySelector('.elce-flux-image img')).not.toBeNull()
    expect(anchor?.querySelector('.elce-flux-image')?.parentElement).toBe(anchor)
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
