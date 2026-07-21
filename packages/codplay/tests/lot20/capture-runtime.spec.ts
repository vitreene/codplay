// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startCapture } from '../../src/runtime/capture-runtime'
import type { CaptureEndFn, CaptureInitFn, CaptureTrackFn } from '../../src/runtime/capture-types'
import type { RuntimeEmitEvent } from '../../src/runtime/types'

function firePointerEvent(target: EventTarget, type: string, coords: { clientX: number; clientY: number; movementX?: number; movementY?: number }): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      clientX: coords.clientX,
      clientY: coords.clientY,
      movementX: coords.movementX ?? 0,
      movementY: coords.movementY ?? 0,
      bubbles: true,
      cancelable: true
    })
  )
}

function fireKeyboardEvent(target: EventTarget, type: string, code: string, modifiers: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...modifiers })
  target.dispatchEvent(event)
  return event
}

describe('Lot 20 — capture-runtime', () => {
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
  })

  it('T1 — initCaptureState est appele une fois a l\'ouverture, avec le state de la story', () => {
    const initCaptureState = vi.fn<CaptureInitFn>(() => ({ x: 0 }))
    const cleanup = startCapture({
      capture: { initCaptureState },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      getStoryState: (storyId) => ({ storyId, draggableX: 42 })
    })
    activeCleanups.push(cleanup)

    expect(initCaptureState).toHaveBeenCalledTimes(1)
    expect(initCaptureState).toHaveBeenCalledWith({ state: { storyId: 'world', draggableX: 42 } })
  })

  it('T2 — sans initCaptureState declare, captureState demarre a {}', () => {
    const trackCommand = vi.fn<CaptureTrackFn>(({ captureState }) => {
      expect(captureState).toEqual({})
      return undefined
    })
    const cleanup = startCapture({
      capture: { trackOn: ['pointermove'], trackCommand },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointermove', { clientX: 10, clientY: 10 })
    expect(trackCommand).toHaveBeenCalledTimes(1)
  })

  it('T3 — pointermove produit un PointerCaptureSample avec clientX/Y et movementX/Y natifs', () => {
    const trackCommand = vi.fn<CaptureTrackFn>(() => undefined)
    const cleanup = startCapture({
      capture: { trackOn: ['pointermove'], trackCommand },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointermove', { clientX: 100, clientY: 200, movementX: 5, movementY: -3 })

    expect(trackCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        sample: { clientX: 100, clientY: 200, movementX: 5, movementY: -3 }
      })
    )
  })

  it('T4 — trackCommand.action est expose au poll subscribeCaptureTick, jamais applique/emis directement', () => {
    let poll: (() => import('../../src/runtime/capture-types').CaptureAction | void) | null = null
    const trackCommand: CaptureTrackFn = ({ sample }) => ({
      action: { actionName: 'capture_draggable_move', data: { style: { x: sample.clientX } } }
    })
    const cleanup = startCapture({
      capture: { trackOn: ['pointermove'], trackCommand },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      subscribeCaptureTick: (fn) => { poll = fn; return () => { poll = null } }
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointermove', { clientX: 42, clientY: 0 })

    const pollFn = poll as (() => import('../../src/runtime/capture-types').CaptureAction | void) | null
    expect(pollFn?.()).toEqual({ actionName: 'capture_draggable_move', data: { style: { x: 42 } } })
    // Polling again without a new sample returns nothing — capture never re-emits stale data.
    expect(pollFn?.()).toBeUndefined()
    expect(emittedEvents).toHaveLength(0)
  })

  it('T5 — trackCommand.captureState remplace integralement la valeur precedente', () => {
    const trackCommand = vi.fn<CaptureTrackFn>(({ captureState }) => ({
      captureState: { x: (typeof captureState.x === 'number' ? captureState.x : 0) + 1 }
    }))
    const cleanup = startCapture({
      capture: { trackOn: ['pointermove'], trackCommand },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointermove', { clientX: 0, clientY: 0 })
    firePointerEvent(window, 'pointermove', { clientX: 0, clientY: 0 })
    firePointerEvent(window, 'pointermove', { clientX: 0, clientY: 0 })

    expect(trackCommand).toHaveBeenLastCalledWith(expect.objectContaining({ captureState: { x: 2 } }))
  })

  it('T6 — le tracking n\'emet jamais d\'event ni ne touche state', () => {
    const trackCommand: CaptureTrackFn = () => ({ action: { actionName: 'x', data: {} } })
    const cleanup = startCapture({
      capture: { trackOn: ['pointermove'], trackCommand },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      subscribeCaptureTick: () => () => {}
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointermove', { clientX: 1, clientY: 1 })
    firePointerEvent(window, 'pointermove', { clientX: 2, clientY: 2 })

    expect(emittedEvents).toHaveLength(0)
  })

  it('T7 — endCapture recoit le tableau complet des samples et la derniere captureState', () => {
    const endCapture = vi.fn<CaptureEndFn>(() => undefined)
    const trackCommand: CaptureTrackFn = ({ captureState }) => ({
      captureState: { count: (typeof captureState.count === 'number' ? captureState.count : 0) + 1 }
    })
    const cleanup = startCapture({
      capture: { trackOn: ['pointermove'], endOn: ['pointerup'], trackCommand, endCapture },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointermove', { clientX: 1, clientY: 1 })
    firePointerEvent(window, 'pointermove', { clientX: 2, clientY: 2 })
    firePointerEvent(window, 'pointerup', { clientX: 2, clientY: 2 })

    expect(endCapture).toHaveBeenCalledTimes(1)
    const call = endCapture.mock.calls[0][0]
    expect(call.samples).toHaveLength(2)
    expect(call.captureState).toEqual({ count: 2 })
  })

  it('T8 — endCapture n\'a pas de update dans son contrat de sortie (types) — ne produit que des events', () => {
    const endCapture: CaptureEndFn = ({ captureState }) => ({
      events: [{ name: 'draggable:dropped', data: { x: captureState.x } }]
    })
    const cleanup = startCapture({
      capture: { endOn: ['pointerup'], endCapture },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0]).toMatchObject({ name: 'draggable:dropped', mode: 'persist-only' })
  })

  it('T9 — endEmit et endCapture sont independants : les deux peuvent coexister', () => {
    const endCapture: CaptureEndFn = () => ({ events: [{ name: 'capture:settled' }] })
    const cleanup = startCapture({
      capture: {
        endOn: ['pointerup'],
        endCapture,
        endEmit: { name: 'drag:ended' }
      },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    const names = emittedEvents.map((e) => e.name)
    expect(names).toContain('capture:settled')
    expect(names).toContain('drag:ended')
  })

  it('T10 — endEmit seul (sans endCapture) reste un StoryEvent normal, pas persist-only', () => {
    const cleanup = startCapture({
      capture: { endOn: ['pointerup'], endEmit: { name: 'drag:ended' } },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0].mode).toBeUndefined()
  })

  it('T11 — durationMode "value" utilise duration telle que fournie par l\'auteur', () => {
    const getCurrentTimelineMs = vi.fn(() => 5000)
    const endCapture: CaptureEndFn = () => ({
      events: [{ name: 'drag:ended' }],
      duration: 300,
      durationMode: 'value'
    })
    const cleanup = startCapture({
      capture: { endOn: ['pointerup'], endCapture },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      getCurrentTimelineMs
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    expect(emittedEvents[0].ms).toBe(5000 - 300)
  })

  it('T12 — durationMode absent (implicite "default") utilise une duree par defaut du runtime', () => {
    const getCurrentTimelineMs = vi.fn(() => 5000)
    const endCapture: CaptureEndFn = () => ({ events: [{ name: 'drag:ended' }] })
    const cleanup = startCapture({
      capture: { endOn: ['pointerup'], endCapture },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      getCurrentTimelineMs
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    expect(emittedEvents[0].ms).toBeLessThan(5000)
  })

  it('T13 — durationMode "capture" mesure la duree reelle entre ouverture et fermeture, jamais exposee a l\'auteur', () => {
    let now = 1000
    const getCurrentTimelineMs = vi.fn(() => now)
    const endCapture: CaptureEndFn = (input) => {
      expect(input).not.toHaveProperty('durationMode')
      return { events: [{ name: 'drag:ended' }], durationMode: 'capture' }
    }
    const cleanup = startCapture({
      capture: { endOn: ['pointerup'], endCapture },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      getCurrentTimelineMs
    })
    activeCleanups.push(cleanup)

    now = 1400
    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    expect(emittedEvents[0].ms).toBe(1400 - 400)
  })

  it('T14 — la duree resolue est propagee dans style.*.duration absent, sans ecraser une duration deja fournie', () => {
    const getCurrentTimelineMs = vi.fn(() => 1000)
    const endCapture: CaptureEndFn = () => ({
      events: [{
        name: 'drag:ended',
        data: { style: { x: { to: 10 }, y: { to: 20, duration: 999 } } }
      }],
      duration: 250,
      durationMode: 'value'
    })
    const cleanup = startCapture({
      capture: { endOn: ['pointerup'], endCapture },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      getCurrentTimelineMs
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    const data = emittedEvents[0].data as { style: { x: { duration: number }; y: { duration: number } } }
    expect(data.style.x.duration).toBe(250)
    expect(data.style.y.duration).toBe(999)
  })

  it('T15 — capture clavier : chaque tick produit un KeyboardCaptureSample avec deltaMs/elapsedMs du player, pas de KeyboardEvent', () => {
    const trackCommand = vi.fn<CaptureTrackFn>(() => undefined)
    let tick: ((deltaMs: number) => void) | null = null
    const triggerKeyboardEvent = new KeyboardEvent('keydown', { code: 'ArrowLeft' })
    const cleanup = startCapture({
      capture: { trackCommand },
      persoId: 'turret',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      subscribeJitTick: (listener) => { tick = listener; return () => { tick = null } },
      keyCode: 'ArrowLeft',
      triggerKeyboardEvent
    })
    activeCleanups.push(cleanup)

    expect(trackCommand).toHaveBeenCalledWith(expect.objectContaining({
      sample: expect.objectContaining({ keyCode: 'ArrowLeft', deltaMs: 0, elapsedMs: 0 })
    }))

    const runTick = tick as ((deltaMs: number) => void) | null
    runTick?.(16)
    expect(trackCommand).toHaveBeenLastCalledWith(expect.objectContaining({
      sample: expect.objectContaining({ deltaMs: 16, elapsedMs: 16 })
    }))
  })

  it('T16 — les modificateurs du KeyboardCaptureSample viennent de l\'event declencheur', () => {
    const trackCommand = vi.fn<CaptureTrackFn>(() => undefined)
    const triggerKeyboardEvent = new KeyboardEvent('keydown', { code: 'ArrowLeft', altKey: true, shiftKey: true })
    const cleanup = startCapture({
      capture: { trackCommand },
      persoId: 'turret',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      subscribeJitTick: (listener) => () => { void listener },
      keyCode: 'ArrowLeft',
      triggerKeyboardEvent
    })
    activeCleanups.push(cleanup)

    expect(trackCommand).toHaveBeenCalledWith(expect.objectContaining({
      sample: expect.objectContaining({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false })
    }))
  })

  it('T17 — keyup d\'une autre touche ne termine pas la capture clavier', () => {
    const endCapture = vi.fn<CaptureEndFn>(() => undefined)
    const cleanup = startCapture({
      capture: { endOn: ['keyup'], endCapture },
      persoId: 'turret',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      keyCode: 'ArrowLeft',
      triggerKeyboardEvent: new KeyboardEvent('keydown', { code: 'ArrowLeft' })
    })
    activeCleanups.push(cleanup)

    fireKeyboardEvent(window, 'keyup', 'ArrowRight')
    expect(endCapture).not.toHaveBeenCalled()

    fireKeyboardEvent(window, 'keyup', 'ArrowLeft')
    expect(endCapture).toHaveBeenCalledTimes(1)
  })

  it('T18 — la fin de capture ne se declenche qu\'une seule fois meme si endOn se produit plusieurs fois', () => {
    const endCapture = vi.fn<CaptureEndFn>(() => undefined)
    const cleanup = startCapture({
      capture: { endOn: ['pointerup'], endCapture },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })
    firePointerEvent(window, 'pointerup', { clientX: 0, clientY: 0 })

    expect(endCapture).toHaveBeenCalledTimes(1)
  })

  it('T19 — cleanup retire tous les listeners installes (track + end + tick)', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const unsubscribeTick = vi.fn()
    const cleanup = startCapture({
      capture: { endOn: ['keyup'] },
      persoId: 'turret',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent,
      subscribeJitTick: () => unsubscribeTick,
      keyCode: 'ArrowLeft',
      triggerKeyboardEvent: new KeyboardEvent('keydown', { code: 'ArrowLeft' })
    })

    cleanup()

    expect(unsubscribeTick).toHaveBeenCalledTimes(1)
    const removedEvents = removeSpy.mock.calls.map((call) => call[0])
    expect(removedEvents).toContain('keyup')
  })

  it('T20 — sans trackCommand declare, le tracking accumule quand meme les samples silencieusement', () => {
    const endCapture = vi.fn<CaptureEndFn>(({ samples }) => {
      expect(samples).toHaveLength(2)
      return undefined
    })
    const cleanup = startCapture({
      capture: { trackOn: ['pointermove'], endOn: ['pointerup'], endCapture },
      persoId: 'draggable',
      storyId: 'world',
      originEventName: 'drag:started',
      emitRuntimeEvent
    })
    activeCleanups.push(cleanup)

    firePointerEvent(window, 'pointermove', { clientX: 1, clientY: 1 })
    firePointerEvent(window, 'pointermove', { clientX: 2, clientY: 2 })
    firePointerEvent(window, 'pointerup', { clientX: 2, clientY: 2 })

    expect(endCapture).toHaveBeenCalledTimes(1)
  })
})
