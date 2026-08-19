import {
  prepareSegmentPath,
  type Path,
  type PathSegmentInput,
  type PathTraversal,
  type Point,
} from './path'

/** Options controlling the deterministic conversion of author SVG paths. */
export type SvgPathOptions = Readonly<{
  traversal?: PathTraversal
  precision?: number
}>

const COMMANDS = new Set(['M', 'm', 'L', 'l', 'A', 'a'])
const TOKEN_PATTERN = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g

/** Compiles one SVG M/L/A path into a normalized prepared ACE path. */
export function prepareSvgPath(value: string, options: SvgPathOptions = {}): Path {
  const precision = options.precision ?? 2
  if (!Number.isInteger(precision) || precision < 0) throw new Error('SVG path precision must be a non-negative integer.')
  const parsed = parseSvgPath(value)
  const normalized = normalizeSegments(parsed.segments, parsed.start, parsed.end, precision)
  const prepared = prepareSegmentPath({ segments: normalized }, { traversal: options.traversal })
  return quantizePreparedPath(prepared, precision)
}

/** Parses the supported SVG command stream before coordinate normalization. */
function parseSvgPath(value: string): { start: Point; end: Point; segments: readonly PathSegmentInput[] } {
  const tokens = tokenize(value)
  let index = 0
  let command: string | undefined
  let current: Point = [0, 0]
  let start: Point | undefined
  const segments: PathSegmentInput[] = []

  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++]
    if (command === undefined) throw new Error('SVG path must start with a command.')
    if (!COMMANDS.has(command.toUpperCase())) throw new Error(`SVG path command is unsupported: ${command}`)

    const upper = command.toUpperCase()
    const relative = command === command.toLowerCase()
    const count = upper === 'A' ? 7 : 2
    const args = readArguments(tokens, index, count)
    index += count

    if (upper === 'M') {
      if (start !== undefined) throw new Error('SVG path must contain one subpath.')
      current = resolvePoint(args[0]!, args[1]!, current, relative)
      start = current
      command = relative ? 'l' : 'L'
      continue
    }

    if (upper === 'L') {
      const to = resolvePoint(args[0]!, args[1]!, current, relative)
      segments.push({ kind: 'line', to })
      current = to
      continue
    }

    const to = resolvePoint(args[5]!, args[6]!, current, relative)
    if (args[0]! < 0 || args[1]! < 0) throw new Error('SVG arc radii must be non-negative.')
    if (!isArcFlag(args[3]!) || !isArcFlag(args[4]!)) throw new Error('SVG arc flags must be 0 or 1.')
    segments.push({
      kind: 'arc',
      to,
      radius: [args[0]!, args[1]!],
      rotation: args[2]!,
      largeArc: args[3] === 1,
      sweep: args[4] === 1,
    })
    current = to
  }

  if (start === undefined) throw new Error('SVG path is missing its move command.')
  if (segments.length === 0 || samePoint(start, current)) throw new Error('SVG path must contain a non-empty trajectory.')
  return { start, end: current, segments }
}

/** Normalizes source coordinates to the canonical [0, 0] -> [1, 0] frame. */
function normalizeSegments(
  segments: readonly PathSegmentInput[],
  start: Point,
  end: Point,
  precision: number,
): readonly PathSegmentInput[] {
  const deltaX = end[0] - start[0]
  const deltaY = end[1] - start[1]
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  if (lengthSquared === 0) throw new Error('SVG path start and end must be different.')
  const length = Math.sqrt(lengthSquared)
  const direction = Math.atan2(deltaY, deltaX) * 180 / Math.PI
  const normalizePoint = (point: Point): Point => [
    quantize(((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaY) / lengthSquared, precision),
    quantize((-(point[0] - start[0]) * deltaY + (point[1] - start[1]) * deltaX) / lengthSquared, precision),
  ]

  return segments.map((segment, index) => {
    const last = index === segments.length - 1
    if (segment.kind === 'line') {
      return { kind: 'line', to: last ? [1, 0] as Point : normalizePoint(segment.to) }
    }
    return {
      kind: 'arc',
      to: last ? [1, 0] as Point : normalizePoint(segment.to),
      radius: [quantize(segment.radius[0] / length, precision), quantize(segment.radius[1] / length, precision)],
      rotation: quantize(segment.rotation - direction, precision),
      largeArc: segment.largeArc,
      sweep: segment.sweep,
    }
  })
}

/** Quantizes the prepared numeric geometry for compact compiled-scene output. */
function quantizePreparedPath(path: Path, precision: number): Path {
  if (path.kind === 'quadratic') return path
  const segments = path.segments!.map((segment) => segment.kind === 'line'
    ? { ...segment, to: quantizePoint(segment.to, precision), length: quantize(segment.length, precision) }
    : {
        ...segment,
        to: quantizePoint(segment.to, precision),
        center: quantizePoint(segment.center, precision),
        radius: quantizePoint(segment.radius, precision),
        rotation: quantize(segment.rotation, precision),
        startAngle: quantize(segment.startAngle, precision),
        deltaAngle: quantize(segment.deltaAngle, precision),
        length: quantize(segment.length, precision),
      })
  const lengths = path.lengths === null ? null : path.lengths.map((length, index) => index === path.lengths!.length - 1 ? 1 : quantize(length, precision))
  return { ...path, segments, lengths }
}

/** Tokenizes SVG commands and numbers while rejecting unsupported characters. */
function tokenize(value: string): readonly string[] {
  const tokens = value.match(TOKEN_PATTERN) ?? []
  const remainder = value.replace(TOKEN_PATTERN, '').replace(/[\s,]/g, '')
  if (remainder.length > 0) throw new Error(`SVG path contains invalid syntax: ${remainder}`)
  return tokens
}

/** Reads one complete numeric command group. */
function readArguments(tokens: readonly string[], index: number, count: number): readonly number[] {
  if (index + count > tokens.length || tokens.slice(index, index + count).some(isCommand)) {
    throw new Error('SVG path command has incomplete arguments.')
  }
  return tokens.slice(index, index + count).map((token) => {
    const number = Number(token)
    if (!Number.isFinite(number)) throw new Error(`SVG path number is invalid: ${token}`)
    return number
  })
}

/** Resolves one absolute or relative SVG point. */
function resolvePoint(x: number, y: number, current: Point, relative: boolean): Point {
  return relative ? [current[0] + x, current[1] + y] : [x, y]
}

/** Checks one supported SVG command token. */
function isCommand(value: string | undefined): value is string {
  return value !== undefined && /^[a-zA-Z]$/.test(value)
}

/** Checks one SVG arc flag. */
function isArcFlag(value: number): boolean {
  return value === 0 || value === 1
}

/** Checks whether two points are identical. */
function samePoint(left: Point, right: Point): boolean {
  return left[0] === right[0] && left[1] === right[1]
}

/** Rounds one scalar to the requested compiled precision. */
function quantize(value: number, precision: number): number {
  const factor = 10 ** precision
  const rounded = Math.round(value * factor) / factor
  return Object.is(rounded, -0) ? 0 : rounded
}

/** Rounds one point to the requested compiled precision. */
function quantizePoint(point: Point, precision: number): Point {
  return [quantize(point[0], precision), quantize(point[1], precision)]
}
