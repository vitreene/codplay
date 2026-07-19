// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startCaptureSession } from '../../src/runtime/capture-session'
import { bindComponentEmitDeclarations, unbindComponentEmitDeclarations } from '../../src/runtime/components/lib/dom'
import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player/player'
import type { EmitCapture, RuntimeEmitEvent } from '../../src/runtime/types'
import type { ItemDoc } from '../../src/runtime/types'
import { createSpaceBubblesScene, createSpaceBubblesStraps } from '@codplay/demos/scenes'

function createCapture(overrides?: Partial<EmitCapture>): EmitCapture {
  return {
    event: { name: 'drag:moved', cascade: true },
    duration: 400,
    snapAt: 'start',
    ...overrides
  }
}

function firePointerEvent(target: EventTarget, type: string, coords: { clientX: number; clientY: number }): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      clientX: coords.clientX,
      clientY: coords.clientY,
      bubbles: true,
      cancelable: true
    })
  )
}

function fireKeyboardEvent(target: EventTarget, type: string, code: string, repeat = false): void {
  target.dispatchEvent(new KeyboardEvent(type, { code, repeat, bubbles: true, cancelable: true }))
}

describe('Lot 20 — capture session', () => {
  let emittedEvents: RuntimeEmitEvent[]
  let emitRuntimeEvent: (event: RuntimeEmitEvent) => void
  const activeCleanups: Array<() => void> = []

  beforeEach(() => {
    emittedEvents = []
    emitRuntimeEvent = (event) => { emittedEvents.push(event) }
  })

  afterEach(() => {
    for (const cleanup of activeCleanups.splice(0)) {
      cleanup()
    }
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('T1 — installe les listeners window sur endOn au démarrage', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')

    const cleanup = startCaptureSession({
      capture: createCapture({ endOn: ['pointerup'], trackOn: ['pointermove'] }),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    const installedEvents = addSpy.mock.calls.map((call) => call[0])
    expect(installedEvents).toContain('pointerup')
    expect(installedEvents).toContain('pointermove')
  })

  it('T2 — sans appel à startCaptureSession, aucun listener window ajouté', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const countBefore = addSpy.mock.calls.length
    expect(addSpy.mock.calls.length).toBe(countBefore)
  })

  it('T3 — pointerup émet l\'event de substitution avec fromX/Y et toX/Y en coordonnées élément', () => {
    // startX=10, startY=20 (pointer start) ; baseX=0, baseY=0 (element base)
    // pointerup at (110, 220) → dx=100, dy=200 → toX=100, toY=200
    const cleanup = startCaptureSession({
      capture: createCapture(),
      startX: 10, startY: 20, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 110, clientY: 220 })

    expect(emittedEvents).toHaveLength(1)
    const data = emittedEvents[0].data as Record<string, unknown>
    expect(data.fromX).toBe(0)
    expect(data.fromY).toBe(0)
    expect(data.toX).toBe(100)
    expect(data.toY).toBe(200)
    expect(data.duration).toBe(400)
    expect(data.snapAt).toBe('start')
  })

  it('T3b — baseX/baseY non nuls sont pris en compte dans fromX/toX', () => {
    // element déjà à (50, 30), pointer part de (200, 150) et arrive à (250, 200)
    // dx=50, dy=50 → toX=50+50=100, toY=30+50=80
    const cleanup = startCaptureSession({
      capture: createCapture(),
      startX: 200, startY: 150, baseX: 50, baseY: 30,
      startMs: Date.now(),
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 250, clientY: 200 })

    const data = emittedEvents[0].data as Record<string, unknown>
    expect(data.fromX).toBe(50)
    expect(data.fromY).toBe(30)
    expect(data.toX).toBe(100)
    expect(data.toY).toBe(80)
  })

  it('T4 — snapAt:start émet avec ms = getCurrentTimelineMs()', () => {
    const getCurrentTimelineMs = vi.fn(() => 1500)

    startCaptureSession({
      capture: createCapture({ snapAt: 'start' }),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent,
      getCurrentTimelineMs
    })

    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    expect(emittedEvents[0].ms).toBe(1500)
  })

  it('T5 — snapAt:end émet avec ms = getCurrentTimelineMs() - duration', () => {
    const getCurrentTimelineMs = vi.fn(() => 2000)

    startCaptureSession({
      capture: createCapture({ snapAt: 'end', duration: 400 }),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent,
      getCurrentTimelineMs
    })

    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    expect(emittedEvents[0].ms).toBe(1600)
  })

  it('T6 — la fonction cleanup retire les listeners window', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const cleanup = startCaptureSession({
      capture: createCapture({ endOn: ['pointerup'], trackOn: ['pointermove'] }),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent
    })

    cleanup()

    const removedEvents = removeSpy.mock.calls.map((call) => call[0])
    expect(removedEvents).toContain('pointerup')
    expect(removedEvents).toContain('pointermove')
  })

  it('T7c — pointermove sans trackStrap émet capture.event via emitRuntimeEvent avec dx/dy/baseX/baseY', () => {
    const cleanup = startCaptureSession({
      capture: createCapture({ trackOn: ['pointermove'] }),
      startX: 50, startY: 30, baseX: 10, baseY: 5,
      startMs: Date.now(),
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointermove', { clientX: 80, clientY: 60 })

    expect(emittedEvents).toHaveLength(1)
    const evt = emittedEvents[0]
    expect(evt.name).toBe('drag:moved')
    const data = evt.data as Record<string, unknown>
    expect(data.dx).toBe(30)
    expect(data.dy).toBe(30)
    expect(data.baseX).toBe(10)
    expect(data.baseY).toBe(5)
  })

  it('T8 — endEvent présent : pointerup émet endEvent.name (pas capture.event.name)', () => {
    const cleanup = startCaptureSession({
      capture: createCapture({ endEvent: { name: 'drag:ended' } }),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 50, clientY: 50 })

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0].name).toBe('drag:ended')
  })

  it('T9 — endEvent présent : le mode reste persist-only (le geste live a déjà produit l\'effet visuel)', () => {
    const cleanup = startCaptureSession({
      capture: createCapture({ endEvent: { name: 'drag:ended' } }),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 50, clientY: 50 })

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0].mode).toBe('persist-only')
  })

  it('T10 — sans endEvent (capture.event réutilisé) : le mode reste aussi persist-only', () => {
    const cleanup = startCaptureSession({
      capture: createCapture(),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 50, clientY: 50 })

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0].mode).toBe('persist-only')
  })

  it('T7 — pointerup ne s\'émet qu\'une seule fois même si déclenché plusieurs fois', () => {
    startCaptureSession({
      capture: createCapture(),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent
    })

    firePointerEvent(window, 'pointerup', { clientX: 50, clientY: 50 })
    firePointerEvent(window, 'pointerup', { clientX: 50, clientY: 50 })

    expect(emittedEvents).toHaveLength(1)
  })

  it('T11 — la capture clavier livre des valeurs continues hors runtime, puis keyup persiste le terminal', () => {
    const liveCaptureEvents: RuntimeEmitEvent[] = []
    let frameCallback: FrameRequestCallback | null = null
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameCallback = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const cleanup = startCaptureSession({
      capture: createCapture({
        event: { name: 'turret:key:track' },
        endEvent: { name: 'turret:key:end' },
        trackOn: ['keydown'],
        endOn: ['keyup']
      }),
      startX: 0,
      startY: 0,
      baseX: 500,
      baseY: 800,
      startMs: 1_000,
      emitRuntimeEvent,
      emitLiveCapture: (event) => liveCaptureEvents.push(event),
      keyCode: 'ArrowRight',
      getCurrentPosition: () => ({ x: 640, y: 800 })
    })
    activeCleanups.push(cleanup)

    expect(liveCaptureEvents).toHaveLength(1)
    expect(liveCaptureEvents[0]).toMatchObject({
      name: 'turret:key:track',
      source: 'system',
      data: { elapsedMs: 0, deltaMs: 0, baseX: 500, baseY: 800, keyCode: 'ArrowRight' }
    })
    expect(emittedEvents).toHaveLength(0)

    vi.spyOn(Date, 'now').mockReturnValue(1_100)
    frameCallback?.(0)

    expect(liveCaptureEvents[1]).toMatchObject({
      name: 'turret:key:track',
      source: 'system',
      data: { elapsedMs: 100, deltaMs: 100 }
    })

    fireKeyboardEvent(window, 'keyup', 'ArrowRight')

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0]).toMatchObject({
      name: 'turret:key:end',
      source: 'system',
      mode: 'persist-only',
      data: { fromX: 500, fromY: 800, toX: 640, toY: 800, keyCode: 'ArrowRight' }
    })
  })

  it('T12 — keyup d’une autre touche ne termine pas la capture', () => {
    const liveCaptureEvents: RuntimeEmitEvent[] = []
    const cleanup = startCaptureSession({
      capture: createCapture({ trackOn: ['keydown'], endOn: ['keyup'] }),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent,
      emitLiveCapture: (event) => liveCaptureEvents.push(event),
      keyCode: 'ArrowLeft'
    })
    activeCleanups.push(cleanup)

    fireKeyboardEvent(window, 'keyup', 'ArrowRight')
    expect(emittedEvents).toHaveLength(0)
    expect(liveCaptureEvents).toHaveLength(1)
  })

  it('T13 — un layout reçoit keydown global, puis relaie uniquement les répétitions à la capture', () => {
    const node = document.createElement('div')
    const liveCaptureEvents: RuntimeEmitEvent[] = []
    const item = {
      id: 'turret',
      storyId: 'world',
      type: 'layout',
      initial: { markup: '<g></g>' },
      actions: {},
      emit: {
        keydown: {
          keyCode: 'ArrowLeft',
          event: { name: 'turret:key:start', cascade: true },
          capture: {
            event: { name: 'turret:key:track', cascade: true },
            endEvent: { name: 'turret:key:end', cascade: true },
            duration: 120,
            trackOn: ['keydown'],
            endOn: ['keyup']
          }
        }
      }
    } as ItemDoc

    bindComponentEmitDeclarations({
      perso: item,
      createElementOptions: { emitRuntimeEvent, emitLiveCapture: (event) => liveCaptureEvents.push(event) },
      resolveRef: () => node,
      report: vi.fn()
    })

    fireKeyboardEvent(window, 'keydown', 'ArrowLeft')
    fireKeyboardEvent(window, 'keydown', 'ArrowLeft', true)
    fireKeyboardEvent(window, 'keyup', 'ArrowLeft')
    unbindComponentEmitDeclarations(node)

    expect(emittedEvents.map((event) => event.name)).toEqual([
      'turret:key:start',
      'turret:key:end'
    ])
    expect(liveCaptureEvents).toHaveLength(1)
  })

  it('T14 — la capture clavier Space Bubbles déplace la vraie tourelle', async () => {
    let frameCallback: FrameRequestCallback | null = null
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameCallback = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene: createSpaceBubblesScene() })
    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    const player = new Player()
    const mountTarget = document.createElement('div')
    document.body.appendChild(mountTarget)
    await player.init({
      mountTarget,
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest,
      strapCollection: createSpaceBubblesStraps()
    })
    await player.emit({ name: 'space:game:start' })

    const before = player.getNodePose('space-turret')?.x
    fireKeyboardEvent(window, 'keydown', 'ArrowRight')
    await new Promise((resolve) => setTimeout(resolve, 20))
    frameCallback?.(0)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(player.getNodePose('space-turret')?.x).toBeGreaterThan(before ?? 0)
    await player.destroy()
    mountTarget.remove()
  })
})
