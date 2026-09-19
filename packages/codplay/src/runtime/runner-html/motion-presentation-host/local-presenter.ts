import { invertMatrix } from 'ace'
import {
  composeMotionPose,
  createMotionRootPose,
  decomposeRootMotionPose,
  type ItemPresentation,
  type LayoutItemSnapshot,
  type LayoutSnapshot,
  type PresentationFrame,
} from '../../motion'
import type { HtmlMatrix, HtmlPose } from '../../motion/html-types'
import type { HtmlMotionStyleLayer } from '../motion-style-layer'
import {
  poseAffineMatrix,
  resolveLocalPresentationMatrix,
  sameHtmlMatrix,
} from '../motion-presentation'
import type { LocalTransformResource } from '../motion-presentation'
import type {
  LocalTargetResolver,
  OverlaySourceResolver,
} from './host-types'

/** Applies local FLIP poses and preserves natural dimensions for one frame. */
export class LocalMotionPresenter {
  private readonly localTargets = new Map<string, HTMLElement>()
  private readonly localSizes = new Map<string, Readonly<{
    target: HTMLElement
    width: number
    height: number
  }>>()
  private readonly localTransforms = new Map<string, LocalTransformResource>()
  private readonly preservedSizes = new Map<string, Readonly<{
    target: HTMLElement
    width?: number
    height?: number
  }>>()
  private readonly transientStyles: HtmlMotionStyleLayer

  constructor(transientStyles: HtmlMotionStyleLayer) {
    this.transientStyles = transientStyles
  }

  /** Restores all local contributions before a natural geometry capture. */
  prepareNaturalCapture(): void {
    for (const target of this.localTargets.values()) this.transientStyles.clearLocal(target)
    this.localTargets.clear()
    this.localSizes.clear()
    this.localTransforms.clear()
    for (const preserved of this.preservedSizes.values()) {
      this.transientStyles.clearPreservedSize(preserved.target)
    }
    this.preservedSizes.clear()
  }

  /** Releases local contributions for selected items or for the complete host. */
  clearTransientPresentation(itemIds?: ReadonlySet<string>): void {
    if (itemIds === undefined) {
      this.prepareNaturalCapture()
      return
    }

    for (const itemId of itemIds) {
      const target = this.localTargets.get(itemId)
      if (target !== undefined && !this.isLocalTargetStillUsed(itemId, target)) {
        this.transientStyles.clearLocal(target)
      }
      this.localTargets.delete(itemId)
      this.localSizes.delete(itemId)
      this.localTransforms.delete(itemId)
      const preserved = this.preservedSizes.get(itemId)
      if (preserved !== undefined) {
        this.transientStyles.clearPreservedSize(preserved.target)
        this.preservedSizes.delete(itemId)
      }
    }
  }

  /** Removes local state for items no longer represented by the current frame. */
  removeInactive(activeItemIds: ReadonlySet<string>): void {
    for (const [itemId, target] of [...this.localTargets]) {
      if (activeItemIds.has(itemId)) continue
      this.transientStyles.clearLocal(target)
      this.localTargets.delete(itemId)
      this.localSizes.delete(itemId)
      this.localTransforms.delete(itemId)
    }
  }

  /** Applies local sizes and transforms in parent-first order. */
  commit(
    frame: PresentationFrame,
    orderedItemIds: readonly string[],
    directOverlayItemIds: ReadonlySet<string>,
    naturalLayout: LayoutSnapshot | undefined,
    resolveTarget: LocalTargetResolver,
    resolveOverlaySource: OverlaySourceResolver,
  ): void {
    for (const itemId of orderedItemIds) {
      const item = frame.items.get(itemId)
      const target = item === undefined
        ? undefined
        : resolveTarget(itemId, frame, directOverlayItemIds, naturalLayout)
      if (item !== undefined && target !== undefined) this.prepare(itemId, item, target)
    }
    this.syncPreservedSizes(
      frame,
      directOverlayItemIds,
      naturalLayout,
      resolveTarget,
      resolveOverlaySource,
    )
    const parentInverses = new Map<string, HtmlMatrix>()
    const parentPoses = new Map<string, HtmlPose>()
    for (const itemId of orderedItemIds) {
      const item = frame.items.get(itemId)
      const target = this.localTargets.get(itemId)
      if (item !== undefined && target !== undefined) {
        this.apply(itemId, item, target, frame, naturalLayout, parentInverses, parentPoses)
      }
    }
  }

