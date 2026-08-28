import { isFiniteNumber } from '../shared'

/** A two-dimensional point used by ACE's geometry primitives. */
export type Point = readonly [number, number]

/** The two traversal modes that must remain visually comparable. */
const PATH_TRAVERSAL_PARAMETER = 'parameter' as const
const PATH_TRAVERSAL_ARC_LENGTH = 'arc-length' as const
export type PathTraversal = typeof PATH_TRAVERSAL_PARAMETER | typeof PATH_TRAVERSAL_ARC_LENGTH

/** A normalized quadratic path input with start [0, 0] and end [1, 0]. */
export type PathInput = Readonly<{
  control: Point
}>

/** One normalized line or SVG elliptical-arc segment before preparation. */
export type PathSegmentInput =
  | Readonly<{
      kind: 'line'
      to: Point
    }>
  | Readonly<{
      kind: 'arc'
      to: Point
      radius: Point
      rotation: number
      largeArc: boolean
      sweep: boolean
    }>

/** One prepared line segment with its normalized endpoint and length. */
export type PathLineSegment = Readonly<{
  kind: 'line'
  to: Point
  length: number
}>

/** One prepared elliptical arc segment in center/angle form. */
export type PathArcSegment = Readonly<{
  kind: 'arc'
  to: Point
  center: Point
  radius: Point
  rotation: number
  startAngle: number
  deltaAngle: number
  length: number
}>

export type PathSegment = PathLineSegment | PathArcSegment
type ResolvablePathSegment = Omit<PathLineSegment, 'length'> | Omit<PathArcSegment, 'length'>

/** A path prepared for repeated resolution and JSON-safe scene transport. */
export type Path = Readonly<{
  kind: 'quadratic' | 'segments'
  control?: Point
  segments?: readonly PathSegment[]
  traversal: PathTraversal
  lengths: readonly number[] | null
}>

const ARC_LENGTH_SAMPLES = 100

/** Resolves a normalized quadratic Bezier point. */
const resolveNormalizedPoint = (control: Point, progress: number): Point => {
  const inverse = 1 - progress
  return [
    2 * inverse * progress * control[0] + progress * progress,
    2 * inverse * progress * control[1],
  ]
}

/** Builds the cumulative normalized arc-length lookup table outside the hot path. */
const prepareArcLengths = (control: Point): number[] => {
  const lengths = [0]
  let previous = resolveNormalizedPoint(control, 0)
  let total = 0
  for (let index = 1; index <= ARC_LENGTH_SAMPLES; index += 1) {
    const point = resolveNormalizedPoint(control, index / ARC_LENGTH_SAMPLES)
    total += Math.hypot(point[0] - previous[0], point[1] - previous[1])
    lengths.push(total)
    previous = point
  }
  return lengths.map((length) => length / total)
}

/** Prepares the optional arc-length lookup table for a normalized quadratic path. */
export const preparePath = (
  input: PathInput,
  options: Readonly<{ traversal?: PathTraversal }> = {},
): Path => {
  const traversal = options.traversal ?? PATH_TRAVERSAL_ARC_LENGTH
  return {
    kind: 'quadratic',
    control: [...input.control] as Point,
    traversal,
    lengths: traversal === PATH_TRAVERSAL_ARC_LENGTH ? prepareArcLengths(input.control) : null,
  }
}

/** Prepares normalized line and SVG arc segments with cumulative traversal data. */
export const prepareSegmentPath = (
  input: Readonly<{ segments: readonly PathSegmentInput[] }>,
  options: Readonly<{ traversal?: PathTraversal }> = {},
): Path => {
  const traversal = options.traversal ?? PATH_TRAVERSAL_ARC_LENGTH
  const segments: PathSegment[] = []
  let current: Point = [0, 0]

  for (const segment of input.segments) {
    if (segment.kind === 'line') {
      if (samePoint(current, segment.to)) continue
      const to = [...segment.to] as Point
      segments.push({ kind: 'line', to, length: distance(current, to) })
      current = to
      continue
    }

    if (samePoint(current, segment.to)) continue
    const arc = resolveArcSegment(current, segment)
    if (arc === null) {
      const to = [...segment.to] as Point
      segments.push({ kind: 'line', to, length: distance(current, to) })
      current = to
      continue
    }
    segments.push(arc)
    current = arc.to
  }

  if (segments.length === 0) throw new Error('ACE path must contain at least one non-empty segment.')
  const totalLength = segments.reduce((total, segment) => total + segment.length, 0)
  const lengths = traversal === PATH_TRAVERSAL_ARC_LENGTH
    ? cumulativeLengths(segments, totalLength)
    : null

  return { kind: 'segments', segments, traversal, lengths }
}

