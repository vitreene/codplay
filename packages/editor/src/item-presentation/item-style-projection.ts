import { multiplyMatrix, type Matrix2D } from 'ace'
import type { CodPlayPresentationPose } from 'codplay'
import { OFFSET_STYLE_PROPERTIES } from '../decor-editor/units'
import { resolveContentInsetStyles } from '../motion-editor/border-insets'
import { contentBoxLayoutDisplacement } from '../motion-editor/content-box'
import { frameVisualCenter, frameWithRotationAtPathAnchor, motionPathAnchorForFrame, resolveMotionGeometryPose } from '../motion-editor/geometry'
import type { SelectionFrameValue } from '../decor-editor/types'
import type { ContentBoxInsetsPx } from '../motion-editor/content-box'
import { ITEM_MOTION_REFERENCE_ANGLE, ITEM_MOTION_ROTATION_BASELINE } from './item-motion-reference'

type Length = Readonly<{ cqw: number; px: number }>

/** The CSS transform and the local axis that produced it, captured at one presentation update. */
export type ItemTransformProjection = Readonly<{
  matrix: Matrix2D
  rotationOrigin: Readonly<{ fx: number; fy: number }>
}>

const itemTransformProjections = new WeakMap<Element, ItemTransformProjection>()

/** Reads the computed 2D portion of a CSS transform matrix. */
function readTransformMatrix(node: Element, transform: string): Matrix2D {
  if (transform === '' || transform === 'none') return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  const Matrix = node.ownerDocument.defaultView?.DOMMatrixReadOnly
  if (Matrix !== undefined) {
    const matrix = new Matrix(transform)
    return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f }
  }
  const values = transform.match(/^matrix\(([^)]+)\)$/)?.[1]?.split(',').map(Number)
  return values?.length === 6 && values.every(Number.isFinite)
    ? { a: values[0]!, b: values[1]!, c: values[2]!, d: values[3]!, e: values[4]!, f: values[5]! }
    : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

/** Resolves a CSS length in pixels, including a percentage of its local axis. */
function readTransformLength(value: string | undefined, basis: number): number {
  if (value === undefined || value === '' || value === 'none') return 0
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number)) return 0
  return value.trim().endsWith('%') ? number * basis / 100 : number
}

/** Resolves one computed transform-origin coordinate to its local-pixel position. */
function readTransformOriginCoordinate(value: string | undefined, axis: 'x' | 'y', basis: number): number {
  const keyword = value?.trim().toLowerCase()
  if (keyword === 'center') return basis / 2
  if ((axis === 'x' && keyword === 'left') || (axis === 'y' && keyword === 'top')) return 0
  if ((axis === 'x' && keyword === 'right') || (axis === 'y' && keyword === 'bottom')) return basis
  return readTransformLength(value, basis)
}

/** Converts a percentage or keyword transform-origin pair into local-box fractions. */
function parseTransformOrigin(value: unknown): SelectionFrameValue['rotationOrigin'] {
  if (typeof value !== 'string') return undefined
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return undefined
  const fraction = (part: string, axis: 'x' | 'y'): number | undefined => {
    const keyword = part.toLowerCase()
    if (keyword === 'center') return 0.5
    if ((axis === 'x' && keyword === 'left') || (axis === 'y' && keyword === 'top')) return 0
    if ((axis === 'x' && keyword === 'right') || (axis === 'y' && keyword === 'bottom')) return 1
    if (!part.endsWith('%')) return undefined
    const parsed = Number.parseFloat(part.slice(0, -1))
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed / 100)) : undefined
  }
  const fx = fraction(parts[0]!, 'x')
  const fy = fraction(parts[1]!, 'y')
  return fx === undefined || fy === undefined ? undefined : { fx, fy }
}

/** Converts a computed CSS angle to radians. */
function readTransformAngle(value: string): number {
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number)) return 0
  if (value.endsWith('rad')) return number
  if (value.endsWith('turn')) return number * Math.PI * 2
  if (value.endsWith('grad')) return number * Math.PI / 200
  return number * Math.PI / 180
}

