import { createIdentityMatrix, invertMatrix, multiplyMatrix } from '../../ace'
import {
  captureHtmlPose,
  composeHtmlPose,
  deriveLocalPoseMatrix,
  ensureHtmlOverlayLayer,
  worldDeltaToLocalDelta,
} from './html-pose'
import { createHtmlTransientStyleLayer, type HtmlTransientStyleLayer } from './html-transient-style-layer'
import type { HtmlFlipProjection, HtmlMatrix, HtmlOverlayPosePhase, HtmlPose, ResolvedFlipPose } from './types'

type OverlayHandle = {
  ghost: HTMLElement
  source: HTMLElement
  root: Element
  descendantByItemId: ReadonlyMap<string, HTMLElement>
  descendantTargetByPerso: ReadonlyMap<string, string>
  resolvedPose?: HtmlPose
}

type OverlayTemplate = Readonly<{
  root: HTMLElement
  descendants: ReadonlyMap<string, HTMLElement>
}>

type MaterializedOverlay = Readonly<{
  ghost: HTMLElement
  descendants: ReadonlyMap<string, HTMLElement>
}>

type LocalPoseSnapshot = Readonly<{
  captureId: string
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
  const localSnapshots = new Map<HTMLElement, LocalPoseSnapshot>()
  const localDebugKeys = new Set<string>()
  const overlayDebugKeys = new Set<string>()
  const activeOverlays = new Map<HTMLElement, OverlayHandle>()
  const transientStyles = createHtmlTransientStyleLayer(options.root)
  let ownedOverlayLayer: HTMLElement | undefined

  return {
    getHostContextId: () => options.hostContextId,
    getProjectionEpoch: options.getProjectionEpoch,
    resolveHandle: (itemId) => options.resolveHandle(itemId),
    capturePose: (handle) => captureHtmlPose(handle as Element),
    captureOverlayPose: (handle, options) => captureOverlayPose(handle as Element, activeOverlays, options?.phase),
    captureHistoricalPose: options.captureHistoricalPose ?? ((input) => {
      const handle = options.resolveHandle(input.ancestorId)
      if (handle === undefined) throw new Error(`FLIP historical ancestor handle is missing: ${input.ancestorId}`)
      return captureHtmlPose(handle)
    }),
    captureOverlayTemplate: (handle, descendantItemIds) => captureOverlayTemplate(
      handle as HTMLElement,
      descendantItemIds ?? [],
      options.resolveHandle,
      transientStyles,
    ),
    suspendTransientForHistorical: () => {
      for (const [source, overlay] of activeOverlays) {
        finishOverlay(overlay, transientStyles)
        activeOverlays.delete(source)
      }
      for (const [handle, snapshot] of localSnapshots) {
        finishLocalPose(handle, snapshot.captureId, localSnapshots, transientStyles)
      }
    },
    applyLocalPose: (handle, resolved) => applyLocalPose(handle as HTMLElement, resolved, localSnapshots, transientStyles, localDebugKeys, options.debug),
    finishLocalPose: (handle, captureId) => finishLocalPose(handle as HTMLElement, captureId, localSnapshots, transientStyles),
    cancelLocalPose: (handle, captureId) => finishLocalPose(handle as HTMLElement, captureId, localSnapshots, transientStyles),
    beginOverlay: (handle, _first, _last, template, overlayTargetByPerso) => {
      const source = handle as HTMLElement
      const existingLayer = findOverlayLayer(options.root)
      const overlay = beginOverlay(
        source,
        options.root,
        transientStyles,
        template,
        overlayTargetByPerso,
        options.resolveHandle,
      )
      if (ownedOverlayLayer === undefined && existingLayer === undefined) ownedOverlayLayer = findOverlayLayer(options.root)
      activeOverlays.set(source, overlay)
      return overlay
    },
    syncOverlayContent: (handle, descendantItemIds, descendantTargetByPerso) => {
      syncOverlayContent(
        handle as OverlayHandle,
        descendantItemIds,
        descendantTargetByPerso,
        transientStyles,
        options.resolveHandle,
      )
    },
    excludeOverlayItem: (itemId, targetId) => {
      for (const overlay of activeOverlays.values()) {
        if (!matchesOverlayTarget(overlay, itemId, targetId)) continue
        hideOverlayDescendant(overlay, itemId, transientStyles)
      }
    },
    restoreOverlayItem: (itemId, targetId) => {
      for (const overlay of activeOverlays.values()) {
        if (!matchesOverlayTarget(overlay, itemId, targetId)) continue
        restoreOverlayDescendant(overlay, itemId, transientStyles)
      }
    },
    applyOverlayPose: (handle, resolved) => {
      const overlay = handle as OverlayHandle
      overlay.resolvedPose = resolved.pose
      applyOverlayPose(overlay, resolved, overlayDebugKeys, options.debug)
    },
    finishOverlay: (handle) => {
      const overlay = handle as OverlayHandle
      activeOverlays.delete(overlay.source)
      finishOverlay(overlay, transientStyles)
    },
    destroy: () => {
      for (const [source, overlay] of activeOverlays) {
        finishOverlay(overlay, transientStyles)
        activeOverlays.delete(source)
      }
      for (const [handle, snapshot] of localSnapshots) {
        finishLocalPose(handle, snapshot.captureId, localSnapshots, transientStyles)
      }
      removeElement(ownedOverlayLayer)
      ownedOverlayLayer = undefined
    },
    flush: () => undefined,
  }
}

