import { bindGestureSession } from '@codplay/selection-frame/gesture-session'
import type { SelectionFrameValue } from '../../decor-editor/types'

type MoveDelta = Readonly<{ dx: number; dy: number }>

type MoveSession = {
  startX: number
  startY: number
  base: SelectionFrameValue
  current: SelectionFrameValue
  moved: boolean
}

type BlockMoveControlOptions = Readonly<{
  sceneRoot: HTMLElement
  onPreview: (delta: MoveDelta) => SelectionFrameValue | null
  onCommit: (value: SelectionFrameValue) => void
  onCancel: (source: SelectionFrameValue) => void
  onGestureStart: () => void
  onGestureEnd: () => void
}>

export type BlockMoveControlHandle = Readonly<{
  element: HTMLElement
  setValue: (value: SelectionFrameValue | null, movable?: boolean) => void
  isGestureActive: () => boolean
  destroy: () => void
}>

/** Creates the move-only control used for zone reassignment in Block mode. */
export function createBlockMoveControl(options: BlockMoveControlOptions): BlockMoveControlHandle {
  const element = options.sceneRoot.ownerDocument.createElement('div')
  element.id = 'editor-block-move-control'
  element.dataset.editorOverlay = ''
  element.setAttribute('aria-hidden', 'true')
  element.style.position = 'absolute'
  element.style.boxSizing = 'border-box'
  element.style.border = '1px solid #4a90d9'
  element.style.pointerEvents = 'auto'
  element.style.touchAction = 'none'
  element.style.zIndex = '1160'
  element.style.display = 'none'
  element.style.cursor = 'move'
  options.sceneRoot.appendChild(element)

  let value: SelectionFrameValue | null = null
  let movable = false

  /** Renders the accepted item pose as a single draggable outline without resize or transform handles. */
  function render(next: SelectionFrameValue | null, canMove: boolean): void {
    value = next
    movable = canMove
    if (next === null) {
      element.style.display = 'none'
      return
    }
    element.style.display = ''
    element.style.pointerEvents = canMove ? 'auto' : 'none'
    element.style.cursor = canMove ? 'move' : 'default'
    element.style.left = `${next.x}px`
    element.style.top = `${next.y}px`
    element.style.width = `${Math.max(0, next.width)}px`
    element.style.height = `${Math.max(0, next.height)}px`
    element.style.transformOrigin = `${(next.rotationOrigin?.fx ?? 0.5) * 100}% ${(next.rotationOrigin?.fy ?? 0.5) * 100}%`
    element.style.transform = `rotate(${next.rotate ?? 0}deg) scale(${next.scaleX ?? 1}, ${next.scaleY ?? 1})`
  }

  const gesture = bindGestureSession<MoveSession>(element, {
    onStart(event) {
      if (value === null || !movable) return null
      event.preventDefault()
      options.onGestureStart()
      return { startX: event.clientX, startY: event.clientY, base: value, current: value, moved: false }
    },
    onMove(event, session) {
      const bounds = options.sceneRoot.getBoundingClientRect()
      const width = options.sceneRoot.clientWidth
      const height = options.sceneRoot.clientHeight
      if (bounds.width <= 0 || bounds.height <= 0 || width <= 0 || height <= 0) return
      const delta = {
        dx: (event.clientX - session.startX) * width / bounds.width,
        dy: (event.clientY - session.startY) * height / bounds.height,
      }
      if (Math.abs(delta.dx) + Math.abs(delta.dy) < 0.5) return
      session.moved = true
      const next = options.onPreview(delta)
      if (next === null) return
      session.current = next
      render(next, true)
    },
    onEnd(session, apply) {
      try {
        if (!session.moved) return
        if (apply) {
          options.onCommit(session.current)
          return
        }
        options.onCancel(session.base)
        render(session.base, true)
      } finally {
        options.onGestureEnd()
      }
    },
  })

  return {
    element,
    setValue(next, canMove = false): void {
      if (next === null || !canMove) gesture.abort()
      render(next, canMove)
    },
    isGestureActive: gesture.isActive,
    destroy(): void {
      gesture.unbind()
      gesture.abort()
      element.remove()
    },
  }
}