  /** Applies every layout-affecting local size before a local transform. */
  private prepare(itemId: string, item: ItemPresentation, target: HTMLElement): void {
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

  /** Reserves natural destination dimensions for active preserve policies. */
  private syncPreservedSizes(
    frame: PresentationFrame,
    directOverlayItemIds: ReadonlySet<string>,
    naturalLayout: LayoutSnapshot | undefined,
    resolveTarget: LocalTargetResolver,
    resolveOverlaySource: OverlaySourceResolver,
  ): void {
    for (const [itemId, current] of this.preservedSizes) {
      const next = this.resolvePreservedSize(
        frame.items.get(itemId),
        frame,
        directOverlayItemIds,
        naturalLayout,
        resolveTarget,
        resolveOverlaySource,
      )
      if (next === undefined) {
        this.transientStyles.clearPreservedSize(current.target)
        this.preservedSizes.delete(itemId)
        continue
      }
      if (next.target === current.target
        && next.width === current.width
        && next.height === current.height) continue
      this.transientStyles.clearPreservedSize(current.target)
      this.transientStyles.applyPreservedSize(next.target, next.width, next.height)
      this.preservedSizes.set(itemId, next)
    }

    for (const item of frame.items.values()) {
      if (this.preservedSizes.has(item.itemId)) continue
      const next = this.resolvePreservedSize(
        item,
        frame,
        directOverlayItemIds,
        naturalLayout,
        resolveTarget,
        resolveOverlaySource,
      )
      if (next === undefined) continue
      this.transientStyles.applyPreservedSize(next.target, next.width, next.height)
      this.preservedSizes.set(item.itemId, next)
    }
  }

  /** Resolves one active preserve reservation from captured natural dimensions. */
  private resolvePreservedSize(
    item: ItemPresentation | undefined,
    frame: PresentationFrame,
    directOverlayItemIds: ReadonlySet<string>,
    naturalLayout: LayoutSnapshot | undefined,
    resolveTarget: LocalTargetResolver,
    resolveOverlaySource: OverlaySourceResolver,
  ): Readonly<{ target: HTMLElement; width?: number; height?: number }> | undefined {
    if (item === undefined || item.resize === undefined) return undefined
    // Keep the reservation on the final active frame. The segment is absent
    // on the following frame, when natural CSS layout can be restored without
    // moving the already materialized target.
    if (item.progress >= 1 && item.activeSegmentId === undefined) return undefined
    const naturalItem = naturalLayout?.items.get(item.itemId)
    const width = item.resize.width === 'preserve'
      ? naturalItem?.localPose.width ?? item.pose.localWidth
      : undefined
    const height = item.resize.height === 'preserve'
      ? naturalItem?.localPose.height ?? item.pose.localHeight
      : undefined
    if (width === undefined && height === undefined) return undefined
    const target = item.representation === 'reparent' && directOverlayItemIds.has(item.itemId)
      ? resolveOverlaySource(item.itemId)
      : resolveTarget(item.itemId, frame, directOverlayItemIds, naturalLayout)
    if (target === undefined) return undefined
    return { target, ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }) }
  }

  /** Presents one local item in the coordinate system of its rendered parent. */
  private apply(
    itemId: string,
    item: ItemPresentation,
    target: HTMLElement,
    frame: PresentationFrame,
    naturalLayout: LayoutSnapshot | undefined,
    parentInverses: Map<string, HtmlMatrix>,
    parentPoses: Map<string, HtmlPose>,
  ): void {
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
    // The host-owned inline contribution replaces the authored transform entirely.
    // Subtract only the untransformed layout slot captured for this item;
    // subtracting localPose.origin would apply the authored transform twice.
    const naturalLayoutOrigin: readonly [number, number] = naturalItem?.localPose.layoutOrigin ?? [0, 0]
    if (item.targetReflow === true && item.direct !== true) {
      // A reflowed container keeps its CSS position. Its interpolated size is
      // already applied above, so the authored layout can resolve its
      // corresponding position without a second FLIP translation.
      const previous = this.localTransforms.get(itemId)
      if (previous !== undefined) {
        this.transientStyles.clearLocal(previous.target)
        this.localTransforms.delete(itemId)
        this.transientStyles.applyLocalSize(target, item.pose.localWidth, item.pose.localHeight)
      }
      return
    }
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

  /** Resolves the world pose of the local root used by one frame item. */
  private resolveItemRootPose(item: ItemPresentation, naturalLayout?: LayoutSnapshot): HtmlPose {
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

  /** Checks whether a local target is still used by another presented item. */
  private isLocalTargetStillUsed(itemId: string, target: HTMLElement): boolean {
    for (const [otherItemId, otherTarget] of this.localTargets) {
      if (otherItemId !== itemId && otherTarget === target) return true
    }
    return false
  }
}
