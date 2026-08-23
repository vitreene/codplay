import { invertMatrix, multiplyMatrix } from '../../ace'
import { captureHtmlPose, ensureHtmlOverlayLayer, worldDeltaToLocalDelta } from '../motion/html-pose'
import { composeMotionPose, decomposeRootMotionPose, type PresentationFrame } from '../motion'
import type { HtmlMatrix, HtmlPose } from '../motion/html-types'
import { createHtmlMotionStyleLayer, type HtmlMotionStyleLayer } from './html-motion-style-layer'

type OverlayResource = {
  source: HTMLElement
  ghost: HTMLElement
  revision?: string
  neutralizedTransformProperties: Set<GhostTransformProperty>
}

type OverlayRevisionResolver = (itemId: string) => string | undefined
type GhostTransformProperty = 'translate' | 'rotate' | 'scale'

/** Commits one complete motion frame without owning temporal state. */
export class HtmlMotionPresentationHost {
  private readonly resources = new Map<string, OverlayResource>()
  private readonly localSources = new Map<string, HTMLElement>()
  private readonly hiddenDescendantClones = new Set<HTMLElement>()
  private readonly root: Element
  private readonly resolveHandle: (itemId: string) => HTMLElement | undefined
  private readonly transientStyles: HtmlMotionStyleLayer

  /** Creates one item-indexed overlay resource host. */
  constructor(root: Element, resolveHandle: (itemId: string) => HTMLElement | undefined) {
    this.root = root
    this.resolveHandle = resolveHandle
    this.transientStyles = createHtmlMotionStyleLayer(root)
  }

  /** Removes the host-owned presentation so the visible nodes expose natural geometry. */
  prepareNaturalCapture(): void {
    this.clearHiddenDescendantClones()
    for (const resource of this.resources.values()) this.transientStyles.clearHidden(resource.source)
    for (const source of this.localSources.values()) this.transientStyles.clearLocal(source)
    this.localSources.clear()
  }

  /** Releases every transient presentation resource, including overlay DOM. */
  clearTransientPresentation(): void {
    this.prepareNaturalCapture()
    for (const resource of this.resources.values()) this.release(resource)
    this.resources.clear()
    removeElement(findOverlayLayer(this.root))
  }

  /** Applies exactly the source/overlay representation declared by one frame. */
  commit(frame: PresentationFrame, resolveRevision?: OverlayRevisionResolver): void {
    if (!isMeasurableElement(this.root)) return
    const directOverlayItemIds = new Set([...frame.items.values()]
      .filter((item) => item.representation === 'reparent')
      .map((item) => item.itemId))
    const activeItemIds = new Set(directOverlayItemIds)
    const localItemIds = new Set<string>()
    for (const item of frame.items.values()) {
      if (item.representation !== 'local') continue
      if (hasOverlayAncestor(frame, item.itemId, directOverlayItemIds)) activeItemIds.add(item.itemId)
      else localItemIds.add(item.itemId)
    }

    for (const [itemId, source] of [...this.localSources]) {
      if (localItemIds.has(itemId)) continue
      this.transientStyles.clearLocal(source)
      this.localSources.delete(itemId)
    }

    for (const [itemId, resource] of [...this.resources]) {
      if (activeItemIds.has(itemId)) continue
      this.release(resource)
      this.resources.delete(itemId)
    }

    const rootPose = captureHtmlPose(this.root)
    const orderedLocalItemIds = orderParentFirst(frame, localItemIds)
    for (const itemId of orderedLocalItemIds) this.prepareLocal(itemId, frame)
    for (const itemId of orderedLocalItemIds) this.applyLocal(itemId, frame, rootPose)

    const orderedActiveItemIds = orderParentFirst(frame, activeItemIds)
    for (const itemId of orderedActiveItemIds) {
      this.ensureOverlay(itemId, resolveRevision?.(itemId))
    }
    const overlayLayer = this.resources.size === 0 ? undefined : ensureHtmlOverlayLayer(this.root)
    if (overlayLayer !== undefined) {
      for (const itemId of orderedActiveItemIds) {
        const resource = this.resources.get(itemId)
        if (resource !== undefined) overlayLayer.appendChild(resource.ghost)
      }
    }
    this.clearHiddenDescendantClones()
    this.hideIndependentDescendantClones(activeItemIds)

    if (activeItemIds.size === 0) removeElement(findOverlayLayer(this.root))
    const presentationOverlayLayer = activeItemIds.size === 0 ? undefined : overlayLayer ?? findOverlayLayer(this.root)
    const overlayPose = presentationOverlayLayer === undefined ? rootPose : captureHtmlPose(presentationOverlayLayer)
    for (const itemId of activeItemIds) {
      const item = frame.items.get(itemId)
      const resource = this.resources.get(itemId)
      if (item === undefined || resource === undefined) continue
      const worldPose = composeMotionPose(rootPose, decomposeRootMotionPose(item.pose))
      applyGhostPose(resource.ghost, overlayPose, worldPose)
    }
  }

