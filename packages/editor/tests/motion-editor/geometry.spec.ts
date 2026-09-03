import { describe, expect, it } from 'vitest'
import {
  alignFrameVisualCenterToMotionPath,
  createDisplayArcPath,
  createMotionArcPath,
  frameVisualCenter,
  isStraightMotion,
  motionControlFromPath,
  motionPathPointAtProgress,
  motionProgressAtTime,
  midpoint,
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

  it('translates only the CS origin so its affine centre follows a curved path', () => {
    const source = { x: 10, y: 20 }
    const target = { x: 110, y: 20 }
    const control = { x: 60, y: 45 }
    const frame = { x: 45, y: 10, width: 20, height: 20, rotate: 20, scaleX: 1.5, scaleY: 0.75 }
    const aligned = alignFrameVisualCenterToMotionPath(frame, source, control, target, 0.5)
    const expected = motionPathPointAtProgress(source, control, target, 0.5)

    expect(frameVisualCenter(aligned).x).toBeCloseTo(expected.x, 6)
    expect(frameVisualCenter(aligned).y).toBeCloseTo(expected.y, 6)
    expect(aligned.width).toBe(frame.width)
    expect(aligned.height).toBe(frame.height)
    expect(aligned.rotate).toBe(frame.rotate)
    expect(aligned.scaleX).toBe(frame.scaleX)
    expect(aligned.scaleY).toBe(frame.scaleY)
  })

  it('uses the same easing spelling and absolute interval as the CodPlay move', () => {
    expect(motionProgressAtTime(0, 1_000, 0, 'linear')).toBe(0)
    expect(motionProgressAtTime(0, 1_000, 500, 'linear')).toBeCloseTo(0.5)
    expect(motionProgressAtTime(0, 1_000, 1_000, 'linear')).toBe(1)
    const easedEarly = motionProgressAtTime(0, 1_000, 250, 'ease-in-out')
    const easedLate = motionProgressAtTime(0, 1_000, 750, 'ease-in-out')
    expect(easedEarly).toBeLessThan(0.25)
    expect(easedLate).toBeGreaterThan(0.75)
    expect(easedEarly + easedLate).toBeCloseTo(1, 6)
  })

  it('keeps an extreme handle on the minor arc instead of creating a near-circle counter-curve', () => {
    const path = createMotionArcPath({ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 })
    expect(path).toMatch(/^M 0 0 A [\d.]+ [\d.]+ 0 0 [01] 1 0$/)
    expect(createDisplayArcPath({ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }))
      .toMatch(/^M 0 0 A [\d.]+ [\d.]+ 0 0 [01] 100 0$/)
  })
})
