import { invertMatrix, prepareTween, resolvePath, resolveTweenProgress, type Point } from '../../ace'
import type {
  FlipAncestorCapture,
  FlipCapture,
  FlipItemCapture,
  HtmlFlipProjection,
  HtmlMatrix,
  HtmlPose,
  ResolvedFlipPose,
} from './types'

type LocalPose = Readonly<{
  origin: Point
  matrix: HtmlMatrix
  width: number
  height: number
}>

/** Caches host historical measurements for one capture, ancestor, epoch and instant. */
export class FlipHistoricalPoseCache {
  private readonly poses = new Map<string, HtmlPose>()

  /** Reads or realizes one historical layout pose. */
  resolve(
    capture: FlipCapture,
    ancestor: FlipAncestorCapture,
    timeMs: number,
    resolver: HtmlFlipProjection['captureHistoricalPose'] | undefined,
  ): HtmlPose | undefined {
    if (resolver === undefined) return undefined
    const key = `${capture.hostContextId}:${capture.projectionEpoch}:${capture.captureId}:${ancestor.ancestorId}:${timeMs}`
    const existing = this.poses.get(key)
    if (existing !== undefined) return existing
    const pose = resolver({ ancestorId: ancestor.ancestorId, timeMs, capture: ancestor })
    if (pose !== undefined) this.poses.set(key, pose)
    return pose
  }

  /** Drops all historical poses after a host projection change. */
  clear(): void {
    this.poses.clear()
  }
}

/** Resolves every captured item through one hierarchical pose graph at one time. */
export function resolveFlipPoseGraph(
  capture: FlipCapture,
  timeMs: number,
  projection?: Pick<HtmlFlipProjection, 'captureHistoricalPose'>,
  historicalPoseCache?: FlipHistoricalPoseCache,
): readonly ResolvedFlipPose[] {
  const ancestorCaptures = new Map(capture.ancestors.map((ancestor) => [ancestor.ancestorId, ancestor]))
  const ancestorPoses = resolveAncestors(capture, timeMs, ancestorCaptures, projection, historicalPoseCache)

  return capture.entries.map((entry) => {
    const parentId = entry.ancestorIds.at(-1)
    const parentCapture = parentId === undefined ? undefined : requireAncestor(ancestorCaptures, parentId)
    const parentPose = parentId === undefined ? undefined : requireAncestorPose(ancestorPoses, parentId)
    const progress = resolveItemProgress(entry, timeMs)
    const local = resolveLocalPose(entry, parentCapture, progress)
    const pose = composeLocalPose(local, parentPose, resolvePathPoint(entry, progress))
    return { itemId: entry.itemId, mode: entry.mode, pose, progress, captureId: capture.captureId }
  })
}

/** Resolves ancestor poses in parent-before-child order. */
function resolveAncestors(
  capture: FlipCapture,
  timeMs: number,
  ancestorCaptures: ReadonlyMap<string, FlipAncestorCapture>,
  projection?: Pick<HtmlFlipProjection, 'captureHistoricalPose'>,
  historicalPoseCache?: FlipHistoricalPoseCache,
): ReadonlyMap<string, HtmlPose> {
  const resolved = new Map<string, HtmlPose>()
  const visiting = new Set<string>()

  for (const ancestor of capture.ancestors) resolve(ancestor)
  return resolved

  function resolve(ancestor: FlipAncestorCapture): HtmlPose {
    const existing = resolved.get(ancestor.ancestorId)
    if (existing !== undefined) return existing
    if (visiting.has(ancestor.ancestorId)) throw new Error(`FLIP ancestor cycle detected: ${ancestor.ancestorId}`)
    visiting.add(ancestor.ancestorId)

    const parentCapture = ancestor.parentId === undefined
      ? undefined
      : requireAncestor(ancestorCaptures, ancestor.parentId)
    if (parentCapture !== undefined) resolve(parentCapture)
    const parentPose = ancestor.parentId === undefined
      ? undefined
      : requireAncestorPose(resolved, ancestor.parentId)

    const pose = ancestor.regime === 'layout'
      ? resolveHistoricalPose(capture, ancestor, timeMs, projection, historicalPoseCache)
      : resolveComposedAncestor(capture, ancestor, parentCapture, parentPose, timeMs)
    if (pose === undefined) throw new Error(`FLIP layout ancestor measurement is unavailable: ${ancestor.ancestorId}`)

    resolved.set(ancestor.ancestorId, pose)
    visiting.delete(ancestor.ancestorId)
    return pose
  }
}

