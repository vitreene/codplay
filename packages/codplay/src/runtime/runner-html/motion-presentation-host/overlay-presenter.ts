import { invertMatrix } from 'ace'
import { isMeasurableHtmlElement } from '../element-guards'
import {
  composeMotionPose,
  createMotionRootPose,
  decomposeRootMotionPose,
  type ItemPresentation,
  type LayoutSnapshot,
  type PresentationFrame,
} from '../../motion'
import type { HtmlPose } from '../../motion/html-types'
import type { HtmlMotionStyleLayer } from '../motion-style-layer'
import {
  findElementPath,
  findNearestOverlayAncestor,
  isDefaultTransformPropertyValue,
  orderOverlayStack,
  applyGhostPose,
  removeElement,
  resolveElementPath,
  sameStringArray,
} from '../motion-presentation'
import type {
  OverlayResource,
  OverlayRevisionResolver,
} from '../motion-presentation'
import type {
  HtmlMotionRootResolver,
  MotionRootState,
  MotionRootToken,
} from './host-types'

/** Owns reparent ghosts, local-root layers and their exclusive visibility. */
export class OverlayMotionPresenter {
  private readonly resources = new Map<string, OverlayResource>()
  private readonly hiddenDescendantClones = new Set<HTMLElement>()
  private hiddenDescendantKey = ''
  private readonly motionRoots = new Map<MotionRootToken, MotionRootState>()
  private readonly root: Element
  private readonly resolveHandle: (itemId: string) => HTMLElement | undefined
  private readonly resolveMotionRoot: HtmlMotionRootResolver
  private readonly transientStyles: HtmlMotionStyleLayer
  private elementPathCache = new WeakMap<HTMLElement, WeakMap<HTMLElement, readonly number[] | undefined>>()

  constructor(
    root: Element,
    resolveHandle: (itemId: string) => HTMLElement | undefined,
    resolveMotionRoot: HtmlMotionRootResolver,
    transientStyles: HtmlMotionStyleLayer,
  ) {
    this.root = root
    this.resolveHandle = resolveHandle
    this.resolveMotionRoot = resolveMotionRoot
    this.transientStyles = transientStyles
  }

  /** Hides projections and reveals sources before a natural geometry capture. */
  prepareNaturalCapture(): void {
    this.clearHiddenDescendantClones()
    this.hiddenDescendantKey = ''
    for (const resource of this.resources.values()) {
      if (!resource.presentationHidden) this.transientStyles.applyHidden(resource.ghost)
      resource.presentationHidden = true
      if (resource.sourceHidden) this.transientStyles.clearHidden(resource.source)
      resource.sourceHidden = false
    }
    for (const state of this.motionRoots.values()) state.overlayOrder = []
    this.clearElementPathCache()
  }

  /** Releases every or selected overlay resource and its owned layers. */
  clearTransientPresentation(itemIds?: ReadonlySet<string>): void {
    if (itemIds !== undefined) {
      this.clearHiddenDescendantClones()
      this.hiddenDescendantKey = ''
      for (const itemId of itemIds) {
        const resource = this.resources.get(itemId)
        if (resource === undefined) continue
        this.release(resource)
        this.resources.delete(itemId)
      }
      this.removeUnusedRootLayers(itemIds)
      this.clearElementPathCache()
      return
    }

    for (const resource of this.resources.values()) this.release(resource)
    this.resources.clear()
    this.clearHiddenDescendantClones()
    this.hiddenDescendantKey = ''
    for (const state of this.motionRoots.values()) {
      removeElement(state.overlayLayer)
      state.overlayLayer = undefined
      state.overlayOrder = []
    }
    this.motionRoots.clear()
    this.clearElementPathCache()
  }

