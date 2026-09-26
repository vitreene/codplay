import { describe, expect, it, vi } from 'vitest'
import { HtmlPointerCaptureSourceAdapter, RuntimeCaptureSourceCircuit } from '../../../src/runtime/capture'
import type { RuntimeCaptureSourcePlayerPort } from '../../../src/runtime/capture'
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
    if (callback !== null) this.listeners.get(type)?.delete(callback)
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

/** Creates one pointer event with the native fields consumed by the adapter. */
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

/** Builds one compiled perso with one pointer capture rule. */
function compiledScene(visibility?: 'story' | 'scene' | 'public'): CompiledScene {
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
                event: { name: 'drag:start', visibility },
                capture: { trackOn: ['pointermove'], endOn: ['pointerup'] },
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

/** Creates the minimal player facade used by a source circuit test. */
function createPlayer(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    getCurrentTimeMs: vi.fn(() => 120),
    emit: vi.fn(async () => ({ ok: true, events: [], straps: [], issues: [] })),
    beginCompiledCapture: vi.fn(() => ({ ok: true, captureState: { opened: true } })),
    trackCapture: vi.fn((_captureId: string, sample: Readonly<{ clientY?: number }>) => ({
      ok: true,
      captureState: { opened: true, latestY: sample.clientY },
      sampleCount: 1,
    })),
    endCapture: vi.fn(async () => ({ ok: true, events: [], samples: [], captureState: {}, warnings: [], dispatchResults: [] })),
    cancelCapture: vi.fn(() => ({ ok: true })),
    ...overrides,
  }
}

/** Builds the shared capture circuit from a compiled scene and player facade. */
function createCircuit(player: Record<string, unknown>, scene = compiledScene()): RuntimeCaptureSourceCircuit {
  return new RuntimeCaptureSourceCircuit({
    compiledScene: scene,
    player: player as unknown as RuntimeCaptureSourcePlayerPort,
  })
}

/** Creates one pointer adapter with its real shared rule resolver. */
function createAdapter(
  player: Record<string, unknown>,
  eventTarget: EventTarget,
  node: TestNode,
  options: Readonly<{
    scene?: CompiledScene
    onCaptureTrack?: ConstructorParameters<typeof HtmlPointerCaptureSourceAdapter>[0]['onCaptureTrack']
    resolveEndCaptureState?: ConstructorParameters<typeof HtmlPointerCaptureSourceAdapter>[0]['resolveEndCaptureState']
    onCaptureClose?: ConstructorParameters<typeof HtmlPointerCaptureSourceAdapter>[0]['onCaptureClose']
  }> = {},
): HtmlPointerCaptureSourceAdapter {
  return new HtmlPointerCaptureSourceAdapter({
    captureSources: createCircuit(player, options.scene),
    nodes: { persoNodes: new Map([['main:item', node]]) },
    eventTarget,
    onCaptureTrack: options.onCaptureTrack,
    resolveEndCaptureState: options.resolveEndCaptureState,
    onCaptureClose: options.onCaptureClose,
  })
}

/** Waits for the pointer start, sample, and end promises to settle. */
async function flushSourceTasks(): Promise<void> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}

