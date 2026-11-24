// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SequenceEditorController } from '../../src/sequence-editor/controller'
import { mountSequenceEditor } from '../../src/sequence-editor/mount'
import type { EditorScene } from '../../src/sequence-editor/types'
import type { Command } from '../../src/app/controller/types'

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
})

/** One item with two pose keyframes, so the second one can be dragged. */
function scene(): EditorScene {
  return {
    id: 'keyframe-drag',
    meta: { title: 'Drag', durationMs: 10000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [{
      id: 'item',
      type: 'bloc',
      parentId: null,
      order: 'a',
      visible: true,
      contentId: null,
      initialDecorId: 'decor',
      keyframes: [
        { id: 'first', timeMs: 1000, decorId: 'decor' },
        { id: 'second', timeMs: 5000, decorId: 'decor' },
      ],
    }],
    contents: {},
    decors: { decor: { id: 'decor' } },
    zones: {},
    markerTracks: {},
  }
}

const POINTER_ID = 5

/** Builds a pointer event with an explicit pointer id, whatever the DOM implementation provides. */
function pointerEvent(type: string, init: { clientX?: number } = {}): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.clientX ?? 0 })
  Object.defineProperty(event, 'pointerId', { value: POINTER_ID })
  return event
}

describe('sequence-editor — real keyframe drag', () => {
  let controller: SequenceEditorController | undefined
  let mounted: { destroy(): void } | undefined
  let overlay: HTMLElement
  let batches: Command[][]

  /** Mounts the timeline and starts a drag on the second keyframe's handle. */
  function startDrag(): void {
    controller = new SequenceEditorController(scene())
    batches = []
    controller.onCommand((commands) => batches.push(commands))
    const container = document.createElement('div')
    document.body.append(container)
    mounted = mountSequenceEditor(container, controller)
    overlay = container.querySelector<HTMLElement>('.seq-drag-overlay')!
    container.querySelector('.seq-row[data-track-id="item"] [data-kf-id="second"] polygon')!
      .dispatchEvent(pointerEvent('pointerdown'))
    expect(controller.getSnapshot().value).toBe('dragging-keyframe')
  }

  afterEach(() => {
    mounted?.destroy()
    controller?.destroy()
    mounted = undefined
    controller = undefined
    document.body.replaceChildren()
  })

  it('writes nothing for a click that never leaves the keyframe', () => {
    startDrag()
    overlay.dispatchEvent(pointerEvent('pointerup'))

    expect(controller!.getSnapshot().value).toBe('idle')
    expect(controller!.getSnapshot().context.interaction).toBeNull()
    expect(batches).toEqual([])
    expect(overlay.classList.contains('active')).toBe(false)
  })

  it('moves the keyframe once when the drag leaves its origin and completes', () => {
    startDrag()
    overlay.dispatchEvent(pointerEvent('pointermove', { clientX: 30 }))
    overlay.dispatchEvent(pointerEvent('pointerup', { clientX: 30 }))

    expect(batches).toHaveLength(1)
    expect(batches[0]![0]).toMatchObject({ name: 'moveKeyframe', args: { itemId: 'item', keyframeId: 'second' } })
    expect(batches[0]![0]).not.toMatchObject({ args: { timeMs: 5000 } })
    expect(controller!.getSnapshot().value).toBe('idle')
  })

  it('abandons the drag on pointercancel without any edit', () => {
    startDrag()
    overlay.dispatchEvent(pointerEvent('pointermove', { clientX: 30 }))
    overlay.dispatchEvent(pointerEvent('pointercancel'))

    expect(batches).toEqual([])
    expect(controller!.getSnapshot().value).toBe('idle')
    expect(overlay.classList.contains('active')).toBe(false)
    // A later pointer event can no longer move anything: the session is over.
    overlay.dispatchEvent(pointerEvent('pointerup', { clientX: 60 }))
    expect(batches).toEqual([])
  })

  it('abandons the drag on Escape and keeps the key from reaching the application', () => {
    startDrag()
    overlay.dispatchEvent(pointerEvent('pointermove', { clientX: 30 }))
    const reachedApplication: string[] = []
    document.addEventListener('keydown', (event) => reachedApplication.push(event.key))
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(batches).toEqual([])
    expect(controller!.getSnapshot().value).toBe('idle')
    expect(reachedApplication).toEqual([])
  })

  it('completes the drag when the pointer capture is lost, like a release', () => {
    startDrag()
    overlay.dispatchEvent(pointerEvent('pointermove', { clientX: 30 }))
    overlay.dispatchEvent(pointerEvent('lostpointercapture'))

    expect(batches).toHaveLength(1)
    expect(controller!.getSnapshot().value).toBe('idle')
  })
})
