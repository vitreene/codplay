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
  const selectedOrder = new Map([...selected].map((itemId, index) => [itemId, index]))
  const candidates = [...selected].sort((left, right) => (
    comparePlacementPath(frame, naturalLayout, left, right)
      || (selectedOrder.get(left)! - selectedOrder.get(right)!)
  ))
  for (const itemId of candidates) visit(itemId)
  return ordered

  function visit(itemId: string): void {
    if (visited.has(itemId)) return
    if (visiting.has(itemId)) throw new Error(`Motion presentation cycle detected: ${itemId}`)
    visiting.add(itemId)
    const ancestorPath = new Set<string>()
    let parentItemId = resolveParentItemId(frame, naturalLayout, itemId)
    while (parentItemId !== undefined && !selected.has(parentItemId)) {
      if (ancestorPath.has(parentItemId)) {
        throw new Error(`Motion presentation cycle detected: ${parentItemId}`)
      }
      ancestorPath.add(parentItemId)
      parentItemId = resolveParentItemId(frame, naturalLayout, parentItemId)
    }
    if (parentItemId !== undefined) visit(parentItemId)
    visiting.delete(itemId)
    visited.add(itemId)
    ordered.push(itemId)
  }
}

/**
 * Orders independent reparent overlays by their structural paint constraints.
 *
 * A mover is above both endpoint branches so it remains visible. Its target
 * placement still anchors comparisons with unrelated overlays, which keeps a
 * sibling already above that target above the mover as well.
 */
export function orderOverlayStack(
  frame: PresentationFrame,
  selected: ReadonlySet<string>,
  naturalLayout?: LayoutSnapshot,
): readonly string[] {
  const selectedOrder = new Map([...selected].map((itemId, index) => [itemId, index]))
  const predecessors = new Map<string, Set<string>>()
  const successors = new Map<string, Set<string>>()
  for (const itemId of selected) {
    predecessors.set(itemId, new Set())
    successors.set(itemId, new Set())
  }

  for (const itemId of selected) {
    const item = frame.items.get(itemId)
    const endpointAncestorItemIds = item?.overlayStacking === undefined
      ? resolveSelectedAncestors(
          frame,
          naturalLayout,
          selected,
          resolveParentItemId(frame, naturalLayout, itemId),
        )
      : [
          ...item.overlayStacking.sourceAncestorItemIds,
          ...item.overlayStacking.targetAncestorItemIds,
        ]
    const seenAncestors = new Set<string>()
    for (const ancestorItemId of endpointAncestorItemIds) {
      if (!selected.has(ancestorItemId) || seenAncestors.has(ancestorItemId)) continue
      seenAncestors.add(ancestorItemId)
      addPredecessor(ancestorItemId, itemId)
    }
  }

  const ready = [...selected].filter((itemId) => predecessors.get(itemId)!.size === 0)
  const ordered: string[] = []
  while (ready.length > 0) {
    ready.sort((left, right) => (
      comparePlacementPath(frame, naturalLayout, left, right, resolveOverlayPlacement)
        || (selectedOrder.get(left)! - selectedOrder.get(right)!)
    ))
    const itemId = ready.shift()!
    ordered.push(itemId)
    for (const successorItemId of successors.get(itemId)!) {
      const successorPredecessors = predecessors.get(successorItemId)!
      successorPredecessors.delete(itemId)
      if (successorPredecessors.size === 0) ready.push(successorItemId)
    }
  }

  if (ordered.length !== selected.size) {
    throw new Error('Motion overlay stacking cycle detected.')
  }
  return ordered

  /** Adds one paint-order edge only once. */
  function addPredecessor(predecessorItemId: string, itemId: string): void {
    if (predecessorItemId === itemId) {
      throw new Error(`Motion overlay stacking cycle detected: ${itemId}`)
    }
    const itemPredecessors = predecessors.get(itemId)!
    if (itemPredecessors.has(predecessorItemId)) return
    itemPredecessors.add(predecessorItemId)
    successors.get(predecessorItemId)!.add(itemId)
  }
}

/** Resolves a selected item's parent from the active frame or natural layout. */
export function resolveParentItemId(
  frame: PresentationFrame,
  naturalLayout: LayoutSnapshot | undefined,
  itemId: string,
): string | undefined {
  const frameItem = frame.items.get(itemId)
  if (frameItem !== undefined) return frameItem.parentItemId
  return naturalLayout?.items.get(itemId)?.parentItemId
}