  /** Prepares active reparent resources and their overlay order for one frame. */
  prepareFrame(
    frame: PresentationFrame,
    activeItemIds: ReadonlySet<string>,
    resolveRevision?: OverlayRevisionResolver,
    naturalLayout?: LayoutSnapshot,
  ): void {
    for (const [itemId, resource] of [...this.resources]) {
      if (activeItemIds.has(itemId)) continue
      this.release(resource)
      this.resources.delete(itemId)
    }

    const orderedActiveItemIds = orderOverlayStack(frame, activeItemIds, naturalLayout)
    const activeByRoot = new Map<MotionRootToken, string[]>()
    for (const itemId of orderedActiveItemIds) {
      const item = frame.items.get(itemId)
      if (item === undefined) continue
      const rootState = this.resolveRootState(item, naturalLayout)
      if (!isMeasurableHtmlElement(rootState.root)) continue
      const itemIds = activeByRoot.get(this.rootToken(rootState)) ?? []
      itemIds.push(itemId)
      activeByRoot.set(this.rootToken(rootState), itemIds)
      this.ensureOverlay(itemId, resolveRevision?.(itemId), rootState)
    }
    for (const [token, state] of this.motionRoots) {
      const itemIds = activeByRoot.get(token) ?? []
      if (itemIds.length === 0) {
        removeElement(state.overlayLayer)
        state.overlayLayer = undefined
        state.overlayOrder = []
        continue
      }
      this.reconcileOverlayOrder(state, itemIds)
    }

    const hiddenKey = orderedActiveItemIds.join('\u0000')
    if (hiddenKey !== this.hiddenDescendantKey) {
      this.clearHiddenDescendantClones()
      this.hideIndependentDescendantClones(activeItemIds)
      this.hiddenDescendantKey = hiddenKey
    }
    if (activeItemIds.size === 0) this.hiddenDescendantKey = ''
  }

  /** Applies measured poses and reveals fully prepared overlay resources. */
  applyFrame(
    frame: PresentationFrame,
    activeItemIds: ReadonlySet<string>,
    naturalLayout?: LayoutSnapshot,
  ): void {
    for (const itemId of activeItemIds) {
      const item = frame.items.get(itemId)
      const resource = this.resources.get(itemId)
      if (item === undefined || resource === undefined) continue
      const rootPose = this.resolveItemRootPose(item, naturalLayout)
      const overlayInverse = invertMatrix({ ...rootPose.matrix, e: 0, f: 0 })
      if (overlayInverse === null) throw new Error('Motion overlay root matrix is singular.')
      const worldPose = composeMotionPose(rootPose, decomposeRootMotionPose(item.pose))
      applyGhostPose(resource, rootPose, overlayInverse, worldPose)
    }
    this.showOverlayResources(activeItemIds)
  }

  /** Returns the source node of an active reparent item, when available. */
  sourceFor(itemId: string): HTMLElement | undefined {
    return this.resources.get(itemId)?.source
  }

  /** Resolves the real source or a matching descendant in its nearest ghost. */
  resolveLocalTarget(
    itemId: string,
    frame: PresentationFrame,
    directOverlayItemIds: ReadonlySet<string>,
    naturalLayout?: LayoutSnapshot,
  ): HTMLElement | undefined {
    const source = this.resolveHandle(itemId)
    if (source === undefined) return undefined
    const ancestorId = findNearestOverlayAncestor(frame, itemId, directOverlayItemIds, naturalLayout)
    if (ancestorId === undefined) return source
    const ancestorSource = this.resolveHandle(ancestorId)
    const ancestorResource = this.resources.get(ancestorId)
    if (ancestorSource === undefined || ancestorResource === undefined) return undefined
    const path = this.findElementPathCached(ancestorSource, source)
    return path === undefined ? undefined : resolveElementPath(ancestorResource.ghost, path)
  }

  /** Reuses or creates one ghost for the current author materialization. */
  private ensureOverlay(
    itemId: string,
    revision: string | undefined,
    rootState: MotionRootState,
  ): void {
    const source = this.resolveHandle(itemId)
    if (source === undefined) return
    const previous = this.resources.get(itemId)
    if (previous !== undefined && previous.source === source) {
      const unchanged = revision === undefined || previous.revision === revision
      this.ensureSourceHidden(previous)
      if (previous.motionRoot !== rootState.root || previous.motionRootKey !== rootState.key) {
        this.ensurePresentationHidden(previous)
        this.getOverlayLayer(rootState).appendChild(previous.ghost)
        previous.motionRoot = rootState.root
        previous.motionRootKey = rootState.key
        previous.lastMatrix = undefined
      }
      if (unchanged) return

      this.ensurePresentationHidden(previous)
      const synchronized = this.transientStyles.syncTemplate(source, previous.ghost)
      if (synchronized) {
        // syncTemplate copies authored content, so restore the hidden phase
        // after the template has been synchronized.
        this.transientStyles.applyHidden(previous.ghost)
        previous.revision = revision
        previous.lastWidth = undefined
        previous.lastHeight = undefined
        previous.lastMatrix = undefined
        this.hiddenDescendantKey = ''
        this.configureOverlayGhost(previous.ghost)
        // The transform-longhand decision was made when this representation
        // was created. Reusing it must not turn a state/template revision
        // into a computed-style read on the presentation path.
        this.reapplyNeutralizedTransformProperties(previous)
        return
      }
      this.hiddenDescendantKey = ''
      this.release(previous)
    } else if (previous !== undefined) {
      this.hiddenDescendantKey = ''
      this.release(previous)
    }

    const overlayLayer = this.getOverlayLayer(rootState)
    // Hide the source before inserting its projection. This keeps the two
    // representations mutually exclusive even at the insertion boundary.
    this.transientStyles.applyHidden(source)
    const ghost = this.transientStyles.captureTemplate(source)
    this.configureOverlayGhost(ghost)
    // The new projection is hidden before insertion. The source is already
    // hidden, so the first painted state cannot contain both representations.
    this.transientStyles.applyHidden(ghost)
    overlayLayer.appendChild(ghost)
    const resource: OverlayResource = {
      source,
      ghost,
      motionRoot: rootState.root,
      ...(rootState.key === undefined ? {} : { motionRootKey: rootState.key }),
      revision,
      sourceHidden: true,
      presentationHidden: true,
      neutralizedTransformProperties: new Set(),
    }
    this.resources.set(itemId, resource)
    this.hiddenDescendantKey = ''
    this.clearElementPathCache()
    this.synchronizeGhostTransformProperties(resource)
  }

