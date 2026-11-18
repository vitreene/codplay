import type { Item } from '../types'

/** Checks whether the item and all its ancestors are included in the scene presentation. */
export function isItemVisible(item: Item, itemsById: ReadonlyMap<string, Item>): boolean {
  let current: Item | undefined = item
  const visited = new Set<string>()
  while (current !== undefined) {
    if (current.visible === false) return false
    if (visited.has(current.id)) return true
    visited.add(current.id)
    current = current.parentId === null ? undefined : itemsById.get(current.parentId)
  }
  return true
}
