import { describe, expect, it } from 'vitest'
import { prepareSvgPath, resolvePathFrame } from 'ace'
import {
  createDisplayArcPath,
  createMotionArcPath,
  frameWithRotationAtPathAnchor,
  frameWithRotationAtVisualCenter,
  frameWithTangentAtPathAnchor,
  frameVisualCenter,
  isStraightMotion,
  motionControlFromPath,
  motionPathPointAtProgress,
  motionPathTangentAngle,
  motionPathAnchorForFrame,
  midpoint,
  normalizeAngleDegrees,
  presentationBorderBoxPoseToContentFrame,
  presentationItemPoseToContentFrame,
  presentationPoseToSelectionFrame,
  resolveMotionGeometryPose,
  sameFramePose,
  splitMotionPath,
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

  it('changes a ghost heading around its existing visual centre', () => {
    const frame = {
      x: 10,
      y: 20,
      width: 40,
      height: 20,
      rotate: 27,
      scaleX: 1.5,
      scaleY: 0.75,
      rotationOrigin: { fx: 0, fy: 1 },
    }
    const center = frameVisualCenter(frame)
    const rotated = frameWithRotationAtVisualCenter(frame, 90)

    expect(frameVisualCenter(rotated).x).toBeCloseTo(center.x, 8)
    expect(frameVisualCenter(rotated).y).toBeCloseTo(center.y, 8)
    expect(rotated.rotate).toBe(90)
  })

  it('keeps a bordered visible centre on the path while its heading changes', () => {
    const frame = {
      x: 100,
      y: 80,
      width: 40,
      height: 20,
      rotate: 0,
      scaleX: 2,
      scaleY: 0.5,
      rotationOrigin: { fx: 0.5, fy: 0.5 },
    }
    const insets = { top: 4, right: 6, bottom: 4, left: 6 }
    const anchor = motionPathAnchorForFrame(frame, insets)
    const tangentFrame = frameWithTangentAtPathAnchor(frame, anchor, 90, insets)
    const center = frameVisualCenter(tangentFrame)

    expect(anchor).toEqual({ x: 120, y: 90 })
    expect(center.x).toBeCloseTo(120, 8)
    expect(center.y).toBeCloseTo(90, 8)
    expect(motionPathAnchorForFrame(tangentFrame, insets)).toEqual(anchor)
    expect(tangentFrame.rotate).toBe(90)
  })

  it('keeps a rotated non-centred frame on its existing runtime path anchor', () => {
    const frame = {
      x: 100,
      y: 80,
      width: 160,
      height: 90,
      rotate: -24,
      scaleX: 1.2,
      scaleY: 0.8,
      rotationOrigin: { fx: 0.3, fy: 0.7 },
    }
    const insets = { top: 4, right: 8, bottom: 6, left: 12 }
    const anchor = motionPathAnchorForFrame(frame, insets)
    const rotated = frameWithRotationAtPathAnchor(frame, 63, anchor, insets)
    const actualAnchor = motionPathAnchorForFrame(rotated, insets)

    expect(actualAnchor.x).toBeCloseTo(anchor.x, 8)
    expect(actualAnchor.y).toBeCloseTo(anchor.y, 8)
    expect(rotated.rotate).toBe(63)
    const restored = frameWithRotationAtPathAnchor(rotated, frame.rotate, anchor, insets)
    expect(restored.x).toBeCloseTo(frame.x, 8)
    expect(restored.y).toBeCloseTo(frame.y, 8)
  })

  it('resolves one shared outer-frame and path-centre projection for asymmetric borders', () => {
    const frame = {
      x: 100,
      y: 80,
      width: 160,
      height: 90,
      rotate: 37,
      scaleX: 1.2,
      scaleY: 0.85,
      rotationOrigin: { fx: 0.25, fy: 0.8 },
    }
    const insets = { top: 7, right: 13, bottom: 2, left: 3 }
    const geometry = resolveMotionGeometryPose(frame, insets)
    const borderCentre = frameVisualCenter(geometry.borderFrame)

    expect(geometry.borderFrame.width).toBe(176)
    expect(geometry.borderFrame.height).toBe(99)
    expect(borderCentre.x).toBeCloseTo(geometry.pathAnchor.x, 8)
    expect(borderCentre.y).toBeCloseTo(geometry.pathAnchor.y, 8)
  })

  it('compares the complete frame pose, including its heading', () => {
    const frame = { x: 10, y: 20, width: 40, height: 20, rotate: 0 }
    const rotated = frameWithRotationAtVisualCenter(frame, 90)
    const displaced = { ...rotated, x: rotated.x + 2 }

    expect(sameFramePose(frame, rotated)).toBe(false)
    expect(sameFramePose(frame, displaced)).toBe(false)
    expect(sameFramePose(frame, { ...frame, rotate: 360 })).toBe(true)
  })

  it('splits a curved trajectory into two arcs sharing its tangent without flattening either half', () => {
    const path = 'M 0 0 A 0.7 0.7 0 0 1 1 0'
    const prepared = prepareSvgPath(path, { traversal: 'arc-length', precision: 2 })
    const source = { x: 20, y: 30 }
    const target = { x: 420, y: 190 }
    const point = resolvePathFrame(prepared, [source.x, source.y], [target.x, target.y], 0.5).point
    const waypoint = { x: point[0], y: point[1] }
    const split = splitMotionPath(path, source, waypoint, target, 0.5)
    expect(split.before).toContain(' A ')
    expect(split.after).toContain(' A ')
    const beforeAngle = motionPathTangentAngle(split.before!, source, waypoint, 1)!
    const afterAngle = motionPathTangentAngle(split.after!, waypoint, target, 0)!
    expect(Math.abs(normalizeAngleDegrees(beforeAngle - afterAngle))).toBeLessThan(1)
    const before = prepareSvgPath(split.before!, { traversal: 'arc-length', precision: 2 })
    const after = prepareSvgPath(split.after!, { traversal: 'arc-length', precision: 2 })
    for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const expected = resolvePathFrame(prepared, [source.x, source.y], [target.x, target.y], progress).point
      const actual = progress <= 0.5
        ? resolvePathFrame(before, [source.x, source.y], point, progress * 2).point
        : resolvePathFrame(after, point, [target.x, target.y], (progress - 0.5) * 2).point
      expect(Math.hypot(actual[0] - expected[0], actual[1] - expected[1])).toBeLessThan(2)
    }
  })

  it('keeps the tangent continuous when an already quantized arc is split again', () => {
    const source = { x: 20, y: 16 }
    const control = { x: 50, y: 55 }
    const target = { x: 80, y: 30 }
    const original = createMotionArcPath(source, control, target)!
    const middlePoint = resolvePathFrame(
      prepareSvgPath(original, { traversal: 'arc-length', precision: 2 }),
      [source.x, source.y], [target.x, target.y], 0.58,
    ).point
    const middle = { x: middlePoint[0], y: middlePoint[1] }
    const firstSplit = splitMotionPath(original, source, middle, target, 0.58)
    const sourceToMiddle = prepareSvgPath(firstSplit.before!, { traversal: 'arc-length', precision: 2 })
    const insertedPoint = resolvePathFrame(
      sourceToMiddle, [source.x, source.y], [middle.x, middle.y], 5 / 6,
    ).point
    const inserted = { x: insertedPoint[0], y: insertedPoint[1] }
    const secondSplit = splitMotionPath(firstSplit.before!, source, inserted, middle, 5 / 6)
    const incoming = motionPathTangentAngle(secondSplit.before!, source, inserted, 1)!
    const outgoing = motionPathTangentAngle(secondSplit.after!, inserted, middle, 0)!

    expect(Math.abs(normalizeAngleDegrees(incoming - outgoing))).toBeLessThan(0.1)
  })

  it('keeps a canonical path unchanged when a waypoint is inserted on its arc', () => {
    const source = { x: 20, y: 16 }
    const control = { x: 50, y: 55 }
    const target = { x: 80, y: 30 }
    const path = createMotionArcPath(source, control, target)!
    const prepared = prepareSvgPath(path, { traversal: 'arc-length', precision: 2 })
    const progress = 0.58
    const point = resolvePathFrame(prepared, [source.x, source.y], [target.x, target.y], progress).point
    const waypoint = { x: point[0], y: point[1] }
    const split = splitMotionPath(path, source, waypoint, target, progress)

    expect(split.waypoint).toEqual(waypoint)
    // ACE quantizes normalized radii to two decimals; this near-semicircle has a 0.34° endpoint bound.
    expect(Math.abs(normalizeAngleDegrees(
      motionPathTangentAngle(path, source, target, 0)!
      - motionPathTangentAngle(split.before!, source, split.waypoint, 0)!,
    ))).toBeLessThan(0.4)
    expect(Math.abs(normalizeAngleDegrees(
      motionPathTangentAngle(path, source, target, 1)!
      - motionPathTangentAngle(split.after!, split.waypoint, target, 1)!,
    ))).toBeLessThan(0.4)
    expect(Math.abs(normalizeAngleDegrees(
      motionPathTangentAngle(split.before!, source, split.waypoint, 1)!
      - motionPathTangentAngle(split.after!, split.waypoint, target, 0)!,
    ))).toBeLessThan(0.2)

    const beforePrepared = prepareSvgPath(split.before!, { traversal: 'arc-length', precision: 2 })
    const afterPrepared = prepareSvgPath(split.after!, { traversal: 'arc-length', precision: 2 })
    for (const sample of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const expected = resolvePathFrame(prepared, [source.x, source.y], [target.x, target.y], sample).point
      const actual = sample <= progress
        ? resolvePathFrame(beforePrepared, [source.x, source.y], [split.waypoint.x, split.waypoint.y], sample / progress).point
        : resolvePathFrame(afterPrepared, [split.waypoint.x, split.waypoint.y], [target.x, target.y], (sample - progress) / (1 - progress)).point
      expect(Math.hypot(actual[0] - expected[0], actual[1] - expected[1])).toBeLessThan(1.25)
    }
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

  it.each([
    { pivot: { fx: 0, fy: 0 }, x: 95, y: 86 },
    { pivot: { fx: 0.5, fy: 0.5 }, x: 65, y: 116 },
  ])('projects the content inset through rotation and scale with pivot $pivot', ({ pivot, x, y }) => {
    const frame = presentationPoseToSelectionFrame({
      origin: { x: 100, y: 80 },
      matrix: { a: 0, b: 2, c: -1, d: 0 },
      localWidth: 40,
      localHeight: 20,
    }, pivot, { left: 3, top: 5, right: 7, bottom: 11 })

    expect(frame.x).toBeCloseTo(x, 6)
    expect(frame.y).toBeCloseTo(y, 6)
    expect(frameVisualCenter(frame).x).toBeCloseTo(85, 6)
    expect(frameVisualCenter(frame).y).toBeCloseTo(126, 6)
    expect(frame.width).toBe(40)
    expect(frame.height).toBe(20)
  })

  it('projects a path host border-box pose back to the same shared content frame', () => {
    const pose = {
      origin: { x: 100, y: 80 },
      matrix: { a: 0, b: 2, c: -1, d: 0 },
      localWidth: 50,
      localHeight: 36,
    }
    const insets = { left: 3, top: 5, right: 7, bottom: 11 }
    const hostFrame = presentationBorderBoxPoseToContentFrame(pose, { fx: 0.5, fy: 0.5 }, insets)
    const contentFrame = presentationPoseToSelectionFrame(
      { ...pose, localWidth: 40, localHeight: 20 },
      { fx: 0.5, fy: 0.5 },
      insets,
    )

    expect(hostFrame).toEqual(contentFrame)
    expect(hostFrame.width).toBe(40)
    expect(hostFrame.height).toBe(20)
    expect(frameVisualCenter(hostFrame)).toMatchObject({ x: 85, y: 126 })
  })

  it('keeps current content dimensions independent of the motion frame dimensions', () => {
    const pose = {
      origin: { x: 100, y: 80 }, matrix: { a: 0, b: 2, c: -1, d: 0 },
      localWidth: 100, localHeight: 80,
    }
    const insets = { left: 3, top: 5, right: 7, bottom: 11 }
    const frame = presentationItemPoseToContentFrame(pose, 40, 20, { fx: 0.5, fy: 0.5 }, insets)
    expect(frame).toMatchObject({ width: 40, height: 20, x: 43, y: 166 })
    expect(frameVisualCenter(frame)).toEqual({ x: 63, y: 176 })
    const resized = presentationItemPoseToContentFrame(pose, 60, 12, { fx: 0, fy: 0 }, insets)
    expect(resized).toMatchObject({ width: 60, height: 12 })
    expect(frameVisualCenter(resized)).toEqual({ x: 63, y: 176 })
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

  it('resolves endpoint tangent angles with the shared ACE path frame', () => {
    const svgPath = 'M 0 0 A 0.7 0.7 0 0 1 1 0'
    const path = prepareSvgPath(svgPath, { traversal: 'arc-length', precision: 2 })
    const source = { x: 20, y: 40 }
    const target = { x: 320, y: 180 }
    const startTangent = resolvePathFrame(path, [source.x, source.y], [target.x, target.y], 0).tangent!
    const endTangent = resolvePathFrame(path, [source.x, source.y], [target.x, target.y], 1).tangent!
    const startAngle = motionPathTangentAngle(svgPath, source, target, 0)
    const endAngle = motionPathTangentAngle(svgPath, source, target, 1)

    expect(startAngle).toBeCloseTo(Math.atan2(startTangent[1], startTangent[0]) * 180 / Math.PI, 8)
    expect(endAngle).toBeCloseTo(Math.atan2(endTangent[1], endTangent[0]) * 180 / Math.PI, 8)
    expect(normalizeAngleDegrees(540)).toBe(-180)
  })

  it('keeps an extreme handle on the minor arc instead of creating a near-circle counter-curve', () => {
    const path = createMotionArcPath({ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 })
    expect(path).toMatch(/^M 0 0 A [\d.]+ [\d.]+ 0 0 [01] 1 0$/)
    expect(createDisplayArcPath({ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }))
      .toMatch(/^M 0 0 A [\d.]+ [\d.]+ 0 0 [01] 100 0$/)
  })
})