/** Parses the computed individual CSS scale as two factors. */
function readTransformScale(value: string, fallback: number): Readonly<{ x: number; y: number }> {
  if (value === '' || value === 'none') return { x: 1, y: 1 }
  const parts = value.split(/\s+/).map(Number)
  const x = Number.isFinite(parts[0]) ? parts[0]! : fallback
  const y = Number.isFinite(parts[1]) ? parts[1]! : x
  return { x, y }
}

/** Captures the full local CSS transform and the normalized axis that produced it. */
export function captureItemTransformProjection(
  node: Element,
  authoredOrigin?: SelectionFrameValue['rotationOrigin'],
): ItemTransformProjection {
  const view = node.ownerDocument.defaultView
  if (view === null) {
    return {
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      rotationOrigin: authoredOrigin ?? { fx: 0.5, fy: 0.5 },
    }
  }
  const style = view.getComputedStyle(node)
  const htmlNode = node as HTMLElement
  const width = htmlNode.offsetWidth || Number.parseFloat(style.width) || 0
  const height = htmlNode.offsetHeight || Number.parseFloat(style.height) || 0
  const origin = style.transformOrigin.split(/\s+/)
  const originX = origin[0] === undefined || origin[0] === ''
    ? width / 2
    : readTransformOriginCoordinate(origin[0], 'x', width)
  const originY = origin[1] === undefined || origin[1] === ''
    ? height / 2
    : readTransformOriginCoordinate(origin[1], 'y', height)
  const capturedOrigin = {
    fx: width > 0 ? Math.min(1, Math.max(0, originX / width)) : 0.5,
    fy: height > 0 ? Math.min(1, Math.max(0, originY / height)) : 0.5,
  }
  const rotationOrigin = authoredOrigin ?? capturedOrigin
  const translate = style.translate === 'none' ? [] : style.translate.split(/\s+/)
  const translateMatrix = {
    a: 1, b: 0, c: 0, d: 1,
    e: readTransformLength(style.left, width) + readTransformLength(translate[0], width),
    f: readTransformLength(style.top, height) + readTransformLength(translate[1], height),
  }
  const rotate = style.rotate === 'none' || style.rotate === '' ? 0 : readTransformAngle(style.rotate)
  const cosine = Math.cos(rotate)
  const sine = Math.sin(rotate)
  const rotateMatrix = { a: cosine, b: sine, c: -sine, d: cosine, e: 0, f: 0 }
  const scale = readTransformScale(style.scale, 1)
  const scaleMatrix = { a: scale.x, b: 0, c: 0, d: scale.y, e: 0, f: 0 }
  const authoredTransform = readTransformMatrix(node, style.transform)
  const local = multiplyMatrix(rotateMatrix, multiplyMatrix(scaleMatrix, authoredTransform))
  return {
    matrix: multiplyMatrix(translateMatrix, multiplyMatrix(
      { a: 1, b: 0, c: 0, d: 1, e: originX, f: originY },
      multiplyMatrix(local, { a: 1, b: 0, c: 0, d: 1, e: -originX, f: -originY }),
    )),
    rotationOrigin,
  }
}

/** Stores the current CSS matrix and its axis beside the item transform anchor. */
export function recordItemTransformProjection(
  node: Element,
  authoredOrigin?: SelectionFrameValue['rotationOrigin'],
): ItemTransformProjection {
  const projection = captureItemTransformProjection(node, authoredOrigin)
  itemTransformProjections.set(node, projection)
  return projection
}

/** Reads the last CSS matrix and rotation axis captured by the item's transform anchor. */
export function readItemTransformProjection(node: Element): ItemTransformProjection {
  return itemTransformProjections.get(node) ?? captureItemTransformProjection(node)
}

