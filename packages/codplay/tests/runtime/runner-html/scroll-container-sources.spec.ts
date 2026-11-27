/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeCaptureSourcePort, RuntimeCaptureSourceSession } from '../../../src/runtime/capture'
import { ScrollContainerComponent } from '../../../src/runtime/components/scroll-container'
import type { HtmlSourceAdapterContext } from '../../../src/runtime/runner-html'
import {
  HtmlScrollProgressSource,
  ScrollObservationPhases,
  calculateScrollProgress,
  type ScrollObservationRule,
} from '../../../src/runtime/runner-html/scroll-container'
import type { CompiledScene } from '../../../src/scene/compiled'

/** Scrollport stand-in that records its listeners and exposes writable scroll geometry. */
class TestElement extends EventTarget {
  scrollTop = 25
  scrollLeft = 0
  scrollHeight = 200
  scrollWidth = 0
  clientHeight = 100
  clientWidth = 0
  readonly added: string[] = []
  readonly removed: string[] = []

  /** Records one listener attached by the source. */
  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
    this.added.push(type)
    super.addEventListener(type, callback, options)
  }

  /** Records one listener removed by the source. */
  override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
    this.removed.push(type)
    super.removeEventListener(type, callback, options)
  }
}

/** Creates a capture session double that records the samples it receives. */
function createSession(): RuntimeCaptureSourceSession {
  return {
    captureId: 'story:viewport:scroll:0',
    getCaptureState: () => ({}),
    track: vi.fn(),
    route: vi.fn(),
    end: vi.fn(async () => undefined),
    cancel: vi.fn(),
  } as unknown as RuntimeCaptureSourceSession
}

/** Creates one progress source over a single scroll-container perso that declares a scroll capture. */
function createSource(element: TestElement, session: RuntimeCaptureSourceSession) {
  const open = vi.fn((..._args: readonly unknown[]) => [session])
  const captureSources = { open, hasRules: () => true } as unknown as RuntimeCaptureSourcePort
  const compiledScene = {
    scene: { stories: { story: { persos: [{ id: 'viewport', type: 'scroll-container', initial: { tag: 'section' } }] } } },
  } as unknown as CompiledScene
  const context = {
    compiledScene,
    resolvePersoElement: (key: string) => (key === 'story:viewport' ? element as unknown as Element : undefined),
  } as unknown as HtmlSourceAdapterContext
  return { source: new HtmlScrollProgressSource(context, captureSources), open }
}

/** Replaces the frame scheduler so each coalesced presentation runs on demand. */
function stubFrames(): { flush: () => void } {
  let pending: FrameRequestCallback | undefined
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending = callback
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  return { flush: () => pending?.(0) }
}

/** Creates one serialized event declaration for a test observation rule. */
function rule(id: string, name: string, initial?: 'enter' | 'leave'): ScrollObservationRule {
  return {
    id,
    persoId: `target-${id}`,
    storyId: 'story',
    declaration: {
      ...(initial === undefined ? {} : { initial }),
      zone: { threshold: 0.5 },
      enter: [{ name: `${name}:enter` }],
      leave: [{ name: `${name}:leave` }],
    },
  }
}

