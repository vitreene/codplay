import type { HtmlMatrix, HtmlPose } from './types'
import { invertMatrix as invertAffineMatrix, multiplyMatrix as multiplyAffineMatrix } from '../../ace'

const IDENTITY_MATRIX: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

type HtmlWorldGeometry = Readonly<{
  origin: { x: number; y: number }
  matrix: HtmlMatrix
  layoutOffset: { x: number; y: number }
}>

/** Parses one computed rotate value to radians. */
function parseRotateToRadians(value: string): number {
  if (!value || value === 'none') return 0
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 0
  if (value.endsWith('rad')) return parsed
  if (value.endsWith('grad')) return (parsed * Math.PI) / 200
  if (value.endsWith('turn')) return parsed * 2 * Math.PI
  return (parsed * Math.PI) / 180
}

/** Parses one computed scale value to x/y factors. */
function parseScaleFactors(value: string): { sx: number; sy: number } {
  if (!value || value === 'none') return { sx: 1, sy: 1 }
  const parts = value.split(/\s+/).map((part) => Number.parseFloat(part))
  const sx = Number.isFinite(parts[0]) ? parts[0]! : 1
  const sy = Number.isFinite(parts[1]) ? parts[1]! : sx
  return { sx, sy }
}

/** Multiplies two affine matrices without depending on V1 utilities. */
function multiplyMatrix(left: HtmlMatrix, right: HtmlMatrix): HtmlMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  }
}

/** Converts a viewport delta into the local coordinate system of a parent. */
export function worldDeltaToLocalDelta(
  matrix: HtmlMatrix,
  worldDeltaX: number,
  worldDeltaY: number,
): { x: number; y: number } {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (Math.abs(determinant) < 1e-8) return { x: worldDeltaX, y: worldDeltaY }

  return {
    x: (matrix.d * worldDeltaX - matrix.c * worldDeltaY) / determinant,
    y: (-matrix.b * worldDeltaX + matrix.a * worldDeltaY) / determinant,
  }
}

/** Parses the browser 2D matrix formats needed by the standalone HTML host. */
function parseCssMatrix(transform: string): HtmlMatrix {
  if (transform === '' || transform === 'none') return { ...IDENTITY_MATRIX }

  const matrix2d = transform.match(/^matrix\(([^)]+)\)$/)
  if (matrix2d !== null) {
    const values = matrix2d[1].split(',').map((value) => Number(value.trim()))
    if (values.length === 6 && values.every((value) => Number.isFinite(value))) {
      return { a: values[0]!, b: values[1]!, c: values[2]!, d: values[3]!, e: values[4]!, f: values[5]! }
    }
  }

  const matrix3d = transform.match(/^matrix3d\(([^)]+)\)$/)
  if (matrix3d !== null) {
    const values = matrix3d[1].split(',').map((value) => Number(value.trim()))
    if (values.length === 16 && values.every((value) => Number.isFinite(value))) {
      return { a: values[0]!, b: values[1]!, c: values[4]!, d: values[5]!, e: values[12]!, f: values[13]! }
    }
  }

  return { ...IDENTITY_MATRIX }
}

/** Reads the own matrix including individual CSS rotate and scale properties. */
function captureNodeOwnMatrix(node: Element): HtmlMatrix {
  const computed = node.ownerDocument.defaultView?.getComputedStyle(node)
  if (computed === undefined) return { ...IDENTITY_MATRIX }
  const transform = parseCssMatrix(computed.transform && computed.transform.length > 0 ? computed.transform : 'none')
  const { sx, sy } = parseScaleFactors(computed.scale)
  const theta = parseRotateToRadians(computed.rotate)
  const scale: HtmlMatrix = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }
  const cosine = Math.cos(theta)
  const sine = Math.sin(theta)
  const rotate: HtmlMatrix = { a: cosine, b: sine, c: -sine, d: cosine, e: 0, f: 0 }
  return multiplyMatrix(rotate, multiplyMatrix(scale, transform))
}