/** Composes the runtime pose with one complete local affine contribution. */
export function composeItemPresentationPose(
  pose: CodPlayPresentationPose,
  projection: ItemTransformProjection,
): CodPlayPresentationPose {
  const local = projection.matrix
  const root = pose.matrix
  return {
    ...pose,
    origin: {
      x: pose.origin.x + root.a * local.e + root.c * local.f,
      y: pose.origin.y + root.b * local.e + root.d * local.f,
    },
    matrix: {
      a: root.a * local.a + root.c * local.b,
      b: root.b * local.a + root.d * local.b,
      c: root.a * local.c + root.c * local.d,
      d: root.b * local.c + root.d * local.d,
    },
  }
}

/** Reads the logical/physical lengths already qualified by the native compiler. */
function readLength(value: unknown): Length | null {
  if (typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'length'
    && 'value' in value && typeof value.value === 'number' && 'unit' in value) {
    if (value.unit === 'cqw') return { cqw: value.value, px: 0 }
    if (value.unit === 'px') return { cqw: 0, px: value.value }
    return null
  }
  if (typeof value === 'number') return { cqw: value, px: 0 }
  if (typeof value !== 'string') return null
  const match = value.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(cqw|px)$/)
  if (match === null) return null
  return match[2] === 'cqw' ? { cqw: Number(match[1]), px: 0 } : { cqw: 0, px: Number(match[1]) }
}

/** Serializes a derived length without losing its responsive or fixed contribution. */
function formatLength(value: Length): string {
  if (value.px === 0) return `${value.cqw}cqw`
  if (value.cqw === 0) return `${value.px}px`
  return `calc(${value.cqw}cqw ${value.px < 0 ? '-' : '+'} ${Math.abs(value.px)}px)`
}

