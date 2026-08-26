import type { HtmlMatrix } from '../../motion/html-types'

/** Mutable DOM resources owned by one reparent presentation item. */
export type OverlayResource = {
  source: HTMLElement
  ghost: HTMLElement
  revision?: string
  lastWidth?: number
  lastHeight?: number
  lastMatrix?: HtmlMatrix
  neutralizedTransformProperties: Set<GhostTransformProperty>
}

/** Resolves the author revision used to decide whether an overlay can be reused. */
export type OverlayRevisionResolver = (itemId: string) => string | undefined

/** CSS transform longhands that may compose with a host-owned pose matrix. */
export type GhostTransformProperty = 'translate' | 'rotate' | 'scale'

/** Cached local transform applied to one visible or cloned target. */
export type LocalTransformResource = Readonly<{
  target: HTMLElement
  matrix: HtmlMatrix
}>