  /** Returns the overlay layer owned by one local motion root. */
  private getOverlayLayer(rootState: MotionRootState): HTMLElement {
    if (rootState.overlayLayer !== undefined) return rootState.overlayLayer
    const layer = rootState.root.ownerDocument.createElement('div')
    layer.style.position = 'absolute'
    layer.style.left = '0'
    layer.style.top = '0'
    layer.style.width = '100%'
    layer.style.height = '100%'
    layer.style.pointerEvents = 'none'
    layer.style.zIndex = '20'
    rootState.root.appendChild(layer)
    rootState.overlayLayer = layer
    return rootState.overlayLayer
  }

  /** Reconciles one local root's overlay order without mixing other roots. */
  private reconcileOverlayOrder(rootState: MotionRootState, orderedItemIds: readonly string[]): void {
    if (sameStringArray(rootState.overlayOrder, orderedItemIds)) return
    const layer = this.getOverlayLayer(rootState)
    for (const itemId of orderedItemIds) {
      const resource = this.resources.get(itemId)
      if (resource !== undefined) layer.appendChild(resource.ghost)
    }
    rootState.overlayOrder = [...orderedItemIds]
  }

  /** Resolves or creates the state associated with one captured local root. */
  private resolveRootState(item: ItemPresentation, naturalLayout?: LayoutSnapshot): MotionRootState {
    const naturalItem = naturalLayout?.items.get(item.itemId)
    const key = item.motionRootKey ?? naturalItem?.motionRootKey ?? naturalLayout?.rootKey
    const root = this.resolveMotionRoot(key) ?? this.root
    const token = this.rootToken({ root, key })
    const existing = this.motionRoots.get(token)
    if (existing !== undefined) return existing
    const state: MotionRootState = {
      root,
      ...(key === undefined ? {} : { key }),
      overlayOrder: [],
    }
    this.motionRoots.set(token, state)
    return state
  }

  /** Returns the stable map key used by one local root state. */
  private rootToken(state: Pick<MotionRootState, 'root' | 'key'>): MotionRootToken {
    return state.key ?? state.root
  }

  /** Resolves the world pose of the local root used by one frame item. */
  private resolveItemRootPose(item: ItemPresentation, naturalLayout?: LayoutSnapshot): HtmlPose {
    const naturalItem = naturalLayout?.items.get(item.itemId)
    return item.motionRootPose
      ?? naturalItem?.motionRootPose
      ?? naturalLayout?.rootPose
      ?? createMotionRootPose()
  }

  /** Reuses a descendant path until an author template changes structurally. */
  private findElementPathCached(root: HTMLElement, target: HTMLElement): readonly number[] | undefined {
    let targets = this.elementPathCache.get(root)
    if (targets === undefined) {
      targets = new WeakMap<HTMLElement, readonly number[] | undefined>()
      this.elementPathCache.set(root, targets)
    }
    if (targets.has(target)) return targets.get(target)
    const path = findElementPath(root, target)
    targets.set(target, path)
    return path
  }

  /** Invalidates paths after a template or source/ghost relationship changes. */
  private clearElementPathCache(): void {
    this.elementPathCache = new WeakMap<HTMLElement, WeakMap<HTMLElement, readonly number[] | undefined>>()
  }

