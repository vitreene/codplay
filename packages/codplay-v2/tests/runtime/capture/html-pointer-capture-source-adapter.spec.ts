import { describe, expect, it, vi } from 'vitest'

import type { RuntimePlayer } from '../../../src/runtime/player'
import { HtmlPointerCaptureSourceAdapter } from '../../../src/runtime/capture'
import type { CompiledScene } from '../../../src/scene/compiled'

class TestNode {
  parentNode: TestNode | null = null
}

class TestEventTarget implements EventTarget {
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  readonly listenerOptions = new Map<string, AddEventListenerOptions | boolean | undefined>()

  /** Registers one event listener for the adapter test source. */
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    if (callback === null) return
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
    listeners.add(callback)
    this.listeners.set(type, listeners)
    this.listenerOptions.set(type, options)
  }

  /** Removes one previously registered test listener. */
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    _options?: EventListenerOptions | boolean,
  ): void {
    if (callback === null) return
    this.listeners.get(type)?.delete(callback)
  }

  /** Dispatches one test event to a snapshot of the registered listeners. */
  dispatchEvent(event: Event): boolean {
    for (const listener of [...this.listeners.get(event.type) ?? []]) {
      if (typeof listener === 'function') listener.call(this, event)
      else listener.handleEvent(event)
    }
    return true
  }
}

/** Creates one pointer event with the native fields used by the adapter. */
function pointerEvent(
  type: string,
  target: TestNode,
  fields: Readonly<Partial<Pick<PointerEvent, 'clientX' | 'clientY' | 'movementX' | 'movementY' | 'pointerId'>>> = {},
): Event {
  const event = new Event(type)
  Object.defineProperty(event, 'target', { value: target })
  for (const [name, value] of Object.entries(fields)) Object.defineProperty(event, name, { value })
  return event
}

/** Builds the smallest compiled scene containing one classic pointer capture. */
function compiledScene(): CompiledScene {
  return {
    schemaVersion: 'codplay.v2.scene.v1',
    createdAt: '2026-08-21T00:00:00.000Z',
    scene: {
      id: 'pointer-capture-scene',
      listen: [],
      tracks: {},
      stories: {
        main: {
          id: 'main',
          listen: [],
          persos: [{
            id: 'item',
            type: 'tag',
            initial: {},
            actions: {},
            emit: {
              pointerdown: {
                event: { name: 'drag:start' },
                capture: {
                  trackOn: ['pointermove'],
                  endOn: ['pointerup'],
                },
              },
            },
          }],
        },
      },
    },
    resources: { entries: [] },
    rootNodeIds: [],
    requirements: { components: [], services: [], modules: [], resources: [] },
    actionTargetIndex: {},
  }
}