/** Measures local box dimensions without deriving them from the transformed AABB. */
function measureLocalBox(node: Element): { width: number | null; height: number | null } {
  const computed = node.ownerDocument.defaultView?.getComputedStyle(node)
  const computedWidth = Number.parseFloat(computed?.width ?? '')
  const computedHeight = Number.parseFloat(computed?.height ?? '')
  const width = Number.isFinite(computedWidth) && computedWidth > 0 ? computedWidth : null
  const height = Number.isFinite(computedHeight) && computedHeight > 0 ? computedHeight : null

  if (node instanceof HTMLElement) {
    return {
      width: width ?? (node.offsetWidth > 0 ? node.offsetWidth : null) ?? (node.clientWidth > 0 ? node.clientWidth : null),
      height: height ?? (node.offsetHeight > 0 ? node.offsetHeight : null) ?? (node.clientHeight > 0 ? node.clientHeight : null),
    }
  }

  return { width, height }
}

/** Reads one CSS length used by an individual transform property. */
function parseLengthPx(value: string | undefined, reference: number): number {
  if (value === undefined) return 0
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 0
  return value.endsWith('%') ? (parsed / 100) * reference : parsed
}

/** Reads the layout offset of one node in its immediate parent coordinate system. */
function captureLayoutOffset(node: Element, parent: Element | null): { x: number; y: number } {
  if (!(node instanceof HTMLElement)) return { x: 0, y: 0 }
  const offsetParent = node.offsetParent instanceof HTMLElement ? node.offsetParent : null
  const nodePosition = captureOffsetToOffsetParent(node, offsetParent)
  if (!(parent instanceof HTMLElement) || offsetParent === parent) {
    return {
      x: nodePosition.x + (offsetParent === parent && parent instanceof HTMLElement ? parent.clientLeft : 0),
      y: nodePosition.y + (offsetParent === parent && parent instanceof HTMLElement ? parent.clientTop : 0),
    }
  }

  const parentPosition = captureOffsetToOffsetParent(parent, offsetParent)
  return {
    x: nodePosition.x - parentPosition.x + parent.clientLeft,
    y: nodePosition.y - parentPosition.y + parent.clientTop,
  }
}

/** Sums layout offsets until one shared offset parent is reached. */
function captureOffsetToOffsetParent(node: HTMLElement, target: HTMLElement | null): { x: number; y: number } {
  let x = node.offsetLeft
  let y = node.offsetTop
  let current = node.offsetParent instanceof HTMLElement ? node.offsetParent : null
  while (current !== null && current !== target) {
    x += current.offsetLeft
    y += current.offsetTop
    current = current.offsetParent instanceof HTMLElement ? current.offsetParent : null
  }
  return { x, y }
}

/** Captures the linear matrix and visual displacement of one node in parent space. */
function captureOwnTransform(node: Element, localWidth: number, localHeight: number): {
  matrix: HtmlMatrix
  displacement: { x: number; y: number }
} {
  const computed = node.ownerDocument.defaultView?.getComputedStyle(node)
  const matrix = captureNodeOwnMatrix(node)
  const linearMatrix: HtmlMatrix = { ...matrix, e: 0, f: 0 }
  const translate = computed?.translate ?? 'none'
  const translateParts = translate === 'none' ? [] : translate.split(/\s+/).filter(Boolean)
  const originParts = (computed?.transformOrigin ?? '').split(/\s+/).filter(Boolean)
  const originX = parseLengthPx(originParts[0], localWidth / 2)
  const originY = parseLengthPx(originParts[1], localHeight / 2)
  const translateX = parseLengthPx(translateParts[0], localWidth)
  const translateY = parseLengthPx(translateParts[1], localHeight)

  return {
    matrix: linearMatrix,
    displacement: {
      x: matrix.e + translateX + originX - (linearMatrix.a * originX + linearMatrix.c * originY),
      y: matrix.f + translateY + originY - (linearMatrix.b * originX + linearMatrix.d * originY),
    },
  }
}