  /** Releases every overlay resource and restores all materialized sources. */
  destroy(): void {
    this.clearTransientPresentation()
  }

  /** Applies every layout-affecting local size before any local transform is solved. */
  private prepareLocal(itemId: string, frame: PresentationFrame): void {
    const source = this.resolveHandle(itemId)
    const item = frame.items.get(itemId)
    if (source === undefined || item === undefined) return
    const previous = this.localSources.get(itemId)
    if (previous !== undefined && previous !== source) this.transientStyles.clearLocal(previous)
    this.transientStyles.clearHidden(source)
    this.transientStyles.clearLocal(source)
    this.transientStyles.applyLocalSize(source, item.pose.localWidth, item.pose.localHeight)
    this.localSources.set(itemId, source)
  }

  /** Presents one local item in the coordinate system of its currently rendered parent. */
  private applyLocal(itemId: string, frame: PresentationFrame, rootPose: HtmlPose): void {
    const source = this.localSources.get(itemId)
    const item = frame.items.get(itemId)
    if (source === undefined || item === undefined) return
    const worldPose = composeMotionPose(rootPose, decomposeRootMotionPose(item.pose))
    const naturalPose = captureHtmlPose(source)
    const parentPose = source.parentElement === null ? undefined : captureHtmlPose(source.parentElement)
    this.transientStyles.applyLocalTransform(source, resolveLocalPresentationMatrix(naturalPose, worldPose, parentPose))
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
        this.configureOverlayGhost(previous.ghost, itemId)
        this.synchronizeGhostTransformProperties(previous)
        this.transientStyles.applyHidden(source)
        return
      }
      this.release(previous)
    } else if (previous !== undefined) {
      this.release(previous)
    }

    const overlayLayer = ensureHtmlOverlayLayer(this.root)
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
    this.synchronizeGhostTransformProperties(resource)
  }

  /** Restores the fixed overlay properties after an in-place template sync. */
  private configureOverlayGhost(ghost: HTMLElement, itemId: string): void {
    ghost.setAttribute('data-codplay-motion-item', itemId)
    ghost.style.position = 'absolute'
    ghost.style.left = '0px'
    ghost.style.top = '0px'
    ghost.style.margin = '0'
    ghost.style.pointerEvents = 'none'
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

  /** Hides an independently presented item inside every active ancestor clone. */
  private hideIndependentDescendantClones(activeItemIds: ReadonlySet<string>): void {
    for (const descendantId of activeItemIds) {
      const descendantSource = this.resolveHandle(descendantId)
      if (descendantSource === undefined) continue
      for (const [ancestorId, ancestor] of this.resources) {
        if (ancestorId === descendantId) continue
        const path = findElementPath(ancestor.source, descendantSource)
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
    this.transientStyles.clearHidden(resource.source)
    removeElement(resource.ghost)
  }
}

/** Applies one root-localized affine pose to a fixed overlay ghost. */
function applyGhostPose(ghost: HTMLElement, root: HtmlPose, pose: HtmlPose): void {
  const localized = localizePose(root, pose)
  ghost.style.width = `${pose.localWidth}px`
  ghost.style.height = `${pose.localHeight}px`
  ghost.style.minWidth = '0'
  ghost.style.minHeight = '0'
  ghost.style.boxSizing = 'border-box'
  ghost.style.transformOrigin = '0 0'
  ghost.style.transform = `matrix(${localized.a}, ${localized.b}, ${localized.c}, ${localized.d}, ${localized.e}, ${localized.f})`
  ghost.style.zIndex = '20'
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

/** Resolves a live-node CSS matrix from one root-resolved graph pose. */
function resolveLocalPresentationMatrix(natural: HtmlPose, target: HtmlPose, parent: HtmlPose | undefined): HtmlMatrix {
  const parentMatrix = parent === undefined
    ? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    : poseAffineMatrix(parent)
  const parentInverse = invertMatrix(parentMatrix)
  if (parentInverse === null) throw new Error('Motion local parent matrix is singular.')
  const targetMatrix = multiplyMatrix(parentInverse, poseAffineMatrix(target))
  const layoutOffset = natural.layoutOffset ?? { x: 0, y: 0 }
  return { ...targetMatrix, e: targetMatrix.e - layoutOffset.x, f: targetMatrix.f - layoutOffset.y }
}

/** Converts one pose into the complete affine matrix of its local-box origin. */
function poseAffineMatrix(pose: HtmlPose): HtmlMatrix {
  return { ...pose.matrix, e: pose.origin.x, f: pose.origin.y }
}

/** Converts one world pose into the overlay root's local coordinates. */
function localizePose(root: HtmlPose, pose: HtmlPose): HtmlMatrix {
  const originDelta = worldDeltaToLocalDelta(
    root.matrix,
    pose.origin.x - root.origin.x,
    pose.origin.y - root.origin.y,
  )
  const inverse = invertMatrix({ ...root.matrix, e: 0, f: 0 })
  if (inverse === null) throw new Error('Motion overlay root matrix is singular.')
  return {
    ...multiplyMatrix(inverse, { ...pose.matrix, e: 0, f: 0 }),
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

/** Reports whether an active local item is visually contained by an overlay ancestor. */
function hasOverlayAncestor(
  frame: PresentationFrame,
  itemId: string,
  overlayItemIds: ReadonlySet<string>,
): boolean {
  const visited = new Set<string>()
  let parentItemId = frame.items.get(itemId)?.parentItemId
  while (parentItemId !== undefined) {
    if (visited.has(parentItemId)) throw new Error(`Motion presentation cycle detected: ${parentItemId}`)
    visited.add(parentItemId)
    if (overlayItemIds.has(parentItemId)) return true
    parentItemId = frame.items.get(parentItemId)?.parentItemId
  }
  return false
}

/** Orders one selected frame subset from ancestors to descendants. */
function orderParentFirst(frame: PresentationFrame, selected: ReadonlySet<string>): readonly string[] {
  const ordered: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  for (const itemId of selected) visit(itemId)
  return ordered

  function visit(itemId: string): void {
    if (visited.has(itemId)) return
    if (visiting.has(itemId)) throw new Error(`Motion presentation cycle detected: ${itemId}`)
    visiting.add(itemId)
    const parentItemId = frame.items.get(itemId)?.parentItemId
    if (parentItemId !== undefined && selected.has(parentItemId)) visit(parentItemId)
    visiting.delete(itemId)
    visited.add(itemId)
    ordered.push(itemId)
  }
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

/** Narrows one root to a browser-measurable element. */
function isMeasurableElement(value: unknown): value is Element {
  return typeof Element !== 'undefined'
    && value instanceof Element
    && value.ownerDocument !== undefined
    && typeof (value as Element & { getBoundingClientRect?: unknown }).getBoundingClientRect === 'function'
}
