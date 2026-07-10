/**
 * Shared pointer-gesture session wiring, reused by every drag/resize/rotate/
 * pivot/trace gesture across selection-frame and its creation/zone-editor
 * variants. Encapsulates the "Robustesse des gestes" rules (v1 plan,
 * docs/plans/2026-06-09-selection-frame-plan.md): only the primary button
 * starts a session; pointer capture is released BEFORE any risky call; a
 * session ends on pointerup, pointercancel, lostpointercapture, or a
 * pointermove arriving with buttons === 0 (missed release) — without this, a
 * surviving session turns a plain hover into a gesture.
 *
 * `lostpointercapture` always APPLIES the gesture at its current point, never
 * treated as an abort. Found by testing on a real drag (large capturing
 * element, e.g. zone-editor's own grid background): browsers can deliver
 * `lostpointercapture` mid-gesture even with the button still held, not just
 * on release — no reliable signal in this codebase (button state, timing,
 * viewport bounds) distinguished a "real" abort from a normal one. Matches
 * the only other precedent in this package (`multi-selection-frame.ts`'s own
 * `lostpointercapture` handling), which never attempted this distinction
 * either: always apply the session's own last-known state, exactly like a
 * `pointerup`. Only `pointercancel` (a genuine hardware-level interruption)
 * still aborts.
 */

/** Releases pointer capture without letting an InvalidPointerId abort the caller. */
export function safeReleaseCapture(node: HTMLElement, pointerId: number): void {
  try {
    if (node.hasPointerCapture(pointerId)) {
      node.releasePointerCapture(pointerId)
    }
  } catch {
    // Capture already gone (pointercancel, implicit release): nothing to do.
  }
}

export type GestureSessionHandlers<S> = {
  /**
   * Primary-button pointerdown on the target node. Return a session payload
   * to start capturing pointer events, or null/undefined to ignore the
   * gesture (e.g. a guard failed, or an alt-click consumed the event instead).
   */
  onStart: (event: PointerEvent) => S | null | undefined
  onMove: (event: PointerEvent, session: S) => void
  /**
   * Called exactly once when the session ends: a release (apply = true —
   * pointerup, a pointermove with buttons === 0 delivered before the
   * pointerup, or lostpointercapture — always treated as a completed
   * gesture, see this file's own top comment), or a genuine abort
   * (apply = false — pointercancel only). Pointer capture is already
   * released by the time this runs.
   */
  onEnd: (session: S, apply: boolean, event: PointerEvent | null) => void
}

export type GestureSessionHandle = {
  unbind: () => void
  /** Whether a session is currently in flight on this target. */
  isActive: () => boolean
}

/**
 * Wires one pointer-gesture session (drag/resize/rotate/pivot/trace) on
 * targetNode, applying the session robustness rules uniformly.
 */
export function bindGestureSession<S>(
  targetNode: HTMLElement,
  handlers: GestureSessionHandlers<S>
): GestureSessionHandle {
  let session: S | null = null
  let pointerId: number | null = null

  const end = (apply: boolean, event: PointerEvent | null): void => {
    if (session === null || pointerId === null) return
    const activeSession = session
    const activePointerId = pointerId
    session = null
    pointerId = null
    safeReleaseCapture(targetNode, activePointerId)
    handlers.onEnd(activeSession, apply, event)
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    const next = handlers.onStart(event)
    if (next === null || next === undefined) return
    session = next
    pointerId = event.pointerId
    targetNode.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (session === null || event.pointerId !== pointerId) return
    if (event.buttons === 0) {
      // buttons === 0 means the button was RELEASED, not that the gesture was
      // aborted: browsers coalesce pointermoves, and on a fast release a last
      // move with buttons already 0 can precede the pointerup — treating it
      // as an abort would swallow the drop. Apply at the current point; only
      // pointercancel is a genuine abort.
      end(true, event)
      return
    }
    handlers.onMove(event, session)
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (session === null || event.pointerId !== pointerId) return
    end(true, event)
  }

  const onPointerCancel = (event: PointerEvent): void => {
    if (session === null || event.pointerId !== pointerId) return
    end(false, event)
  }

  const onLostPointerCapture = (event: PointerEvent): void => {
    if (session === null || event.pointerId !== pointerId) return
    end(true, event)
  }

  targetNode.addEventListener('pointerdown', onPointerDown)
  targetNode.addEventListener('pointermove', onPointerMove)
  targetNode.addEventListener('pointerup', onPointerUp)
  targetNode.addEventListener('pointercancel', onPointerCancel)
  targetNode.addEventListener('lostpointercapture', onLostPointerCapture)

  return {
    unbind(): void {
      targetNode.removeEventListener('pointerdown', onPointerDown)
      targetNode.removeEventListener('pointermove', onPointerMove)
      targetNode.removeEventListener('pointerup', onPointerUp)
      targetNode.removeEventListener('pointercancel', onPointerCancel)
      targetNode.removeEventListener('lostpointercapture', onLostPointerCapture)
    },
    isActive: () => session !== null
  }
}
