import { extractRotationMatrix } from 'codplay-v1/runtime/modules/list-flip/engine/dom-matrix'
import { multiplyMatrix, parseCssMatrix } from 'codplay-v1/runtime/modules/list-flip/engine/matrix-2d'
import type { Matrix2D } from 'codplay-v1/runtime/modules/list-flip/engine/types'

const CALIBRATION_MAX_ITERATIONS = 4
const CALIBRATION_TOLERANCE_PX = 0.25

const IDENTITY_MATRIX: Matrix2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** Parses one computed `rotate` value ("20deg", "0.5turn", "none") to radians. */
function parseRotateToRadians(value: string): number {
  if (!value || value === 'none') return 0
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 0
  if (value.endsWith('rad')) return parsed
  if (value.endsWith('grad')) return (parsed * Math.PI) / 200
  if (value.endsWith('turn')) return parsed * 2 * Math.PI
  return (parsed * Math.PI) / 180
}

/** Parses one computed `scale` value ("2", "2 1.5", "none") to factors. */
function parseScaleFactors(value: string): { sx: number; sy: number } {
  if (!value || value === 'none') return { sx: 1, sy: 1 }
  const parts = value.split(/\s+/).map((part) => Number.parseFloat(part))
  const sx = Number.isFinite(parts[0]) ? parts[0]! : 1
  const sy = Number.isFinite(parts[1]) ? parts[1]! : sx
  return { sx, sy }
}

/**
 * Composes the full own matrix of one node: the individual CSS properties
 * `rotate` and `scale` are NOT part of the computed `transform` value, yet
 * the adapters mutate them. Per spec the composition order is
 * translate · rotate · scale · transform; translate does not affect the
 * linear part and positions are measured via getBoundingClientRect, so only
 * rotate · scale · transform is composed here.
 */
export function captureNodeOwnMatrix(node: Element): Matrix2D {
  const win = node.ownerDocument.defaultView
  if (win === null) return IDENTITY_MATRIX
  const computed = win.getComputedStyle(node)

  const transformMatrix = parseCssMatrix(computed.transform && computed.transform.length > 0 ? computed.transform : 'none')

  const { sx, sy } = parseScaleFactors(computed.scale)
  const theta = parseRotateToRadians(computed.rotate)

  const scaleMatrix: Matrix2D = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const rotateMatrix: Matrix2D = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }

  return multiplyMatrix(rotateMatrix, multiplyMatrix(scaleMatrix, transformMatrix))
}

/**
 * Own-transform components of one node, read from computed styles. Used to
 * decompose the LAYOUT box from the VISUAL box: the displacement the own
 * transform applies to the local origin is d = t + (I − M)·O (t = translate,
 * M = own linear matrix, O = transform-origin in px).
 */
export type OwnTransformComponents = {
  matrix: Matrix2D
  translateX: number
  translateY: number
  originX: number
  originY: number
}

function parseLengthPx(part: string | undefined, referencePx: number, fallbackPx: number): number {
  if (part === undefined) return fallbackPx
  const parsed = Number.parseFloat(part)
  if (!Number.isFinite(parsed)) return fallbackPx
  return part.endsWith('%') ? (parsed / 100) * referencePx : parsed
}

export function captureOwnTransformComponents(
  node: Element,
  localWidth: number,
  localHeight: number
): OwnTransformComponents {
  const win = node.ownerDocument.defaultView
  const computed = win?.getComputedStyle(node)

  const translateRaw = computed?.translate ?? ''
  const translateParts = translateRaw === 'none' ? [] : translateRaw.split(/\s+/).filter(Boolean)
  const originParts = (computed?.transformOrigin ?? '').split(/\s+/).filter(Boolean)

  return {
    matrix: captureNodeOwnMatrix(node),
    translateX: parseLengthPx(translateParts[0], localWidth, 0),
    translateY: parseLengthPx(translateParts[1], localHeight, 0),
    originX: parseLengthPx(originParts[0], localWidth, localWidth / 2),
    originY: parseLengthPx(originParts[1], localHeight, localHeight / 2)
  }
}

