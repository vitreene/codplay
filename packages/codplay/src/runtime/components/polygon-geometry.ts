export type PolygonShapeState = {
  sides?: unknown;
  inner?: unknown;
  outer?: unknown;
  rotationDeg?: unknown;
  inflexion?: unknown;
};

export type NormalizedPolygonShapeState = {
  sides: number;
  inner: number | null;
  outer: number;
  rotationDeg: number;
  inflexion: number[];
};

type Point = { x: number; y: number };

/** Clamps one morph progress into the [0, 1] interval. */
export function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Normalizes one authored polygon shape state into a safe geometric state. */
export function normalizePolygonShapeState(input: PolygonShapeState): NormalizedPolygonShapeState {
  const sidesRaw = Number.isFinite(input.sides) ? Number(input.sides) : 3;
  const sides = Math.max(3, Math.round(sidesRaw));
  const outerRaw = Number.isFinite(input.outer) ? Number(input.outer) : 40;
  const outer = Math.max(1, outerRaw);
  const innerRaw = Number.isFinite(input.inner) ? Number(input.inner) : null;
  const inner = innerRaw === null ? null : Math.max(0, Math.min(outer, Number(innerRaw)));
  const rotationDeg = Number.isFinite(input.rotationDeg) ? Number(input.rotationDeg) : -90;
  const segmentCount = inner !== null && inner > 0 && inner < outer ? sides * 2 : sides;
  const inflexionRaw = input.inflexion;
  let inflexion: number[];
  if (Array.isArray(inflexionRaw)) {
    inflexion = Array.from({ length: segmentCount }, (_, i) => {
      const v = inflexionRaw[i];
      return Number.isFinite(v) ? Number(v) : 0;
    });
  } else {
    const scalar = Number.isFinite(inflexionRaw) ? Number(inflexionRaw) : 0;
    inflexion = Array.from({ length: segmentCount }, () => scalar);
  }
  return { sides, inner, outer, rotationDeg, inflexion };
}

/** Builds the explicit vertices of one regular polygon or star. */
export function createPolygonVertices(input: NormalizedPolygonShapeState): Point[] {
  const { sides, inner, outer, rotationDeg } = input;
  const isStar = inner !== null && inner > 0 && inner < outer;
  const stepCount = isStar ? sides * 2 : sides;
  const startAngle = (rotationDeg * Math.PI) / 180;
  const points: Point[] = [];

  for (let index = 0; index < stepCount; index += 1) {
    const angle = startAngle + (Math.PI * 2 * index) / stepCount;
    const radius = isStar && index % 2 === 1 ? inner : outer;
    points.push({
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
    });
  }

  return points;
}

/** Measures the perimeter length of one closed polyline. */
function measureClosedPolyline(points: readonly Point[]): { lengths: number[]; total: number } {
  const lengths: number[] = [];
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.hypot(dx, dy);
    lengths.push(length);
    total += length;
  }
  return { lengths, total };
}

/** Resamples one closed polyline into a fixed point count. */
export function resampleClosedPolyline(points: readonly Point[], sampleCount: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: sampleCount }, () => ({ ...points[0]! }));

  const { lengths, total } = measureClosedPolyline(points);
  if (total === 0) return Array.from({ length: sampleCount }, () => ({ ...points[0]! }));

  const result: Point[] = [];
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const targetDistance = (sampleIndex / sampleCount) * total;
    let walked = 0;
    for (let segmentIndex = 0; segmentIndex < points.length; segmentIndex += 1) {
      const segmentLength = lengths[segmentIndex]!;
      const nextWalked = walked + segmentLength;
      if (targetDistance <= nextWalked || segmentIndex === points.length - 1) {
        const localDistance = segmentLength === 0 ? 0 : (targetDistance - walked) / segmentLength;
        const current = points[segmentIndex]!;
        const next = points[(segmentIndex + 1) % points.length]!;
        result.push({
          x: current.x + (next.x - current.x) * localDistance,
          y: current.y + (next.y - current.y) * localDistance,
        });
        break;
      }
      walked = nextWalked;
    }
  }

  return result;
}

