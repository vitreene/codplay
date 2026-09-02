/** V2-neutral selection-frame entry point with composable capability modules. */

import { bindGestureSession, type GestureSessionHandle } from './gesture-session'
import { createHandleNode, type HandleId } from './handle-geometry'
import { createRotationModifier } from './v2/rotation-modifier'
import type {
  SelectionFrameDelta,
  SelectionFrameHandleId,
  SelectionFrameV2Modifier,
  SelectionFrameV2ModifierHandle,
  SelectionFrameV2Handle,
  SelectionFrameV2Options,
  SelectionFrameValue,
} from './v2/types'

export type {
  SelectionFrameDelta,
  SelectionFrameHandleId,
  SelectionFrameRotationOrigin,
  SelectionFrameV2Modifier,
  SelectionFrameV2ModifierContext,
  SelectionFrameV2ModifierHandle,
  SelectionFrameV2Options,
  SelectionFrameV2Handle,
  SelectionFrameValue,
} from './v2/types'
export { createRotationModifier } from './v2/rotation-modifier'

type Gesture = Readonly<{
  startX: number
  startY: number
  handle?: SelectionFrameHandleId
}>

const HANDLE_IDS: readonly SelectionFrameHandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** Creates the V2-neutral move/resize overlay and composes explicit capability modules. */
export function createSelectionFrameV2(options: SelectionFrameV2Options): SelectionFrameV2Handle {
  const doc = options.sceneRoot.ownerDocument
  const frame = doc.createElement('div')
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
      doc,
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
  const suppressedHandles = new Map<SelectionFrameHandleId, Set<symbol>>()
  const gestures: GestureSessionHandle[] = []
  const modifierHandles: SelectionFrameV2ModifierHandle[] = []

  /** Updates the visibility of base handles after a modifier reserves one point. */
  function refreshHandleVisibility(): void {
    for (const [id, handle] of handles) {
      handle.style.display = (suppressedHandles.get(id)?.size ?? 0) > 0 ? 'none' : ''
    }
  }

  /** Lets one modifier reserve/release a base handle without owning its DOM. */
  function setHandleSuppressed(owner: symbol, handle: SelectionFrameHandleId, suppressed: boolean): void {
    const owners = suppressedHandles.get(handle) ?? new Set<symbol>()
    if (suppressed) {
      owners.add(owner)
      suppressedHandles.set(handle, owners)
    } else {
      owners.delete(owner)
      if (owners.size === 0) suppressedHandles.delete(handle)
    }
    refreshHandleVisibility()
  }

  /** Renders one accepted local-pixel value and notifies every composed modifier. */
  function renderValue(next: SelectionFrameValue | null): void {
    value = next
    for (const modifier of modifierHandles) modifier.update(next)
    if (next === null || suspended) {
      frame.style.display = 'none'
      return
    }
    frame.style.display = ''
    frame.style.left = `${next.x}px`
    frame.style.top = `${next.y}px`
    frame.style.width = `${Math.max(0, next.width)}px`
    frame.style.height = `${Math.max(0, next.height)}px`
    frame.style.transformOrigin = `${(next.rotationOrigin?.fx ?? 0.5) * 100}% ${(next.rotationOrigin?.fy ?? 0.5) * 100}%`
    const rotate = next.rotate ?? 0
    const scaleX = next.scaleX ?? 1
    const scaleY = next.scaleY ?? 1
    frame.style.transform = `rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`
    refreshHandleVisibility()
  }

  const activeModifiers: readonly SelectionFrameV2Modifier[] = options.modifiers ?? [createRotationModifier()]
  const modifierContextBase = {
    sceneRoot: options.sceneRoot,
    frame,
    getValue: () => value,
    onPreview: options.onPreview,
    renderValue,
    onCommit: options.onCommit,
    onCancel: () => options.onCancel?.(),
    isSuspended: () => suspended,
  }
  for (const modifier of activeModifiers) {
    const owner = Symbol(modifier.name)
    modifierHandles.push(modifier.mount({
      ...modifierContextBase,
      setHandleSuppressed: (handle, suppressed) => setHandleSuppressed(owner, handle, suppressed),
    }))
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

  /** Ends one base gesture and delegates commit/abandonment to the owning editor. */
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
      if (modifierHandles.some((modifier) => modifier.ownsTarget(target))) return null
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
    setValue(next): void {
      // A new selection/rebuild starts with no transient state from a previous capability module.
      suppressedHandles.clear()
      for (const modifier of modifierHandles) modifier.reset()
      renderValue(next)
    },
    setSuspended(next): void {
      suspended = next
      renderValue(value)
    },
    isGestureActive: () => gestures.some((gesture) => gesture.isActive())
      || modifierHandles.some((modifier) => modifier.isGestureActive()),
    destroy(): void {
      for (const gesture of gestures) gesture.unbind()
      for (const modifier of modifierHandles) modifier.destroy()
      frame.remove()
    },
  }
}
