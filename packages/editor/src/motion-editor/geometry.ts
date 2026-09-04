/** Pure geometry used by the editor motion overlay and its document adapter. */

import { prepareSvgPath, resolvePath } from 'ace'
import type { CodPlayPresentationPose } from 'codplay'
import type { SelectionFrameValue } from '../decor-editor/types'

export type MotionPoint = Readonly<{ x: number; y: number }>
export type MotionEasing = string | Readonly<{
  kind: 'cubic-bezier'
  p1x: number
  p1y: number
  p2x: number
  p2y: number
}>

/** Returns the midpoint of two scene-local points. */
export function midpoint(from: MotionPoint, to: MotionPoint): MotionPoint {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
}

/** Returns the visual center of an affine selection-frame pose. */
export function frameVisualCenter(frame: SelectionFrameValue): MotionPoint {
  const fx = clamp(frame.rotationOrigin?.fx ?? 0.5)
  const fy = clamp(frame.rotationOrigin?.fy ?? 0.5)
  const originX = fx * frame.width
  const originY = fy * frame.height
  const scaleX = finiteScale(frame.scaleX)
  const scaleY = finiteScale(frame.scaleY)
  const angle = ((frame.rotate ?? 0) * Math.PI) / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const localX = frame.width / 2
  const localY = frame.height / 2
  return {
    x: frame.x + originX - (cosine * scaleX * originX - sine * scaleY * originY)
      + cosine * scaleX * localX - sine * scaleY * localY,
    y: frame.y + originY - (sine * scaleX * originX + cosine * scaleY * originY)
      + sine * scaleX * localX + cosine * scaleY * localY,
  }
}

/** Converts one runtime affine pose into the local frame vocabulary of SelectionFrameV2. */
export function presentationPoseToSelectionFrame(
  pose: CodPlayPresentationPose,
  rotationOrigin?: SelectionFrameValue['rotationOrigin'],
): SelectionFrameValue {
  const width = finiteDimension(pose.localWidth)
  const height = finiteDimension(pose.localHeight)
  const rawMatrix = pose.matrix
  const scaleX = finiteScale(Math.hypot(rawMatrix.a, rawMatrix.b))
  const scaleY = finiteScale(Math.hypot(rawMatrix.c, rawMatrix.d))
  const rotate = Math.atan2(rawMatrix.b, rawMatrix.a) * 180 / Math.PI
  const radians = rotate * Math.PI / 180
  const linear = {
    a: Math.cos(radians) * scaleX,
    b: Math.sin(radians) * scaleX,
    c: -Math.sin(radians) * scaleY,
    d: Math.cos(radians) * scaleY,
  }
  const origin = {
    fx: clamp(rotationOrigin?.fx ?? 0.5),
    fy: clamp(rotationOrigin?.fy ?? 0.5),
  }
  const pivotX = origin.fx * width
  const pivotY = origin.fy * height
  const centerX = width / 2
  const centerY = height / 2
  // The runtime pose is affine. SelectionFrameV2 can represent rotation and
  // scale but not an arbitrary shear from an ancestor, so preserve the exact
  // visual centre even when the decomposed frame is the closest representation.
  const presentedCenter = {
    x: pose.origin.x + rawMatrix.a * centerX + rawMatrix.c * centerY,
    y: pose.origin.y + rawMatrix.b * centerX + rawMatrix.d * centerY,
  }
  const frameCenterWithoutTranslation = {
    x: pivotX + linear.a * (centerX - pivotX) + linear.c * (centerY - pivotY),
    y: pivotY + linear.b * (centerX - pivotX) + linear.d * (centerY - pivotY),
  }
  return {
    x: presentedCenter.x - frameCenterWithoutTranslation.x,
    y: presentedCenter.y - frameCenterWithoutTranslation.y,
    width,
    height,
    rotate: Number.isFinite(rotate) ? rotate : 0,
    scaleX,
    scaleY,
    rotationOrigin: origin,
  }
}

/** Returns a frame translated by a scene-local pointer delta. */
export function translateFrame(frame: SelectionFrameValue, dx: number, dy: number): SelectionFrameValue {
  return { ...frame, x: frame.x + dx, y: frame.y + dy }
}

/** Returns the distance from a point to a segment, used by the overlay hit-test. */
export function distanceToSegment(point: MotionPoint, from: MotionPoint, to: MotionPoint): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= Number.EPSILON) return Math.hypot(point.x - from.x, point.y - from.y)
  const projection = Math.min(1, Math.max(0, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (from.x + projection * dx), point.y - (from.y + projection * dy))
}

