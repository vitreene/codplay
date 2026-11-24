/** Callbacks of one timeline pointer gesture. */
export type PointerSessionHandlers = Readonly<{
  /** Called for each move of the gesture's pointer. */
  onMove: (event: PointerEvent) => void
  /** Called exactly once; `apply` is false when the gesture was cancelled, true when it completed. */
  onEnd: (apply: boolean) => void
}>

/**
 * Runs one timeline drag on the persistent drag overlay and ends it exactly once.
 *
 * The overlay captures the pointer, so a release outside the timeline or the window still ends
 * the gesture. A genuine cancellation (`pointercancel`, or Escape) ends it with `apply = false`;
 * `pointerup` and a lost capture complete it, like the shared selection-frame gesture session.
 * The drag starts from a handle that is re-rendered on every timeline change, so the session
 * cannot be bound to the handle's own `pointerdown` as `bindGestureSession` does.
 */
export function runPointerSession(
  overlay: HTMLElement,
  pointerId: number,
  handlers: PointerSessionHandlers,
): void {
  let ended = false

  /** Ends the gesture once: removes every listener, releases the capture, hides the overlay. */
  const end = (apply: boolean): void => {
    if (ended) return
    ended = true
    overlay.removeEventListener('pointermove', onMove)
    overlay.removeEventListener('pointerup', onUp)
    overlay.removeEventListener('pointercancel', onCancel)
    overlay.removeEventListener('lostpointercapture', onUp)
    document.removeEventListener('keydown', onKeyDown, true)
    if (overlay.hasPointerCapture?.(pointerId)) overlay.releasePointerCapture(pointerId)
    overlay.classList.remove('active')
    handlers.onEnd(apply)
  }

  const onMove = (event: PointerEvent): void => {
    if (event.pointerId === pointerId) handlers.onMove(event)
  }
  const onUp = (event: PointerEvent): void => {
    if (event.pointerId === pointerId) end(true)
  }
  const onCancel = (event: PointerEvent): void => {
    if (event.pointerId === pointerId) end(false)
  }
  /** Escape cancels the drag only: it must not also clear the application selection. */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.stopImmediatePropagation()
    end(false)
  }

  overlay.classList.add('active')
  overlay.addEventListener('pointermove', onMove)
  overlay.addEventListener('pointerup', onUp)
  overlay.addEventListener('pointercancel', onCancel)
  overlay.addEventListener('lostpointercapture', onUp)
  document.addEventListener('keydown', onKeyDown, true)
  // Last: a pointer that is no longer active makes the capture throw, after the session is set up.
  overlay.setPointerCapture?.(pointerId)
}
