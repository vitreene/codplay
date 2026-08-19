import { invertMatrix, multiplyMatrix, resolvePath, type Point } from '../../ace'
import type { HtmlMatrix, HtmlPose } from './html-types'
import type { RelativeMotionPose } from './types'

/** Converts one world pose into the local coordinates of its parent pose. */
export function deriveRelativeMotionPose(parent: HtmlPose, child: HtmlPose): RelativeMotionPose {
  const inverse = invertMatrix(toAffine(parent))
  if (inverse === null) throw new Error('Motion graph cannot derive a pose from a singular parent.')
  const local = multiplyMatrix(inverse, toAffine(child))
  return {
    origin: [local.e, local.f],
    matrix: linear(local),
    width: child.localWidth,
    height: child.localHeight,
  }
}

/** Converts one root-relative HTML pose into a reusable attachment pose. */
export function decomposeRootMotionPose(pose: HtmlPose): RelativeMotionPose {
  return {
    origin: [pose.origin.x, pose.origin.y],
    matrix: linear(pose.matrix),
    width: pose.localWidth,
    height: pose.localHeight,
  }
}

/** Composes one local attachment with a resolved parent world pose. */
export function composeMotionPose(parent: HtmlPose, local: RelativeMotionPose): HtmlPose {
  const parentAffine = toAffine(parent)
  const localAffine: HtmlMatrix = { ...local.matrix, e: local.origin[0], f: local.origin[1] }
  return poseFromAffine(multiplyMatrix(parentAffine, localAffine), parent.matrix, local.width, local.height)
}

/** Interpolates two resolved poses, including an optional authored path. */
export function interpolateMotionPose(
  from: HtmlPose,
  to: HtmlPose,
  progress: number,
  path?: Parameters<typeof resolvePath>[0],
): HtmlPose {
  const matrix: HtmlMatrix = {
    a: lerp(from.matrix.a, to.matrix.a, progress),
    b: lerp(from.matrix.b, to.matrix.b, progress),
    c: lerp(from.matrix.c, to.matrix.c, progress),
    d: lerp(from.matrix.d, to.matrix.d, progress),
    e: 0,
    f: 0,
  }
  const width = lerp(from.localWidth, to.localWidth, progress)
  const height = lerp(from.localHeight, to.localHeight, progress)
  const pathPoint = path === undefined
    ? undefined
    : resolvePath(path, [from.rect.left, from.rect.top], [to.rect.left, to.rect.top], progress)
  const origin: Point = pathPoint === undefined
    ? [lerp(from.origin.x, to.origin.x, progress), lerp(from.origin.y, to.origin.y, progress)]
    : originFromAabb(pathPoint, matrix, width, height)
  return poseFromAffine({ ...matrix, e: origin[0], f: origin[1] }, to.parentMatrix, width, height)
}

/** Derives a virtual source pose so a retarget keeps its phase and authored path. */
export function extrapolateMotionPoseAtProgress(
  current: HtmlPose,
  destination: HtmlPose,
  progress: number,
  path?: Parameters<typeof resolvePath>[0],
): HtmlPose {
  const clamped = Math.min(1 - 1e-6, Math.max(1e-6, progress))
  const inverseRemaining = 1 / (1 - clamped)
  const matrix: HtmlMatrix = {
    a: (current.matrix.a - destination.matrix.a * clamped) * inverseRemaining,
    b: (current.matrix.b - destination.matrix.b * clamped) * inverseRemaining,
    c: (current.matrix.c - destination.matrix.c * clamped) * inverseRemaining,
    d: (current.matrix.d - destination.matrix.d * clamped) * inverseRemaining,
    e: 0,
    f: 0,
  }
  const width = (current.localWidth - destination.localWidth * clamped) * inverseRemaining
  const height = (current.localHeight - destination.localHeight * clamped) * inverseRemaining
  const sourceAnchor = path === undefined
    ? [
        (current.origin.x - destination.origin.x * clamped) * inverseRemaining,
        (current.origin.y - destination.origin.y * clamped) * inverseRemaining,
      ] as Point
    : solvePathSourceAnchor(path, current.rect.left, current.rect.top, destination.rect.left, destination.rect.top, clamped)
  const origin = path === undefined
    ? sourceAnchor
    : originFromAabb(sourceAnchor, matrix, width, height)
  return poseFromAffine({ ...matrix, e: origin[0], f: origin[1] }, current.parentMatrix, width, height)
}

