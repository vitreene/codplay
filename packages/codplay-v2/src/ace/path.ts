/** A two-dimensional point used by ACE's geometry primitives. */
export type Point = readonly [number, number]

/** The two traversal modes that must remain visually comparable. */
export type PathTraversal = 'parameter' | 'arc-length'

/** A normalized quadratic path with start [0, 0] and end [1, 0]. */
export type PathInput = Readonly<{
  control: Point
}>

/** A path prepared for repeated resolution. */
export type Path = Readonly<{
  control: Point
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
  for (let index = 1; index <= ARC_LENGTH_SAMPLES; index++) {
    const point = resolveNormalizedPoint(control, index / ARC_LENGTH_SAMPLES)
    total += Math.hypot(point[0] - previous[0], point[1] - previous[1])
    lengths.push(total)
    previous = point
  }
  return lengths.map((length) => length / total)
}

/** Prepares the optional arc-length lookup table for a normalized path. */
export const preparePath = (
  input: PathInput,
  options: Readonly<{ traversal?: PathTraversal }> = {},
): Path => {
  const traversal = options.traversal ?? 'arc-length'
  return {
    control: [...input.control] as Point,
    traversal,
    lengths: traversal === 'arc-length' ? prepareArcLengths(input.control) : null,
  }
}

/** Converts an arc-length fraction into its matching Bezier parameter. */
const resolveArcParameter = (lengths: readonly number[], progress: number): number => {
  if (progress <= 0 || progress >= 1) return progress
  let low = 0
  let high = lengths.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (lengths[middle] < progress) low = middle + 1
    else high = middle
  }
  const end = low
  const start = end - 1
  const startLength = lengths[start]
  const endLength = lengths[end]
  const localProgress = (progress - startLength) / (endLength - startLength)
  return (start + localProgress) / ARC_LENGTH_SAMPLES
}

/**
 * Resolves a prepared normalized path between two points with uniform segment scaling.
 */
export const resolvePath = (path: Path, from: Point, to: Point, progress: number): Point => {
  const parameter = path.lengths ? resolveArcParameter(path.lengths, progress) : progress
  const [x, y] = resolveNormalizedPoint(path.control, parameter)
  const deltaX = to[0] - from[0]
  const deltaY = to[1] - from[1]
  return [
    from[0] + x * deltaX - y * deltaY,
    from[1] + x * deltaY + y * deltaX,
  ]
}