/** Applies one phase batch and keeps only the selected event names. */
function eventsOf(phases: ScrollObservationPhases, updates: ReadonlyArray<Readonly<{ ruleId: string; phase: 'inside' | 'outside' }>>): string[] {
  return phases.update(updates.map((update) => ({ ...update, ratio: 0 }))).emissions.map((emission) => emission.event.name)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('scroll progress source', () => {
  it('normalizes the progress and clamps it to the scrollable extent', () => {
    expect(calculateScrollProgress({ offset: 40, extent: 300, viewportExtent: 100 })).toBe(0.2)
    expect(calculateScrollProgress({ offset: -20, extent: 300, viewportExtent: 100 })).toBe(0)
    expect(calculateScrollProgress({ offset: 400, extent: 300, viewportExtent: 100 })).toBe(1)
    expect(calculateScrollProgress({ offset: 10, extent: 100, viewportExtent: 100 })).toBe(0)
    expect(calculateScrollProgress({ offset: Number.NaN, extent: 100, viewportExtent: 20 })).toBe(0)
  })

  it('attaches to the scrollport and routes coalesced progress and scrollend through the capture circuit', () => {
    const frames = stubFrames()
    const element = new TestElement()
    const session = createSession()
    const { source, open } = createSource(element, session)

    source.attach()
    expect(element.added.filter((type) => type.startsWith('scroll'))).toEqual(['scroll', 'scrollend'])
    frames.flush()
    expect(open.mock.calls[0]?.[0]).toMatchObject({ storyId: 'story', persoId: 'viewport', source: 'scroll' })
    expect(session.track).toHaveBeenCalledWith({ progress: 0.25 })

    element.scrollTop = 30
    element.dispatchEvent(new Event('scroll'))
    element.scrollTop = 50
    element.dispatchEvent(new Event('scroll'))
    frames.flush()
    expect(session.track).toHaveBeenLastCalledWith({ progress: 0.5 })
    expect(session.track).toHaveBeenCalledTimes(2)
    element.dispatchEvent(new Event('scrollend'))
    expect(session.end).toHaveBeenCalledWith({ source: 'scroll', eventType: 'scrollend' })

    source.onSequenceEnd()
    expect(element.removed.filter((type) => type.startsWith('scroll'))).toEqual(['scroll', 'scrollend'])
    source.onReset()
    expect(element.added.filter((type) => type.startsWith('scroll'))).toEqual(['scroll', 'scrollend', 'scroll', 'scrollend'])
    source.destroy()
  })

  it('cancels an open session during seek and detaches its listeners at destruction', () => {
    const frames = stubFrames()
    const element = new TestElement()
    const session = createSession()
    const { source } = createSource(element, session)

    source.attach()
    frames.flush()
    source.beforeSeek()
    expect(session.cancel).toHaveBeenCalledTimes(1)
    source.destroy()
    expect(element.removed.filter((type) => type.startsWith('scroll'))).toEqual(['scroll', 'scrollend'])
  })
})

describe('scroll-container component', () => {
  it('resets only the configured inline axis', () => {
    const component = new ScrollContainerComponent({
      services: { declare: vi.fn(), get: vi.fn(), apply: vi.fn() },
      perso: { id: 'viewport', storyId: 'story', initial: { tag: 'section', values: { progress: { axis: 'inline' } } } },
    })
    const element = document.createElement('section')
    element.scrollLeft = 64
    element.scrollTop = 25
    component._materialize(element, [])

    component.onReset()

    expect(element.scrollLeft).toBe(0)
    expect(element.scrollTop).toBe(25)
  })
})

describe('scroll observation phases', () => {
  it('silences the first phase and orders later events by declaration', () => {
    const phases = new ScrollObservationPhases([rule('first-rule', 'first'), rule('second-rule', 'second')])
    phases.attach()

    expect(eventsOf(phases, [{ ruleId: 'second-rule', phase: 'outside' }, { ruleId: 'first-rule', phase: 'outside' }])).toEqual([])
    expect(eventsOf(phases, [{ ruleId: 'second-rule', phase: 'inside' }, { ruleId: 'first-rule', phase: 'inside' }]))
      .toEqual(['first:enter', 'second:enter'])
    expect(eventsOf(phases, [{ ruleId: 'second-rule', phase: 'outside' }, { ruleId: 'first-rule', phase: 'outside' }]))
      .toEqual(['first:leave', 'second:leave'])
    expect(eventsOf(phases, [{ ruleId: 'first-rule', phase: 'inside' }])).toEqual(['first:enter'])
    phases.detach()
    phases.attach()
    expect(eventsOf(phases, [{ ruleId: 'second-rule', phase: 'inside' }])).toEqual([])
  })

  it('emits only the declared matching phase on the first observation', () => {
    const phases = new ScrollObservationPhases([rule('enter-rule', 'enter', 'enter'), rule('leave-rule', 'leave', 'leave')])
    phases.attach()

    expect(eventsOf(phases, [{ ruleId: 'enter-rule', phase: 'inside' }, { ruleId: 'leave-rule', phase: 'inside' }]))
      .toEqual(['enter:enter'])
    expect(eventsOf(phases, [{ ruleId: 'enter-rule', phase: 'outside' }, { ruleId: 'leave-rule', phase: 'outside' }]))
      .toEqual(['enter:leave', 'leave:leave'])
  })
})
