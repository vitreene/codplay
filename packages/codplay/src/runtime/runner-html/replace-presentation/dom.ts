import { markHtmlTransientNode } from '../transient-node'
import { nextReplacePresentationId } from './ids'


export type SnapshotGeometry = Readonly<{ left: number; top: number; width: number; height: number }>


/** Clones an HTML snapshot and preserves raster content from any generated canvases. */
export function cloneSnapshotNode(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true)
  if (!isHtmlElement(clone)) return source.cloneNode(true) as HTMLElement
  const sourceCanvases = [
    ...(source.tagName.toLowerCase() === 'canvas' ? [source as HTMLCanvasElement] : []),
    ...Array.from(source.querySelectorAll<HTMLCanvasElement>('canvas')),
  ]
  const cloneCanvases = [
    ...(clone.tagName.toLowerCase() === 'canvas' ? [clone as HTMLCanvasElement] : []),
    ...Array.from(clone.querySelectorAll<HTMLCanvasElement>('canvas')),
  ]
  for (let index = 0; index < sourceCanvases.length; index += 1) {
    const sourceCanvas = sourceCanvases[index]
    const cloneCanvas = cloneCanvases[index]
    if (sourceCanvas === undefined || cloneCanvas === undefined) continue
    cloneCanvas.width = sourceCanvas.width
    cloneCanvas.height = sourceCanvas.height
    const context = cloneCanvas.getContext('2d')
    if (context !== null) {
      try {
        context.drawImage(sourceCanvas, 0, 0)
      } catch {
        return clone
      }
    }
  }
  return clone
}


/** Captures the currently visible outgoing/incoming DOM views as one detached composite. */
export function createPresentationComposite(snapshots: readonly HTMLElement[]): HTMLElement | undefined {
  if (snapshots.length === 0) return undefined
  const composite = document.createElement('div')
  composite.id = `codplay-replace-interruption-${nextReplacePresentationId()}`
  composite.setAttribute('aria-hidden', 'true')
  markHtmlTransientNode(composite)
  Object.assign(composite.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
  })
  for (const source of snapshots) {
    const snapshot = cloneSnapshotNode(source)
    snapshot.style.position = 'absolute'
    snapshot.style.left = '0'
    snapshot.style.top = '0'
    snapshot.style.width = '100%'
    snapshot.style.height = '100%'
    snapshot.style.margin = '0'
    snapshot.style.boxSizing = 'border-box'
    composite.append(snapshot)
  }
  return composite
}


/** Returns the cloned content root nested inside one motion snapshot wrapper. */
export function getMotionContentRoot(snapshot: HTMLElement): HTMLElement | undefined {
  const child = snapshot.firstElementChild
  return isHtmlElement(child) ? child : undefined
}


/** Creates a temporary clipping layer that confines slot views to their host rectangle. */
export function createPresentationLayer(root: HTMLElement, zIndex: string): HTMLElement {
  const layer = document.createElement('div')
  markHtmlTransientNode(layer)
  layer.setAttribute('data-codplay-replace-layer', '')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.position = 'absolute'
  layer.style.boxSizing = 'border-box'
  layer.style.margin = '0'
  layer.style.pointerEvents = 'none'
  layer.style.overflow = 'hidden'
  layer.style.isolation = 'isolate'
  layer.style.zIndex = zIndex
  const rootStyles = getComputedStyle(root)
  layer.style.borderRadius = rootStyles.borderRadius
  layer.style.clipPath = rootStyles.clipPath
  return layer
}


/** Repositions the clipping layer over the current slot rectangle. */
export function positionPresentationLayer(layer: HTMLElement, root: HTMLElement, parent: HTMLElement): void {
  const offset = getOffsetFromParent(root, parent)
  layer.style.left = `${offset.left}px`
  layer.style.top = `${offset.top}px`
  layer.style.width = `${offset.width}px`
  layer.style.height = `${offset.height}px`
}