/** Returns a normalized SVG arc for three scene points, or undefined for the implicit straight path. */
export function createMotionArcPath(source: MotionPoint, control: MotionPoint, target: MotionPoint): string | undefined {
  const normalized = normalizePoints(source, control, target)
  if (normalized === undefined) return undefined
  const circle = circumcircle(normalized.source, normalized.control, normalized.target)
  if (circle === undefined) return undefined
  const { largeArc, sweep } = resolveMinorArcFlags(normalized.source, normalized.control, normalized.target)
  const radius = formatNumber(circle.radius)
  return `M 0 0 A ${radius} ${radius} 0 ${largeArc} ${sweep} 1 0`
}

/** Returns an SVG arc in scene coordinates for drawing the overlay path. */
export function createDisplayArcPath(source: MotionPoint, control: MotionPoint, target: MotionPoint): string | undefined {
  // A midpoint is the implicit straight trajectory. Treat near-collinear floating-point results
  // as straight as well; endpoint reprojection can otherwise turn the same route into a tiny arc
  // when the active KF is materialized.
  if (isStraightMotion(source, control, target)) return undefined
  const prepared = prepareCanonicalMotionPath(source, control, target)
  if (prepared === undefined || prepared.kind !== 'segments' || prepared.segments === undefined || prepared.segments.length !== 1) return undefined
  const segment = prepared.segments[0]
  if (segment === undefined || segment.kind !== 'arc') return undefined
  // Keep the projected SVG representation on the same quantized geometry that CodPlay V2
  // consumes at compilation time. A raw circumcircle here would drift several pixels from the
  // presented item after `prepareSvgPath(..., precision: 2)` rounds the normalized arc.
  // Derive the radius from the canonical median sagitta rather than from the rounded prepared
  // center. This makes the SVG marker and the runtime point agree at 50% even though the runtime
  // retains quantized start/delta angles internally.
  const median = resolvePath(prepared, [0, 0], [1, 0], 0.5)
  const sagitta = Math.abs(median[1])
  if (sagitta <= 1e-8) return undefined
  const normalizedRadius = (0.25 + sagitta * sagitta) / (2 * sagitta)
  const radius = normalizedRadius * distance(source, target)
  const largeArc = Math.abs(segment.deltaAngle) > Math.PI ? 1 : 0
  const sweep = segment.deltaAngle >= 0 ? 1 : 0
  return `M ${formatNumber(source.x)} ${formatNumber(source.y)} A ${formatNumber(radius)} ${formatNumber(radius)} ${formatNumber(segment.rotation)} ${largeArc} ${sweep} ${formatNumber(target.x)} ${formatNumber(target.y)}`
}

/** Resolves one point on the canonical editor/runtime path at a normalized progress. */
export function motionPathPointAtProgress(
  source: MotionPoint,
  control: MotionPoint,
  target: MotionPoint,
  progress: number,
): MotionPoint {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  const prepared = prepareCanonicalMotionPath(source, control, target)
  if (prepared === undefined) {
    return {
      x: source.x + (target.x - source.x) * clamped,
      y: source.y + (target.y - source.y) * clamped,
    }
  }
  const [x, y] = resolvePath(prepared, [source.x, source.y], [target.x, target.y], clamped)
  return { x, y }
}

/** Returns the normalized control point of a scene-space motion path. */
export function normalizeMotionControl(source: MotionPoint, control: MotionPoint, target: MotionPoint): MotionPoint | undefined {
  const normalized = normalizePoints(source, control, target)
  return normalized?.control
}

/** Maps a normalized control point back into scene-local coordinates. */
export function denormalizeMotionControl(source: MotionPoint, target: MotionPoint, control: MotionPoint): MotionPoint {
  const dx = target.x - source.x
  const dy = target.y - source.y
  return {
    x: source.x + control.x * dx - control.y * dy,
    y: source.y + control.x * dy + control.y * dx,
  }
}

/** Decodes the midpoint of the single circular-arc form emitted by this module. */
export function motionControlFromPath(path: string, source: MotionPoint, target: MotionPoint): MotionPoint | undefined {
  const match = path.trim().match(/^M\s*0\s+0\s+A\s+([\d.]+)\s+\1\s+0\s+([01])\s+([01])\s+1\s+0$/i)
  if (match === null) return undefined
  const radius = Number(match[1])
  if (!Number.isFinite(radius) || radius < 0.5) return undefined
  const largeArc = Number(match[2])
  const sweep = Number(match[3])
  const offset = Math.sqrt(Math.max(0, radius * radius - 0.25))
  // In SVG's screen coordinate convention sweep=0 selects the lower-angle arc whose circle
  // center lies above the chord; sweep=1 selects the mirrored center below it.
  const center = { x: 0.5, y: sweep === 1 ? offset : -offset }
  const startAngle = Math.atan2(-center.y, -center.x)
  const targetAngle = Math.atan2(-center.y, 1 - center.x)
  const rawDelta = sweep === 1 ? positiveAngle(targetAngle - startAngle) : positiveAngle(startAngle - targetAngle)
  const delta = largeArc === 1
    ? (rawDelta < Math.PI ? Math.PI * 2 - rawDelta : rawDelta)
    : (rawDelta > Math.PI ? Math.PI * 2 - rawDelta : rawDelta)
  const angle = startAngle + (sweep === 1 ? delta / 2 : -delta / 2)
  return denormalizeMotionControl(source, target, {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  })
}