/** Computes one node's world affine geometry while retaining fractional DOM placement. */
function captureWorldGeometry(node: Element, cache = new Map<Element, HtmlWorldGeometry>()): HtmlWorldGeometry {
  const existing = cache.get(node)
  if (existing !== undefined) return existing

  const parent = node.parentElement
  const parentGeometry: HtmlWorldGeometry = parent === null
    ? { origin: { x: 0, y: 0 }, matrix: { ...IDENTITY_MATRIX }, layoutOffset: { x: 0, y: 0 } }
    : captureWorldGeometry(parent, cache)
  const localBox = measureLocalBox(node)
  const localWidth = localBox.width ?? 0
  const localHeight = localBox.height ?? 0
  const fallbackLayoutOffset = captureLayoutOffset(node, parent)
  const ownTransform = captureOwnTransform(node, localWidth, localHeight)
  const matrix = multiplyMatrix(parentGeometry.matrix, ownTransform.matrix)
  const fallbackLocalOrigin = {
    x: fallbackLayoutOffset.x + ownTransform.displacement.x,
    y: fallbackLayoutOffset.y + ownTransform.displacement.y,
  }
  const fallbackOrigin = {
    x: parentGeometry.origin.x + parentGeometry.matrix.a * fallbackLocalOrigin.x + parentGeometry.matrix.c * fallbackLocalOrigin.y,
    y: parentGeometry.origin.y + parentGeometry.matrix.b * fallbackLocalOrigin.x + parentGeometry.matrix.d * fallbackLocalOrigin.y,
  }
  const origin = resolveMeasuredWorldOrigin(node, matrix, localWidth, localHeight, fallbackOrigin)
  const localOrigin = worldDeltaToLocalDelta(
    parentGeometry.matrix,
    origin.x - parentGeometry.origin.x,
    origin.y - parentGeometry.origin.y,
  )
  const layoutOffset = {
    x: localOrigin.x - ownTransform.displacement.x,
    y: localOrigin.y - ownTransform.displacement.y,
  }
  const geometry: HtmlWorldGeometry = { origin, matrix, layoutOffset }
  cache.set(node, geometry)
  return geometry
}

/** Recovers fractional layout placement from the real DOM AABB without treating it as an affine origin. */
function resolveMeasuredWorldOrigin(
  node: Element,
  matrix: HtmlMatrix,
  localWidth: number,
  localHeight: number,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  const measurableNode = node as Element & { getBoundingClientRect?: () => DOMRect }
  if (typeof measurableNode.getBoundingClientRect !== 'function') return fallback
  const rect = measurableNode.getBoundingClientRect()
  const hasUsableRect = Number.isFinite(rect.left)
    && Number.isFinite(rect.top)
    && !(localWidth > 0 && rect.width === 0)
    && !(localHeight > 0 && rect.height === 0)
  if (!hasUsableRect) return fallback

  const bounds = transformedBounds(matrix, localWidth, localHeight)
  const scrollX = node.ownerDocument.defaultView?.scrollX ?? 0
  const scrollY = node.ownerDocument.defaultView?.scrollY ?? 0
  return {
    x: rect.left + scrollX - bounds.left,
    y: rect.top + scrollY - bounds.top,
  }
}

/** Computes transformed local-box bounds from a linear matrix. */
function transformedBounds(matrix: HtmlMatrix, width: number, height: number): { left: number; top: number; width: number; height: number } {
  const points = [
    [0, 0],
    [matrix.a * width, matrix.b * width],
    [matrix.c * height, matrix.d * height],
    [matrix.a * width + matrix.c * height, matrix.b * width + matrix.d * height],
  ]
  const left = Math.min(...points.map((point) => point[0]!))
  const right = Math.max(...points.map((point) => point[0]!))
  const top = Math.min(...points.map((point) => point[1]!))
  const bottom = Math.max(...points.map((point) => point[1]!))
  return { left, top, width: right - left, height: bottom - top }
}

/** Extracts the rotation-only matrix used by the overlay projection. */
function extractRotationMatrix(matrix: HtmlMatrix): HtmlMatrix {
  const scaleX = Math.max(1e-8, Math.hypot(matrix.a, matrix.b))
  const scaleY = Math.max(1e-8, Math.hypot(matrix.c, matrix.d))
  return { a: matrix.a / scaleX, b: matrix.b / scaleX, c: matrix.c / scaleY, d: matrix.d / scaleY, e: 0, f: 0 }
}

