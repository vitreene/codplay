export type PolygonShapeState = {
  sides?: unknown
  inner?: unknown
  outer?: unknown
  rotationDeg?: unknown
}

export type NormalizedPolygonShapeState = {
  sides: number
  inner: number | null
  outer: number
  rotationDeg: number
}

type Point = { x: number; y: number }

/** Clamps one morph progress into the [0, 1] interval. */
export function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Normalizes one authored polygon shape state into a safe geometric state. */
export function normalizePolygonShapeState(input: PolygonShapeState): NormalizedPolygonShapeState {
  const sidesRaw = Number.isFinite(input.sides) ? Number(input.sides) : 3
  const sides = Math.max(3, Math.round(sidesRaw))
  const outerRaw = Number.isFinite(input.outer) ? Number(input.outer) : 40
  const outer = Math.max(1, outerRaw)
  const innerRaw = Number.isFinite(input.inner) ? Number(input.inner) : null
  const inner = innerRaw === null ? null : Math.max(0, Math.min(outer, Number(innerRaw)))
  const rotationDeg = Number.isFinite(input.rotationDeg) ? Number(input.rotationDeg) : -90
  return { sides, inner, outer, rotationDeg }
}

/** Builds the explicit vertices of one regular polygon or star. */
export function createPolygonVertices(input: NormalizedPolygonShapeState): Point[] {
  const { sides, inner, outer, rotationDeg } = input
  const isStar = inner !== null && inner > 0 && inner < outer
  const stepCount = isStar ? sides * 2 : sides
  const startAngle = (rotationDeg * Math.PI) / 180
  const points: Point[] = []

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

/** Measures the perimeter length of one closed polyline. */
function measureClosedPolyline(points: readonly Point[]): { lengths: number[]; total: number } {
  const lengths: number[] = []
  let total = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    const dx = next.x - current.x
    const dy = next.y - current.y
    const length = Math.hypot(dx, dy)
    lengths.push(length)
    total += length
  }
  return { lengths, total }
}

/** Resamples one closed polyline into a fixed point count. */
export function resampleClosedPolyline(points: readonly Point[], sampleCount: number): Point[] {
  if (points.length === 0) return []
  if (points.length === 1) return Array.from({ length: sampleCount }, () => ({ ...points[0]! }))

  const { lengths, total } = measureClosedPolyline(points)
  if (total === 0) return Array.from({ length: sampleCount }, () => ({ ...points[0]! }))

  const result: Point[] = []
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const targetDistance = (sampleIndex / sampleCount) * total
    let walked = 0
    for (let segmentIndex = 0; segmentIndex < points.length; segmentIndex += 1) {
      const segmentLength = lengths[segmentIndex]!
      const nextWalked = walked + segmentLength
      if (targetDistance <= nextWalked || segmentIndex === points.length - 1) {
        const localDistance = segmentLength === 0 ? 0 : (targetDistance - walked) / segmentLength
        const current = points[segmentIndex]!
        const next = points[(segmentIndex + 1) % points.length]!
        result.push({
          x: current.x + (next.x - current.x) * localDistance,
          y: current.y + (next.y - current.y) * localDistance,
        })
        break
      }
      walked = nextWalked
    }
  }

  return result
}

/** Interpolates two point clouds of equal size. */
export function interpolatePointSets(from: readonly Point[], to: readonly Point[], progress: number): Point[] {
  const clamped = clampProgress(progress)
  return from.map((point, index) => ({
    x: point.x + (to[index]!.x - point.x) * clamped,
    y: point.y + (to[index]!.y - point.y) * clamped,
  }))
}

/** Serializes one point cloud into one SVG polygon points string. */
export function toPolygonPointsString(points: readonly Point[]): string {
  return points.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(' ')
}

/** Resolves one polygon points string for one static shape state. */
export function resolvePolygonPointsString(input: PolygonShapeState): string {
  return toPolygonPointsString(createPolygonVertices(normalizePolygonShapeState(input)))
}

/** Resolves one morph-interpolated polygon points string between two shape states. */
export function resolveMorphPointsString(input: {
  from: PolygonShapeState
  to: PolygonShapeState
  progress: number
  sampleCount?: number
}): string {
  const sampleCount = Math.max(8, Math.round(Number.isFinite(input.sampleCount) ? Number(input.sampleCount) : 96))
  const fromPoints = resampleClosedPolyline(
    createPolygonVertices(normalizePolygonShapeState(input.from)),
    sampleCount,
  )
  const toPoints = resampleClosedPolyline(
    createPolygonVertices(normalizePolygonShapeState(input.to)),
    sampleCount,
  )
  return toPolygonPointsString(interpolatePointSets(fromPoints, toPoints, input.progress))
}
