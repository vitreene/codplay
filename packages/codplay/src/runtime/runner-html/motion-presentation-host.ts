import { invertMatrix } from 'ace'
import { isMeasurableHtmlElement } from './element-guards'
import { ensureHtmlOverlayLayer } from '../motion/html-pose'
import {
  composeMotionPose,
  createMotionRootPose,
  decomposeRootMotionPose,
  type ItemPresentation,
  type LayoutItemSnapshot,
  type LayoutSnapshot,
  type PresentationFrame,
} from '../motion'
import type { HtmlMatrix, HtmlPose } from '../motion/html-types'
import { createHtmlMotionStyleLayer, type HtmlMotionStyleLayer } from './motion-style-layer'
import {
  applyGhostPose,
  findElementPath,
  findNearestOverlayAncestor,
  findOverlayLayer,
  isDefaultTransformPropertyValue,
  orderOverlayStack,
  orderParentFirst,
  poseAffineMatrix,
  removeElement,
  resolveElementPath,
  resolveLocalPresentationMatrix,
  sameHtmlMatrix,
  sameStringArray,
} from './motion-presentation'
import type {
  LocalTransformResource,
  OverlayResource,
  OverlayRevisionResolver,
} from './motion-presentation'

/** Resolves the DOM container recorded by one HTML layout snapshot. */
type HtmlMotionRootResolver = (rootKey: string | undefined) => Element | undefined

/** Identity used to retain one presentation layer per local motion root. */
type MotionRootToken = string | Element

/** Mutable resources retained for one local motion root. */
type MotionRootState = {
  root: Element
  key?: string
  overlayLayer?: HTMLElement
  overlayOrder: readonly string[]
}

/** Commits one complete motion frame without owning temporal state. */
export class HtmlMotionPresentationHost {
  private readonly resources = new Map<string, OverlayResource>()
  private readonly localTargets = new Map<string, HTMLElement>()
  private readonly localSizes = new Map<string, Readonly<{
    target: HTMLElement
    width: number
    height: number
  }>>()
  private readonly localTransforms = new Map<string, LocalTransformResource>()
  private readonly hiddenDescendantClones = new Set<HTMLElement>()
  private hiddenDescendantKey = ''
  private readonly motionRoots = new Map<MotionRootToken, MotionRootState>()
  private readonly root: Element
  private readonly resolveHandle: (itemId: string) => HTMLElement | undefined
  private readonly resolveMotionRoot: HtmlMotionRootResolver
  private readonly transientStyles: HtmlMotionStyleLayer
  private elementPathCache = new WeakMap<HTMLElement, WeakMap<HTMLElement, readonly number[] | undefined>>()

  /** Creates one item-indexed overlay resource host. */
  constructor(
    root: Element,
    resolveHandle: (itemId: string) => HTMLElement | undefined,
    resolveMotionRoot: HtmlMotionRootResolver = () => root,
  ) {
    this.root = root
    this.resolveHandle = resolveHandle
    this.resolveMotionRoot = resolveMotionRoot
    this.transientStyles = createHtmlMotionStyleLayer(root)
  }

  /** Removes the host-owned presentation so the visible nodes expose natural geometry. */
  prepareNaturalCapture(): void {
    this.clearHiddenDescendantClones()
    // The next commit must recompute descendant masking. The capture phase
    // deliberately removes those markers from reused ancestor ghosts.
    this.hiddenDescendantKey = ''
    // Hide every projection before revealing any source. This keeps a source
    // and its projection from being visible at the same time at the boundary.
    for (const resource of this.resources.values()) {
      if (!resource.presentationHidden) this.transientStyles.applyHidden(resource.ghost)
      resource.presentationHidden = true
      if (resource.sourceHidden) this.transientStyles.clearHidden(resource.source)
      resource.sourceHidden = false
    }
    for (const target of this.localTargets.values()) this.transientStyles.clearLocal(target)
    this.localTargets.clear()
    this.localSizes.clear()
    this.localTransforms.clear()
    for (const state of this.motionRoots.values()) state.overlayOrder = []
    this.clearElementPathCache()
  }

