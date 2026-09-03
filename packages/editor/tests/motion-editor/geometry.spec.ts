import { describe, expect, it } from 'vitest'
import {
  createDisplayArcPath,
  createMotionArcPath,
  frameVisualCenter,
  isStraightMotion,
  motionControlFromPath,
  motionPathPointAtProgress,
  midpoint,
  presentationPoseToSelectionFrame,
} from '../../src/motion-editor/geometry'

describe('motion-editor geometry', () => {
  it('uses the affine visual center, including rotation origin and scale', () => {
    expect(frameVisualCenter({ x: 10, y: 20, width: 40, height: 20 })).toEqual({ x: 30, y: 30 })
    expect(frameVisualCenter({ x: 10, y: 20, width: 40, height: 20, rotate: 90 })).toEqual({ x: 30, y: 30 })
    const scaledCenter = frameVisualCenter({
      x: 10,
      y: 20,
      width: 40,
      height: 20,
      rotate: 90,
      scaleX: 2,
      scaleY: 1,
      rotationOrigin: { fx: 0, fy: 0 },
    })
    expect(scaledCenter.x).toBeCloseTo(0)
    expect(scaledCenter.y).toBeCloseTo(60)
  })

  it('converts a runtime pose to a CS frame while preserving the presented centre', () => {
    const frame = presentationPoseToSelectionFrame({
      origin: { x: 100, y: 80 },
      matrix: { a: 0, b: 2, c: -1, d: 0 },
      localWidth: 40,
      localHeight: 20,
    }, { fx: 0, fy: 0 })

    expect(frameVisualCenter(frame).x).toBeCloseTo(90, 6)
    expect(frameVisualCenter(frame).y).toBeCloseTo(120, 6)
    expect(frame.width).toBe(40)
    expect(frame.height).toBe(20)
    expect(frame.rotate).toBeCloseTo(90, 6)
    expect(frame.scaleX).toBeCloseTo(2, 6)
    expect(frame.scaleY).toBeCloseTo(1, 6)
    expect(frame.rotationOrigin).toEqual({ fx: 0, fy: 0 })
  })

  it('keeps a straight segment implicit and creates a normalized SVG arc for a moved midpoint', () => {
    const source = { x: 10, y: 20 }
    const target = { x: 110, y: 20 }
    const straight = midpoint(source, target)
    expect(isStraightMotion(source, straight, target)).toBe(true)
    expect(createMotionArcPath(source, straight, target)).toBeUndefined()

    const control = { x: 60, y: 45 }
    expect(isStraightMotion(source, control, target)).toBe(false)
    expect(createMotionArcPath(source, control, target)).toMatch(/^M 0 0 A [\d.]+ [\d.]+ 0 [01] [01] 1 0$/)
    expect(createDisplayArcPath(source, control, target)).toMatch(/^M 10 20 A [\d.]+ [\d.]+ 0 [01] [01] 110 20$/)
    const encoded = createMotionArcPath(source, control, target)!
    const decoded = motionControlFromPath(encoded, source, target)!
    expect(decoded.x).toBeCloseTo(control.x, 1)
    expect(decoded.y).toBeCloseTo(control.y, 1)
  })

  it('uses the same quantized path point that CodPlay V2 presents at the median', () => {
    const source = { x: 10, y: 20 }
    const target = { x: 110, y: 20 }
    const control = { x: 80, y: 45 }
    const median = motionPathPointAtProgress(source, control, target, 0.5)
    expect(median.x).toBeGreaterThan(source.x)
    expect(median.x).toBeLessThan(target.x)
    expect(median.y).toBeGreaterThan(source.y)
    expect(median.x).not.toBeCloseTo(control.x, 3)
  })

  it('keeps an extreme handle on the minor arc instead of creating a near-circle counter-curve', () => {
    const path = createMotionArcPath({ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 })
    expect(path).toMatch(/^M 0 0 A [\d.]+ [\d.]+ 0 0 [01] 1 0$/)
    expect(createDisplayArcPath({ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }))
      .toMatch(/^M 0 0 A [\d.]+ [\d.]+ 0 0 [01] 100 0$/)
  })
})
