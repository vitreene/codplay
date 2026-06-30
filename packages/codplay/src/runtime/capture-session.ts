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
  getCurrentTimelineMs?: () => number
}

/**
 * Starts one window-level interaction capture session triggered by a pointer event.
 * Returns a cleanup function that removes all installed listeners immediately.
 */
export function startCaptureSession(input: CaptureSessionInput): () => void {
  const { capture, startX, startY, baseX, baseY, startMs, persoId, scopeStoryId, emitRuntimeEvent, getCurrentTimelineMs } = input
  const endOn = capture.endOn ?? DEFAULT_END_ON
  const trackOn = capture.trackOn ?? DEFAULT_TRACK_ON

  let ended = false

  function onEnd(domEvent: Event): void {
    if (ended) {
      return
    }

    ended = true
    cleanup()

    const endPointerX = domEvent instanceof PointerEvent ? domEvent.clientX : startX
    const endPointerY = domEvent instanceof PointerEvent ? domEvent.clientY : startY
    const toX = baseX + (endPointerX - startX)
    const toY = baseY + (endPointerY - startY)

    const nowMs = getCurrentTimelineMs?.() ?? 0
    const deltaMs = Date.now() - startMs
    const eventMs = capture.snapAt === 'end' ? nowMs - capture.duration : nowMs

    const endEventSpec = capture.endEvent ?? capture.event
    const endEventMode = capture.endEvent !== undefined ? undefined : 'persist-only'

    emitRuntimeEvent({
      name: endEventSpec.name,
      cascade: endEventSpec.cascade,
      scopeStoryId: endEventSpec.cascade === true ? undefined : scopeStoryId,
      source: 'system',
      ms: eventMs,
      mode: endEventMode,
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
        persoId
      }
    })
  }

  function onTrack(domEvent: Event): void {
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
    for (const eventName of endOn) {
      globalThis.window?.removeEventListener(eventName, onEnd, { capture: true })
    }

    for (const eventName of trackOn) {
      globalThis.window?.removeEventListener(eventName, onTrack, { capture: true })
    }
  }

  return cleanup
}