/** Returns whether a control point is visually equivalent to the implicit straight midpoint. */
export function isStraightMotion(source: MotionPoint, control: MotionPoint, target: MotionPoint): boolean {
  const normalized = normalizePoints(source, control, target)
  if (normalized === undefined) return true
  const midpointX = 0.5
  return Math.abs(normalized.control.x - midpointX) <= 1e-4 && Math.abs(normalized.control.y) <= 1e-4
}

/** Clamps one duration to the positive finite range accepted by CodPlay motion. */
export function clampMotionDuration(value: number, minimum = 1, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

type NormalizedPoints = Readonly<{ source: MotionPoint; control: MotionPoint; target: MotionPoint }>
type Circle = Readonly<{ center: MotionPoint; radius: number }>

/** Prepares one editor arc with exactly the V2 compiler precision and traversal. */
function prepareCanonicalMotionPath(source: MotionPoint, control: MotionPoint, target: MotionPoint) {
  const path = createMotionArcPath(source, control, target)
  if (path === undefined) return undefined
  try {
    return prepareSvgPath(path, { traversal: 'arc-length', precision: 2 })
  } catch {
    // The raw path is produced by the validated geometry above. Keep the overlay defensive if a
    // future geometry extension emits a form that the shared SVG parser does not accept yet.
    return undefined
  }
}

/** Converts three scene points to the canonical source=(0,0), target=(1,0) frame. */
function normalizePoints(source: MotionPoint, control: MotionPoint, target: MotionPoint): NormalizedPoints | undefined {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const lengthSquared = dx * dx + dy * dy
  if (!Number.isFinite(lengthSquared) || lengthSquared <= 1e-8) return undefined
  const length = Math.sqrt(lengthSquared)
  return {
    source: { x: 0, y: 0 },
    target: { x: 1, y: 0 },
    control: {
      x: ((control.x - source.x) * dx + (control.y - source.y) * dy) / lengthSquared,
      y: (-(control.x - source.x) * dy + (control.y - source.y) * dx) / (length * length),
    },
  }
}

/** Computes a circumcircle for three non-collinear normalized points. */
function circumcircle(source: MotionPoint, control: MotionPoint, target: MotionPoint): Circle | undefined {
  const determinant = 2 * (source.x * (control.y - target.y) + control.x * (target.y - source.y) + target.x * (source.y - control.y))
  if (Math.abs(determinant) <= 1e-8) return undefined
  const sourceSquared = source.x * source.x + source.y * source.y
  const controlSquared = control.x * control.x + control.y * control.y
  const targetSquared = target.x * target.x + target.y * target.y
  const center = {
    x: (sourceSquared * (control.y - target.y) + controlSquared * (target.y - source.y) + targetSquared * (source.y - control.y)) / determinant,
    y: (sourceSquared * (target.x - control.x) + controlSquared * (source.x - target.x) + targetSquared * (control.x - source.x)) / determinant,
  }
  return { center, radius: distance(center, source) }
}

/** Returns a positive angular delta in the SVG coordinate convention. */
function positiveAngle(value: number): number {
  const fullTurn = Math.PI * 2
  return ((value % fullTurn) + fullTurn) % fullTurn
}

/**
 * Selects the minor circular arc on the side where the author placed the handle.
 * Choosing the endpoint arc that contains an extreme handle can set the SVG
 * `large-arc-flag` to `1` and create an almost closed counter-curve. The editor
 * keeps the strongest non-looping bend instead; the handle remains an authoring
 * point even when it is dragged beyond that minor-arc domain.
 */
function resolveMinorArcFlags(
  source: MotionPoint,
  control: MotionPoint,
  target: MotionPoint,
): { largeArc: 0; sweep: 0 | 1 } {
  const cross = (target.x - source.x) * (control.y - source.y)
    - (target.y - source.y) * (control.x - source.x)
  return { largeArc: 0, sweep: cross > 0 ? 0 : 1 }
}

/** Returns the Euclidean distance between two points. */
function distance(from: MotionPoint, to: MotionPoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y)
}

/** Returns a finite non-zero scale for affine center projection. */
function finiteScale(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && Math.abs(value) > 1e-8 ? value : 1
}

/** Returns a finite non-negative local dimension for an external pose. */
function finiteDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

/** Clamps one local-box fraction to a finite range. */
function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5
}

/** Formats a path coordinate without locale-dependent output or needless precision. */
function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString()
}
