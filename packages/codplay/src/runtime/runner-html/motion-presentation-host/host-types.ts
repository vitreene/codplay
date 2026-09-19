import type { LayoutSnapshot, PresentationFrame } from '../../motion'

/** Resolves the DOM container recorded by one HTML layout snapshot. */
export type HtmlMotionRootResolver = (rootKey: string | undefined) => Element | undefined

/** Identity used to retain one presentation layer per local motion root. */
export type MotionRootToken = string | Element

/** Mutable resources retained for one local motion root. */
export type MotionRootState = {
  root: Element
  key?: string
  overlayLayer?: HTMLElement
  overlayOrder: readonly string[]
}

/** Resolves the rendered target for one local presentation item. */
export type LocalTargetResolver = (
  itemId: string,
  frame: PresentationFrame,
  directOverlayItemIds: ReadonlySet<string>,
  naturalLayout?: LayoutSnapshot,
) => HTMLElement | undefined

/** Resolves the source node of an active reparent presentation. */
export type OverlaySourceResolver = (itemId: string) => HTMLElement | undefined
