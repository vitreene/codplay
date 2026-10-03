/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LayoutFlowReservationController } from '../../../src/runtime/components/layout/layout-flow-reservation'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'

class TestResizeObserver {
  static current: TestResizeObserver | null = null
  private readonly callback: ResizeObserverCallback
  disconnect = vi.fn()

  /** Stores the callback used to simulate a real width notification. */
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    TestResizeObserver.current = this
  }

  /** Accepts the observed element without creating a second layout circuit. */
  observe(): void {}

  /** Delivers one content-box width change to the component. */
  notify(width: number): void {
    this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

let runner: HtmlPlayerRunner | undefined

afterEach(() => {
  runner?.destroy()
  runner = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Range.prototype, 'getClientRects')
  document.body.replaceChildren()
  TestResizeObserver.current = null
})

describe('layout flow reservation', () => {
  it('waits for CodPlay attachment, then reuses the same part after its visual line on resize', async () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    const root = document.createElement('article')
    root.innerHTML = '<p id="text">Before <span id="slot"><img id="media"></span> after line</p>'
    const slot = root.querySelector<HTMLElement>('#slot')!
    const media = root.querySelector<HTMLImageElement>('#media')!
    const paragraph = root.querySelector<HTMLElement>('#text')!
    const originalBefore = slot.previousSibling?.textContent
    let nextLineOffset = 7

    vi.spyOn(slot, 'getClientRects').mockReturnValue([{ top: 10 }] as unknown as DOMRectList)
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: function (this: Range) {
        const top = this.startContainer.textContent?.includes('after') && this.startOffset >= nextLineOffset ? 30 : 10
        return [{ top }] as unknown as DOMRectList
      },
    })

    const controller = new LayoutFlowReservationController(root, [{ partId: 'slot', blockSize: '75%' }], () => slot)
    await Promise.resolve()
    expect(slot.parentElement).toBe(paragraph)
    expect(slot.previousSibling?.textContent).toBe(originalBefore)

    document.body.append(root)
    TestResizeObserver.current!.notify(500)
    await Promise.resolve()
    expect(slot.previousSibling?.textContent).toBe(' after ')
    expect(slot.nextSibling?.textContent).toBe('line')
    expect(slot.contains(media)).toBe(true)
    expect(slot.style.float).toBe('left')
    expect(slot.style.paddingBottom).toBe('75%')

    nextLineOffset = 3
    TestResizeObserver.current!.notify(300)
    await Promise.resolve()
    expect(slot.previousSibling?.textContent).toBe(' af')
    expect(paragraph.textContent).toBe('Before  after line')
    expect(paragraph.querySelectorAll('#slot')).toHaveLength(1)
    expect(slot.contains(media)).toBe(true)

    controller.destroy()
    expect(TestResizeObserver.current!.disconnect).toHaveBeenCalledOnce()
  })

  it('preserves each original insertion point when multiple reservations are refreshed', async () => {
    const root = document.createElement('article')
    root.innerHTML = '<p id="text">Before <span id="slot-a"></span> alpha <span id="slot-b"></span> omega after</p>'
    const paragraph = root.querySelector<HTMLElement>('#text')!
    const first = root.querySelector<HTMLElement>('#slot-a')!
    const second = root.querySelector<HTMLElement>('#slot-b')!

    vi.spyOn(first, 'getClientRects').mockReturnValue([{ top: 10 }] as unknown as DOMRectList)
    vi.spyOn(second, 'getClientRects').mockReturnValue([{ top: 10 }] as unknown as DOMRectList)
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: function (this: Range) {
        const text = this.startContainer.textContent ?? ''
        const nextLine = (text.includes('alpha') && this.startOffset >= 2)
          || (text.includes('omega') && this.startOffset >= 3)
        return [{ top: nextLine ? 30 : 10 }] as unknown as DOMRectList
      },
    })

    document.body.append(root)
    const controller = new LayoutFlowReservationController(root, [
      { partId: 'slot-a', blockSize: '100px' },
      { partId: 'slot-b', blockSize: '100px' },
    ], (partId) => root.querySelector(`#${partId}`))
    await Promise.resolve()

    expect(first.previousSibling?.textContent).toBe(' a')
    expect(second.previousSibling?.textContent).toBe(' om')

    controller.refresh()
    await Promise.resolve()

    expect(first.previousSibling?.textContent).toBe(' a')
    expect(second.previousSibling?.textContent).toBe(' om')
    expect(paragraph.textContent).toBe('Before  alpha  omega after')
    expect(paragraph.querySelectorAll('#slot-a, #slot-b')).toHaveLength(2)
    controller.destroy()
  })

  it('keeps the same two-slot scene after the real runner seeks back to its start', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const built = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'layout-flow-replay-scene',
      stories: {
        main: {
          id: 'main',
          persos: [
            {
              id: 'flow-layout',
              type: 'layout',
              initial: {
                move: '@root',
                markup: '<article id="flow-root"><p id="flow-text">Before <span id="slot-a" data-part="slot-a"></span> alpha <span id="slot-b" data-part="slot-b"></span> omega after</p></article>',
                flowReservations: [
                  { partId: 'slot-a', blockSize: '100px' },
                  { partId: 'slot-b', blockSize: '100px' },
                ],
              },
            },
            { id: 'media-a', type: 'tag', initial: { tag: 'strong', content: 'media-a', move: { target: 'slot-a' } } },
            { id: 'media-b', type: 'tag', initial: { tag: 'strong', content: 'media-b', move: { target: 'slot-b' } } },
          ],
        },
      },
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return

    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
      return this.matches('#slot-a, #slot-b') ? [{ top: 10 }] as unknown as DOMRectList : [] as unknown as DOMRectList
    })
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: function (this: Range) {
        const text = this.startContainer.textContent ?? ''
        const nextLine = (text.includes('alpha') && this.startOffset >= 2)
          || (text.includes('omega') && this.startOffset >= 3)
        return [{ top: nextLine ? 30 : 10 }] as unknown as DOMRectList
      },
    })

    const refresh = vi.spyOn(LayoutFlowReservationController.prototype, 'refresh')
    runner = new HtmlPlayerRunner({ id: 'layout-flow-replay-runner', compiledScene: built.compiledScene, root, catalog })
    expect(runner.init().ok).toBe(true)
    await Promise.resolve()

    const first = root.querySelector<HTMLElement>('#slot-a')!
    const second = root.querySelector<HTMLElement>('#slot-b')!
    const firstMedia = runner.getPersoNode('main:media-a')
    const secondMedia = runner.getPersoNode('main:media-b')
    expect(first.previousSibling?.textContent).toBe(' a')
    expect(second.previousSibling?.textContent).toBe(' om')
    expect(first.firstElementChild).toBe(firstMedia)
    expect(second.firstElementChild).toBe(secondMedia)

    expect(runner.seek(0).ok).toBe(true)
    await Promise.resolve()

    expect(first.previousSibling?.textContent).toBe(' a')
    expect(second.previousSibling?.textContent).toBe(' om')
    expect(first.firstElementChild).toBe(firstMedia)
    expect(second.firstElementChild).toBe(secondMedia)
    expect(refresh).toHaveBeenCalledOnce()
    const authoredText = Array.from(root.querySelector('#flow-text')!.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('')
    expect(authoredText).toBe('Before  alpha  omega after')
    expect(root.querySelectorAll('#slot-a, #slot-b')).toHaveLength(2)
  })
})
