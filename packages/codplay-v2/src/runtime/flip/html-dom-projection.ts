import { createIdentityMatrix, invertMatrix, multiplyMatrix } from '../../ace'
import {
  captureHtmlPose,
  composeHtmlPose,
  deriveLocalPoseMatrix,
  ensureHtmlOverlayLayer,
  worldDeltaToLocalDelta,
} from './html-pose'
import type { HtmlFlipProjection, HtmlMatrix, HtmlPose, ResolvedFlipPose } from './types'

type OverlayHandle = {
  ghost: HTMLElement
  source: HTMLElement
  sourceStyle: string | null
  root: Element
  resolvedPose?: HtmlPose
}

type LocalPoseSnapshot = Readonly<{
  style: string | null
}>

/** Configuration for the standalone DOM projection used by HTML FLIP. */
export type HtmlDomProjectionOptions = Readonly<{
  hostContextId: string
  getProjectionEpoch: () => number
  root: Element
  resolveHandle: (itemId: string) => HTMLElement | undefined
  captureHistoricalPose?: HtmlFlipProjection['captureHistoricalPose']
  debug?: (label: string, payload: unknown) => void
}>

/** Creates the HTML host projection consumed by HtmlFlipRuntime. */
export function createHtmlDomProjection(options: HtmlDomProjectionOptions): HtmlFlipProjection {
  const localSnapshots = new Map<string, LocalPoseSnapshot>()
  const localDebugKeys = new Set<string>()
  const overlayDebugKeys = new Set<string>()
  const activeOverlays = new Map<HTMLElement, OverlayHandle>()
  const hiddenOverlayDescendants = new WeakMap<HTMLElement, string>()

  return {
    getHostContextId: () => options.hostContextId,
    getProjectionEpoch: options.getProjectionEpoch,
    resolveHandle: (itemId) => options.resolveHandle(itemId),
    capturePose: (handle) => captureHtmlPose(handle as Element),
    captureOverlayPose: (handle) => captureOverlayPose(handle as Element, activeOverlays),
    captureHistoricalPose: options.captureHistoricalPose ?? ((input) => {
      const handle = options.resolveHandle(input.ancestorId)
      if (handle === undefined) throw new Error(`FLIP historical ancestor handle is missing: ${input.ancestorId}`)
      return captureHtmlPose(handle)
    }),
    applyLocalPose: (handle, resolved) => applyLocalPose(handle as HTMLElement, resolved, localSnapshots, localDebugKeys, options.debug),
    finishLocalPose: (handle, captureId) => finishLocalPose(handle as HTMLElement, captureId, localSnapshots),
    cancelLocalPose: (handle, captureId) => finishLocalPose(handle as HTMLElement, captureId, localSnapshots),
    beginOverlay: (handle) => {
      const source = handle as HTMLElement
      const overlay = beginOverlay(source, options.root)
      activeOverlays.set(source, overlay)
      return overlay
    },
    excludeOverlayItem: (itemId) => {
      for (const overlay of activeOverlays.values()) hideOverlayDescendant(overlay.ghost, itemId, hiddenOverlayDescendants)
    },
    restoreOverlayItem: (itemId) => {
      for (const overlay of activeOverlays.values()) restoreOverlayDescendant(overlay.ghost, itemId, hiddenOverlayDescendants)
    },
    applyOverlayPose: (handle, resolved) => {
      const overlay = handle as OverlayHandle
      overlay.resolvedPose = resolved.pose
      applyOverlayPose(overlay, resolved, overlayDebugKeys, options.debug)
    },
    finishOverlay: (handle) => {
      const overlay = handle as OverlayHandle
      activeOverlays.delete(overlay.source)
      finishOverlay(overlay)
    },
    flush: () => undefined,
  }
}

/** Applies one local FLIP pose in the transformed parent coordinate system. */
function applyLocalPose(
  node: HTMLElement,
  resolved: ResolvedFlipPose,
  snapshots: Map<string, LocalPoseSnapshot>,
  debugKeys: Set<string>,
  debug: HtmlDomProjectionOptions['debug'],
): void {
  if (resolved.progress >= 1) {
    finishLocalPose(node, resolved.captureId, snapshots)
    return
  }

  const itemId = resolved.itemId
  if (!snapshots.has(itemId)) {
    snapshots.set(itemId, {
      style: node.getAttribute('style'),
    })
  }
  restoreLocalPose(node, snapshots.get(itemId)!.style)

  // Size changes can alter the parent's auto-layout position before the matrix
  // is solved, especially when the parent centers its children.
  node.style.width = `${resolved.pose.localWidth}px`
  node.style.height = `${resolved.pose.localHeight}px`
  const naturalPose = captureHtmlPose(node)
  const naturalRect = naturalPose.rect
  const parentPose = node.parentElement === null ? undefined : captureHtmlPose(node.parentElement)
  const targetMatrix = resolveLocalProjectionMatrix(naturalPose, resolved.pose, parentPose)

  const debugKey = `${resolved.captureId}:${itemId}`
  if (debug !== undefined && resolved.progress > 0.05 && resolved.progress < 0.65 && !debugKeys.has(debugKey)) {
    debugKeys.add(debugKey)
    debug('local-debug-mid-transition', {
      captureId: resolved.captureId,
      itemId,
      progress: resolved.progress,
      natural: { ...naturalRect },
      target: { ...resolved.pose.rect },
      matrix: { ...targetMatrix },
      layoutOffset: naturalPose.layoutOffset,
      parentMatrix: parentPose === undefined ? createIdentityMatrix() : poseAffineMatrix(parentPose),
    })
  }

  node.style.transition = 'none'
  node.style.transformOrigin = '0 0'
  node.style.translate = 'none'
  node.style.rotate = 'none'
  node.style.scale = 'none'
  node.style.transform = `matrix(${targetMatrix.a}, ${targetMatrix.b}, ${targetMatrix.c}, ${targetMatrix.d}, ${targetMatrix.e}, ${targetMatrix.f})`
}

