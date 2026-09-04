/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMotionOverlay, type MotionOverlayGhost, type MotionOverlaySegment } from '../../src/motion-editor/overlay'
import { createMotionArcPath, frameVisualCenter, motionPathPointAtProgress } from '../../src/motion-editor/geometry'
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

  it('uses one full-frame movement surface without a central or border split', () => {
    const overlay = createMotionOverlay(host, {
      onDrop: () => null,
      onActivateRole: () => undefined,
      onPathActivate: () => undefined,
      onPathChange: () => undefined,
    })
    overlay.setSelection(frame, true)

    const moveZones = host.querySelectorAll<HTMLElement>('[data-motion-move-zone]')
    expect(moveZones).toHaveLength(1)
    expect(moveZones[0]?.style.clipPath).toBe('none')
    expect(host.querySelector('[data-motion-border]')).toBeNull()
    expect(moveZones[0]?.style.left).toBe(`${frame.x}px`)
    expect(moveZones[0]?.style.width).toBe(`${frame.width}px`)
    overlay.destroy()
  })

  it('previews a temporary middle keyframe as the two route segments that will be committed', () => {
    const drops: Array<{ sourceFrame: SelectionFrameValue; targetFrame: SelectionFrameValue }> = []
    const overlay = createMotionOverlay(host, {
      onDrop: (drop) => {
        drops.push(drop)
        return null
      },
      onActivateRole: () => undefined,
      onPathActivate: () => undefined,
      onPathChange: () => undefined,
    })
    const temporaryPose = { ...frame, x: 120, y: 80 }
    const temporarySegment: MotionOverlaySegment = {
      ...segment,
      sourceKeyframeId: 'source-kf',
      targetKeyframeId: 'target-kf',
      role: 'source',
      isTemporary: true,
    }
    overlay.setSegments([temporarySegment])
    overlay.setSelection(temporaryPose, true)

    const moveZone = host.querySelector<HTMLElement>('[data-motion-move-zone]')!
    expect(moveZone.style.left).toBe(`${temporaryPose.x}px`)
    expect(moveZone.style.top).toBe(`${temporaryPose.y}px`)
    expect(moveZone.style.zIndex).toBe('5')
    moveZone.dispatchEvent(pointerEvent('pointerdown', temporaryPose.x, temporaryPose.y))
    moveZone.dispatchEvent(pointerEvent('pointermove', temporaryPose.x + 20, temporaryPose.y + 10))

    const paths = [...host.querySelectorAll<SVGPathElement>('[data-motion-path]')]
    expect(paths).toHaveLength(2)
    const activePath = host.querySelector<SVGPathElement>('[data-motion-path-active]')!
    const inactivePath = host.querySelector<SVGPathElement>('[data-motion-path-inactive]')!
    expect(activePath.getAttribute('d')).toBe('M 70 60 L 190 120')
    expect(inactivePath.getAttribute('d')).toBe('M 190 120 L 270 150')
    expect(activePath.style.opacity).toBe('1')
    expect(inactivePath.style.opacity).toBe('0.15')

    moveZone.dispatchEvent(pointerEvent('pointerup', temporaryPose.x + 20, temporaryPose.y + 10))
    expect(drops).toHaveLength(1)
    expect(drops[0]?.sourceFrame).toEqual(temporaryPose)
    overlay.destroy()
  })

  it('keeps an existing target path on the second half of a temporary split', () => {
    const overlay = createMotionOverlay(host, {
      onDrop: () => null,
      onActivateRole: () => undefined,
      onPathActivate: () => undefined,
      onPathChange: () => undefined,
    })
    const targetFrame = { ...frame, x: 220, y: 120 }
    const sourceCenter = frameVisualCenter(frame)
    const targetCenter = frameVisualCenter(targetFrame)
    const authoredControl = { x: 170, y: 20 }
    const authoredPath = createMotionArcPath(sourceCenter, authoredControl, targetCenter)
    expect(authoredPath).toBeDefined()
    overlay.setSegments([{
      sourceKeyframeId: 'source-kf',
      targetKeyframeId: 'target-kf',
      sourceFrame: frame,
      targetFrame,
      control: authoredControl,
      path: authoredPath,
      isTemporary: true,
    }])
    const temporaryPose = { ...frame, x: 120, y: 80 }
    overlay.setSelection(temporaryPose, true)

    const moveZone = host.querySelector<HTMLElement>('[data-motion-move-zone]')!
    moveZone.dispatchEvent(pointerEvent('pointerdown', temporaryPose.x, temporaryPose.y))
    moveZone.dispatchEvent(pointerEvent('pointermove', temporaryPose.x + 20, temporaryPose.y + 10))

    expect(host.querySelector<SVGPathElement>('[data-motion-path-active]')?.getAttribute('d')).not.toContain('A')
    expect(host.querySelector<SVGPathElement>('[data-motion-path-inactive]')?.getAttribute('d')).toContain('A')
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

  it('routes structured endpoint ghost clicks through their keyframe ids', () => {
    const roles: string[] = []
    const keyframes: string[] = []
    const overlay = createMotionOverlay(host, {
      onDrop: () => null,
      onActivateRole: (role) => roles.push(role),
      onActivateKeyframe: (keyframeId) => keyframes.push(keyframeId),
      onPathActivate: () => undefined,
      onPathChange: () => undefined,
    })
    const structuredSegment: MotionOverlaySegment = {
      ...segment,
      sourceKeyframeId: 'source-kf',
      targetKeyframeId: 'target-kf',
    }
    overlay.setSelection({ ...segment.sourceFrame, x: 120, y: 80 }, true)
    overlay.setSegment(structuredSegment)
    overlay.setGhosts([
      { id: 'source-ghost', keyframeId: 'source-kf', frame: segment.sourceFrame, chainDistance: 0 },
      { id: 'target-ghost', keyframeId: 'target-kf', frame: segment.targetFrame, chainDistance: 0 },
    ])

    host.querySelector<HTMLElement>('[data-motion-ghost="source"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    host.querySelector<HTMLElement>('[data-motion-ghost="target"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(keyframes).toEqual(['source-kf', 'target-kf'])
    expect(roles).toEqual([])
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
    expect(inactivePaths.map((candidate) => candidate.style.opacity)).toEqual(['0.15', '0.15'])
    expect(inactivePaths.every((candidate) => candidate.style.stroke !== '#f59e0b')).toBe(true)
    expect(inactivePaths.every((candidate) => candidate.style.pointerEvents === 'none')).toBe(true)
    expect(host.querySelectorAll('[data-motion-path-control]')).toHaveLength(1)
    overlay.destroy()
  })

  it('renders every item keyframe ghost with a chain-distance colour and click target', () => {
    const activated: string[] = []
    const overlay = createMotionOverlay(host, {
      onDrop: () => null,
      onActivateRole: () => undefined,
      onActivateKeyframe: (keyframeId) => activated.push(keyframeId),
      onPathActivate: () => undefined,
      onPathChange: () => undefined,
    })
    const frames = [0, 1, 2, 3, 4].map((index) => ({ ...frame, x: index * 120 }))
    const ghosts: MotionOverlayGhost[] = frames.map((ghostFrame, index) => ({
      id: `ghost-${index}`,
      keyframeId: `kf-${index}`,
      frame: ghostFrame,
      chainDistance: Math.abs(index - 2),
      ...(index === 0 ? { isInitial: true } : {}),
    }))
    overlay.setSelection(frames[2]!, true)
    overlay.setSegments([{
      ...segment,
      sourceKeyframeId: 'kf-1',
      targetKeyframeId: 'kf-2',
      sourceFrame: frames[1]!,
      targetFrame: frames[2]!,
      active: true,
    }])
    overlay.setGhosts(ghosts)

    const renderedGhosts = [...host.querySelectorAll<HTMLElement>('[data-motion-ghost]')]
    expect(renderedGhosts).toHaveLength(5)
    expect(host.querySelector<HTMLElement>('[data-motion-keyframe-id="kf-2"]')?.style.display).toBe('none')
    for (const keyframeId of ['kf-0', 'kf-1', 'kf-3', 'kf-4']) {
      expect(host.querySelector<HTMLElement>(`[data-motion-keyframe-id="${keyframeId}"]`)?.style.display).not.toBe('none')
    }

    const nearest = host.querySelector<HTMLElement>('[data-motion-keyframe-id="kf-1"]')!
    const nearbyInactive = host.querySelector<HTMLElement>('[data-motion-keyframe-id="kf-3"]')!
    const farther = host.querySelector<HTMLElement>('[data-motion-keyframe-id="kf-4"]')!
    expect(nearest.dataset.motionGhostDistance).toBe('1')
    expect(farther.dataset.motionGhostDistance).toBe('2')
    expect(nearest.style.opacity).toBe('1')
    expect(nearbyInactive.style.opacity).toBe('0.18')
    expect(farther.style.opacity).toBe('0.16')
    expect(nearbyInactive.style.borderColor).not.toBe(farther.style.borderColor)

    farther.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(activated).toEqual(['kf-4'])
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
    expect(initialGhost.style.opacity).toBe('0.16')
    initialGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(initialActivations).toBe(1)

    // The first segment's source is already the initial pose: only its normal source ghost is
    // retained, so a route projection never draws two identical outlines.
    overlay.setInitialGhost(segment.sourceFrame)
    expect(initialGhost.style.display).toBe('none')
    overlay.destroy()
  })
})