/** Creates the identity root pose used while resolving root-relative snapshots. */
export function createMotionRootPose(): HtmlPose {
  const matrix = identityMatrix()
  return {
    rect: { left: 0, top: 0, width: 0, height: 0 },
    origin: { x: 0, y: 0 },
    matrix,
    parentMatrix: matrix,
    rotationMatrix: matrix,
    scaleX: 1,
    scaleY: 1,
    localWidth: 0,
    localHeight: 0,
    frameWidth: 0,
    frameHeight: 0,
  }
}

/** Reports whether two local attachments differ geometrically. */
export function sameRelativeMotionPose(left: RelativeMotionPose, right: RelativeMotionPose, epsilon = 0.001): boolean {
  return nearly(left.origin[0], right.origin[0], epsilon)
    && nearly(left.origin[1], right.origin[1], epsilon)
    && nearly(left.matrix.a, right.matrix.a, epsilon)
    && nearly(left.matrix.b, right.matrix.b, epsilon)
    && nearly(left.matrix.c, right.matrix.c, epsilon)
    && nearly(left.matrix.d, right.matrix.d, epsilon)
    && nearly(left.width, right.width, epsilon)
    && nearly(left.height, right.height, epsilon)
}

/** Converts one HTML pose to its complete affine matrix. */
function toAffine(pose: HtmlPose): HtmlMatrix {
  return { ...pose.matrix, e: pose.origin.x, f: pose.origin.y }
}

/** Rebuilds all derived HTML pose fields from one affine matrix. */
function poseFromAffine(affine: HtmlMatrix, parentMatrix: HtmlMatrix, width: number, height: number): HtmlPose {
  const matrix = linear(affine)
  const bounds = transformedBounds(matrix, width, height)
  const scaleX = Math.max(1e-6, Math.hypot(matrix.a, matrix.b))
  const scaleY = Math.max(1e-6, Math.hypot(matrix.c, matrix.d))
  return {
    rect: {
      left: affine.e + bounds.left,
      top: affine.f + bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
    origin: { x: affine.e, y: affine.f },
    matrix,
    parentMatrix: linear(parentMatrix),
    rotationMatrix: {
      a: matrix.a / scaleX,
      b: matrix.b / scaleX,
      c: matrix.c / scaleY,
      d: matrix.d / scaleY,
      e: 0,
      f: 0,
    },
    scaleX,
    scaleY,
    localWidth: width,
    localHeight: height,
    frameWidth: width * scaleX,
    frameHeight: height * scaleY,
  }
}

/** Converts an AABB top-left path point back to a local-box origin. */
function originFromAabb(anchor: Point, matrix: HtmlMatrix, width: number, height: number): Point {
  const bounds = transformedBounds(matrix, width, height)
  return [anchor[0] - bounds.left, anchor[1] - bounds.top]
}

/** Solves the virtual source AABB required to preserve a curved path phase. */
function solvePathSourceAnchor(
  path: Parameters<typeof resolvePath>[0],
  currentX: number,
  currentY: number,
  destinationX: number,
  destinationY: number,
  progress: number,
): Point {
  const [pathX, pathY] = resolvePath(path, [0, 0], [1, 0], progress)
  const remaining = 1 - pathX
  const determinant = remaining * remaining + pathY * pathY
  if (determinant < 1e-9) return [currentX, currentY]

  const rightX = currentX - pathX * destinationX + pathY * destinationY
  const rightY = currentY - pathY * destinationX - pathX * destinationY
  return [
    (remaining * rightX - pathY * rightY) / determinant,
    (pathY * rightX + remaining * rightY) / determinant,
  ]
}

/** Computes transformed bounds for one local rectangle. */
function transformedBounds(matrix: HtmlMatrix, width: number, height: number): { left: number; top: number; width: number; height: number } {
  const points: readonly Point[] = [
    [0, 0],
    [matrix.a * width, matrix.b * width],
    [matrix.c * height, matrix.d * height],
    [matrix.a * width + matrix.c * height, matrix.b * width + matrix.d * height],
  ]
  const left = Math.min(...points.map((point) => point[0]))
  const right = Math.max(...points.map((point) => point[0]))
  const top = Math.min(...points.map((point) => point[1]))
  const bottom = Math.max(...points.map((point) => point[1]))
  return { left, top, width: right - left, height: bottom - top }
}

/** Removes translation from one affine matrix. */
function linear(matrix: HtmlMatrix): HtmlMatrix {
  return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: 0, f: 0 }
}

/** Creates one affine identity. */
function identityMatrix(): HtmlMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

/** Interpolates one scalar component. */
function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

/** Compares one scalar with a host-measurement tolerance. */
function nearly(left: number, right: number, epsilon: number): boolean {
  return Math.abs(left - right) <= epsilon
}