/** Resolves one local CSS matrix without using scale to interpolate item size. */
export function resolveLocalProjectionMatrix(
  natural: HtmlPose,
  target: HtmlPose,
  parent: HtmlPose | undefined,
): HtmlMatrix {
  const parentMatrix = parent === undefined ? createIdentityMatrix() : poseAffineMatrix(parent)
  const parentInverse = invertMatrix(parentMatrix)
  if (parentInverse === null) throw new Error('FLIP local parent matrix is singular.')
  const targetMatrix = multiplyMatrix(parentInverse, poseAffineMatrix(target))
  const layoutOffset = natural.layoutOffset ?? { x: 0, y: 0 }
  return {
    ...targetMatrix,
    e: targetMatrix.e - layoutOffset.x,
    f: targetMatrix.f - layoutOffset.y,
  }
}

/** Converts one numeric pose into the affine matrix of its local-box origin. */
function poseAffineMatrix(pose: HtmlPose): ReturnType<typeof createIdentityMatrix> {
  return {
    a: pose.matrix.a,
    b: pose.matrix.b,
    c: pose.matrix.c,
    d: pose.matrix.d,
    e: pose.origin.x,
    f: pose.origin.y,
  }
}

/** Restores one local item to the exact authored inline style. */
function finishLocalPose(node: HTMLElement, captureId: string, snapshots: Map<string, LocalPoseSnapshot>): void {
  void captureId
  const itemId = node.dataset.itemId
  if (itemId === undefined) return
  const snapshot = snapshots.get(itemId)
  if (snapshot === undefined) return
  restoreLocalPose(node, snapshot.style)
  snapshots.delete(itemId)
}

/** Restores an inline style snapshot without reading the rendered node. */
function restoreLocalPose(node: HTMLElement, style: string | null): void {
  if (style === null) node.removeAttribute('style')
  else node.setAttribute('style', style)
}

/** Captures the ad-hoc world anchor needed only by the overlay host. */
function captureWorldAnchorPose(node: Element): HtmlPose {
  const pose = captureHtmlPose(node)
  const rect = node.getBoundingClientRect()
  return { ...pose, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }
}

/** Captures one pose while composing any active projected overlay ancestor. */
function captureOverlayPose(node: Element, overlays: ReadonlyMap<HTMLElement, OverlayHandle>): HtmlPose {
  const direct = node instanceof HTMLElement ? overlays.get(node) : undefined
  if (direct?.resolvedPose !== undefined) return direct.resolvedPose

  let ancestor = node.parentElement
  while (ancestor !== null) {
    const overlay = overlays.get(ancestor)
    if (overlay?.resolvedPose !== undefined) {
      const childPose = captureHtmlPose(node)
      const parentPose = captureHtmlPose(overlay.source)
      const local = deriveLocalPoseMatrix(parentPose, childPose)
      return composeHtmlPose(overlay.resolvedPose, local, childPose.localWidth, childPose.localHeight)
    }
    ancestor = ancestor.parentElement
  }

  return captureWorldAnchorPose(node)
}

/** Creates one fixed overlay clone for a world-space FLIP item. */
function beginOverlay(source: HTMLElement, root: Element): OverlayHandle {
  const ghost = source.cloneNode(true) as HTMLElement
  const sourceStyle = source.getAttribute('style')
  ensureHtmlOverlayLayer(root).appendChild(ghost)
  source.style.visibility = 'hidden'
  ghost.style.position = 'absolute'
  ghost.style.left = '0px'
  ghost.style.top = '0px'
  ghost.style.margin = '0'
  ghost.style.visibility = 'visible'
  return { ghost, source, sourceStyle, root }
}

/** Hides one independently projected descendant in an existing ghost. */
function hideOverlayDescendant(ghost: HTMLElement, itemId: string, hidden: WeakMap<HTMLElement, string>): void {
  for (const element of ghost.querySelectorAll<HTMLElement>('[data-item-id], [id]')) {
    if (element.dataset.itemId !== itemId && element.id !== itemId) continue
    if (!hidden.has(element)) hidden.set(element, element.style.visibility)
    element.style.visibility = 'hidden'
  }
}

