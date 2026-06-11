import type { ListDiff } from './types'

/**
 * Computes added, removed, and moved child IDs between two ordered snapshots.
 */
export function computeListDiff(prevChildrenIds: string[], nextChildrenIds: string[]): ListDiff {
  const prevSet = new Set<string>(prevChildrenIds)
  const nextSet = new Set<string>(nextChildrenIds)
  const prevIndexById = new Map<string, number>()

  for (const [index, childId] of prevChildrenIds.entries()) {
    prevIndexById.set(childId, index)
  }

  const added = nextChildrenIds.filter((childId) => !prevSet.has(childId))
  const removed = prevChildrenIds.filter((childId) => !nextSet.has(childId))
  const moved = nextChildrenIds.filter((childId, nextIndex) => {
    const prevIndex = prevIndexById.get(childId)
    return prevIndex !== undefined && prevIndex !== nextIndex
  })

  return {
    added,
    removed,
    moved
  }
}