/** Resolves one layout ancestor through the optional host measurement cache. */
function resolveHistoricalPose(
  capture: FlipCapture,
  ancestor: FlipAncestorCapture,
  timeMs: number,
  projection: Pick<HtmlFlipProjection, 'captureHistoricalPose'> | undefined,
  historicalPoseCache: FlipHistoricalPoseCache | undefined,
): HtmlPose | undefined {
  if (historicalPoseCache !== undefined) {
    return historicalPoseCache.resolve(capture, ancestor, timeMs, projection?.captureHistoricalPose)
  }
  return projection?.captureHistoricalPose?.({ ancestorId: ancestor.ancestorId, timeMs, capture: ancestor })
}

/** Resolves one stable or composited ancestor from its local transition. */
function resolveComposedAncestor(
  capture: FlipCapture,
  ancestor: FlipAncestorCapture,
  parent: FlipAncestorCapture | undefined,
  parentPose: HtmlPose | undefined,
  timeMs: number,
): HtmlPose {
  const progress = resolveCaptureProgress(capture, timeMs)
  const from = parent === undefined ? decomposeRootPose(ancestor.from) : deriveLocalPose(parent.from, ancestor.from)
  const to = parent === undefined ? decomposeRootPose(ancestor.to) : deriveLocalPose(parent.to, ancestor.to)
  return composeLocalPose(interpolateLocalPose(from, to, progress), parentPose)
}

/** Resolves one item's local pose before composing its active parent ancestor. */
function resolveLocalPose(
  entry: FlipItemCapture,
  parent: FlipAncestorCapture | undefined,
  progress: number,
): LocalPose {
  const from = parent === undefined ? decomposeRootPose(entry.from) : deriveLocalPose(parent.from, entry.from)
  const to = parent === undefined ? decomposeRootPose(entry.to) : deriveLocalPose(parent.to, entry.to)
  return interpolateLocalPose(from, to, progress)
}

/** Composes one local pose into the resolved parent world pose. */
function composeLocalPose(local: LocalPose, parent: HtmlPose | undefined, worldAnchor?: Point): HtmlPose {
  const parentMatrix = parent?.matrix ?? identityMatrix()
  const worldMatrix = multiply(parentMatrix, local.matrix)
  const parentAnchor: Point = parent === undefined ? [0, 0] : [parent.rect.left, parent.rect.top]
  const composedAnchor = add(parentAnchor, transformLinearPoint(parentMatrix, local.origin))
  return poseFromAnchor(worldAnchor ?? composedAnchor, worldMatrix, parentMatrix, local.width, local.height)
}

/** Resolves the optional normalized trajectory point for one item. */
function resolvePathPoint(entry: Pick<FlipItemCapture, 'path' | 'from' | 'to'>, progress: number): Point | undefined {
  return entry.path === undefined
    ? undefined
    : resolvePath(entry.path, [entry.from.rect.left, entry.from.rect.top], [entry.to.rect.left, entry.to.rect.top], progress)
}

/** Resolves an item's eased progress at one absolute timeline instant. */
function resolveItemProgress(entry: Pick<FlipItemCapture, 'duration' | 'easing' | 'startAt'>, timeMs: number): number {
  const tween = prepareTween({ from: 0, to: 1, duration: entry.duration, ease: entry.easing })
  return resolveTweenProgress(tween, timeMs - entry.startAt)
}

/** Resolves the shared transaction progress for one ancestor. */
function resolveCaptureProgress(capture: FlipCapture, timeMs: number): number {
  const tween = prepareTween({ from: 0, to: 1, duration: capture.duration, ease: capture.easing })
  return resolveTweenProgress(tween, timeMs - capture.startAt)
}

/** Converts a world pose to a root-local pose. */
function decomposeRootPose(pose: HtmlPose): LocalPose {
  return {
    origin: [pose.rect.left, pose.rect.top],
    matrix: pose.matrix,
    width: pose.localWidth,
    height: pose.localHeight,
  }
}

/** Converts a child world pose into coordinates relative to one captured parent. */
function deriveLocalPose(parent: HtmlPose, child: HtmlPose): LocalPose {
  const inverseParent = invertMatrix(parent.matrix)
  if (inverseParent === null) throw new Error('FLIP cannot resolve a singular ancestor matrix.')
  const parentAnchor: Point = [parent.rect.left, parent.rect.top]
  const childAnchor: Point = [child.rect.left, child.rect.top]
  return {
    origin: inverseLinearPoint(parent.matrix, [childAnchor[0] - parentAnchor[0], childAnchor[1] - parentAnchor[1]]),
    matrix: multiply(inverseParent, child.matrix),
    width: child.localWidth,
    height: child.localHeight,
  }
}

