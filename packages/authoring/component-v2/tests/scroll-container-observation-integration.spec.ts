// @vitest-environment jsdom
import { SceneBuilder } from 'codplay/scene/compiled'
import type { SceneDoc } from 'codplay/scene/types'
import { createCoreRuntimeCatalog } from 'codplay/runtime/catalog'
import type { Ticker } from 'codplay/runtime/engine'
import { HtmlPlayerRunner } from 'codplay/runtime/runner-html'
import { afterEach, expect, it, vi } from 'vitest'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
  createScrollContainerSourceAdapter,
} from '../src/scroll-container'

type ObservationEntry = Pick<IntersectionObserverEntry, 'target' | 'intersectionRatio' | 'isIntersecting'>

/** Controls native observation callbacks without replacing the HTML player path. */
class ControlledIntersectionObserver {
  static readonly instances: ControlledIntersectionObserver[] = []
  readonly targets = new Set<Element>()
  private readonly callback: IntersectionObserverCallback

  /** Registers one observer and retains its native callback for deterministic tests. */
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    ControlledIntersectionObserver.instances.push(this)
  }

  /** Starts observing one materialized target. */
  observe(target: Element): void {
    this.targets.add(target)
  }

  /** Stops the observer and clears its observed target set. */
  disconnect(): void {
    this.targets.clear()
  }

  /** Delivers one native-shaped entry to the actual scroll source adapter. */
  deliver(entry: ObservationEntry): void {
    this.callback([entry as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

afterEach(() => {
  ControlledIntersectionObserver.instances.length = 0
  vi.unstubAllGlobals()
})

/** Creates a small scene with one ratio-driven title and one animated image. */
function createObservationScene(): SceneDoc<string> {
  return {
    id: 'scroll-observation-reset',
    stories: {
      story: {
        id: 'story',
        initial: { move: '@root' },
        persos: [
          {
            id: 'viewport',
            type: 'scroll-container',
            initial: {
              tag: 'section',
              style: { height: '100px', overflowY: 'auto' },
              move: '@root',
            },
          },
          {
            id: 'heading',
            type: 'tag',
            initial: {
              tag: 'h2',
              content: 'Section',
              style: { backgroundColor: 'rgb(0, 0, 0)' },
              move: { target: 'viewport' },
            },
            emit: {
              observe: {
                liveAction: 'heading:color',
                zone: { threshold: [0, 0.5, 1] },
              },
            },
            actions: {
              'heading:color': {
                duration: 1,
                fn: (input: { data: Readonly<Record<string, unknown>> }) => ({
                  style: {
                    backgroundColor: Number(input.data.ratio) > 0.5
                      ? 'rgb(0, 0, 255)'
                      : 'rgb(255, 0, 0)',
                  },
                }),
              },
            },
          },
          {
            id: 'image-frame',
            type: 'tag',
            initial: {
              tag: 'figure',
              move: { target: 'viewport' },
            },
            emit: {
              observe: {
                zone: { threshold: 0 },
                enter: [{ name: 'image:enter' }],
                leave: [{ name: 'image:leave' }],
              },
            },
          },
          {
            id: 'image',
            type: 'img',
            initial: {
              src: '/image.png',
              style: { translateX: '0%' },
              img: { style: { display: 'block', width: '100%' } },
              move: { target: 'image-frame' },
            },
            actions: {
              'image:enter': {
                style: { translateX: { from: '-112%', to: '0%', duration: 1000, ease: 'linear' } },
              },
              'image:leave': {
                style: { translateX: { from: '0%', to: '-112%', duration: 820, ease: 'linear' } },
              },
            },
          },
        ],
      },
    },
  }
}

/** Creates a real HtmlPlayerRunner with the optional scroll observation adapter. */
function createObservationRunner(root: HTMLElement): HtmlPlayerRunner {
  const catalog = createCoreRuntimeCatalog()
  catalog.registerComponent(SCROLL_CONTAINER_COMPONENT_DEFINITION)
  catalog.registerModule(SCROLL_CONTAINER_MODULE_DEFINITION)
  const build = new SceneBuilder(catalog.validationSnapshot()).build(createObservationScene())
  if (!build.ok) throw new Error(build.diagnostics.errors.map((issue) => issue.message).join('\n'))
  return new HtmlPlayerRunner({
    id: 'scroll-observation-reset',
    compiledScene: build.compiledScene,
    functions: build.functions,
    root,
    catalog,
    resources: ['/image.png'],
    sourceAdapterFactories: [createScrollContainerSourceAdapter],
  })
}

/** Returns the most recently attached observer that watches one target. */
function observerFor(target: Element): ControlledIntersectionObserver {
  const observer = [...ControlledIntersectionObserver.instances].reverse().find((candidate) => candidate.targets.has(target))
  if (observer === undefined) throw new Error('No active IntersectionObserver watches the requested target.')
  return observer
}

/** Creates a ticker that changes lifecycle state without advancing time. */
function stoppedTicker(): Ticker {
  return { start: () => undefined, stop: () => undefined, isRunning: () => false }
}

/** Delivers one observation and allows the asynchronous event dispatcher to settle. */
async function deliverAndSettle(
  observer: ControlledIntersectionObserver,
  target: Element,
  isIntersecting: boolean,
  ratio: number,
): Promise<void> {
  observer.deliver({ target, isIntersecting, intersectionRatio: ratio })
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}

it('resynchronizes observations after reset while retaining title live actions and later image transitions', async () => {
  vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
  const root = document.createElement('div')
  document.body.append(root)
  const runner = createObservationRunner(root)

  expect(runner.init().ok).toBe(true)
  runner.play(stoppedTicker())
  const heading = runner.getPersoNode('story:heading') as HTMLElement
  const imageFrame = runner.getPersoNode('story:image-frame') as HTMLElement
  const image = runner.getPersoNode('story:image') as HTMLElement
  const imageObserver = observerFor(imageFrame)
  const headingObserver = observerFor(heading)

  expect(image.style.transform).toBe('translateX(0%)')
  await deliverAndSettle(imageObserver, imageFrame, true, 1)
  expect(runner.player.trackJournal.getAllEvents().map((event) => event.name)).not.toContain('image:enter')
  expect(image.style.transform).toBe('translateX(0%)')
  await deliverAndSettle(imageObserver, imageFrame, false, 0)
  await deliverAndSettle(headingObserver, heading, true, 0.25)
  expect(heading.style.backgroundColor).toBe('rgb(255, 0, 0)')

  runner.reset()
  runner.play(stoppedTicker())
  const resetImageObserver = observerFor(imageFrame)
  const resetHeadingObserver = observerFor(heading)

  await deliverAndSettle(imageObserver, imageFrame, false, 0)
  await deliverAndSettle(headingObserver, heading, true, 0.25)
  expect(runner.player.trackJournal.getAllEvents().map((event) => event.name)).not.toContain('image:enter')
  expect(heading.style.backgroundColor).toBe('rgb(0, 0, 0)')

  await deliverAndSettle(resetImageObserver, imageFrame, true, 1)
  await deliverAndSettle(resetHeadingObserver, heading, true, 1)
  expect(runner.player.trackJournal.getAllEvents().map((event) => event.name)).not.toContain('image:enter')
  expect(heading.style.backgroundColor).toBe('rgb(0, 0, 255)')

  await deliverAndSettle(resetImageObserver, imageFrame, false, 0)
  await deliverAndSettle(resetImageObserver, imageFrame, true, 1)
  expect(runner.player.trackJournal.getAllEvents().map((event) => event.name)).toEqual([
    'image:leave',
    'image:enter',
  ])

  runner.destroy()
  root.remove()
})
