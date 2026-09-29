import type { RuntimeCaptureSourcePort, RuntimeCaptureSourceSession } from 'codplay/runtime/capture'
import { afterEach, expect, it, vi } from 'vitest'
import { ScrollContainerComponent } from '../src/scroll-container/scroll-container-component'

class TestElement extends EventTarget {
  readonly ownerDocument = {}
  scrollTop = 25
  scrollLeft = 0
  scrollHeight = 200
  clientHeight = 100
  readonly addCalls: Array<Readonly<{ type: string; listener: EventListenerOrEventListenerObject; options?: AddEventListenerOptions | boolean }>> = []
  readonly removeCalls: Array<Readonly<{ type: string; listener: EventListenerOrEventListenerObject }>> = []

  /** Supplies the geometry required by the shared measurable element guard. */
  getBoundingClientRect(): DOMRect {
    return {} as DOMRect
  }

  /** Records the listener attached to this materialized component root. */
  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    if (callback !== null) this.addCalls.push({ type, listener: callback, options })
    super.addEventListener(type, callback, options)
  }

  /** Records source listener removal at component lifecycle boundaries. */
  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    if (callback !== null) this.removeCalls.push({ type, listener: callback })
    super.removeEventListener(type, callback, options)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('attaches to the materialized root in initialize and routes progress and scrollend through the shared circuit', () => {
  vi.stubGlobal('Element', TestElement)
  let pendingFrame: FrameRequestCallback | undefined
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pendingFrame = callback
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const element = new TestElement()
  const session = {
    captureId: 'story:viewport:scroll:0',
    getCaptureState: () => ({}),
    track: vi.fn(),
    route: vi.fn(),
    end: vi.fn(async () => undefined),
    cancel: vi.fn(),
  } satisfies RuntimeCaptureSourceSession
  const open = vi.fn((..._args: readonly unknown[]) => [session])
  const captureSources = {
    open,
    hasRules: () => true,
    resolveIdentity: () => undefined,
    getEventTypes: () => [],
    cancelAll: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn(),
  } as unknown as RuntimeCaptureSourcePort
  const component = new ScrollContainerComponent({
    services: {
      declare: vi.fn(),
      get: vi.fn(),
      apply: vi.fn(),
    },
    captureSources,
    perso: {
      id: 'viewport',
      storyId: 'story',
      initial: { tag: 'section', values: { progress: { axis: 'block' } } } as never,
    },
  })
  component._materialize(element, [])

  component.initialize()

  expect(element.addCalls.map(({ type }) => type)).toEqual(['scroll', 'scrollend'])
  expect(element.addCalls[0]?.options).toEqual({ passive: true })
  pendingFrame?.(0)
  expect(open.mock.calls[0]?.[0]).toMatchObject({
    storyId: 'story',
    persoId: 'viewport',
    source: 'scroll',
  })
  expect(session.track).toHaveBeenCalledWith({ progress: 0.25 })

  element.scrollTop = 50
  element.dispatchEvent(new Event('scroll'))
  pendingFrame?.(16)
  expect(session.track).toHaveBeenLastCalledWith({ progress: 0.5 })
  element.dispatchEvent(new Event('scrollend'))
  expect(session.end).toHaveBeenCalledWith({ source: 'scroll', eventType: 'scrollend' })

  component.onSequenceEnd()
  expect(element.removeCalls.map(({ type }) => type)).toEqual(['scroll', 'scrollend'])
  element.scrollTop = 86
  component.onReset()
  expect(element.scrollTop).toBe(0)
  expect(element.addCalls.map(({ type }) => type)).toEqual(['scroll', 'scrollend', 'scroll', 'scrollend'])
  component.destroy()
})

it('resets the configured inline scroll axis without changing the vertical offset', () => {
  vi.stubGlobal('Element', TestElement)
  const element = new TestElement()
  element.scrollLeft = 64
  const captureSources = {
    open: vi.fn(() => []),
    hasRules: () => true,
    resolveIdentity: () => undefined,
    getEventTypes: () => [],
    cancelAll: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn(),
  } as unknown as RuntimeCaptureSourcePort
  const component = new ScrollContainerComponent({
    services: { declare: vi.fn(), get: vi.fn(), apply: vi.fn() },
    captureSources,
    perso: {
      id: 'viewport',
      storyId: 'story',
      initial: { tag: 'section', values: { progress: { axis: 'inline' } } } as never,
    },
  })
  component._materialize(element, [])
  component.initialize()

  component.onReset()

  expect(element.scrollLeft).toBe(0)
  expect(element.scrollTop).toBe(25)
  component.destroy()
})

it('cancels an open source during seek and detaches its node listeners at destruction', () => {
  vi.stubGlobal('Element', TestElement)
  let pendingFrame: FrameRequestCallback | undefined
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pendingFrame = callback
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const element = new TestElement()
  const session = {
    captureId: 'story:viewport:scroll:0',
    getCaptureState: () => ({}),
    track: vi.fn(),
    route: vi.fn(),
    end: vi.fn(async () => undefined),
    cancel: vi.fn(),
  } satisfies RuntimeCaptureSourceSession
  const captureSources = {
    open: vi.fn(() => [session]),
    hasRules: () => true,
    resolveIdentity: () => undefined,
    getEventTypes: () => [],
    cancelAll: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn(),
  } as unknown as RuntimeCaptureSourcePort
  const component = new ScrollContainerComponent({
    services: { declare: vi.fn(), get: vi.fn(), apply: vi.fn() },
    captureSources,
    perso: { id: 'viewport', storyId: 'story', initial: { tag: 'section' } },
  })
  component._materialize(element, [])
  component.initialize()
  pendingFrame?.(0)
  component.beforeSeek()

  expect(session.cancel).toHaveBeenCalledTimes(1)
  component.destroy()
  expect(element.removeCalls.map(({ type }) => type)).toEqual(['scroll', 'scrollend'])
})