/** Applies one local FLIP pose in the transformed parent coordinate system. */
function applyLocalPose(
  node: HTMLElement,
  resolved: ResolvedFlipPose,
  snapshots: Map<HTMLElement, LocalPoseSnapshot>,
  transientStyles: HtmlTransientStyleLayer,
  debugKeys: Set<string>,
  debug: HtmlDomProjectionOptions['debug'],
): void {
  if (resolved.progress >= 1) {
    finishLocalPose(node, resolved.captureId, snapshots, transientStyles)
    return
  }

  const itemId = resolved.itemId
  const active = snapshots.get(node)
  if (active !== undefined && active.captureId !== resolved.captureId) {
    transientStyles.clearLocal(node)
    snapshots.delete(node)
  }
  if (!snapshots.has(node)) snapshots.set(node, { captureId: resolved.captureId })

  // Size changes can alter the parent's auto-layout position before the matrix
  // is solved, especially when the parent centers its children.
  transientStyles.clearLocal(node)
  transientStyles.applyLocalSize(node, resolved.pose.localWidth, resolved.pose.localHeight)
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

  transientStyles.applyLocalTransform(node, targetMatrix)
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

/** Removes only the active local projection contribution for one item. */
function finishLocalPose(
  node: HTMLElement,
  captureId: string,
  snapshots: Map<HTMLElement, LocalPoseSnapshot>,
  transientStyles: HtmlTransientStyleLayer,
): void {
  const snapshot = snapshots.get(node)
  if (snapshot === undefined || snapshot.captureId !== captureId) return
  transientStyles.clearLocal(node)
  snapshots.delete(node)
}

/** Captures the ad-hoc world anchor needed only by the overlay host. */
function captureWorldAnchorPose(node: Element): HtmlPose {
  const pose = captureHtmlPose(node)
  const rect = node.getBoundingClientRect()
  return { ...pose, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }
}

/** Captures one pose while composing any active projected overlay ancestor. */
function captureOverlayPose(
  node: Element,
  overlays: ReadonlyMap<HTMLElement, OverlayHandle>,
  phase: HtmlOverlayPosePhase = 'last',
): HtmlPose {
  const direct = node instanceof HTMLElement ? overlays.get(node) : undefined
  // FIRST is the current visual state of a concurrent animation. Reusing the
  // direct ghost preserves its in-flight pose instead of re-reading the
  // author's logical placement after a list reflow.
  if (phase === 'first' && direct?.resolvedPose !== undefined) return direct.resolvedPose

  // A previous parent capture may still own a direct child ghost while a new
  // capture measures the child after it has moved under another active parent.
  // The current DOM ancestry is the authoritative ownership at this phase, so
  // resolve an active parent first and only fall back to the direct ghost when
  // no active parent can compose the child.
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

  if (direct?.resolvedPose !== undefined) return direct.resolvedPose

  return captureWorldAnchorPose(node)
}

/** Creates one fixed overlay clone for a world-space FLIP item. */
function beginOverlay(
  source: HTMLElement,
  root: Element,
  transientStyles: HtmlTransientStyleLayer,
  template?: unknown,
  overlayTargetByPerso?: Readonly<Record<string, string>>,
  resolveHandle?: (itemId: string) => HTMLElement | undefined,
): OverlayHandle {
  const itemIds = Object.keys(overlayTargetByPerso ?? {})
  const materialized = cloneOverlayTemplate(template)
    ?? materializeLiveOverlay(source, itemIds, resolveHandle)
  const ghost = materialized.ghost
  ensureHtmlOverlayLayer(root).appendChild(ghost)
  transientStyles.applyHidden(source)
  ghost.style.position = 'absolute'
  ghost.style.left = '0px'
  ghost.style.top = '0px'
  ghost.style.margin = '0'
  ghost.style.visibility = 'visible'
  return {
    ghost,
    source,
    root,
    descendantByItemId: materialized.descendants,
    descendantTargetByPerso: new Map(Object.entries(overlayTargetByPerso ?? {})),
  }
}

/** Rebuilds one ghost subtree from the current source DOM without changing its pose. */
function syncOverlayContent(
  overlay: OverlayHandle,
  descendantItemIds: readonly string[],
  descendantTargetByPerso: Readonly<Record<string, string>>,
  transientStyles: HtmlTransientStyleLayer,
  resolveHandle: (itemId: string) => HTMLElement | undefined,
): void {
  const template = captureOverlayTemplate(overlay.source, descendantItemIds, resolveHandle, transientStyles)
  const descendantPaths = new Map<string, readonly number[]>()
  for (const [itemId, descendant] of template.descendants) {
    const path = findElementPath(template.root, descendant)
    if (path !== undefined) descendantPaths.set(itemId, path)
  }

  while (overlay.ghost.childNodes.length > 0) overlay.ghost.removeChild(overlay.ghost.childNodes[0]!)
  for (const child of [...template.root.childNodes]) overlay.ghost.appendChild(child)

  const descendants = new Map<string, HTMLElement>()
  for (const [itemId, path] of descendantPaths) {
    const descendant = resolveElementPath(overlay.ghost, path)
    if (descendant !== undefined) descendants.set(itemId, descendant)
  }
  overlay.descendantByItemId = descendants
  overlay.descendantTargetByPerso = new Map(Object.entries(descendantTargetByPerso))
}

/** Captures a clean FIRST subtree and references its known descendants by item ID. */
function captureOverlayTemplate(
  source: HTMLElement,
  descendantItemIds: readonly string[],
  resolveHandle: (itemId: string) => HTMLElement | undefined,
  transientStyles: HtmlTransientStyleLayer,
): OverlayTemplate {
  const root = transientStyles.captureTemplate(source)
  const descendants = new Map<string, HTMLElement>()
  for (const itemId of descendantItemIds) {
    const sourceDescendant = resolveHandle(itemId)
    if (sourceDescendant === undefined) continue
    const path = findElementPath(source, sourceDescendant)
    const cloneDescendant = path === undefined ? undefined : resolveElementPath(root, path)
    if (cloneDescendant !== undefined) descendants.set(itemId, cloneDescendant)
  }
  return { root, descendants }
}

/** Clones a captured FIRST subtree and remaps its known descendant references. */
function cloneOverlayTemplate(template: unknown): MaterializedOverlay | undefined {
  if (isOverlayTemplate(template)) {
    const ghost = template.root.cloneNode(true) as HTMLElement
    const descendants = new Map<string, HTMLElement>()
    for (const [itemId, templateDescendant] of template.descendants) {
      const path = findElementPath(template.root, templateDescendant)
      const cloneDescendant = path === undefined ? undefined : resolveElementPath(ghost, path)
      if (cloneDescendant !== undefined) descendants.set(itemId, cloneDescendant)
    }
    return { ghost, descendants }
  }
  if (!isCloneableElement(template)) return undefined
  return { ghost: template.cloneNode(true) as HTMLElement, descendants: new Map() }
}

/** Clones the current subtree when no runtime template resource is available. */
function materializeLiveOverlay(
  source: HTMLElement,
  itemIds: readonly string[],
  resolveHandle: ((itemId: string) => HTMLElement | undefined) | undefined,
): MaterializedOverlay {
  const ghost = source.cloneNode(true) as HTMLElement
  const descendants = new Map<string, HTMLElement>()
  if (resolveHandle !== undefined) {
    for (const itemId of itemIds) {
      const sourceDescendant = resolveHandle(itemId)
      if (sourceDescendant === undefined) continue
      const path = findElementPath(source, sourceDescendant)
      const cloneDescendant = path === undefined ? undefined : resolveElementPath(ghost, path)
      if (cloneDescendant !== undefined) descendants.set(itemId, cloneDescendant)
    }
  }
  return { ghost, descendants }
}

/** Finds a descendant's child-index path without reading identity attributes. */
function findElementPath(root: HTMLElement, target: HTMLElement): readonly number[] | undefined {
  const path: number[] = []
  let current: HTMLElement | null = target
  while (current !== root) {
    if (current === null) return undefined
    const parent: HTMLElement | null = current.parentElement
    if (parent === null) return undefined
    const index = Array.from(parent.children).indexOf(current)
    if (index < 0) return undefined
    path.unshift(index)
    current = parent
  }
  return path
}

/** Resolves a child-index path in a cloned subtree. */
function resolveElementPath(root: HTMLElement, path: readonly number[]): HTMLElement | undefined {
  let current = root
  for (const index of path) {
    const child = current.children[index]
    if (!(child instanceof HTMLElement)) return undefined
    current = child
  }
  return current
}

/** Narrows one runtime-only FIRST template resource. */
function isOverlayTemplate(value: unknown): value is OverlayTemplate {
  return typeof value === 'object'
    && value !== null
    && 'root' in value
    && 'descendants' in value
    && isCloneableElement((value as { root?: unknown }).root)
    && (value as { descendants?: unknown }).descendants instanceof Map
}

/** Narrows a runtime-only overlay resource to the DOM clone contract. */
function isCloneableElement(value: unknown): value is Element & { cloneNode: (deep?: boolean) => Node } {
  return typeof value === 'object'
    && value !== null
    && 'cloneNode' in value
    && typeof (value as { cloneNode?: unknown }).cloneNode === 'function'
}

/** Finds the overlay layer owned by this host root, if one is already present. */
function findOverlayLayer(root: Element): HTMLElement | undefined {
  const layer = Array.from(root.children).find((child) => child.getAttribute('data-selection-frame-overlay') !== null)
  return layer === undefined ? undefined : layer as HTMLElement
}

/** Hides one independently projected descendant through its captured reference. */
function hideOverlayDescendant(overlay: OverlayHandle, itemId: string, transientStyles: HtmlTransientStyleLayer): void {
  const descendant = overlay.descendantByItemId.get(itemId)
  if (descendant !== undefined) transientStyles.applyHidden(descendant)
}

/** Restores one descendant that no longer owns an independent overlay. */
function restoreOverlayDescendant(overlay: OverlayHandle, itemId: string, transientStyles: HtmlTransientStyleLayer): void {
  const descendant = overlay.descendantByItemId.get(itemId)
  if (descendant !== undefined) transientStyles.clearHidden(descendant)
}

/** Restricts descendant visibility changes to the ghost owning the requested target. */
function matchesOverlayTarget(overlay: OverlayHandle, itemId: string, targetId: string | undefined): boolean {
  const descendantTargetId = overlay.descendantTargetByPerso.get(itemId)
  if (descendantTargetId === undefined || targetId === undefined) return true
  return descendantTargetId === targetId
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
function finishOverlay(handle: OverlayHandle, transientStyles: HtmlTransientStyleLayer): void {
  transientStyles.clearHidden(handle.source)
  removeElement(handle.ghost)
}

/** Removes one DOM element through either the browser or a minimal test double. */
function removeElement(element: Element | undefined): void {
  if (element === undefined) return
  const removable = element as Element & { remove?: () => void }
  if (typeof removable.remove === 'function') {
    removable.remove()
    return
  }
  element.parentElement?.removeChild(element)
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