/** Projects one resolved item state into its frame and private native representation. */
export function projectItemStyle(
  style: Readonly<Record<string, unknown>>,
  pixelRatio: number,
) {
  const insets = resolveContentInsetStyles(style, pixelRatio)
  const rotationOrigin = parseTransformOrigin(style['transform-origin'])
  const frame = {
    x: 0, y: 0, width: 0, height: 0,
    rotate: typeof style.rotate === 'number' ? style.rotate : 0,
    scaleX: typeof style.scaleX === 'number' ? style.scaleX : 1,
    scaleY: typeof style.scaleY === 'number' ? style.scaleY : 1,
    ...(rotationOrigin === undefined ? {} : { rotationOrigin }),
  }
  const referenceAngle = typeof style[ITEM_MOTION_REFERENCE_ANGLE] === 'number'
    ? style[ITEM_MOTION_REFERENCE_ANGLE] : undefined
  const rotationBaseline = typeof style[ITEM_MOTION_ROTATION_BASELINE] === 'number'
    ? style[ITEM_MOTION_ROTATION_BASELINE] : undefined
  const splitMotionTransform = rotationBaseline !== undefined
  const captureAngle = referenceAngle ?? rotationBaseline
  const captureFrame = captureAngle === undefined ? frame : { ...frame, rotate: captureAngle }
  const centersMotionOnAxis = splitMotionTransform && rotationOrigin !== undefined
    && (rotationOrigin.fx !== 0.5 || rotationOrigin.fy !== 0.5)
    && (['x', 'y', 'width', 'height'] as const).every(property => readLength(style[property]) !== null)
  /** Resolves one length coefficient of the private frame's layout offset. */
  function captureDisplacement(value: SelectionFrameValue, insets: ContentBoxInsetsPx) {
    if (centersMotionOnAxis) {
      const capture = resolveMotionGeometryPose({ ...value, rotate: captureAngle, scaleX: 1, scaleY: 1 }, insets)
      const center = frameVisualCenter(capture.borderFrame)
      const axis = motionPathAnchorForFrame(value, insets)
      // The motion frame follows its center. Make that center the visible item's axis.
      return {
        x: axis.x - (center.x - capture.borderFrame.x),
        y: axis.y - (center.y - capture.borderFrame.y),
      }
    }
    const reference = captureAngle === undefined ? { x: 0, y: 0 }
      : frameWithRotationAtPathAnchor(value, captureAngle, motionPathAnchorForFrame(value, insets), insets)
    const { x, y } = contentBoxLayoutDisplacement(captureFrame, insets)
    return { x: reference.x - x, y: reference.y - y }
  }
  const contributions = Object.entries(insets).filter(([, css]) => css !== '0px').map(([side, css]) => {
    const basis = { top: 0, right: 0, bottom: 0, left: 0, [side]: 1 }
    const { x, y } = captureDisplacement(frame, basis)
    return { css, x, y,
      width: side === 'left' || side === 'right' ? 1 : 0,
      height: side === 'top' || side === 'bottom' ? 1 : 0 }
  })
  const referenceLengths = captureAngle === undefined ? [] : (['width', 'height'] as const).flatMap(property => {
    const length = readLength(style[property])
    if (length === null) return []
    const reference = captureDisplacement({ ...frame, [property]: 1 }, { top: 0, right: 0, bottom: 0, left: 0 })
    return [{ css: formatLength(length), x: reference.x, y: reference.y, width: 0, height: 0 }]
  })
  const frameStyle: Record<string, unknown> = { position: 'relative', overflow: 'visible' }
  const visualStyle: Record<string, unknown> = {}
  const motionTransformStyle: Record<string, unknown> = {}
  for (const [property, value] of Object.entries(style)) {
    if (property === ITEM_MOTION_REFERENCE_ANGLE || property === ITEM_MOTION_ROTATION_BASELINE) continue
    const ownsGeometry = OFFSET_STYLE_PROPERTIES.has(property)
      || property === 'transform' || property === 'translate' || property === 'scale'
    if (splitMotionTransform && ['rotate', 'scaleX', 'scaleY', 'transform', 'translate', 'scale'].includes(property)) {
      if (property === 'transform-origin') frameStyle[property] = value
      if (property === 'transform' || property === 'translate' || property === 'scale') motionTransformStyle[property] = value
      continue
    }
    if (!ownsGeometry || property === 'width' || property === 'height') visualStyle[property] = value
    if (ownsGeometry) frameStyle[property] = value
  }
  if (splitMotionTransform) {
    const rotate = typeof style.rotate === 'number' ? style.rotate : rotationBaseline!
    const scaleX = typeof style.scaleX === 'number' ? style.scaleX : 1
    const scaleY = typeof style.scaleY === 'number' ? style.scaleY : 1
    const authoredTransform = typeof motionTransformStyle.transform === 'string'
      && motionTransformStyle.transform.trim() !== 'none'
      ? motionTransformStyle.transform.trim() : undefined
    motionTransformStyle.transform = [
      `rotate(${rotate - rotationBaseline!}deg)`,
      `scale(${scaleX}, ${scaleY})`,
      authoredTransform,
    ].filter((transform): transform is string => transform !== undefined).join(' ')
    if (style.scale !== undefined) motionTransformStyle.scale = style.scale
    motionTransformStyle['transform-origin'] = typeof style['transform-origin'] === 'string'
      ? style['transform-origin'] : '50% 50%'
    if (centersMotionOnAxis) {
      motionTransformStyle.left = `${(0.5 - rotationOrigin.fx) * 100}%`
      motionTransformStyle.top = `${(0.5 - rotationOrigin.fy) * 100}%`
    }
    frameStyle.rotate = captureAngle ?? 0
  }
  for (const property of ['x', 'y', 'width', 'height'] as const) {
    const value = readLength(style[property])
    if (value === null) continue
    const terms = [...contributions, ...referenceLengths].filter((contribution) => Math.abs(contribution[property]) > 1e-10).map((contribution) => {
      const coefficient = contribution[property]
      return `${coefficient < 0 ? ' - ' : ' + '}${Math.abs(coefficient) === 1 ? '' : `${Math.abs(coefficient)} * `}${contribution.css}`
    }).join('')
    frameStyle[property] = terms === '' ? formatLength(value) : `calc(${formatLength(value)}${terms})`
  }
  return { frameStyle, visualStyle, motionTransformStyle, rotationOrigin }
}