  /** Disables authored CSS transitions during one atomic logical seek. */
  prepareSeek(): void {
    this.root.setAttribute('data-codplay-motion-seek', '')
  }

  /** Restores authored CSS transition behavior after one seek commit. */
  completeSeek(): void {
    this.root.removeAttribute('data-codplay-motion-seek')
  }

  /** Releases every transient presentation resource, including overlay DOM. */
  clearTransientPresentation(): void {
    this.prepareNaturalCapture()
    for (const resource of this.resources.values()) this.release(resource)
    this.resources.clear()
    this.clearHiddenDescendantClones()
    this.hiddenDescendantKey = ''
    for (const state of this.motionRoots.values()) {
      removeElement(state.overlayLayer ?? findOverlayLayer(state.root))
      state.overlayLayer = undefined
      state.overlayOrder = []
    }
    this.motionRoots.clear()
    this.clearElementPathCache()
  }

  /** Applies exactly the source/overlay representation declared by one frame. */
  commit(
    frame: PresentationFrame,
    resolveRevision?: OverlayRevisionResolver,
    naturalLayout?: LayoutSnapshot,
  ): void {
    const directOverlayItemIds = new Set([...frame.items.values()]
      .filter((item) => item.representation === 'reparent')
      .map((item) => item.itemId))
    const activeItemIds = new Set(directOverlayItemIds)
    const localItemIds = new Set<string>()
    for (const item of frame.items.values()) {
      if (item.representation !== 'local') continue
      // A local descendant of a reparented item remains a local FLIP. Its
      // presentation target is the matching descendant in the parent's ghost,
      // not a second independent overlay resource.
      localItemIds.add(item.itemId)
    }

    for (const [itemId, target] of [...this.localTargets]) {
      if (localItemIds.has(itemId)) continue
      this.transientStyles.clearLocal(target)
      this.localTargets.delete(itemId)
      this.localSizes.delete(itemId)
      this.localTransforms.delete(itemId)
    }

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
        removeElement(state.overlayLayer ?? findOverlayLayer(state.root))
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

    if (activeItemIds.size === 0) {
      this.hiddenDescendantKey = ''
    }

    const orderedLocalItemIds = orderParentFirst(frame, localItemIds, naturalLayout)
    const localParentInverses = new Map<string, HtmlMatrix>()
    const localParentPoses = new Map<string, HtmlPose>()
    for (const itemId of orderedLocalItemIds) this.prepareLocal(itemId, frame, directOverlayItemIds, naturalLayout)
    for (const itemId of orderedLocalItemIds) this.applyLocal(
      itemId,
      frame,
      naturalLayout,
      localParentInverses,
      localParentPoses,
    )

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

  /** Releases every overlay resource and restores all materialized sources. */
  destroy(): void {
    this.completeSeek()
    this.clearTransientPresentation()
  }

  /** Applies every layout-affecting local size before any local transform is solved. */
  private prepareLocal(
    itemId: string,
    frame: PresentationFrame,
    directOverlayItemIds: ReadonlySet<string>,
    naturalLayout?: LayoutSnapshot,
  ): void {
    const target = this.resolveLocalTarget(itemId, frame, directOverlayItemIds, naturalLayout)
    const item = frame.items.get(itemId)
    if (target === undefined || item === undefined) return
    const previous = this.localTargets.get(itemId)
    if (previous !== undefined && previous !== target) {
      this.transientStyles.clearLocal(previous)
      this.localSizes.delete(itemId)
      this.localTransforms.delete(itemId)
    }
    const previousSize = this.localSizes.get(itemId)
    if (previousSize?.target !== target
      || previousSize.width !== item.pose.localWidth
      || previousSize.height !== item.pose.localHeight) {
      this.transientStyles.applyLocalSize(target, item.pose.localWidth, item.pose.localHeight)
      this.localSizes.set(itemId, {
        target,
        width: item.pose.localWidth,
        height: item.pose.localHeight,
      })
    }
    this.localTargets.set(itemId, target)
  }

  /** Presents one local item in the coordinate system of its currently rendered parent. */
  private applyLocal(
    itemId: string,
    frame: PresentationFrame,
    naturalLayout: LayoutSnapshot | undefined,
    parentInverses: Map<string, HtmlMatrix>,
    parentPoses: Map<string, HtmlPose>,
  ): void {
    const target = this.localTargets.get(itemId)
    const item = frame.items.get(itemId)
    if (target === undefined || item === undefined) return
    const rootPose = this.resolveItemRootPose(item, naturalLayout)
    const worldPose = composeMotionPose(rootPose, decomposeRootMotionPose(item.pose))
    const parentCacheKey = this.parentCacheKey(item.parentItemId, item, naturalLayout)
    let parentInverse = parentInverses.get(parentCacheKey)
    if (parentInverse === undefined) {
      const parentLayoutPose = this.resolveParentLayoutPose(
        item.parentItemId,
        frame,
        naturalLayout,
        parentPoses,
        item.motionRootKey,
      )
      const parentPose = composeMotionPose(
        this.resolveParentRootPose(item.parentItemId, frame, naturalLayout, rootPose),
        decomposeRootMotionPose(parentLayoutPose),
      )
      const resolvedParentInverse = invertMatrix(poseAffineMatrix(parentPose))
      if (resolvedParentInverse === null) throw new Error('Motion local parent matrix is singular.')
      parentInverse = resolvedParentInverse
      parentInverses.set(parentCacheKey, resolvedParentInverse)
    }
    const naturalItem = naturalLayout?.items.get(itemId)
    // The projection stylesheet replaces the authored transform entirely.
    // Subtract only the untransformed layout slot captured for this item;
    // subtracting localPose.origin would apply the authored transform twice.
    const naturalLayoutOrigin: readonly [number, number] = naturalItem?.localPose.layoutOrigin ?? [0, 0]
    const matrix = resolveLocalPresentationMatrix(naturalLayoutOrigin, worldPose, parentInverse)
    const previous = this.localTransforms.get(itemId)
    if (previous?.target === target && sameHtmlMatrix(previous.matrix, matrix)) return
    this.transientStyles.applyLocalTransform(target, matrix)
    this.localTransforms.set(itemId, { target, matrix })
  }

  /** Resolves an item's effective parent pose through non-presented ancestors. */
  private resolveParentLayoutPose(
    parentItemId: string | undefined,
    frame: PresentationFrame,
    naturalLayout: LayoutSnapshot | undefined,
    cache: Map<string, HtmlPose>,
    motionRootKey?: string,
  ): HtmlPose {
    const cacheKey = `${motionRootKey ?? ''}:${parentItemId ?? ''}`
    const cached = cache.get(cacheKey)
    if (cached !== undefined) return cached

    if (parentItemId === undefined) {
      const root = createMotionRootPose()
      cache.set(cacheKey, root)
      return root
    }

    const presentedParent = frame.items.get(parentItemId)
    if (presentedParent !== undefined) {
      cache.set(cacheKey, presentedParent.pose)
      return presentedParent.pose
    }

    const naturalParent = naturalLayout?.items.get(parentItemId)
    if (naturalParent === undefined) {
      const root = createMotionRootPose()
      cache.set(cacheKey, root)
      return root
    }

    const chain: LayoutItemSnapshot[] = [naturalParent]
    let ancestorItemId = naturalParent.parentItemId
    let presentedAncestor: HtmlPose | undefined
    while (ancestorItemId !== undefined) {
      presentedAncestor = frame.items.get(ancestorItemId)?.pose
      if (presentedAncestor !== undefined) break
      const naturalAncestor = naturalLayout?.items.get(ancestorItemId)
      if (naturalAncestor === undefined) break
      chain.push(naturalAncestor)
      ancestorItemId = naturalAncestor.parentItemId
    }

    if (presentedAncestor === undefined) {
      cache.set(cacheKey, naturalParent.rootPose)
      return naturalParent.rootPose
    }

    let resolved = presentedAncestor
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      resolved = composeMotionPose(resolved, chain[index]!.localPose)
    }
    cache.set(cacheKey, resolved)
    return resolved
  }

