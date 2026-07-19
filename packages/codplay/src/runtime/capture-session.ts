import { buildCaptureSubstitutionStyle } from './capture-substitution'
import type { EmitCapture, RuntimeEmitEvent } from './types'

const DEFAULT_TRACK_ON = ['pointermove']
const DEFAULT_END_ON = ['pointerup']

export type CaptureSessionInput = {
  capture: EmitCapture
  startX: number
  startY: number
  baseX: number
  baseY: number
  startMs: number
  persoId?: string
  scopeStoryId?: string
  emitRuntimeEvent: (event: RuntimeEmitEvent) => void
  emitLiveCapture?: (event: RuntimeEmitEvent) => void
  getCurrentTimelineMs?: () => number
  keyCode?: string
  getCurrentPosition?: () => { x: number; y: number } | null
}

/**
 * Starts one window-level interaction capture session triggered by pointer or keyboard input.
 * Returns a cleanup function that removes all installed listeners immediately.
 */
export function startCaptureSession(input: CaptureSessionInput): () => void {
  const {
    capture,
    startX,
    startY,
    baseX,
    baseY,
    startMs,
    persoId,
    scopeStoryId,
    emitRuntimeEvent,
    emitLiveCapture,
    getCurrentTimelineMs,
    keyCode,
    getCurrentPosition
  } = input
  const endOn = capture.endOn ?? DEFAULT_END_ON
  const trackOn = capture.trackOn ?? DEFAULT_TRACK_ON

  let ended = false
  let keyboardFrame: number | null = null
  let keyboardLastSampleAtMs = startMs

  const emitKeyboardValue = (nowMs: number): void => {
    emitLiveCapture?.({
      name: capture.event.name,
      cascade: capture.event.cascade,
      scopeStoryId: capture.event.cascade === true ? undefined : scopeStoryId,
      source: 'system',
      data: {
        elapsedMs: Math.max(0, nowMs - startMs),
        deltaMs: Math.max(0, nowMs - keyboardLastSampleAtMs),
        baseX,
        baseY,
        keyCode,
        persoId
      }
    })
    keyboardLastSampleAtMs = nowMs
  }

  const scheduleKeyboardFrame = (): void => {
    if (keyCode === undefined || typeof globalThis.requestAnimationFrame !== 'function') {
      return
    }

    keyboardFrame = globalThis.requestAnimationFrame(() => {
      if (ended) {
        return
      }
      emitKeyboardValue(Date.now())
      scheduleKeyboardFrame()
    })
  }

  if (keyCode !== undefined && emitLiveCapture !== undefined) {
    emitKeyboardValue(startMs)
    scheduleKeyboardFrame()
  }

  function onEnd(domEvent: Event): void {
    if (ended || (keyCode !== undefined && (!(domEvent instanceof KeyboardEvent) || domEvent.code !== keyCode))) {
      return
    }

    ended = true
    cleanup()

    const isKeyboardCapture = keyCode !== undefined
    const endPointerX = domEvent instanceof PointerEvent ? domEvent.clientX : startX
    const endPointerY = domEvent instanceof PointerEvent ? domEvent.clientY : startY
    const currentPosition = isKeyboardCapture ? getCurrentPosition?.() : null
    const toX = currentPosition?.x ?? baseX + (endPointerX - startX)
    const toY = currentPosition?.y ?? baseY + (endPointerY - startY)

    const nowMs = getCurrentTimelineMs?.() ?? 0
    const deltaMs = Date.now() - startMs
    const eventMs = capture.snapAt === 'end' ? nowMs - capture.duration : nowMs

    const endEventSpec = capture.endEvent ?? capture.event
    const substitution =
      capture.replay === true
        ? buildCaptureSubstitutionStyle({ fromX: baseX, fromY: baseY, toX, toY, duration: capture.duration })
        : undefined

    emitRuntimeEvent({
      name: endEventSpec.name,
      cascade: endEventSpec.cascade,
      scopeStoryId: endEventSpec.cascade === true ? undefined : scopeStoryId,
      source: 'system',
      ms: eventMs,
      mode: 'persist-only',
      data: {
        fromX: baseX,
        fromY: baseY,
        toX,
        toY,
        clientX: endPointerX,
        clientY: endPointerY,
        deltaMs,
        duration: capture.duration,
        snapAt: capture.snapAt,
        persoId,
        keyCode,
        ...substitution
      }
    })
  }

  function onTrack(domEvent: Event): void {
    if (keyCode !== undefined) {
      return
    }

    if (!(domEvent instanceof PointerEvent)) {
      return
    }

    const dx = domEvent.clientX - startX
    const dy = domEvent.clientY - startY

    emitRuntimeEvent({
      name: capture.event.name,
      cascade: capture.event.cascade,
      scopeStoryId: capture.event.cascade === true ? undefined : scopeStoryId,
      source: 'system',
      data: { dx, dy, baseX, baseY, x: baseX + dx, y: baseY + dy, persoId }
    })
  }

  for (const eventName of endOn) {
    globalThis.window?.addEventListener(eventName, onEnd, { capture: true })
  }

  for (const eventName of trackOn) {
    globalThis.window?.addEventListener(eventName, onTrack, { capture: true })
  }

  function cleanup(): void {
    if (keyboardFrame !== null && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(keyboardFrame)
      keyboardFrame = null
    }

    for (const eventName of endOn) {
      globalThis.window?.removeEventListener(eventName, onEnd, { capture: true })
    }

    for (const eventName of trackOn) {
      globalThis.window?.removeEventListener(eventName, onTrack, { capture: true })
    }
  }

  return cleanup
}
