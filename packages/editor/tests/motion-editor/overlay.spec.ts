/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMotionOverlay, type MotionOverlaySegment } from '../../src/motion-editor/overlay'
import { frameVisualCenter, motionPathPointAtProgress } from '../../src/motion-editor/geometry'
import type { SelectionFrameValue } from '../../src/decor-editor/types'

const frame: SelectionFrameValue = { x: 20, y: 30, width: 100, height: 60 }
const segment: MotionOverlaySegment = {
  sourceFrame: frame,
  targetFrame: { ...frame, x: 220, y: 120 },
  control: { x: 170, y: 105 },
  role: 'target',
}

/** Creates the pointer event shape expected by the shared gesture-session adapter in jsdom. */
function pointerEvent(type: string, clientX: number, clientY: number, pointerId = 1): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  Object.defineProperty(event, 'buttons', { value: type === 'pointerup' ? 0 : 1 })
  return event
}

describe('motion overlay', () => {
  let host: HTMLElement

  beforeEach(() => {
    HTMLElement.prototype.setPointerCapture = () => undefined
    HTMLElement.prototype.hasPointerCapture = () => false
    HTMLElement.prototype.releasePointerCapture = () => undefined
    host = document.createElement('div')
    Object.defineProperty(host, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 600, height: 400, right: 600, bottom: 400 }),
    })
    document.body.appendChild(host)
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('keeps the path control hidden until a scene selection supplies a segment', () => {
    const overlay = createMotionOverlay(host, {
      onDrop: () => null,
      onActivateRole: () => undefined,
      onPathActivate: () => undefined,
      onPathChange: () => undefined,
    })

    expect(host.querySelector<HTMLElement>('[data-motion-path-control]')?.style.display).toBe('none')
    expect(host.querySelector<SVGPathElement>('[data-motion-path]')?.style.display).toBe('none')
    overlay.destroy()
  })

  it('moves the median control and the visible path during the drag, before release', () => {
    const changes: Array<{ control: { x: number; y: number }; path?: string }> = []
    const overlay = createMotionOverlay(host, {
      onDrop: () => null,
      onActivateRole: () => undefined,
      onPathActivate: () => undefined,
      onPathChange: (change) => changes.push(change),
    })
    overlay.setSelection(segment.targetFrame, true)
    overlay.setSegment(segment)

    const control = host.querySelector<HTMLElement>('[data-motion-path-control]')!
    const initialLeft = control.style.left
    control.dispatchEvent(pointerEvent('pointerdown', 170, 105))
    control.dispatchEvent(pointerEvent('pointermove', 180, 160))

    expect(control.style.left).not.toBe(initialLeft)
    const median = motionPathPointAtProgress(
      frameVisualCenter(segment.sourceFrame),
      { x: 180, y: 160 },
      frameVisualCenter(segment.targetFrame),
      0.5,
    )
    expect(control.style.left).toBe(`${median.x - 6}px`)
    expect(control.style.top).toBe(`${median.y - 6}px`)
    expect(host.querySelector<SVGPathElement>('[data-motion-path]')?.getAttribute('d')).toContain('A')
    expect(changes).toHaveLength(0)

    control.dispatchEvent(pointerEvent('pointerup', 180, 160))
    expect(changes).toHaveLength(1)
    expect(changes[0]?.path).toMatch(/^M 0 0 A /)
    overlay.destroy()
  })
})
