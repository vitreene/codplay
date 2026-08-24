/** Authored polygon shape values before normalization. */
export type PolygonShapeState = Readonly<{
  sides?: unknown
  inner?: unknown
  outer?: unknown
  rotationDeg?: unknown
  inflexion?: unknown
}>

/** Safe polygon values used by the geometry algorithms. */
export type NormalizedPolygonShapeState = Readonly<{
  sides: number
  inner: number | null
  outer: number
  rotationDeg: number
  inflexion: readonly number[]
}>

/** One cartesian polygon point. */
export type PolygonPoint = Readonly<{ x: number; y: number }>

/** Clamps one morph progress into the closed [0, 1] interval. */
export function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Normalizes authored polygon values into a safe geometric state. */
export function normalizePolygonShapeState(input: PolygonShapeState): NormalizedPolygonShapeState {
  const sidesRaw = finiteNumber(input.sides) ?? 3
  const sides = Math.max(3, Math.round(sidesRaw))
  const outer = Math.max(1, finiteNumber(input.outer) ?? 40)
  const innerRaw = input.inner === null ? null : finiteNumber(input.inner)
  const inner = innerRaw === null ? null : Math.max(0, Math.min(outer, innerRaw ?? 0))
  const rotationDeg = finiteNumber(input.rotationDeg) ?? -90
  const segmentCount = inner !== null && inner > 0 && inner < outer ? sides * 2 : sides
  const scalarInflexion = finiteNumber(input.inflexion) ?? 0
  const inflexionValues = Array.isArray(input.inflexion) ? input.inflexion : undefined
  const inflexion = inflexionValues !== undefined
    ? Array.from({ length: segmentCount }, (_, index) => finiteNumber(inflexionValues[index]) ?? 0)
    : Array.from({ length: segmentCount }, () => scalarInflexion)
  return { sides, inner, outer, rotationDeg, inflexion }
}

/** Builds the explicit vertices of one regular polygon or star. */
export function createPolygonVertices(input: NormalizedPolygonShapeState): readonly PolygonPoint[] {
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

/** Resolves one static polygon points string. */
export function resolvePolygonPointsString(input: PolygonShapeState): string {
  return toPolygonPointsString(createPolygonVertices(normalizePolygonShapeState(input)))
}

/** Resolves one morph-interpolated points string using V1's fixed sampling. */
export function resolveMorphPointsString(input: {
  from: PolygonShapeState
  to: PolygonShapeState
  progress: number
  sampleCount?: number
}): string {
  const sampleCount = Math.max(8, Math.round(finiteNumber(input.sampleCount) ?? 96))
  const from = resampleClosedPolyline(createPolygonVertices(normalizePolygonShapeState(input.from)), sampleCount)
  const to = resampleClosedPolyline(createPolygonVertices(normalizePolygonShapeState(input.to)), sampleCount)
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

/** Resolves one static polygon path string. */
export function resolvePolygonPathString(input: PolygonShapeState): string {
  const state = normalizePolygonShapeState(input)
  return toPolygonPathString(createPolygonVertices(state), state.inflexion)
}

/** Resolves one morph-interpolated path string with straight sampled segments. */
export function resolveMorphPathString(input: {
  from: PolygonShapeState
  to: PolygonShapeState
  progress: number
  sampleCount?: number
}): string {
  const sampleCount = Math.max(8, Math.round(finiteNumber(input.sampleCount) ?? 96))
  const from = resampleClosedPolyline(createPolygonVertices(normalizePolygonShapeState(input.from)), sampleCount)
  const to = resampleClosedPolyline(createPolygonVertices(normalizePolygonShapeState(input.to)), sampleCount)
  return toPolygonPathString(
    interpolatePointSets(from, to, input.progress),
    Array.from({ length: sampleCount }, () => 0),
  )
}

/** Converts only finite numeric authored values. */
function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