/** Converts an arc-length fraction into its matching Bezier parameter. */
const resolveArcParameter = (lengths: readonly number[], progress: number): number => {
  if (progress <= 0 || progress >= 1) return progress
  let low = 0
  let high = lengths.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (lengths[middle]! < progress) low = middle + 1
    else high = middle
  }
  const end = low
  const start = end - 1
  const startLength = lengths[start]!
  const endLength = lengths[end]!
  const localProgress = (progress - startLength) / (endLength - startLength)
  return (start + localProgress) / ARC_LENGTH_SAMPLES
}

/** Resolves a prepared normalized path between two world points. */
export const resolvePath = (path: Path, from: Point, to: Point, progress: number): Point => {
  if (path.kind === 'quadratic') {
    const parameter = path.lengths ? resolveArcParameter(path.lengths, progress) : progress
    const [x, y] = resolveNormalizedPoint(path.control!, parameter)
    return mapNormalizedPoint([x, y], from, to)
  }
  return mapNormalizedPoint(resolveSegmentPath(path, progress), from, to)
}

/** Validates one prepared path received from a compiled scene. */
export function isPreparedPath(value: unknown): value is Path {
  if (!isRecord(value) || (value.kind !== 'quadratic' && value.kind !== 'segments')) return false
  if (value.traversal !== 'parameter' && value.traversal !== 'arc-length') return false
  if (value.lengths !== null && (!Array.isArray(value.lengths) || !value.lengths.every(isFiniteNumber))) return false
  if (value.kind === 'quadratic') return isPoint(value.control)
  return Array.isArray(value.segments) && value.segments.length > 0 && value.segments.every(isPreparedSegment)
}

/** Resolves one segment path in its canonical normalized coordinate space. */
function resolveSegmentPath(path: Path, progress: number): Point {
  const segments = path.segments!
  if (progress <= 0) return [0, 0]
  if (progress >= 1) return segments[segments.length - 1]!.to

  let index: number
  let localProgress: number
  if (path.lengths !== null) {
    let endIndex = path.lengths.findIndex((length) => progress <= length)
    if (endIndex < 0) endIndex = path.lengths.length - 1
    const startLength = endIndex === 0 ? 0 : path.lengths[endIndex - 1]!
    const endLength = path.lengths[endIndex]!
    index = endIndex
    localProgress = (progress - startLength) / (endLength - startLength)
  } else {
    const scaled = progress * segments.length
    index = Math.min(segments.length - 1, Math.floor(scaled))
    localProgress = scaled - index
  }

  const segment = segments[index]!
  const from = index === 0 ? [0, 0] as Point : segments[index - 1]!.to
  return resolveSegmentPoint(segment, from, localProgress)
}

/** Resolves one prepared line or arc segment at a local progress. */
function resolveSegmentPoint(segment: ResolvablePathSegment, from: Point, progress: number): Point {
  if (segment.kind === 'line') return lerpPoint(from, segment.to, progress)
  if (progress <= 0) return from
  if (progress >= 1) return segment.to
  const point = resolveArcPoint(segment, progress)
  const start = resolveArcPoint(segment, 0)
  const end = resolveArcPoint(segment, 1)
  return [
    point[0] + (1 - progress) * (from[0] - start[0]) + progress * (segment.to[0] - end[0]),
    point[1] + (1 - progress) * (from[1] - start[1]) + progress * (segment.to[1] - end[1]),
  ]
}

/** Resolves one raw elliptical-arc point before endpoint correction. */
function resolveArcPoint(segment: Extract<ResolvablePathSegment, { kind: 'arc' }>, progress: number): Point {
  const angle = segment.startAngle + segment.deltaAngle * progress
  const rotation = segment.rotation * Math.PI / 180
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  const localX = segment.radius[0] * Math.cos(angle)
  const localY = segment.radius[1] * Math.sin(angle)
  return [
    segment.center[0] + cosine * localX - sine * localY,
    segment.center[1] + sine * localX + cosine * localY,
  ]
}

/** Converts one canonical normalized point into the actual A-to-B frame. */
function mapNormalizedPoint(point: Point, from: Point, to: Point): Point {
  const deltaX = to[0] - from[0]
  const deltaY = to[1] - from[1]
  return [
    from[0] + point[0] * deltaX - point[1] * deltaY,
    from[1] + point[0] * deltaY + point[1] * deltaX,
  ]
}