describe('HtmlPointerCaptureSourceAdapter', () => {
  it('routes a classic pointer capture through the RuntimePlayer facade', async () => {
    const eventTarget = new TestEventTarget()
    const node = new TestNode()
    const player = {
      getCurrentTimeMs: vi.fn(() => 120),
      emit: vi.fn(async () => ({ ok: true, events: [], straps: [], issues: [] })),
      beginCompiledCapture: vi.fn(() => ({ ok: true, captureId: 'capture', captureState: {} })),
      trackCapture: vi.fn(() => ({ ok: true, captureState: {}, sampleCount: 1 })),
      endCapture: vi.fn(async () => ({
        ok: true,
        events: [],
        samples: [],
        captureState: {},
        warnings: [],
        dispatchResults: [],
      })),
    } as unknown as RuntimePlayer
    const adapter = new HtmlPointerCaptureSourceAdapter({
      player,
      compiledScene: compiledScene(),
      nodes: { persoNodes: new Map([['main:item', node]]) },
      eventTarget,
    })

    adapter.attach()
    expect(eventTarget.listenerOptions.get('pointermove')).toEqual({ capture: true })
    eventTarget.dispatchEvent(pointerEvent('pointerdown', node))
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
    expect(player.emit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'drag:start',
      applyAtMs: 120,
      storyId: 'main',
    }))
    expect(player.beginCompiledCapture).toHaveBeenCalledWith(expect.objectContaining({
      storyId: 'main',
      declaration: { trackOn: ['pointermove'], endOn: ['pointerup'] },
    }))

    eventTarget.dispatchEvent(pointerEvent('pointermove', node, {
      clientX: 40,
      clientY: 25,
      movementX: 4,
      movementY: -2,
    }))
    expect(player.trackCapture).toHaveBeenCalledWith(
      expect.any(String),
      { clientX: 40, clientY: 25, movementX: 4, movementY: -2 },
    )

    eventTarget.dispatchEvent(pointerEvent('pointerup', node))
    await Promise.resolve()
    expect(player.endCapture).toHaveBeenCalledWith(expect.any(String), {
      source: 'html-pointer',
      eventType: 'pointerup',
    })
  })

  it('does not open a capture for a pointer outside a materialized perso', () => {
    const eventTarget = new TestEventTarget()
    const player = {
      getCurrentTimeMs: () => 0,
      emit: vi.fn(async () => ({ ok: true, events: [], straps: [], issues: [] })),
      beginCompiledCapture: vi.fn(() => ({ ok: true, captureId: 'capture', captureState: {} })),
    } as unknown as RuntimePlayer
    const adapter = new HtmlPointerCaptureSourceAdapter({
      player,
      compiledScene: compiledScene(),
      nodes: { persoNodes: new Map() },
      eventTarget,
    })

    adapter.attach()
    eventTarget.dispatchEvent(pointerEvent('pointerdown', new TestNode()))

    expect(player.emit).not.toHaveBeenCalled()
    expect(player.beginCompiledCapture).not.toHaveBeenCalled()
  })

  it('routes only the opening pointer and closes only on the declared end event', async () => {
    const eventTarget = new TestEventTarget()
    const node = new TestNode()
    const player = {
      getCurrentTimeMs: () => 0,
      emit: vi.fn(async () => ({ ok: true, events: [], straps: [], issues: [] })),
      beginCompiledCapture: vi.fn(() => ({ ok: true, captureId: 'capture', captureState: {} })),
      trackCapture: vi.fn(() => ({ ok: true, captureState: {}, sampleCount: 1 })),
      cancelCapture: vi.fn(() => ({ ok: true })),
      endCapture: vi.fn(async () => ({ ok: true })),
    } as unknown as RuntimePlayer
    const adapter = new HtmlPointerCaptureSourceAdapter({
      player,
      compiledScene: compiledScene(),
      nodes: { persoNodes: new Map([['main:item', node]]) },
      eventTarget,
    })

    adapter.attach()
    eventTarget.dispatchEvent(pointerEvent('pointerdown', node, { pointerId: 7 }))
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
    eventTarget.dispatchEvent(pointerEvent('pointermove', node, {
      pointerId: 8,
      clientX: 40,
      clientY: 25,
      movementX: 4,
      movementY: -2,
    }))
    expect(player.trackCapture).not.toHaveBeenCalled()

    eventTarget.dispatchEvent(pointerEvent('pointermove', node, {
      pointerId: 7,
      clientX: 40,
      clientY: 25,
      movementX: 4,
      movementY: -2,
    }))
    expect(player.trackCapture).toHaveBeenCalledTimes(1)

    eventTarget.dispatchEvent(pointerEvent('pointercancel', node, { pointerId: 7 }))
    eventTarget.dispatchEvent(pointerEvent('lostpointercapture', node, { pointerId: 7 }))
    eventTarget.dispatchEvent(pointerEvent('pointercancel', node, { pointerId: 7 }))
    expect(player.cancelCapture).not.toHaveBeenCalled()
    expect(player.endCapture).not.toHaveBeenCalled()

    eventTarget.dispatchEvent(pointerEvent('pointerup', node, { pointerId: 7 }))
    await Promise.resolve()
    expect(player.endCapture).toHaveBeenCalledTimes(1)
  })

  it('cancels an open capture when the source is destroyed', async () => {
    const eventTarget = new TestEventTarget()
    const node = new TestNode()
    const player = {
      getCurrentTimeMs: () => 0,
      emit: vi.fn(async () => ({ ok: true, events: [], straps: [], issues: [] })),
      beginCompiledCapture: vi.fn(() => ({ ok: true, captureId: 'capture', captureState: {} })),
      cancelCapture: vi.fn(() => ({ ok: true })),
    } as unknown as RuntimePlayer
    const adapter = new HtmlPointerCaptureSourceAdapter({
      player,
      compiledScene: compiledScene(),
      nodes: { persoNodes: new Map([['main:item', node]]) },
      eventTarget,
    })

    adapter.attach()
    eventTarget.dispatchEvent(pointerEvent('pointerdown', node, { pointerId: 7 }))
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
    adapter.destroy()

    expect(player.cancelCapture).toHaveBeenCalledTimes(1)
  })

  it('removes source listeners without touching the player', () => {
    const eventTarget = new TestEventTarget()
    const node = new TestNode()
    const player = {
      getCurrentTimeMs: () => 0,
      emit: vi.fn(async () => ({ ok: true, events: [], straps: [], issues: [] })),
      beginCompiledCapture: vi.fn(() => ({ ok: true, captureId: 'capture', captureState: {} })),
    } as unknown as RuntimePlayer
    const adapter = new HtmlPointerCaptureSourceAdapter({
      player,
      compiledScene: compiledScene(),
      nodes: { persoNodes: new Map([['main:item', node]]) },
      eventTarget,
    })

    adapter.attach()
    adapter.destroy()
    eventTarget.dispatchEvent(pointerEvent('pointerdown', node))

    expect(player.emit).not.toHaveBeenCalled()
    expect(player.beginCompiledCapture).not.toHaveBeenCalled()
  })
})