/** Rebuilds an HTML pose from a visual AABB anchor and a composed matrix. */
function poseFromAnchor(anchor: Point, matrix: HtmlMatrix, parentMatrix: HtmlMatrix, width: number, height: number): HtmlPose {
  const bounds = transformedBounds(matrix, width, height)
  const scaleX = Math.max(1e-6, Math.hypot(matrix.a, matrix.b))
  const scaleY = Math.max(1e-6, Math.hypot(matrix.c, matrix.d))
  return {
    rect: {
      left: anchor[0],
      top: anchor[1],
      width: bounds.width,
      height: bounds.height,
    },
    matrix,
    parentMatrix,
    rotationMatrix: normalizeRotation(matrix),
    scaleX,
    scaleY,
    localWidth: width,
    localHeight: height,
    frameWidth: width * scaleX,
    frameHeight: height * scaleY,
  }
}

/** Interpolates all local pose components. */
function interpolateLocalPose(from: LocalPose, to: LocalPose, progress: number): LocalPose {
  return {
    origin: [lerp(from.origin[0], to.origin[0], progress), lerp(from.origin[1], to.origin[1], progress)],
    matrix: interpolateMatrix(from.matrix, to.matrix, progress),
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress),
  }
}

/** Computes transformed axis-aligned bounds for one local box. */
function transformedBounds(matrix: HtmlMatrix, width: number, height: number): { left: number; top: number; width: number; height: number } {
  const points = [
    transformPoint(matrix, [0, 0]),
    transformPoint(matrix, [width, 0]),
    transformPoint(matrix, [0, height]),
    transformPoint(matrix, [width, height]),
  ]
  const left = Math.min(...points.map((point) => point[0]))
  const right = Math.max(...points.map((point) => point[0]))
  const top = Math.min(...points.map((point) => point[1]))
  const bottom = Math.max(...points.map((point) => point[1]))
  return { left, top, width: right - left, height: bottom - top }
}

function transformPoint(matrix: HtmlMatrix, point: Point): Point {
  return [matrix.a * point[0] + matrix.c * point[1] + matrix.e, matrix.b * point[0] + matrix.d * point[1] + matrix.f]
}

function transformLinearPoint(matrix: HtmlMatrix, point: Point): Point {
  return [matrix.a * point[0] + matrix.c * point[1], matrix.b * point[0] + matrix.d * point[1]]
}

function inverseLinearPoint(matrix: HtmlMatrix, point: Point): Point {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (Math.abs(determinant) < 1e-8) throw new Error('FLIP cannot resolve a singular ancestor matrix.')
  return [
    (matrix.d * point[0] - matrix.c * point[1]) / determinant,
    (-matrix.b * point[0] + matrix.a * point[1]) / determinant,
  ]
}


function normalizeRotation(matrix: HtmlMatrix): HtmlMatrix {
  const scaleX = Math.max(1e-6, Math.hypot(matrix.a, matrix.b))
  const scaleY = Math.max(1e-6, Math.hypot(matrix.c, matrix.d))
  return { a: matrix.a / scaleX, b: matrix.b / scaleX, c: matrix.c / scaleY, d: matrix.d / scaleY, e: 0, f: 0 }
}

function interpolateMatrix(from: HtmlMatrix, to: HtmlMatrix, progress: number): HtmlMatrix {
  return {
    a: lerp(from.a, to.a, progress),
    b: lerp(from.b, to.b, progress),
    c: lerp(from.c, to.c, progress),
    d: lerp(from.d, to.d, progress),
    e: lerp(from.e, to.e, progress),
    f: lerp(from.f, to.f, progress),
  }
}

function multiply(left: HtmlMatrix, right: HtmlMatrix): HtmlMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  }
}

function add(left: Point, right: Point): Point {
  return [left[0] + right[0], left[1] + right[1]]
}

function identityMatrix(): HtmlMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

function requireAncestor(captures: ReadonlyMap<string, FlipAncestorCapture>, ancestorId: string): FlipAncestorCapture {
  const ancestor = captures.get(ancestorId)
  if (ancestor === undefined) throw new Error(`FLIP ancestor capture is missing: ${ancestorId}`)
  return ancestor
}

function requireAncestorPose(poses: ReadonlyMap<string, HtmlPose>, ancestorId: string): HtmlPose {
  const pose = poses.get(ancestorId)
  if (pose === undefined) throw new Error(`FLIP ancestor pose is unresolved: ${ancestorId}`)
  return pose
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}
