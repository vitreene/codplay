import { captureHtmlPose, ensureHtmlOverlayLayer, worldDeltaToLocalDelta } from './html-pose'
import type { HtmlFlipProjection, HtmlMatrix, HtmlPose, ResolvedFlipPose } from './types'

type OverlayHandle = Readonly<{
  ghost: HTMLElement
  source: HTMLElement
  sourceStyle: string | null
}>

type LocalPoseSnapshot = Readonly<{
  style: string | null
  authoredTransform: string
}>

/** Configuration for the standalone DOM projection used by HTML FLIP. */
export type HtmlDomProjectionOptions = Readonly<{
  hostContextId: string
  getProjectionEpoch: () => number
  root: Element
  resolveHandle: (itemId: string) => HTMLElement | undefined
  debug?: (label: string, payload: unknown) => void
}>

/** Creates the HTML host projection consumed by HtmlFlipRuntime. */
export function createHtmlDomProjection(options: HtmlDomProjectionOptions): HtmlFlipProjection {
  const localSnapshots = new Map<string, LocalPoseSnapshot>()
  const localDebugKeys = new Set<string>()

  return {
    getHostContextId: () => options.hostContextId,
    getProjectionEpoch: options.getProjectionEpoch,
    resolveHandle: (itemId) => options.resolveHandle(itemId),
    capturePose: (handle) => captureHtmlPose(handle as Element),
    captureOverlayPose: (handle) => captureOverlayPose(handle as Element),
    applyLocalPose: (handle, resolved) => applyLocalPose(handle as HTMLElement, resolved, localSnapshots, localDebugKeys, options.debug),
    finishLocalPose: (handle, captureId) => finishLocalPose(handle as HTMLElement, captureId, localSnapshots),
    cancelLocalPose: (handle, captureId) => finishLocalPose(handle as HTMLElement, captureId, localSnapshots),
    beginOverlay: (handle) => beginOverlay(handle as HTMLElement, options.root),
    applyOverlayPose: (handle, resolved) => applyOverlayPose(handle as OverlayHandle, resolved, options.debug),
    finishOverlay: (handle) => finishOverlay(handle as OverlayHandle),
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
      authoredTransform: node.style.transform,
    })
  }
  restoreLocalPose(node, snapshots.get(itemId)!.style)

  const naturalPose = captureHtmlPose(node)
  const naturalRect = naturalPose.rect
  const scaleX = naturalRect.width === 0 ? 1 : resolved.pose.rect.width / naturalRect.width
  const scaleY = naturalRect.height === 0 ? 1 : resolved.pose.rect.height / naturalRect.height
  const deltaWorld = {
    x: resolved.pose.rect.left - naturalRect.left,
    y: resolved.pose.rect.top - naturalRect.top,
  }
  const deltaLocal = worldDeltaToLocalDelta(naturalPose.parentMatrix, deltaWorld.x, deltaWorld.y)

  const debugKey = `${resolved.captureId}:${itemId}`
  if (debug !== undefined && resolved.progress > 0.05 && resolved.progress < 0.35 && !debugKeys.has(debugKey)) {
    debugKeys.add(debugKey)
    debug('local-debug-mid-transition', {
      captureId: resolved.captureId,
      itemId,
      progress: resolved.progress,
      natural: { ...naturalRect },
      target: { ...resolved.pose.rect },
      deltaWorld,
      deltaLocal,
      parentMatrix: { ...naturalPose.parentMatrix },
    })
  }

  node.style.transition = 'none'
  node.style.transformOrigin = 'center'
  node.style.transform = `translate(${deltaLocal.x}px, ${deltaLocal.y}px) scale(${scaleX}, ${scaleY}) ${snapshots.get(itemId)!.authoredTransform}`
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
function captureOverlayPose(node: Element): HtmlPose {
  const pose = captureHtmlPose(node)
  const rect = node.getBoundingClientRect()
  return { ...pose, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }
}

/** Creates one fixed overlay clone for a world-space FLIP item. */
function beginOverlay(source: HTMLElement, root: Element): OverlayHandle {
  const ghost = source.cloneNode(true) as HTMLElement
  const sourceStyle = source.getAttribute('style')
  ensureHtmlOverlayLayer(root).appendChild(ghost)
  source.style.visibility = 'hidden'
  ghost.style.position = 'fixed'
  ghost.style.left = '0px'
  ghost.style.top = '0px'
  ghost.style.margin = '0'
  ghost.style.visibility = 'visible'
  return { ghost, source, sourceStyle }
}

/** Applies one world pose through a matrix-only transform. */
function applyOverlayPose(handle: OverlayHandle, resolved: ResolvedFlipPose, debug: HtmlDomProjectionOptions['debug']): void {
  const { ghost } = handle
  const matrix = resolved.pose.matrix
  const linearMatrix: HtmlMatrix = { ...matrix, e: 0, f: 0 }
  const bounds = transformedBounds(linearMatrix, resolved.pose.localWidth, resolved.pose.localHeight)
  if (debug !== undefined && (resolved.progress <= 0.05 || resolved.progress >= 0.95)) {
    debug('overlay-apply', { itemId: resolved.itemId, progress: resolved.progress, resolvedRect: { ...resolved.pose.rect } })
  }
  ghost.style.position = 'fixed'
  ghost.style.left = '0px'
  ghost.style.top = '0px'
  ghost.style.width = `${resolved.pose.localWidth}px`
  ghost.style.height = `${resolved.pose.localHeight}px`
  ghost.style.margin = '0'
  ghost.style.minWidth = '0'
  ghost.style.minHeight = '0'
  ghost.style.boxSizing = 'border-box'
  ghost.style.transformOrigin = '0 0'
  ghost.style.transform = `matrix(${linearMatrix.a}, ${linearMatrix.b}, ${linearMatrix.c}, ${linearMatrix.d}, ${resolved.pose.rect.left - bounds.left}, ${resolved.pose.rect.top - bounds.top})`
  ghost.style.zIndex = '20'
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
