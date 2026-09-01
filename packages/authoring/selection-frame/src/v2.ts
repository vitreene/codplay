/** V2-neutral selection-frame entry point used by the editor integration. */

export type SelectionFrameHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** Local-pixel frame value supplied by the owning editor. */
export type SelectionFrameValue = Readonly<{
  x: number
  y: number
  width: number
  height: number
  rotate?: number
  scaleX?: number
  scaleY?: number
}>

/** Raw local-pixel gesture delta emitted by the frame. */
export type SelectionFrameDelta = Readonly<
  | { kind: 'move'; dx: number; dy: number }
  | { kind: 'resize'; handle: SelectionFrameHandleId; dx: number; dy: number }
>

export type SelectionFrameV2Options = Readonly<{
  /** Stable scene overlay host; it is not a player item node. */
  sceneRoot: HTMLElement
  /** Computes and previews a candidate from one raw pixel delta. */
  onPreview: (delta: SelectionFrameDelta) => SelectionFrameValue | null
  /** Commits the last accepted candidate through the owning editor bridge. */
  onCommit: (value: SelectionFrameValue) => void
  /** Abandons the current gesture without producing a document mutation. */
  onCancel?: () => void
}>

export type SelectionFrameV2Handle = Readonly<{
  element: HTMLElement
  setValue: (value: SelectionFrameValue | null) => void
  setSuspended: (suspended: boolean) => void
  isGestureActive: () => boolean
  destroy: () => void
}>

import { bindGestureSession, type GestureSessionHandle } from './gesture-session'
import { createHandleNode, type HandleId } from './handle-geometry'

type Gesture = Readonly<{
  startX: number
  startY: number
  handle?: SelectionFrameHandleId
}>

const HANDLE_IDS: readonly SelectionFrameHandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** Creates the V2-neutral move/resize overlay owned by the editor. */
export function createSelectionFrameV2(options: SelectionFrameV2Options): SelectionFrameV2Handle {
  const frame = options.sceneRoot.ownerDocument.createElement('div')
  frame.dataset.selectionFrame = 'v2'
  frame.setAttribute('data-selection-frame', 'v2')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'absolute'
  frame.style.boxSizing = 'border-box'
  frame.style.border = '1px solid #38bdf8'
  frame.style.pointerEvents = 'auto'
  frame.style.touchAction = 'none'
  frame.style.zIndex = '1000'
  frame.style.display = 'none'

  const handles = new Map<SelectionFrameHandleId, HTMLElement>()
  for (const id of HANDLE_IDS) {
    const handle = createHandleNode({
      doc: options.sceneRoot.ownerDocument,
      id: id as HandleId,
      attributeName: 'data-selection-frame-handle',
      borderColor: '#0284c7',
      pointerEventsAuto: true,
    })
    frame.appendChild(handle)
    handles.set(id, handle)
  }
  options.sceneRoot.appendChild(frame)

  let value: SelectionFrameValue | null = null
  let suspended = false
  const gestures: GestureSessionHandle[] = []

  /** Renders one accepted local-pixel value without reading the player DOM. */
  function renderValue(next: SelectionFrameValue | null): void {
    value = next
    if (next === null || suspended) {
      frame.style.display = 'none'
      return
    }
    frame.style.display = ''
    frame.style.left = `${next.x}px`
    frame.style.top = `${next.y}px`
    frame.style.width = `${Math.max(0, next.width)}px`
    frame.style.height = `${Math.max(0, next.height)}px`
    const rotate = next.rotate ?? 0
    const scaleX = next.scaleX ?? 1
    const scaleY = next.scaleY ?? 1
    frame.style.transformOrigin = 'center center'
    frame.style.transform = `rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`
  }

  /** Converts one pointer movement into the raw delta expected by the editor bridge. */
  function deltaFor(event: PointerEvent, gesture: Gesture): SelectionFrameDelta {
    const dx = event.clientX - gesture.startX
    const dy = event.clientY - gesture.startY
    return gesture.handle === undefined
      ? { kind: 'move', dx, dy }
      : { kind: 'resize', handle: gesture.handle, dx, dy }
  }

  /** Applies an accepted preview candidate returned by the owning editor. */
  function preview(event: PointerEvent, gesture: Gesture): void {
    const candidate = options.onPreview(deltaFor(event, gesture))
    if (candidate !== null) renderValue(candidate)
  }

  /** Ends one gesture and delegates commit/abandonment to the owning editor. */
  function endGesture(gesture: Gesture, apply: boolean, event: PointerEvent | null): void {
    if (!apply) {
      options.onCancel?.()
      return
    }
    if (event !== null) preview(event, gesture)
    if (value !== null) options.onCommit(value)
  }

  const bodyGesture = bindGestureSession<Gesture>(frame, {
    onStart: (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-selection-frame-handle]') !== null) return null
      if (value === null || suspended) return null
      return { startX: event.clientX, startY: event.clientY }
    },
    onMove: preview,
    onEnd: endGesture,
  })
  gestures.push(bodyGesture)

  for (const [handleId, handle] of handles) {
    const gesture = bindGestureSession<Gesture>(handle, {
      onStart: (event) => value === null || suspended
        ? null
        : { startX: event.clientX, startY: event.clientY, handle: handleId },
      onMove: preview,
      onEnd: endGesture,
    })
    gestures.push(gesture)
  }

  return {
    element: frame,
    setValue: renderValue,
    setSuspended(next): void {
      suspended = next
      renderValue(value)
    },
    isGestureActive: () => gestures.some((gesture) => gesture.isActive()),
    destroy(): void {
      for (const gesture of gestures) gesture.unbind()
      frame.remove()
    },
  }
}