/** Restores one descendant that no longer owns an independent overlay. */
function restoreOverlayDescendant(ghost: HTMLElement, itemId: string, hidden: WeakMap<HTMLElement, string>): void {
  for (const element of ghost.querySelectorAll<HTMLElement>('[data-item-id], [id]')) {
    if (element.dataset.itemId !== itemId && element.id !== itemId) continue
    const visibility = hidden.get(element)
    if (visibility === undefined) continue
    element.style.visibility = visibility
    hidden.delete(element)
  }
}

/** Applies one world pose through a matrix-only transform. */
function applyOverlayPose(
  handle: OverlayHandle,
  resolved: ResolvedFlipPose,
  debugKeys: Set<string>,
  debug: HtmlDomProjectionOptions['debug'],
): void {
  const { ghost } = handle
  const rootPose = captureWorldAnchorPose(handle.root)
  const localized = localizePose(rootPose, resolved.pose)
  const debugKey = `${resolved.captureId}:${resolved.itemId}`
  if (debug !== undefined && resolved.progress <= 0.05 && !debugKeys.has(debugKey)) {
    debugKeys.add(debugKey)
    debug('overlay-localized-start', {
      itemId: resolved.itemId,
      progress: resolved.progress,
      rootRect: { ...rootPose.rect },
      itemRect: { ...resolved.pose.rect },
      origin: localized.origin,
      matrix: localized.matrix,
      cssTranslation: localized.origin,
    })
  }
  if (debug !== undefined && (resolved.progress <= 0.05 || resolved.progress >= 0.95)) {
    debug('overlay-apply', { itemId: resolved.itemId, progress: resolved.progress, resolvedRect: { ...resolved.pose.rect } })
  }
  ghost.style.position = 'absolute'
  ghost.style.left = '0px'
  ghost.style.top = '0px'
  ghost.style.width = `${resolved.pose.localWidth}px`
  ghost.style.height = `${resolved.pose.localHeight}px`
  ghost.style.margin = '0'
  ghost.style.minWidth = '0'
  ghost.style.minHeight = '0'
  ghost.style.boxSizing = 'border-box'
  ghost.style.transformOrigin = '0 0'
  ghost.style.transform = `matrix(${localized.matrix.a}, ${localized.matrix.b}, ${localized.matrix.c}, ${localized.matrix.d}, ${localized.matrix.e}, ${localized.matrix.f})`
  ghost.style.zIndex = '20'

  if (debug !== undefined && resolved.progress <= 0.05 && debugKeys.has(debugKey)) {
    const actual = captureWorldAnchorPose(ghost)
    debug('overlay-actual-start', {
      itemId: resolved.itemId,
      expected: { ...resolved.pose.rect },
      actual: { ...actual.rect },
    })
  }
}

/** Converts one world pose to the coordinate system of the current overlay root. */
export function localizePose(root: HtmlPose, pose: HtmlPose): { matrix: HtmlMatrix; origin: { x: number; y: number } } {
  const rootBounds = transformedBounds(root.matrix, root.localWidth, root.localHeight)
  const poseBounds = transformedBounds(pose.matrix, pose.localWidth, pose.localHeight)
  const rootOrigin = { x: root.rect.left - rootBounds.left, y: root.rect.top - rootBounds.top }
  const poseOrigin = { x: pose.rect.left - poseBounds.left, y: pose.rect.top - poseBounds.top }
  const originDelta = worldDeltaToLocalDelta(root.matrix, poseOrigin.x - rootOrigin.x, poseOrigin.y - rootOrigin.y)
  const inverse = invertMatrix({ ...root.matrix, e: 0, f: 0 })
  if (inverse === null) throw new Error('FLIP overlay root matrix is singular.')
  return {
    matrix: { ...multiplyMatrix(inverse, { ...pose.matrix, e: 0, f: 0 }), e: originDelta.x, f: originDelta.y },
    origin: originDelta,
  }
}

/** Restores the source and removes one overlay clone. */
function finishOverlay(handle: OverlayHandle): void {
  if (handle.sourceStyle === null) handle.source.removeAttribute('style')
  else handle.source.setAttribute('style', handle.sourceStyle)
  handle.ghost.remove()
}

/** Computes transformed bounds for one local rectangle. */
function transformedBounds(matrix: HtmlMatrix, width: number, height: number): { left: number; top: number } {
  const points = [
    transformPoint(matrix, [0, 0]),
    transformPoint(matrix, [width, 0]),
    transformPoint(matrix, [0, height]),
    transformPoint(matrix, [width, height]),
  ]
  return {
    left: Math.min(...points.map((point) => point[0])),
    top: Math.min(...points.map((point) => point[1])),
  }
}

/** Applies one linear matrix to one point. */
function transformPoint(matrix: HtmlMatrix, point: readonly [number, number]): readonly [number, number] {
  return [matrix.a * point[0] + matrix.c * point[1], matrix.b * point[0] + matrix.d * point[1]]
}