describe('HtmlPointerCaptureSourceAdapter', () => {
  it('queues pointer samples and the end boundary while the shared start event is pending', async () => {
    const eventTarget = new TestEventTarget()
    const node = new TestNode()
    let releaseStart: ((value: Readonly<{ ok: true; events: never[]; straps: never[]; issues: never[] }>) => void) | undefined
    const startEvent = new Promise<Readonly<{ ok: true; events: never[]; straps: never[]; issues: never[] }>>((resolve) => {
      releaseStart = resolve
    })
    const player = createPlayer({ emit: vi.fn(() => startEvent) })
    const onCaptureTrack = vi.fn()
    const adapter = createAdapter(player, eventTarget, node, { onCaptureTrack })

    adapter.attach()
    eventTarget.dispatchEvent(pointerEvent('pointerdown', node))
    eventTarget.dispatchEvent(pointerEvent('pointermove', node, {
      clientX: 20, clientY: 30, movementX: 0, movementY: 10,
    }))
    eventTarget.dispatchEvent(pointerEvent('pointermove', node, {
      clientX: 20, clientY: 110, movementX: 0, movementY: 80,
    }))
    eventTarget.dispatchEvent(pointerEvent('pointerup', node))

    expect(player.trackCapture).not.toHaveBeenCalled()
    releaseStart?.({ ok: true, events: [], straps: [], issues: [] })
    await flushSourceTasks()

    expect(player.trackCapture).toHaveBeenCalledTimes(2)
    expect(onCaptureTrack.mock.calls.map(([input]) => input.sample.clientY)).toEqual([30, 110])
    expect(player.endCapture).toHaveBeenCalledTimes(1)
  })

  it('routes a capture start with each compiled visibility through the normal player event path', async () => {
    for (const visibility of ['story', 'scene', 'public'] as const) {
      const eventTarget = new TestEventTarget()
      const node = new TestNode()
      const player = createPlayer()
      const adapter = createAdapter(player, eventTarget, node, { scene: compiledScene(visibility) })

      adapter.attach()
      eventTarget.dispatchEvent(pointerEvent('pointerdown', node))
      await flushSourceTasks()

      expect(player.emit).toHaveBeenCalledWith(expect.objectContaining({
        name: 'drag:start',
        visibility,
        applyAtMs: 120,
      }))
      if (visibility === 'story') {
        expect(player.emit).toHaveBeenCalledWith(expect.objectContaining({ storyId: 'main' }))
      } else {
        expect(player.emit).not.toHaveBeenCalledWith(expect.objectContaining({ storyId: 'main' }))
      }
      adapter.destroy()
    }
  })

  it('passes tracking and final-state callbacks through the shared session', async () => {
    const eventTarget = new TestEventTarget()
    const node = new TestNode()
    const player = createPlayer()
    const onCaptureTrack = vi.fn()
    const resolveEndCaptureState = vi.fn(({ captureState }: Readonly<{ captureState: Readonly<Record<string, unknown>> }>) => ({
      ...captureState,
      resolved: true,
    }))
    const onCaptureClose = vi.fn()
    const adapter = createAdapter(player, eventTarget, node, {
      onCaptureTrack,
      resolveEndCaptureState,
      onCaptureClose,
    })

    adapter.attach()
    eventTarget.dispatchEvent(pointerEvent('pointerdown', node))
    await flushSourceTasks()
    eventTarget.dispatchEvent(pointerEvent('pointermove', node, {
      clientX: 40, clientY: 25, movementX: 4, movementY: -2,
    }))
    eventTarget.dispatchEvent(pointerEvent('pointerup', node))
    await flushSourceTasks()

    expect(onCaptureTrack).toHaveBeenCalledWith(expect.objectContaining({
      captureId: 'main:item:pointerdown:0',
      persoKey: 'main:item',
      sample: { clientX: 40, clientY: 25, movementX: 4, movementY: -2 },
    }))
    expect(resolveEndCaptureState).toHaveBeenCalledTimes(1)
    expect(player.endCapture).toHaveBeenCalledWith(
      'main:item:pointerdown:0',
      { source: 'html-pointer', eventType: 'pointerup' },
      { opened: true, latestY: 25, resolved: true },
    )
    expect(onCaptureClose).toHaveBeenCalledWith({
      captureId: 'main:item:pointerdown:0',
      persoKey: 'main:item',
      completed: true,
    })
  })

  it('keeps concurrent pointer identities isolated and ignores unmatched end events', async () => {
    const eventTarget = new TestEventTarget()
    const node = new TestNode()
    const player = createPlayer()
    const adapter = createAdapter(player, eventTarget, node)

    adapter.attach()
    eventTarget.dispatchEvent(pointerEvent('pointerdown', node, { pointerId: 7 }))
    await flushSourceTasks()
    eventTarget.dispatchEvent(pointerEvent('pointermove', node, {
      pointerId: 8, clientX: 40, clientY: 25, movementX: 4, movementY: -2,
    }))
    expect(player.trackCapture).not.toHaveBeenCalled()

    eventTarget.dispatchEvent(pointerEvent('pointermove', node, {
      pointerId: 7, clientX: 40, clientY: 25, movementX: 4, movementY: -2,
    }))
    eventTarget.dispatchEvent(pointerEvent('pointercancel', node, { pointerId: 7 }))
    expect(player.trackCapture).toHaveBeenCalledTimes(1)
    expect(player.endCapture).not.toHaveBeenCalled()

    eventTarget.dispatchEvent(pointerEvent('pointerup', node, { pointerId: 7 }))
    await flushSourceTasks()
    expect(player.endCapture).toHaveBeenCalledTimes(1)
  })

  it('does not open a capture when the start event is rejected', async () => {
    const eventTarget = new TestEventTarget()
    const node = new TestNode()
    const player = createPlayer({ emit: vi.fn(async () => ({ ok: false, events: [], straps: [], issues: [] })) })
    const adapter = createAdapter(player, eventTarget, node)

    adapter.attach()
    eventTarget.dispatchEvent(pointerEvent('pointerdown', node))
    await flushSourceTasks()

    expect(player.beginCompiledCapture).not.toHaveBeenCalled()
  })

  it('cancels an active session when the adapter is destroyed', async () => {
    const eventTarget = new TestEventTarget()
    const node = new TestNode()
    const player = createPlayer()
    const adapter = createAdapter(player, eventTarget, node)

    adapter.attach()
    eventTarget.dispatchEvent(pointerEvent('pointerdown', node, { pointerId: 7 }))
    await flushSourceTasks()
    adapter.destroy()

    expect(player.cancelCapture).toHaveBeenCalledTimes(1)
  })

  it('removes global listeners before another pointer event can reach the circuit', () => {
    const eventTarget = new TestEventTarget()
    const node = new TestNode()
    const player = createPlayer()
    const adapter = createAdapter(player, eventTarget, node)

    adapter.attach()
    expect(eventTarget.listenerOptions.get('pointermove')).toEqual({ capture: true })
    adapter.destroy()
    eventTarget.dispatchEvent(pointerEvent('pointerdown', node))

    expect(player.emit).not.toHaveBeenCalled()
  })
})
