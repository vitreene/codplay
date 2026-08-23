import { invertMatrix, multiplyMatrix } from '../../ace'
import { ensureHtmlOverlayLayer, worldDeltaToLocalDelta } from '../motion/html-pose'
import {
  composeMotionPose,
  createMotionRootPose,
  decomposeRootMotionPose,
  type LayoutSnapshot,
  type PresentationFrame,
} from '../motion'
import type { HtmlMatrix, HtmlPose } from '../motion/html-types'
import { createHtmlMotionStyleLayer, type HtmlMotionStyleLayer } from './html-motion-style-layer'

type OverlayResource = {
  source: HTMLElement
  ghost: HTMLElement
  revision?: string
  lastWidth?: number
  lastHeight?: number
  lastMatrix?: HtmlMatrix
  neutralizedTransformProperties: Set<GhostTransformProperty>
}

type OverlayRevisionResolver = (itemId: string) => string | undefined
type GhostTransformProperty = 'translate' | 'rotate' | 'scale'
type LocalTransformResource = Readonly<{
  target: HTMLElement
  matrix: HtmlMatrix
}>

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
  private readonly hiddenNaturalCaptureGhosts = new Set<HTMLElement>()
  private overlayOrder: readonly string[] = []
  private hiddenDescendantKey = ''
  private readonly root: Element
  private readonly resolveHandle: (itemId: string) => HTMLElement | undefined
  private readonly transientStyles: HtmlMotionStyleLayer
  private overlayLayer: HTMLElement | undefined
  private elementPathCache = new WeakMap<HTMLElement, WeakMap<HTMLElement, readonly number[] | undefined>>()

  /** Creates one item-indexed overlay resource host. */
  constructor(root: Element, resolveHandle: (itemId: string) => HTMLElement | undefined) {
    this.root = root
    this.resolveHandle = resolveHandle
    this.transientStyles = createHtmlMotionStyleLayer(root)
  }

  /** Removes the host-owned presentation so the visible nodes expose natural geometry. */
  prepareNaturalCapture(): void {
    this.clearHiddenDescendantClones()
    // The next commit must recompute descendant masking. The capture phase
    // deliberately removes those markers from reused ancestor ghosts.
    this.hiddenDescendantKey = ''
    for (const resource of this.resources.values()) this.transientStyles.clearHidden(resource.source)
    for (const resource of this.resources.values()) {
      this.transientStyles.applyHidden(resource.ghost)
      this.hiddenNaturalCaptureGhosts.add(resource.ghost)
    }
    for (const target of this.localTargets.values()) this.transientStyles.clearLocal(target)
    this.localTargets.clear()
    this.localSizes.clear()
    this.localTransforms.clear()
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
    this.hiddenNaturalCaptureGhosts.clear()
    this.overlayOrder = []
    this.hiddenDescendantKey = ''
    removeElement(this.overlayLayer ?? findOverlayLayer(this.root))
    this.overlayLayer = undefined
    this.clearElementPathCache()
  }

  /** Applies exactly the source/overlay representation declared by one frame. */
  commit(
    frame: PresentationFrame,
    resolveRevision?: OverlayRevisionResolver,
    naturalLayout?: LayoutSnapshot,
  ): void {
    if (!isMeasurableElement(this.root)) return
    this.restoreNaturalCaptureGhosts()
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

    const orderedActiveItemIds = orderParentFirst(frame, activeItemIds, naturalLayout)
    for (const itemId of orderedActiveItemIds) {
      this.ensureOverlay(itemId, resolveRevision?.(itemId))
    }
    const overlayLayer = this.resources.size === 0 ? undefined : this.getOverlayLayer()
    if (overlayLayer !== undefined) this.reconcileOverlayOrder(overlayLayer, orderedActiveItemIds)

    const hiddenKey = orderedActiveItemIds.join('\u0000')
    if (hiddenKey !== this.hiddenDescendantKey) {
      this.clearHiddenDescendantClones()
      this.hideIndependentDescendantClones(activeItemIds)
      this.hiddenDescendantKey = hiddenKey
    }

    if (activeItemIds.size === 0) {
      removeElement(this.overlayLayer ?? findOverlayLayer(this.root))
      this.overlayLayer = undefined
      this.overlayOrder = []
      this.hiddenDescendantKey = ''
    }

    const rootPose = naturalLayout?.rootPose ?? createMotionRootPose()
    const overlayInverse = activeItemIds.size === 0
      ? undefined
      : invertMatrix({ ...rootPose.matrix, e: 0, f: 0 })
    if (overlayInverse === null) {
      throw new Error('Motion overlay root matrix is singular.')
    }
    const orderedLocalItemIds = orderParentFirst(frame, localItemIds, naturalLayout)
    const localParentInverses = new Map<string | undefined, HtmlMatrix>()
    for (const itemId of orderedLocalItemIds) this.prepareLocal(itemId, frame, directOverlayItemIds, naturalLayout)
    for (const itemId of orderedLocalItemIds) {
      this.applyLocal(itemId, frame, rootPose, naturalLayout, localParentInverses)
    }

    const overlayPose = rootPose
    for (const itemId of activeItemIds) {
      const item = frame.items.get(itemId)
      const resource = this.resources.get(itemId)
      if (item === undefined || resource === undefined) continue
      const worldPose = composeMotionPose(rootPose, decomposeRootMotionPose(item.pose))
      if (overlayInverse !== undefined) applyGhostPose(resource, overlayPose, overlayInverse, worldPose)
    }
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
    rootPose: HtmlPose,
    naturalLayout: LayoutSnapshot | undefined,
    parentInverses: Map<string | undefined, HtmlMatrix>,
  ): void {
    const target = this.localTargets.get(itemId)
    const item = frame.items.get(itemId)
    if (target === undefined || item === undefined) return
    const worldPose = composeMotionPose(rootPose, decomposeRootMotionPose(item.pose))
    let parentInverse = parentInverses.get(item.parentItemId)
    if (parentInverse === undefined) {
      const parentPresentation = item.parentItemId === undefined
        ? undefined
        : frame.items.get(item.parentItemId)
      const naturalParent = item.parentItemId === undefined
        ? undefined
        : naturalLayout?.items.get(item.parentItemId)
      const parentPose = parentPresentation !== undefined
        ? composeMotionPose(rootPose, decomposeRootMotionPose(parentPresentation.pose))
        : naturalParent !== undefined
          ? composeMotionPose(rootPose, decomposeRootMotionPose(naturalParent.rootPose))
          : rootPose
      const resolvedParentInverse = invertMatrix(poseAffineMatrix(parentPose))
      if (resolvedParentInverse === null) throw new Error('Motion local parent matrix is singular.')
      parentInverse = resolvedParentInverse
      parentInverses.set(item.parentItemId, resolvedParentInverse)
    }
    const naturalOrigin: readonly [number, number] = naturalLayout?.items.get(itemId)?.localPose.origin ?? [0, 0]
    const matrix = resolveLocalPresentationMatrix(naturalOrigin, worldPose, parentInverse)
    const previous = this.localTransforms.get(itemId)
    if (previous?.target === target && sameHtmlMatrix(previous.matrix, matrix)) return
    this.transientStyles.applyLocalTransform(target, matrix)
    this.localTransforms.set(itemId, { target, matrix })
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

  /** Reuses or creates one ghost for the current author materialization. */
  private ensureOverlay(itemId: string, revision: string | undefined): void {
    const source = this.resolveHandle(itemId)
    if (source === undefined) return
    const previous = this.resources.get(itemId)
    if (previous !== undefined && previous.source === source) {
      const unchanged = revision === undefined || previous.revision === revision
      const synchronized = unchanged || this.transientStyles.syncTemplate(source, previous.ghost)
      if (synchronized) {
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
        this.transientStyles.applyHidden(source)
        return
      }
      this.hiddenDescendantKey = ''
      this.release(previous)
    } else if (previous !== undefined) {
      this.hiddenDescendantKey = ''
      this.release(previous)
    }

    const overlayLayer = this.getOverlayLayer()
    const ghost = this.transientStyles.captureTemplate(source)
    this.configureOverlayGhost(ghost, itemId)
    overlayLayer.appendChild(ghost)
    this.transientStyles.applyHidden(source)
    const resource: OverlayResource = {
      source,
      ghost,
      revision,
      neutralizedTransformProperties: new Set(),
    }
    this.resources.set(itemId, resource)
    this.hiddenDescendantKey = ''
    this.clearElementPathCache()
    this.synchronizeGhostTransformProperties(resource)
  }

  /** Returns the one overlay layer owned by this host, creating it only once. */
  private getOverlayLayer(): HTMLElement {
    if (this.overlayLayer !== undefined) return this.overlayLayer
    this.overlayLayer = ensureHtmlOverlayLayer(this.root)
    return this.overlayLayer
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

  /** Reorders existing ghosts only when the resolved parent-first order changed. */
  private reconcileOverlayOrder(layer: HTMLElement, orderedItemIds: readonly string[]): void {
    if (sameStringArray(this.overlayOrder, orderedItemIds)) return
    for (const itemId of orderedItemIds) {
      const resource = this.resources.get(itemId)
      if (resource !== undefined) layer.appendChild(resource.ghost)
    }
    this.overlayOrder = [...orderedItemIds]
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

  /** Restores overlay ghosts after the explicit natural-geometry capture phase. */
  private restoreNaturalCaptureGhosts(): void {
    for (const ghost of this.hiddenNaturalCaptureGhosts) this.transientStyles.clearHidden(ghost)
    this.hiddenNaturalCaptureGhosts.clear()
  }

  /** Restores one source and removes its presentation resource. */
  private release(resource: OverlayResource): void {
    this.transientStyles.clearHidden(resource.source)
    removeElement(resource.ghost)
  }
}

/** Applies one root-localized affine pose to a fixed overlay ghost. */
function applyGhostPose(resource: OverlayResource, root: HtmlPose, rootInverse: HtmlMatrix, pose: HtmlPose): void {
  const localized = localizePose(root, rootInverse, pose)
  if (resource.lastWidth !== pose.localWidth) {
    resource.ghost.style.width = `${pose.localWidth}px`
    resource.lastWidth = pose.localWidth
  }
  if (resource.lastHeight !== pose.localHeight) {
    resource.ghost.style.height = `${pose.localHeight}px`
    resource.lastHeight = pose.localHeight
  }
  if (resource.lastMatrix !== undefined && sameHtmlMatrix(resource.lastMatrix, localized)) return
  resource.ghost.style.transform = `matrix(${localized.a}, ${localized.b}, ${localized.c}, ${localized.d}, ${localized.e}, ${localized.f})`
  resource.lastMatrix = localized
}

/** Reports whether one author transform longhand is at its neutral CSS value. */
function isDefaultTransformPropertyValue(property: GhostTransformProperty, value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (normalized === '' || normalized === 'none') return true
  if (property === 'rotate') return /^0(?:deg|grad|rad|turn)?$/.test(normalized)
  if (property === 'scale') {
    const factors = normalized.split(/\s+/)
    return factors.length <= 3 && factors.every((factor) => factor === '1')
  }
  const translations = normalized.split(/\s+/)
  return translations.length <= 3 && translations.every((part) => /^0(?:[a-z%]+)?$/.test(part))
}

/** Resolves a live-node matrix by subtracting the natural origin in the same logical parent space. */
function resolveLocalPresentationMatrix(
  naturalOrigin: readonly [number, number],
  target: HtmlPose,
  parentInverse: HtmlMatrix,
): HtmlMatrix {
  const targetMatrix = multiplyMatrix(parentInverse, poseAffineMatrix(target))
  return { ...targetMatrix, e: targetMatrix.e - naturalOrigin[0], f: targetMatrix.f - naturalOrigin[1] }
}

/** Converts one pose into the complete affine matrix of its local-box origin. */
function poseAffineMatrix(pose: HtmlPose): HtmlMatrix {
  return { ...pose.matrix, e: pose.origin.x, f: pose.origin.y }
}

/** Compares two affine matrices before rewriting a local presentation slot. */
function sameHtmlMatrix(left: HtmlMatrix, right: HtmlMatrix): boolean {
  return left.a === right.a
    && left.b === right.b
    && left.c === right.c
    && left.d === right.d
    && left.e === right.e
    && left.f === right.f
}

/** Converts one world pose into the overlay root's local coordinates. */
function localizePose(root: HtmlPose, rootInverse: HtmlMatrix, pose: HtmlPose): HtmlMatrix {
  const originDelta = worldDeltaToLocalDelta(
    root.matrix,
    pose.origin.x - root.origin.x,
    pose.origin.y - root.origin.y,
  )
  return {
    ...multiplyMatrix(rootInverse, { ...pose.matrix, e: 0, f: 0 }),
    e: originDelta.x,
    f: originDelta.y,
  }
}

/** Finds one descendant through stable child-index references. */
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

/** Resolves one child-index path in a cloned subtree. */
function resolveElementPath(root: HTMLElement, path: readonly number[]): HTMLElement | undefined {
  let current = root
  for (const index of path) {
    const child = current.children[index]
    if (!(child instanceof HTMLElement)) return undefined
    current = child
  }
  return current
}

/** Finds the single overlay layer owned by this host. */
function findOverlayLayer(root: Element): HTMLElement | undefined {
  const children = (root as Element & { children?: HTMLCollection }).children
  if (children === undefined) return undefined
  const layer = Array.from(children).find((child) => child.hasAttribute('data-codplay-motion-overlay'))
  return layer instanceof HTMLElement ? layer : undefined
}

/** Finds the nearest direct overlay ancestor that owns one local descendant's presentation. */
function findNearestOverlayAncestor(
  frame: PresentationFrame,
  itemId: string,
  overlayItemIds: ReadonlySet<string>,
  naturalLayout?: LayoutSnapshot,
): string | undefined {
  const visited = new Set<string>()
  let parentItemId = resolveParentItemId(frame, naturalLayout, itemId)
  while (parentItemId !== undefined) {
    if (visited.has(parentItemId)) throw new Error(`Motion presentation cycle detected: ${parentItemId}`)
    visited.add(parentItemId)
    if (overlayItemIds.has(parentItemId)) return parentItemId
    parentItemId = resolveParentItemId(frame, naturalLayout, parentItemId)
  }
  return undefined
}

/** Orders one selected frame subset from ancestors to descendants. */
function orderParentFirst(
  frame: PresentationFrame,
  selected: ReadonlySet<string>,
  naturalLayout?: LayoutSnapshot,
): readonly string[] {
  const ordered: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  for (const itemId of selected) visit(itemId)
  return ordered

  function visit(itemId: string): void {
    if (visited.has(itemId)) return
    if (visiting.has(itemId)) throw new Error(`Motion presentation cycle detected: ${itemId}`)
    visiting.add(itemId)
    const parentItemId = resolveParentItemId(frame, naturalLayout, itemId)
    if (parentItemId !== undefined && selected.has(parentItemId)) visit(parentItemId)
    visiting.delete(itemId)
    visited.add(itemId)
    ordered.push(itemId)
  }
}

/** Resolves a selected item's parent from the active frame or natural layout. */
function resolveParentItemId(
  frame: PresentationFrame,
  naturalLayout: LayoutSnapshot | undefined,
  itemId: string,
): string | undefined {
  return frame.items.get(itemId)?.parentItemId
    ?? naturalLayout?.items.get(itemId)?.parentItemId
}

/** Removes one element in browsers and lightweight DOM doubles. */
function removeElement(element: Element | undefined): void {
  if (element === undefined) return
  if (typeof (element as Element & { remove?: () => void }).remove === 'function') {
    ;(element as Element & { remove: () => void }).remove()
  } else {
    element.parentElement?.removeChild(element)
  }
}

/** Compares overlay identities without reading the overlay DOM on every frame. */
function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

/** Narrows one root to a browser-measurable element. */
function isMeasurableElement(value: unknown): value is Element {
  return typeof Element !== 'undefined'
    && value instanceof Element
    && value.ownerDocument !== undefined
    && typeof (value as Element & { getBoundingClientRect?: unknown }).getBoundingClientRect === 'function'
}