/**
 * Displacement the own transform applies to the element's local origin, in
 * the element's PARENT space: d = t + (I − M)·O. Layout corner = visual
 * corner − d ; final visual corner after a layout move = new layout corner + d
 * (with O recomputed when the box size changes — percent origins follow it).
 */
export function ownCornerDisplacement(
  components: OwnTransformComponents,
  originX: number,
  originY: number
): { x: number; y: number } {
  const m = components.matrix
  return {
    x: components.translateX + (originX - (m.a * originX + m.c * originY)),
    y: components.translateY + (originY - (m.b * originX + m.d * originY))
  }
}

/**
 * Accumulates the matrices of one node and all its ancestors, individual
 * transform properties included (unlike codplay's captureCombinedMatrixForNode
 * which only reads `transform`).
 */
export function captureCombinedMatrixWithIndividualTransforms(node: Element): Matrix2D {
  let combined = captureNodeOwnMatrix(node)
  let parent = node.parentElement
  while (parent !== null) {
    combined = multiplyMatrix(captureNodeOwnMatrix(parent), combined)
    parent = parent.parentElement
  }
  return combined
}

/**
 * Visual pose of one target node, ready to drive an overlay-world artefact:
 * fixed anchor (left/top), rendered size (local × scale), rotation-only matrix.
 * parentMatrix is the cumulated matrix WITHOUT the node's own transform — the
 * space in which the CSS `translate` property of the node operates (translate
 * composes before the node's own rotate/scale/transform).
 */
export type OverlayPose = {
  rect: { left: number; top: number; width: number; height: number }
  matrix: Matrix2D
  parentMatrix: Matrix2D
  rotationMatrix: Matrix2D
  scaleX: number
  scaleY: number
  localWidth: number
  localHeight: number
  frameWidth: number
  frameHeight: number
}

/**
 * Local border-box dimensions following codplay's box-snapshot pattern
 * (captureElementBoxSnapshot in create-list-flip-module.ts): computed style
 * pixels first, then offset, then client dimensions. Never derived from
 * getBoundingClientRect — the AABB is transform-dependent.
 */
function measureLocalBox(node: Element): { width: number | null; height: number | null } {
  let computedWidthPx: number | null = null
  let computedHeightPx: number | null = null

  const win = node.ownerDocument.defaultView
  if (win !== null) {
    const computed = win.getComputedStyle(node)
    const parsedWidth = Number.parseFloat(computed.width)
    const parsedHeight = Number.parseFloat(computed.height)
    computedWidthPx = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : null
    computedHeightPx = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : null
  }

  if (node instanceof HTMLElement) {
    return {
      width: computedWidthPx ?? (node.offsetWidth > 0 ? node.offsetWidth : null) ?? (node.clientWidth > 0 ? node.clientWidth : null),
      height: computedHeightPx ?? (node.offsetHeight > 0 ? node.offsetHeight : null) ?? (node.clientHeight > 0 ? node.clientHeight : null)
    }
  }

  return { width: computedWidthPx, height: computedHeightPx }
}

/**
 * SINGLE seam for world-anchor measurement (getBoundingClientRect). This is
 * the only legitimate gBCR usage — the viewport anchor and the calibration
 * loop, exactly like codplay's captureLiveWorldPhoto. All other measures
 * (dimensions, fractions, conversions) go through computed styles and the
 * matrix; never derive them from this rect.
 */
