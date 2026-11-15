import type { EditorScene, Item } from '../app/commands/types'
import { descendantIds } from './utils'

export type TrackDropMode = 'before' | 'after' | 'inside'

export type TrackMovePlacement = Readonly<{
  trackId: string
  parentId: string | null
  beforeItemId?: string
  afterItemId?: string
}>

/** Resolves a tree drop to a parent and adjacent order anchors without mutating the scene. */
export function resolveTrackDrop(
  scene: EditorScene,
  trackId: string,
  targetId: string,
  mode: TrackDropMode,
): TrackMovePlacement | null {
  const source = scene.items.find((item) => item.id === trackId)
  const target = scene.items.find((item) => item.id === targetId)
  if (source === undefined || target === undefined || source.id === target.id) return null
  if (mode === 'inside' && target.type !== 'capsule') return null

  const parentId = mode === 'inside' ? target.id : target.parentId
  if (parentId !== null && descendantIds(scene.items, source.id).includes(parentId)) return null

  const siblings = scene.items
    .filter((item) => item.parentId === parentId && item.id !== source.id)
    .sort(compareFrontToBack)
  const insertionIndex = mode === 'inside'
    ? 0
    : siblings.findIndex((item) => item.id === target.id) + (mode === 'after' ? 1 : 0)
  if (insertionIndex < 0) return null

  const nextOrder = [...siblings]
  nextOrder.splice(insertionIndex, 0, source)
  const currentOrder = scene.items
    .filter((item) => item.parentId === source.parentId)
    .sort(compareFrontToBack)
    .map((item) => item.id)
  if (source.parentId === parentId && sameIds(currentOrder, nextOrder.map((item) => item.id))) return null
  if (mode === 'inside') return { trackId, parentId }

  const ascendingSiblings = [...siblings].reverse()
  const ascendingInsertionIndex = ascendingSiblings.length - insertionIndex
  const before = ascendingSiblings[ascendingInsertionIndex]
  const after = ascendingSiblings[ascendingInsertionIndex - 1]
  return {
    trackId,
    parentId,
    ...(before === undefined ? {} : { beforeItemId: before.id }),
    ...(after === undefined ? {} : { afterItemId: after.id }),
  }
}

/** Sorts the visible tree from front to back while the runtime keeps ascending order keys. */
function compareFrontToBack(left: Item, right: Item): number {
  if (left.order > right.order) return -1
  if (left.order < right.order) return 1
  return left.id.localeCompare(right.id)
}

/** Compares a current sibling order with a proposed display order. */
function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}
