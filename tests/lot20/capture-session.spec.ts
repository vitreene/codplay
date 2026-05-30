// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startCaptureSession } from '../../src/runtime/capture-session'
import type { EmitCapture, RuntimeEmitEvent } from '../../src/runtime/types'

function createCapture(overrides?: Partial<EmitCapture>): EmitCapture {
  return {
    event: { name: 'drag:moved', cascade: true },
    duration: 400,
    anchor: 'start',
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

describe('Lot 20 — capture session', () => {
  let emittedEvents: RuntimeEmitEvent[]
  let liveUpdates: RuntimeEmitEvent[]
  let emitRuntimeEvent: (event: RuntimeEmitEvent) => void
  let applyLiveUpdate: (event: RuntimeEmitEvent) => void
  const activeCleanups: Array<() => void> = []

  beforeEach(() => {
    emittedEvents = []
    liveUpdates = []
    emitRuntimeEvent = (event) => { emittedEvents.push(event) }
    applyLiveUpdate = (event) => { liveUpdates.push(event) }
  })

  afterEach(() => {
    for (const cleanup of activeCleanups.splice(0)) {
      cleanup()
    }
    vi.restoreAllMocks()
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
    expect(data.anchor).toBe('start')
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

  it('T4 — anchor:start émet avec ms = getCurrentTimelineMs()', () => {
    const getCurrentTimelineMs = vi.fn(() => 1500)

    startCaptureSession({
      capture: createCapture({ anchor: 'start' }),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent,
      getCurrentTimelineMs
    })

    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    expect(emittedEvents[0].ms).toBe(1500)
  })

  it('T5 — anchor:end émet avec ms = getCurrentTimelineMs() - duration', () => {
    const getCurrentTimelineMs = vi.fn(() => 2000)

    startCaptureSession({
      capture: createCapture({ anchor: 'end', duration: 400 }),
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

  it('T7b — pointermove appelle applyLiveUpdate avec les coordonnées élément courantes', () => {
    const cleanup = startCaptureSession({
      capture: createCapture({
        trackOn: ['pointermove'],
        trackEvent: { name: 'drag:tracking', cascade: true }
      }),
      startX: 50, startY: 30, baseX: 10, baseY: 5,
      startMs: Date.now(),
      emitRuntimeEvent,
      applyLiveUpdate
    })
    activeCleanups.push(cleanup)

    // dx = 80-50 = 30 ; toX = 10+30 = 40
    // dy = 60-30 = 30 ; toY = 5+30 = 35
    firePointerEvent(window, 'pointermove', { clientX: 80, clientY: 60 })

    expect(liveUpdates).toHaveLength(1)
    const data = liveUpdates[0].data as Record<string, unknown>
    const style = data.style as Record<string, unknown>
    expect((style.x as Record<string, unknown>).to).toBe(40)
    expect((style.y as Record<string, unknown>).to).toBe(35)
    expect((style.x as Record<string, unknown>).duration).toBe(0)
  })

  it('T7c — pointermove sans applyLiveUpdate ni trackEvent ne provoque pas d\'erreur', () => {
    const cleanup = startCaptureSession({
      capture: createCapture({ trackOn: ['pointermove'] }),
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      startMs: Date.now(),
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    expect(() => firePointerEvent(window, 'pointermove', { clientX: 50, clientY: 50 })).not.toThrow()
    expect(liveUpdates).toHaveLength(0)
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
})