/** Compares complete placement paths while preserving list order for siblings. */
function comparePlacementPath(
  frame: PresentationFrame,
  naturalLayout: LayoutSnapshot | undefined,
  leftItemId: string,
  rightItemId: string,
  resolvePlacementNode: PlacementResolver = resolvePlacement,
): number {
  const leftPath = resolvePlacementPath(frame, naturalLayout, leftItemId, resolvePlacementNode)
  const rightPath = resolvePlacementPath(frame, naturalLayout, rightItemId, resolvePlacementNode)
  const commonLength = Math.min(leftPath.length, rightPath.length)
  for (let index = 0; index < commonLength; index += 1) {
    const left = leftPath[index]!
    const right = rightPath[index]!
    if (left.itemId === right.itemId) continue
    // targetOrder is meaningful only among children of the same target. A
    // different target has no list ordering contract, so keep map order.
    if (left.parentItemId === right.parentItemId && left.targetId === right.targetId) {
      if (left.targetOrder < right.targetOrder) return -1
      if (left.targetOrder > right.targetOrder) return 1
    }
    return 0
  }
  if (leftPath.length < rightPath.length) return -1
  if (leftPath.length > rightPath.length) return 1
  return 0
}

/** Resolves one item's structural ancestry from the frame and natural layout. */
function resolvePlacementPath(
  frame: PresentationFrame,
  naturalLayout: LayoutSnapshot | undefined,
  itemId: string,
  resolvePlacementNode: PlacementResolver = resolvePlacement,
): readonly PlacementNode[] {
  const path: PlacementNode[] = []
  const visited = new Set<string>()
  let currentItemId: string | undefined = itemId
  while (currentItemId !== undefined) {
    if (visited.has(currentItemId)) throw new Error(`Motion presentation cycle detected: ${currentItemId}`)
    visited.add(currentItemId)
    const placement = resolvePlacementNode(frame, naturalLayout, currentItemId)
    if (placement === undefined) break
    path.unshift({ itemId: currentItemId, ...placement })
    currentItemId = placement.parentItemId
  }
  return path
}

/** Finds every selected ancestor of one endpoint through the natural relation. */
function resolveSelectedAncestors(
  frame: PresentationFrame,
  naturalLayout: LayoutSnapshot | undefined,
  selected: ReadonlySet<string>,
  parentItemId: string | undefined,
): readonly string[] {
  const ancestors: string[] = []
  const visited = new Set<string>()
  let currentItemId: string | undefined = parentItemId
  while (currentItemId !== undefined) {
    if (visited.has(currentItemId)) {
      throw new Error(`Motion presentation cycle detected: ${currentItemId}`)
    }
    visited.add(currentItemId)
    if (selected.has(currentItemId)) ancestors.push(currentItemId)
    currentItemId = resolveParentItemId(frame, naturalLayout, currentItemId)
  }
  return ancestors
}

/** Resolves one item's parent and target order from the active structural graph. */
function resolvePlacement(
  frame: PresentationFrame,
  naturalLayout: LayoutSnapshot | undefined,
  itemId: string,
): PlacementNodeData | undefined {
  const frameItem = frame.items.get(itemId)
  if (frameItem !== undefined) {
    return {
      parentItemId: frameItem.parentItemId,
      targetId: frameItem.targetId,
      targetOrder: frameItem.targetOrder,
    }
  }
  const naturalItem = naturalLayout?.items.get(itemId)
  if (naturalItem === undefined) return undefined
  return {
    parentItemId: naturalItem.parentItemId,
    targetId: naturalItem.targetId,
    targetOrder: naturalItem.targetOrder,
  }
}

/** Resolves the destination anchor used only for independent overlay ordering. */
function resolveOverlayPlacement(
  frame: PresentationFrame,
  naturalLayout: LayoutSnapshot | undefined,
  itemId: string,
): PlacementNodeData | undefined {
  const frameItem = frame.items.get(itemId)
  if (frameItem?.overlayStacking !== undefined) {
    return {
      parentItemId: frameItem.overlayStacking.targetParentItemId,
      targetId: frameItem.overlayStacking.targetId,
      targetOrder: frameItem.overlayStacking.targetOrder,
    }
  }
  return resolvePlacement(frame, naturalLayout, itemId)
}

/** One structural placement relation used by the overlay order comparator. */
type PlacementNodeData = Readonly<{
  parentItemId?: string
  targetId: string
  targetOrder: number
}>

/** One placement relation annotated with its item identity. */
type PlacementNode = PlacementNodeData & Readonly<{ itemId: string }>

/** Resolves one item's active structural placement relation. */
type PlacementResolver = (
  frame: PresentationFrame,
  naturalLayout: LayoutSnapshot | undefined,
  itemId: string,
) => PlacementNodeData | undefined

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
