// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { bindGestureSession } from '../src/gesture-session'

function temp__firePointer(target: Element, type: string, init: { clientX?: number; clientY?: number } = {}): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, button: 0, ...init }))
}

describe('bindGestureSession — abort', () => {
  it('is a no-op when no session is in flight', () => {
    const node = document.createElement('div')
    const handle = bindGestureSession(node, {
      onStart: () => ({}),
      onMove: () => {},
      onEnd: () => {
        throw new Error('onEnd must not fire for an abort with no session in flight')
      }
    })

    expect(() => handle.abort()).not.toThrow()
    expect(handle.isActive()).toBe(false)
  })

  it('ends an in-flight session with apply=false, like pointercancel', () => {
    const node = document.createElement('div')
    node.setPointerCapture = () => {}
    node.hasPointerCapture = () => false
    const ended: Array<{ apply: boolean; event: PointerEvent | null }> = []
    const handle = bindGestureSession(node, {
      onStart: () => ({ started: true }),
      onMove: () => {},
      onEnd: (_session, apply, event) => ended.push({ apply, event })
    })

    temp__firePointer(node, 'pointerdown')
    expect(handle.isActive()).toBe(true)

    handle.abort()
    expect(handle.isActive()).toBe(false)
    expect(ended).toHaveLength(1)
    expect(ended[0]!.apply).toBe(false)
    expect(ended[0]!.event).toBeNull()
  })
})