/** Captures a numeric pose for one HTML target without retaining the DOM handle. */
export function captureHtmlPose(node: Element): HtmlPose {
  const geometry = captureWorldGeometry(node)
  const parentMatrix = node.parentElement === null ? { ...IDENTITY_MATRIX } : captureWorldGeometry(node.parentElement).matrix
  const scaleX = Math.max(1e-6, Math.hypot(geometry.matrix.a, geometry.matrix.b))
  const scaleY = Math.max(1e-6, Math.hypot(geometry.matrix.c, geometry.matrix.d))
  const localBox = measureLocalBox(node)
  const localWidth = localBox.width ?? 0
  const localHeight = localBox.height ?? 0
  const bounds = transformedBounds(geometry.matrix, localWidth, localHeight)
  const scrollX = node.ownerDocument.defaultView?.scrollX ?? 0
  const scrollY = node.ownerDocument.defaultView?.scrollY ?? 0
  const rect = {
    left: geometry.origin.x + bounds.left - scrollX,
    top: geometry.origin.y + bounds.top - scrollY,
    width: bounds.width,
    height: bounds.height,
  }

  return {
    rect,
    origin: { x: geometry.origin.x - scrollX, y: geometry.origin.y - scrollY },
    matrix: geometry.matrix,
    parentMatrix,
    layoutOffset: geometry.layoutOffset,
    rotationMatrix: extractRotationMatrix(geometry.matrix),
    scaleX,
    scaleY,
    localWidth,
    localHeight,
    frameWidth: localWidth * scaleX,
    frameHeight: localHeight * scaleY,
  }
}

/** Converts one pose into an affine matrix whose origin is its local-box origin. */
export function poseToAffineMatrix(pose: HtmlPose): HtmlMatrix {
  return {
    a: pose.matrix.a,
    b: pose.matrix.b,
    c: pose.matrix.c,
    d: pose.matrix.d,
    e: pose.origin.x,
    f: pose.origin.y,
  }
}

/** Derives one child affine pose in the local coordinates of a captured parent. */
export function deriveLocalPoseMatrix(parent: HtmlPose, child: HtmlPose): HtmlMatrix {
  const inverse = invertAffineMatrix(poseToAffineMatrix(parent))
  if (inverse === null) throw new Error('FLIP cannot derive a child pose from a singular parent.')
  return multiplyAffineMatrix(inverse, poseToAffineMatrix(child))
}

/** Composes one local child affine pose with a projected parent pose. */
export function composeHtmlPose(parent: HtmlPose, local: HtmlMatrix, width: number, height: number): HtmlPose {
  const world = multiplyAffineMatrix(poseToAffineMatrix(parent), local)
  const matrix: HtmlMatrix = { ...world, e: 0, f: 0 }
  const bounds = transformedBounds(matrix, width, height)
  return {
    rect: {
      left: world.e + bounds.left,
      top: world.f + bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
    origin: { x: world.e, y: world.f },
    matrix,
    parentMatrix: parent.matrix,
    rotationMatrix: extractRotationMatrix(matrix),
    scaleX: Math.max(1e-6, Math.hypot(matrix.a, matrix.b)),
    scaleY: Math.max(1e-6, Math.hypot(matrix.c, matrix.d)),
    localWidth: width,
    localHeight: height,
    frameWidth: width * Math.max(1e-6, Math.hypot(matrix.a, matrix.b)),
    frameHeight: height * Math.max(1e-6, Math.hypot(matrix.c, matrix.d)),
  }
}

/** Positions a fixed ghost from one geometry-derived viewport anchor. */
export function positionHtmlGhost(ghost: HTMLElement, target: { left: number; top: number }): void {
  const left = target.left
  const top = target.top
  ghost.style.left = `${left}px`
  ghost.style.top = `${top}px`
}

/** Creates the overlay layer scoped to one standalone HTML host root. */
export function ensureHtmlOverlayLayer(sceneRoot: Element): HTMLElement {
  const existing = Array.from(sceneRoot.children).find((child) => child.getAttribute('data-selection-frame-overlay') !== null)
  if (existing instanceof HTMLElement) return existing
  const layer = sceneRoot.ownerDocument.createElement('div')
  layer.setAttribute('data-selection-frame-overlay', '')
  layer.style.position = 'absolute'
  layer.style.left = '0'
  layer.style.top = '0'
  layer.style.width = '100%'
  layer.style.height = '100%'
  layer.style.pointerEvents = 'none'
  layer.style.zIndex = '20'
  sceneRoot.appendChild(layer)
  return layer
}