/** Positions one temporary view inside its clipping layer or over its media root. */
export function positionSnapshot(
  snapshot: HTMLElement,
  root: HTMLElement,
  parent: HTMLElement,
  layer: HTMLElement | undefined,
  overflow: 'hidden' | 'visible' = 'hidden',
  geometry?: SnapshotGeometry,
): void {
  snapshot.style.position = 'absolute'
  snapshot.style.boxSizing = 'border-box'
  snapshot.style.margin = '0'
  snapshot.style.pointerEvents = 'none'
  snapshot.style.overflow = overflow
  if (layer === undefined) {
    const offset = geometry ?? getOffsetFromParent(root, parent)
    snapshot.style.left = `${offset.left}px`
    snapshot.style.top = `${offset.top}px`
    snapshot.style.width = `${offset.width}px`
    snapshot.style.height = `${offset.height}px`
    return
  }
  snapshot.style.left = '0'
  snapshot.style.top = '0'
  snapshot.style.width = '100%'
  snapshot.style.height = '100%'
}


/** Measures the slot relative to its parent, accounting for scrolling and scale. */
export function getOffsetFromParent(
  root: HTMLElement,
  parent: HTMLElement,
  widthSafetyMargin = 0,
): Readonly<{ left: number; top: number; width: number; height: number }> {
  const rootRect = root.getBoundingClientRect()
  const parentRect = parent.getBoundingClientRect()
  const parentLayoutWidth = getUntransformedBorderBoxSize(parent, 'width')
  const parentLayoutHeight = getUntransformedBorderBoxSize(parent, 'height')
  const scaleX = parentLayoutWidth === 0 ? 1 : parentRect.width / parentLayoutWidth
  const scaleY = parentLayoutHeight === 0 ? 1 : parentRect.height / parentLayoutHeight
  const measuredWidth = rootRect.width || root.offsetWidth
  const width = measuredWidth === 0
    ? 0
    : measuredWidth / (scaleX || 1) + widthSafetyMargin
  return {
    left: (rootRect.left - parentRect.left) / (scaleX || 1) + parent.scrollLeft - parent.clientLeft,
    top: (rootRect.top - parentRect.top) / (scaleY || 1) + parent.scrollTop - parent.clientTop,
    width,
    height: (rootRect.height || root.offsetHeight) / (scaleY || 1),
  }
}


/** Returns one untransformed border-box dimension without offset-size rounding. */
export function getUntransformedBorderBoxSize(
  element: HTMLElement,
  dimension: 'width' | 'height',
): number {
  const styles = getComputedStyle(element)
  const computedSize = Number.parseFloat(styles[dimension])
  if (!Number.isFinite(computedSize) || computedSize < 0) {
    return dimension === 'width' ? element.offsetWidth : element.offsetHeight
  }
  if (styles.boxSizing === 'border-box') return computedSize

  const padding = dimension === 'width'
    ? parsePixelSize(styles.paddingLeft) + parsePixelSize(styles.paddingRight)
    : parsePixelSize(styles.paddingTop) + parsePixelSize(styles.paddingBottom)
  const border = dimension === 'width'
    ? parsePixelSize(styles.borderLeftWidth) + parsePixelSize(styles.borderRightWidth)
    : parsePixelSize(styles.borderTopWidth) + parsePixelSize(styles.borderBottomWidth)
  return computedSize + padding + border
}


/** Reads a CSS pixel length while treating non-numeric values as zero. */
export function parsePixelSize(value: string): number {
  const size = Number.parseFloat(value)
  return Number.isFinite(size) ? size : 0
}


/** Removes identities and inline handlers from the temporary presentation copy. */
export function sanitizeSnapshot(snapshot: HTMLElement, view: 'outgoing' | 'incoming'): void {
  markHtmlTransientNode(snapshot)
  snapshot.setAttribute('data-codplay-replace-view', view)
  for (const element of [snapshot, ...Array.from(snapshot.querySelectorAll<HTMLElement>('*'))]) {
    if (element.closest('[data-codplay-replace-mask-host]') === null) element.removeAttribute('id')
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name)
    }
    element.setAttribute('aria-hidden', 'true')
    element.style.pointerEvents = 'none'
  }
}


/** Removes one snapshot only if it remains attached to its presentation parent. */
export function removeSnapshot(snapshot: HTMLElement, parent: HTMLElement): void {
  if (snapshot.parentNode === parent) parent.removeChild(snapshot)
}


/** Restores the parent positioning contribution left by the snapshots. */
export function restoreParentPosition(parent: HTMLElement, originalPosition: string): void {
  if (parent.style.position === 'relative') parent.style.position = originalPosition
}


/** Narrows the materialized root to the HTML element contract used by this surface. */
export function isHtmlElement(value: unknown): value is HTMLElement {
  return typeof globalThis.HTMLElement !== 'undefined' && value instanceof globalThis.HTMLElement
}