  /** Restores the fixed overlay properties after an in-place template sync. */
  private configureOverlayGhost(ghost: HTMLElement): void {
    ghost.style.position = 'absolute'
    ghost.style.left = '0px'
    ghost.style.top = '0px'
    ghost.style.margin = '0'
    ghost.style.pointerEvents = 'none'
    ghost.style.minWidth = '0'
    ghost.style.minHeight = '0'
    ghost.style.boxSizing = 'border-box'
    ghost.style.transformOrigin = '0 0'
    ghost.style.zIndex = '20'
  }

  /** Neutralizes non-default author transform longhands on a new ghost. */
  private synchronizeGhostTransformProperties(resource: OverlayResource): void {
    const computed = resource.source.ownerDocument.defaultView?.getComputedStyle(resource.source)
    if (computed === undefined) return
    for (const property of ['translate', 'rotate', 'scale'] as const) {
      const value = computed[property]
      if (isDefaultTransformPropertyValue(property, value)) {
        if (resource.neutralizedTransformProperties.has(property)) {
          resource.ghost.style.removeProperty(property)
          resource.neutralizedTransformProperties.delete(property)
        }
        continue
      }
      resource.ghost.style.setProperty(property, 'none')
      resource.neutralizedTransformProperties.add(property)
    }
  }

  /** Reapplies a captured transform-longhand decision without DOM measurement. */
  private reapplyNeutralizedTransformProperties(resource: OverlayResource): void {
    for (const property of resource.neutralizedTransformProperties) {
      resource.ghost.style.setProperty(property, 'none')
    }
  }

  /** Hides independently presented items inside active ancestor ghosts. */
  private hideIndependentDescendantClones(activeItemIds: ReadonlySet<string>): void {
    for (const descendantId of activeItemIds) {
      const descendantSource = this.resolveHandle(descendantId)
      if (descendantSource === undefined) continue
      for (const [ancestorId, ancestor] of this.resources) {
        if (ancestorId === descendantId) continue
        const path = this.findElementPathCached(ancestor.source, descendantSource)
        const clone = path === undefined ? undefined : resolveElementPath(ancestor.ghost, path)
        if (clone !== undefined) {
          this.transientStyles.applyHidden(clone)
          this.hiddenDescendantClones.add(clone)
        }
      }
    }
  }

  /** Clears only descendant-clone markers created by the previous frame. */
  private clearHiddenDescendantClones(): void {
    for (const clone of this.hiddenDescendantClones) this.transientStyles.clearHidden(clone)
    this.hiddenDescendantClones.clear()
  }

  /** Reveals newly prepared projections after their complete pose is written. */
  private showOverlayResources(itemIds: ReadonlySet<string>): void {
    for (const itemId of itemIds) {
      const resource = this.resources.get(itemId)
      if (resource === undefined || !resource.presentationHidden) continue
      this.transientStyles.clearHidden(resource.ghost)
      resource.presentationHidden = false
    }
  }

  /** Removes root layers no longer referenced by the selected resources. */
  private removeUnusedRootLayers(itemIds: ReadonlySet<string>): void {
    for (const state of this.motionRoots.values()) {
      state.overlayOrder = state.overlayOrder.filter((id) => !itemIds.has(id))
      if (state.overlayOrder.length > 0) continue
      const hasResource = [...this.resources.values()].some((resource) => resource.motionRoot === state.root)
      if (hasResource) continue
      removeElement(state.overlayLayer)
      state.overlayLayer = undefined
    }
  }

  /** Restores one source and removes its presentation resource. */
  private release(resource: OverlayResource): void {
    // Remove the projection while the source is still hidden, then reveal the
    // source. This ordering also covers a resource released without capture.
    removeElement(resource.ghost)
    if (resource.sourceHidden) this.transientStyles.clearHidden(resource.source)
    resource.sourceHidden = false
    resource.presentationHidden = true
  }

  /** Hides one source only when the exclusive presentation state changes. */
  private ensureSourceHidden(resource: OverlayResource): void {
    if (resource.sourceHidden) return
    this.transientStyles.applyHidden(resource.source)
    resource.sourceHidden = true
  }

  /** Hides one projection only before its template is rewritten. */
  private ensurePresentationHidden(resource: OverlayResource): void {
    if (resource.presentationHidden) return
    this.transientStyles.applyHidden(resource.ghost)
    resource.presentationHidden = true
  }
}