/** Interpolates two point clouds of equal size. */
export function interpolatePointSets(
  from: readonly Point[],
  to: readonly Point[],
  progress: number,
): Point[] {
  const clamped = clampProgress(progress);
  return from.map((point, index) => ({
    x: point.x + (to[index]!.x - point.x) * clamped,
    y: point.y + (to[index]!.y - point.y) * clamped,
  }));
}

/** Serializes one point cloud into one SVG polygon points string. */
export function toPolygonPointsString(points: readonly Point[]): string {
  return points.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(" ");
}

/** Resolves one polygon points string for one static shape state. */
export function resolvePolygonPointsString(input: PolygonShapeState): string {
  return toPolygonPointsString(createPolygonVertices(normalizePolygonShapeState(input)));
}

/** Resolves one morph-interpolated polygon points string between two shape states. */
export function resolveMorphPointsString(input: {
  from: PolygonShapeState;
  to: PolygonShapeState;
  progress: number;
  sampleCount?: number;
}): string {
  const sampleCount = Math.max(
    8,
    Math.round(Number.isFinite(input.sampleCount) ? Number(input.sampleCount) : 96),
  );
  const fromPoints = resampleClosedPolyline(
    createPolygonVertices(normalizePolygonShapeState(input.from)),
    sampleCount,
  );
  const toPoints = resampleClosedPolyline(
    createPolygonVertices(normalizePolygonShapeState(input.to)),
    sampleCount,
  );
  return toPolygonPointsString(interpolatePointSets(fromPoints, toPoints, input.progress));
}

/** Builds one SVG arc or line command from one vertex to the next. */
function arcSegmentCommand(p1: Point, p2: Point, f: number): string {
  if (f === 0) return `L ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const c = Math.hypot(dx, dy);
  if (c === 0) return `L ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
  const s = Math.abs(f);
  const r = ((c * c) / 4 + s * s) / (2 * s);
  const largeArc = s > c / 2 ? 1 : 0;
  const sweep = f > 0 ? 1 : 0;
  return `A ${r.toFixed(3)} ${r.toFixed(3)} 0 ${largeArc} ${sweep} ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
}

/** Serializes one point cloud with per-segment inflexion into an SVG path `d` string. */
export function toPolygonPathString(vertices: readonly Point[], inflexions: readonly number[]): string {
  if (vertices.length === 0) return "";
  const first = vertices[0]!;
  const commands: string[] = [`M ${first.x.toFixed(3)} ${first.y.toFixed(3)}`];
  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i]!;
    const p2 = vertices[(i + 1) % vertices.length]!;
    commands.push(arcSegmentCommand(p1, p2, inflexions[i] ?? 0));
  }
  commands.push("Z");
  return commands.join(" ");
}

/** Resolves one SVG path `d` string for one static shape state, with arc support. */
export function resolvePolygonPathString(input: PolygonShapeState): string {
  const state = normalizePolygonShapeState(input);
  return toPolygonPathString(createPolygonVertices(state), state.inflexion);
}

/** Resolves one morph-interpolated SVG path `d` string between two shape states. */
export function resolveMorphPathString(input: {
  from: PolygonShapeState;
  to: PolygonShapeState;
  progress: number;
  sampleCount?: number;
}): string {
  const sampleCount = Math.max(
    8,
    Math.round(Number.isFinite(input.sampleCount) ? Number(input.sampleCount) : 96),
  );
  const fromPoints = resampleClosedPolyline(
    createPolygonVertices(normalizePolygonShapeState(input.from)),
    sampleCount,
  );
  const toPoints = resampleClosedPolyline(
    createPolygonVertices(normalizePolygonShapeState(input.to)),
    sampleCount,
  );
  const interpolated = interpolatePointSets(fromPoints, toPoints, input.progress);
  return toPolygonPathString(
    interpolated,
    Array.from({ length: interpolated.length }, () => 0),
  );
}
