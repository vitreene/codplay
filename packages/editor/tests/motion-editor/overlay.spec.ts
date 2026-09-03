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

  it('keeps both distinct endpoint ghosts visible and delegates endpoint clicks', () => {
    const roles: string[] = []
    const overlay = createMotionOverlay(host, {
      onDrop: () => null,
      onActivateRole: (role) => roles.push(role),
      onPathActivate: () => undefined,
      onPathChange: () => undefined,
    })
    overlay.setSelection({ ...segment.sourceFrame, x: 120, y: 80 }, true)
    overlay.setSegment(segment)

    const sourceGhost = host.querySelector<HTMLElement>('[data-motion-ghost="source"]')!
    const targetGhost = host.querySelector<HTMLElement>('[data-motion-ghost="target"]')!
    expect(sourceGhost.style.display).toBe('')
    expect(targetGhost.style.display).toBe('')
    expect(sourceGhost.style.pointerEvents).toBe('auto')
    expect(targetGhost.style.pointerEvents).toBe('auto')

    sourceGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    targetGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(roles).toEqual(['source', 'target'])
    overlay.destroy()
  })

  it('hides the endpoint ghost occupied by the live pose', () => {
    const roles: string[] = []
    const overlay = createMotionOverlay(host, {
      onDrop: () => null,
      onActivateRole: (role) => roles.push(role),
      onPathActivate: () => undefined,
      onPathChange: () => undefined,
    })
    // The source ghost is brought back to the same pose by a reposition. The source artefact is
    // hidden while the opposite endpoint remains visible and navigable.
    overlay.setSelection(segment.sourceFrame, true)
    overlay.setSegment({
      ...segment,
      sourceFrame: { ...segment.sourceFrame, width: segment.sourceFrame.width + 0.02 },
    })

    const sourceGhost = host.querySelector<HTMLElement>('[data-motion-ghost="source"]')!
    const targetGhost = host.querySelector<HTMLElement>('[data-motion-ghost="target"]')!
    expect(sourceGhost.style.display).toBe('none')
    expect(sourceGhost.style.pointerEvents).toBe('none')
    expect(targetGhost.style.display).toBe('')
    expect(targetGhost.style.pointerEvents).toBe('auto')
    targetGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(roles).toEqual(['target'])
    overlay.destroy()
  })

  it('renders inactive paths as translucent, non-interactive artefacts without extra medians', () => {
    const overlay = createMotionOverlay(host, {
      onDrop: () => null,
      onActivateRole: () => undefined,
      onPathActivate: () => undefined,
      onPathChange: () => undefined,
    })
    const inactive: MotionOverlaySegment = {
      id: 'previous',
      sourceFrame: frame,
      targetFrame: { ...frame, x: 120, y: 80 },
      control: { x: 70, y: 65 },
      active: false,
    }
    const inactiveLater: MotionOverlaySegment = {
      id: 'later',
      sourceFrame: { ...frame, x: 320, y: 100 },
      targetFrame: { ...frame, x: 420, y: 180 },
      control: { x: 370, y: 165 },
      active: false,
    }
    const active: MotionOverlaySegment = {
      ...segment,
      id: 'current',
      active: true,
    }
    overlay.setSelection(active.targetFrame, true)
    overlay.setSegments([inactive, active, inactiveLater])

    expect(host.querySelectorAll('[data-motion-path]')).toHaveLength(3)
    const inactivePaths = [...host.querySelectorAll<SVGPathElement>('[data-motion-path-inactive]')]
    expect(inactivePaths).toHaveLength(2)
    expect(inactivePaths.map((candidate) => candidate.style.opacity)).toEqual(['0.28', '0.56'])
    expect(inactivePaths.every((candidate) => candidate.style.pointerEvents === 'none')).toBe(true)
    expect(host.querySelectorAll('[data-motion-path-control]')).toHaveLength(1)
    overlay.destroy()
  })

  it('keeps the first pose as a route-level ghost without duplicating the active source', () => {
    let initialActivations = 0
    const overlay = createMotionOverlay(host, {
      onDrop: () => null,
      onActivateRole: () => undefined,
      onActivateInitial: () => { initialActivations += 1 },
      onPathActivate: () => undefined,
      onPathChange: () => undefined,
    })
    const initialFrame: SelectionFrameValue = { ...frame, x: 0, y: 10 }
    overlay.setSelection(segment.targetFrame, true)
    overlay.setSegments([{ ...segment, id: 'current', active: true }])
    overlay.setInitialGhost(initialFrame)

    const initialGhost = host.querySelector<HTMLElement>('[data-motion-ghost="initial"]')!
    expect(initialGhost.style.display).toBe('')
    expect(initialGhost.style.left).toBe('0px')
    expect(initialGhost.style.top).toBe('10px')
    expect(initialGhost.style.opacity).toBe('0.28')
    initialGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(initialActivations).toBe(1)

    // The first segment's source is already the initial pose: only its normal source ghost is
    // retained, so a route projection never draws two identical outlines.
    overlay.setInitialGhost(segment.sourceFrame)
    expect(initialGhost.style.display).toBe('none')
    overlay.destroy()
  })
})