  /** Resolves the real source or the matching descendant in its nearest overlay ancestor. */
  private resolveLocalTarget(
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

  /** Reveals newly prepared projections after their complete pose has been written. */
  private showOverlayResources(itemIds: ReadonlySet<string>): void {
    for (const itemId of itemIds) {
      const resource = this.resources.get(itemId)
      if (resource === undefined || !resource.presentationHidden) continue
      this.transientStyles.clearHidden(resource.ghost)
      resource.presentationHidden = false
    }
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
        // syncTemplate deliberately removes transient attributes before
        // copying authored content, so restore the hidden phase after it.
        this.transientStyles.applyHidden(previous.ghost)
        previous.revision = revision
        if (!unchanged) {
          // syncTemplate removes the ghost's inline style attribute before
          // copying the authored template. The presentation dimensions are
          // host-owned and therefore have to be written again even when the
          // pose width/height did not change.
          previous.lastWidth = undefined
          previous.lastHeight = undefined
          previous.lastMatrix = undefined
          this.hiddenDescendantKey = ''
          this.configureOverlayGhost(previous.ghost, itemId)
          // The transform-longhand decision was made when this representation
          // was created. Reusing it must not turn a state/template revision
          // into a computed-style read on the presentation path.
          this.reapplyNeutralizedTransformProperties(previous)
        }
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
    this.configureOverlayGhost(ghost, itemId)
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
    rootState.overlayLayer = ensureHtmlOverlayLayer(rootState.root)
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
  private resolveItemRootPose(
    item: ItemPresentation,
    naturalLayout?: LayoutSnapshot,
  ): HtmlPose {
    const naturalItem = naturalLayout?.items.get(item.itemId)
    return item.motionRootPose
      ?? naturalItem?.motionRootPose
      ?? naturalLayout?.rootPose
      ?? createMotionRootPose()
  }

  /** Resolves the root pose used by a local item's rendered parent. */
  private resolveParentRootPose(
    parentItemId: string | undefined,
    frame: PresentationFrame,
    naturalLayout: LayoutSnapshot | undefined,
    fallback: HtmlPose,
  ): HtmlPose {
    if (parentItemId === undefined) return fallback
    const presentedParent = frame.items.get(parentItemId)
    if (presentedParent?.motionRootPose !== undefined) return presentedParent.motionRootPose
    const naturalParent = naturalLayout?.items.get(parentItemId)
    return naturalParent?.motionRootPose ?? fallback
  }

  /** Separates cached local-parent inverses belonging to different roots. */
  private parentCacheKey(
    parentItemId: string | undefined,
    item: ItemPresentation,
    naturalLayout?: LayoutSnapshot,
  ): string {
    const naturalItem = naturalLayout?.items.get(item.itemId)
    const rootKey = item.motionRootKey ?? naturalItem?.motionRootKey ?? naturalLayout?.rootKey ?? 'scene'
    return `${rootKey}:${parentItemId ?? '<root>'}`
  }

  /** Reuses one descendant path until an author template changes structurally. */
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
  private configureOverlayGhost(ghost: HTMLElement, itemId: string): void {
    ghost.setAttribute('data-codplay-motion-item', itemId)
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

  /** Neutralizes only non-default author transform longhands that would compose with the pose matrix. */
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

  /** Reapplies a previously captured transform-longhand decision without DOM measurement. */
  private reapplyNeutralizedTransformProperties(resource: OverlayResource): void {
    for (const property of resource.neutralizedTransformProperties) {
      resource.ghost.style.setProperty(property, 'none')
    }
  }

  /** Hides an independently presented item inside every active ancestor clone. */
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

  /** Clears only descendant-clone markers created by the previous presentation frame. */
  private clearHiddenDescendantClones(): void {
    for (const clone of this.hiddenDescendantClones) this.transientStyles.clearHidden(clone)
    this.hiddenDescendantClones.clear()
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
