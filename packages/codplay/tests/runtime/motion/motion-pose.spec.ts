import { describe, expect, it } from 'vitest'
import { preparePath, resolvePath, resolvePathFrame, createRotateMatrix } from '../../../src/ace'
import { deriveRelativeMotionPose, interpolateMotionPose } from '../../../src/runtime/motion'
import type { HtmlMatrix, HtmlPose } from '../../../src/runtime/motion/html-types'

const IDENTITY: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

describe('motion pose path anchors', () => {
  it('carries the untransformed layout origin into the attachment parent space', () => {
    const parent = pose({
      origin: { x: 10, y: 20 },
      matrix: IDENTITY,
      localWidth: 100,
      localHeight: 20,
      rect: { left: 10, top: 20, width: 100, height: 20 },
    })
    const child = pose({
      origin: { x: 80, y: 90 },
      layoutOrigin: { x: 35, y: 50 },
      matrix: IDENTITY,
      localWidth: 20,
      localHeight: 20,
      rect: { left: 80, top: 90, width: 20, height: 20 },
    })

    const local = deriveRelativeMotionPose(parent, child)

    expect(local.origin).toEqual([70, 70])
    expect(local.layoutOrigin).toEqual([25, 30])
  })

  it('follows affine visual centers and reconstructs the matching item origin', () => {
    const from = pose({
      origin: { x: 10, y: 20 },
      matrix: IDENTITY,
      localWidth: 100,
      localHeight: 20,
      rect: { left: 10, top: 20, width: 100, height: 20 },
    })
    const toMatrix = createRotateMatrix(Math.PI / 6)
    const to = pose({
      origin: { x: 180, y: 110 },
      matrix: toMatrix,
      localWidth: 40,
      localHeight: 60,
      rect: { left: 150, top: 100, width: 70, height: 60 },
    })
    const path = preparePath({ control: [0.5, 1] }, { traversal: 'arc-length' })
    const frame = interpolateMotionPose(from, to, 0.5, path)
    const expectedCenter = resolvePath(path, visualCenter(from), visualCenter(to), 0.5)
    const actualCenter = visualCenter(frame)

    expect(actualCenter[0]).toBeCloseTo(expectedCenter[0], 6)
    expect(actualCenter[1]).toBeCloseTo(expectedCenter[1], 6)
    expect(frame.origin.x).not.toBeCloseTo(frame.rect.left, 2)
  })

  it('uses the affine visual center as the default path anchor', () => {
    const from = pose({
      origin: { x: 10, y: 20 },
      matrix: IDENTITY,
      localWidth: 100,
      localHeight: 20,
      rect: { left: 10, top: 20, width: 100, height: 20 },
    })
    const toMatrix = createRotateMatrix(Math.PI / 6)
    const to = pose({
      origin: { x: 180, y: 110 },
      matrix: toMatrix,
      localWidth: 40,
      localHeight: 60,
      rect: { left: 150, top: 100, width: 70, height: 60 },
    })
    const path = preparePath({ control: [0.5, 1] }, { traversal: 'arc-length' })
    const frame = interpolateMotionPose(from, to, 0.5, path)
    const expectedCenter = resolvePath(path, visualCenter(from), visualCenter(to), 0.5)
    const actualCenter = visualCenter(frame)

    expect(actualCenter[0]).toBeCloseTo(expectedCenter[0], 6)
    expect(actualCenter[1]).toBeCloseTo(expectedCenter[1], 6)
  })

  it('aligns the local forward axis to the path tangent and adds the interpolated rotate offset', () => {
    const from = pose({
      origin: { x: 0, y: 0 },
      matrix: IDENTITY,
      localWidth: 20,
      localHeight: 10,
      rect: { left: 0, top: 0, width: 20, height: 10 },
    })
    const to = pose({
      origin: { x: 100, y: 100 },
      matrix: IDENTITY,
      localWidth: 20,
      localHeight: 10,
      rect: { left: 100, top: 100, width: 20, height: 10 },
    })
    const path = preparePath({ control: [0.5, 1] }, { traversal: 'parameter' })
    const frame = interpolateMotionPose(from, to, 0.5, path, { rotateOffset: { from: 10, to: 20 } })
    const pathFrame = resolvePathFrame(path, visualCenter(from), visualCenter(to), 0.5)

    expect(Math.atan2(frame.matrix.b, frame.matrix.a) * 180 / Math.PI).toBeCloseTo(60)
    expect(visualCenter(frame)[0]).toBeCloseTo(pathFrame.point[0])
    expect(visualCenter(frame)[1]).toBeCloseTo(pathFrame.point[1])
  })

  it('keeps the authored endpoint rotation without path orientation', () => {
    const from = pose({
      origin: { x: 0, y: 0 },
      matrix: IDENTITY,
      localWidth: 20,
      localHeight: 10,
      rect: { left: 0, top: 0, width: 20, height: 10 },
    })
    const toMatrix = createRotateMatrix(Math.PI / 4)
    const to = pose({
      origin: { x: 100, y: 100 },
      matrix: toMatrix,
      localWidth: 20,
      localHeight: 10,
      rect: { left: 100, top: 100, width: 20, height: 10 },
    })
    const path = preparePath({ control: [0.5, 1] }, { traversal: 'parameter' })

    expect(interpolateMotionPose(from, to, 1, path).matrix).toEqual(to.matrix)
  })
})

/** Creates the complete numeric shape required by the pose interpolator. */
function pose(input: Readonly<{
  origin: Readonly<{ x: number; y: number }>
  layoutOrigin?: Readonly<{ x: number; y: number }>
  matrix: HtmlMatrix
  localWidth: number
  localHeight: number
  rect: Readonly<{ left: number; top: number; width: number; height: number }>
}>): HtmlPose {
  return {
    ...input,
    parentMatrix: IDENTITY,
    rotationMatrix: IDENTITY,
    scaleX: 1,
    scaleY: 1,
    frameWidth: input.localWidth,
    frameHeight: input.localHeight,
  }
}

/** Computes the affine visual center of one numeric pose. */
function visualCenter(value: HtmlPose): [number, number] {
  return [
    value.origin.x + value.matrix.a * value.localWidth / 2 + value.matrix.c * value.localHeight / 2,
    value.origin.y + value.matrix.b * value.localWidth / 2 + value.matrix.d * value.localHeight / 2,
  ]
}