/** Converts one SVG endpoint arc into a center-parameterized arc segment. */
function resolveArcSegment(from: Point, input: Extract<PathSegmentInput, { kind: 'arc' }>): PathArcSegment | null {
  let radiusX = Math.abs(input.radius[0])
  let radiusY = Math.abs(input.radius[1])
  if (radiusX === 0 || radiusY === 0) return null

  const rotation = input.rotation * Math.PI / 180
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  const halfDeltaX = (from[0] - input.to[0]) / 2
  const halfDeltaY = (from[1] - input.to[1]) / 2
  const primeX = cosine * halfDeltaX + sine * halfDeltaY
  const primeY = -sine * halfDeltaX + cosine * halfDeltaY
  const radiusRatio = (primeX * primeX) / (radiusX * radiusX) + (primeY * primeY) / (radiusY * radiusY)
  if (radiusRatio > 1) {
    const scale = Math.sqrt(radiusRatio)
    radiusX *= scale
    radiusY *= scale
  }

  const numerator = radiusX * radiusX * radiusY * radiusY
    - radiusX * radiusX * primeY * primeY
    - radiusY * radiusY * primeX * primeX
  const denominator = radiusX * radiusX * primeY * primeY + radiusY * radiusY * primeX * primeX
  const coefficient = denominator === 0
    ? 0
    : (input.largeArc === input.sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator))
  const centerPrimeX = coefficient * radiusX * primeY / radiusY
  const centerPrimeY = coefficient * -radiusY * primeX / radiusX
  const center: Point = [
    cosine * centerPrimeX - sine * centerPrimeY + (from[0] + input.to[0]) / 2,
    sine * centerPrimeX + cosine * centerPrimeY + (from[1] + input.to[1]) / 2,
  ]
  const startVector: Point = [(primeX - centerPrimeX) / radiusX, (primeY - centerPrimeY) / radiusY]
  const endVector: Point = [(-primeX - centerPrimeX) / radiusX, (-primeY - centerPrimeY) / radiusY]
  const startAngle = Math.atan2(startVector[1], startVector[0])
  let deltaAngle = Math.atan2(
    startVector[0] * endVector[1] - startVector[1] * endVector[0],
    startVector[0] * endVector[0] + startVector[1] * endVector[1],
  )
  if (!input.sweep && deltaAngle > 0) deltaAngle -= Math.PI * 2
  if (input.sweep && deltaAngle < 0) deltaAngle += Math.PI * 2

  const output: Omit<PathArcSegment, 'length'> = {
    kind: 'arc',
    to: [...input.to] as Point,
    center,
    radius: [radiusX, radiusY],
    rotation: input.rotation,
    startAngle,
    deltaAngle,
  }
  return { ...output, length: estimateArcLength(output, from) }
}

/** Estimates one normalized elliptical-arc length for traversal preparation. */
function estimateArcLength(segment: Omit<PathArcSegment, 'length'>, from: Point): number {
  let previous = from
  let total = 0
  for (let index = 1; index <= ARC_LENGTH_SAMPLES; index += 1) {
    const point = resolveSegmentPoint(segment, from, index / ARC_LENGTH_SAMPLES)
    total += distance(previous, point)
    previous = point
  }
  return total
}

/** Builds cumulative normalized segment lengths for arc-length traversal. */
function cumulativeLengths(segments: readonly PathSegment[], totalLength: number): number[] {
  let accumulated = 0
  return segments.map((segment) => {
    accumulated += segment.length
    return accumulated / totalLength
  })
}

/** Checks whether two points are identical. */
function samePoint(left: Point, right: Point): boolean {
  return left[0] === right[0] && left[1] === right[1]
}

/** Computes Euclidean distance between two normalized points. */
function distance(left: Point, right: Point): number {
  return Math.hypot(right[0] - left[0], right[1] - left[1])
}

/** Interpolates one normalized line segment. */
function lerpPoint(from: Point, to: Point, progress: number): Point {
  return [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress]
}

/** Checks one prepared segment shape at the compiled-scene boundary. */
function isPreparedSegment(value: unknown): value is PathSegment {
  if (!isRecord(value) || !isPoint(value.to) || !isFiniteNumber(value.length)) return false
  if (value.kind === 'line') return true
  return value.kind === 'arc'
    && isPoint(value.center)
    && isPoint(value.radius)
    && isFiniteNumber(value.rotation)
    && isFiniteNumber(value.startAngle)
    && isFiniteNumber(value.deltaAngle)
}

/** Checks one numeric point. */
function isPoint(value: unknown): value is Point {
  return Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber)
}

/** Checks one JSON-like record without importing the scene layer. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
