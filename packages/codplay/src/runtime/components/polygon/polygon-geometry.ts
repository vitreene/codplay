import type {
  PolygonGeometryState,
  PolygonPoint,
  PolygonShapeState,
} from './polygon-types'

/** Clamps one temporal morph progress into the closed [0, 1] interval. */
export function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Expands one compiled shape into the exact geometric segment representation. */
export function resolvePolygonGeometryState(input: PolygonShapeState): PolygonGeometryState {
  const isStar = input.inner !== null && input.inner > 0 && input.inner < input.outer
  const segmentCount = isStar ? input.sides * 2 : input.sides
  const inflexionValue = input.inflexion
  const inflexion = typeof inflexionValue === 'number'
    ? Array.from({ length: segmentCount }, () => inflexionValue)
    : Array.from({ length: segmentCount }, (_, index) => inflexionValue[index] ?? 0)
  return {
    sides: input.sides,
    inner: input.inner,
    outer: input.outer,
    rotationDeg: input.rotationDeg,
    inflexion,
  }
}

/** Builds the explicit vertices of one regular polygon or star. */
export function createPolygonVertices(input: PolygonGeometryState): readonly PolygonPoint[] {
  const { sides, inner, outer, rotationDeg } = input
  const isStar = inner !== null && inner > 0 && inner < outer
  const stepCount = isStar ? sides * 2 : sides
  const startAngle = (rotationDeg * Math.PI) / 180
  const points: PolygonPoint[] = []

  for (let index = 0; index < stepCount; index += 1) {
    const angle = startAngle + (Math.PI * 2 * index) / stepCount
    const radius = isStar && index % 2 === 1 ? inner : outer
    points.push({
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
    })
  }
  return points
}

/** Resamples one closed polyline into a fixed number of points. */
export function resampleClosedPolyline(points: readonly PolygonPoint[], sampleCount: number): PolygonPoint[] {
  if (points.length === 0) return []
  if (points.length === 1) return Array.from({ length: sampleCount }, () => ({ ...points[0]! }))

  const lengths: number[] = []
  let total = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    const length = Math.hypot(next.x - current.x, next.y - current.y)
    lengths.push(length)
    total += length
  }
  if (total === 0) return Array.from({ length: sampleCount }, () => ({ ...points[0]! }))

  const result: PolygonPoint[] = []
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const targetDistance = (sampleIndex / sampleCount) * total
    let walked = 0
    for (let segmentIndex = 0; segmentIndex < points.length; segmentIndex += 1) {
      const segmentLength = lengths[segmentIndex]!
      const nextWalked = walked + segmentLength
      if (targetDistance <= nextWalked || segmentIndex === points.length - 1) {
        const local = segmentLength === 0 ? 0 : (targetDistance - walked) / segmentLength
        const current = points[segmentIndex]!
        const next = points[(segmentIndex + 1) % points.length]!
        result.push({
          x: current.x + (next.x - current.x) * local,
          y: current.y + (next.y - current.y) * local,
        })
        break
      }
      walked = nextWalked
    }
  }
  return result
}

/** Interpolates two point sets of equal size. */
export function interpolatePointSets(
  from: readonly PolygonPoint[],
  to: readonly PolygonPoint[],
  progress: number,
): PolygonPoint[] {
  const bounded = clampProgress(progress)
  return from.map((point, index) => ({
    x: point.x + (to[index]!.x - point.x) * bounded,
    y: point.y + (to[index]!.y - point.y) * bounded,
  }))
}

/** Serializes polygon points with stable precision. */
export function toPolygonPointsString(points: readonly PolygonPoint[]): string {
  return points.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(' ')
}

/** Resolves one static polygon points string from a compiled shape state. */
export function resolvePolygonPointsString(input: PolygonShapeState): string {
  return toPolygonPointsString(createPolygonVertices(resolvePolygonGeometryState(input)))
}

/** Resolves one morph-interpolated points string using the compiled sample count. */
export function resolveMorphPointsString(input: {
  from: PolygonShapeState
  to: PolygonShapeState
  progress: number
  sampleCount: number
}): string {
  const from = resampleClosedPolyline(createPolygonVertices(resolvePolygonGeometryState(input.from)), input.sampleCount)
  const to = resampleClosedPolyline(createPolygonVertices(resolvePolygonGeometryState(input.to)), input.sampleCount)
  return toPolygonPointsString(interpolatePointSets(from, to, input.progress))
}

/** Serializes one polygon edge as a line or circular SVG arc. */
function arcSegmentCommand(first: PolygonPoint, second: PolygonPoint, inflexion: number): string {
  if (inflexion === 0) return `L ${second.x.toFixed(3)} ${second.y.toFixed(3)}`
  const chord = Math.hypot(second.x - first.x, second.y - first.y)
  if (chord === 0) return `L ${second.x.toFixed(3)} ${second.y.toFixed(3)}`
  const radius = ((chord * chord) / 4 + inflexion * inflexion) / (2 * Math.abs(inflexion))
  const largeArc = Math.abs(inflexion) > chord / 2 ? 1 : 0
  const sweep = inflexion > 0 ? 1 : 0
  return `A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 ${largeArc} ${sweep} ${second.x.toFixed(3)} ${second.y.toFixed(3)}`
}

/** Serializes vertices and inflexions into one closed SVG path. */
export function toPolygonPathString(vertices: readonly PolygonPoint[], inflexions: readonly number[]): string {
  if (vertices.length === 0) return ''
  const first = vertices[0]!
  const commands = [`M ${first.x.toFixed(3)} ${first.y.toFixed(3)}`]
  for (let index = 0; index < vertices.length; index += 1) {
    commands.push(arcSegmentCommand(vertices[index]!, vertices[(index + 1) % vertices.length]!, inflexions[index] ?? 0))
  }
  commands.push('Z')
  return commands.join(' ')
}

/** Resolves one static SVG path string from a compiled shape state. */
export function resolvePolygonPathString(input: PolygonShapeState): string {
  const state = resolvePolygonGeometryState(input)
  return toPolygonPathString(createPolygonVertices(state), state.inflexion)
}

/** Resolves one morph-interpolated SVG path string from compiled shape states. */
export function resolveMorphPathString(input: {
  from: PolygonShapeState
  to: PolygonShapeState
  progress: number
  sampleCount: number
}): string {
  const from = resampleClosedPolyline(createPolygonVertices(resolvePolygonGeometryState(input.from)), input.sampleCount)
  const to = resampleClosedPolyline(createPolygonVertices(resolvePolygonGeometryState(input.to)), input.sampleCount)
  const interpolated = interpolatePointSets(from, to, input.progress)
  return toPolygonPathString(interpolated, Array.from({ length: interpolated.length }, () => 0))
}

/** Compares two compiled polygon shapes without serializing their values. */
export function samePolygonShape(left: PolygonShapeState, right: PolygonShapeState): boolean {
  return sameValue(left.sides, right.sides)
    && sameValue(left.inner, right.inner)
    && sameValue(left.outer, right.outer)
    && sameValue(left.rotationDeg, right.rotationDeg)
    && sameValue(left.inflexion, right.inflexion)
}

/** Compares scalar and list values used by the compiled shape profile. */
function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => sameValue(value, right[index]))
  }
  return false
}