export function measureWorldRect(node: Element): { left: number; top: number; width: number; height: number } {
  const rect = node.getBoundingClientRect()
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

export function captureOverlayPose(node: Element): OverlayPose {
  const rect = measureWorldRect(node)
  const matrix = captureCombinedMatrixWithIndividualTransforms(node)
  const parentMatrix =
    node.parentElement !== null
      ? captureCombinedMatrixWithIndividualTransforms(node.parentElement)
      : IDENTITY_MATRIX
  const scaleX = Math.max(1e-6, Math.hypot(matrix.a, matrix.b))
  const scaleY = Math.max(1e-6, Math.hypot(matrix.c, matrix.d))
  const rotationMatrix = extractRotationMatrix(matrix)

  const localBox = measureLocalBox(node)
  const localWidth = localBox.width ?? rect.width / scaleX
  const localHeight = localBox.height ?? rect.height / scaleY

  return {
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    matrix,
    parentMatrix,
    rotationMatrix,
    scaleX,
    scaleY,
    localWidth,
    localHeight,
    frameWidth: localWidth * scaleX,
    frameHeight: localHeight * scaleY
  }
}

/**
 * Viewport position of one local fraction point (0..1) of the pose's box.
 * The AABB corner offset relative to the local origin is recovered from the
 * transformed box corners, making the mapping exact for any affine transform.
 */
export function localFractionToViewportPoint(pose: OverlayPose, fx: number, fy: number): { x: number; y: number } {
  const m = pose.matrix
  const w = pose.localWidth
  const h = pose.localHeight
  const cornersX = [0, m.a * w, m.c * h, m.a * w + m.c * h]
  const cornersY = [0, m.b * w, m.d * h, m.b * w + m.d * h]
  const minX = Math.min(...cornersX)
  const minY = Math.min(...cornersY)
  const px = m.a * (fx * w) + m.c * (fy * h)
  const py = m.b * (fx * w) + m.d * (fy * h)
  return {
    x: pose.rect.left + (px - minX),
    y: pose.rect.top + (py - minY)
  }
}

/**
 * Anchors one fixed-position ghost on a world snapshot and corrects browser
 * subpixel residuals by iterative left/top adjustment (overlay-world pattern,
 * see calibrateOverlayGhostToWorldSnapshot in create-list-flip-module.ts).
 * Runs only at attach/reattach time, never during a drag.
 */
export function calibrateGhostToWorldSnapshot(
  ghostNode: HTMLElement,
  target: { left: number; top: number }
): void {
  let styleLeftPx = target.left
  let styleTopPx = target.top

  ghostNode.style.left = `${styleLeftPx}px`
  ghostNode.style.top = `${styleTopPx}px`

  let rect = ghostNode.getBoundingClientRect()

  for (let index = 0; index < CALIBRATION_MAX_ITERATIONS; index += 1) {
    const residualLeft = target.left - rect.left
    const residualTop = target.top - rect.top

    if (Math.abs(residualLeft) <= CALIBRATION_TOLERANCE_PX && Math.abs(residualTop) <= CALIBRATION_TOLERANCE_PX) {
      break
    }

    styleLeftPx += residualLeft
    styleTopPx += residualTop
    ghostNode.style.left = `${styleLeftPx}px`
    ghostNode.style.top = `${styleTopPx}px`
    rect = ghostNode.getBoundingClientRect()
  }
}

/**
 * Creates (or reuses) the shared fixed overlay layer inside the document that
 * hosts one scene root. Artefacts (cs, gabarit, temporary clone) all live here.
 */
export function ensureOverlayLayer(sceneRoot: Element): HTMLElement {
  const doc = sceneRoot.ownerDocument
  const existing = doc.querySelector<HTMLElement>('[data-selection-frame-overlay]')
  if (existing !== null) {
    return existing
  }
  const layer = doc.createElement('div')
  layer.setAttribute('data-selection-frame-overlay', '')
  layer.style.position = 'fixed'
  layer.style.left = '0'
  layer.style.top = '0'
  layer.style.width = '0'
  layer.style.height = '0'
  layer.style.pointerEvents = 'none'
  layer.style.zIndex = '2147483000'
  doc.body.appendChild(layer)
  return layer
}
