import type {
  LayoutSnapshot,
  PresentationFrame,
} from '../../motion'

/** Finds one descendant through stable child-index references. */
export function findElementPath(root: HTMLElement, target: HTMLElement): readonly number[] | undefined {
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
export function resolveElementPath(root: HTMLElement, path: readonly number[]): HTMLElement | undefined {
  let current = root
  for (const index of path) {
    const child = current.children[index]
    if (!(child instanceof HTMLElement)) return undefined
    current = child
  }
  return current
}

/** Finds the single overlay layer owned by this host. */
export function findOverlayLayer(root: Element): HTMLElement | undefined {
  const children = (root as Element & { children?: HTMLCollection }).children
  if (children === undefined) return undefined
  const layer = Array.from(children).find((child) => child.hasAttribute('data-codplay-motion-overlay'))
  return layer instanceof HTMLElement ? layer : undefined
}

/** Finds the nearest direct overlay ancestor that owns one local descendant's presentation. */
export function findNearestOverlayAncestor(
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
export function orderParentFirst(
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
export function resolveParentItemId(
  frame: PresentationFrame,
  naturalLayout: LayoutSnapshot | undefined,
  itemId: string,
): string | undefined {
  return frame.items.get(itemId)?.parentItemId
    ?? naturalLayout?.items.get(itemId)?.parentItemId
}

/** Removes one element in browsers and lightweight DOM doubles. */
export function removeElement(element: Element | undefined): void {
  if (element === undefined) return
  if (typeof (element as Element & { remove?: () => void }).remove === 'function') {
    ;(element as Element & { remove: () => void }).remove()
  } else {
    element.parentElement?.removeChild(element)
  }
}

/** Compares overlay identities without reading the overlay DOM on every frame. */
export function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}
