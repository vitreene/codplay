import type { LayoutProfile, Item, SnapPoint } from './types'

export function clampMs(ms: number, minMs: number, maxMs: number): number {
  return Math.max(minMs, Math.min(maxMs, ms))
}

/** Every item directly under `parentId` (root items when `null`), sorted by their fractional `order` key — same patron as `build-scene.ts::childrenOf`. */
export function childrenOf(items: Item[], parentId: string | null): Item[] {
  return items.filter((item) => item.parentId === parentId).sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
}

export function getTrackRowHeight(item: Item, profile: LayoutProfile): number {
  return item.type === 'capsule' ? profile.rowHeightCapsule : profile.rowHeightElement
}

export function computeGraduationInterval(pxPerSec: number, levels: number[], minGapPx: number): number {
  for (const levelMs of levels) {
    const gapPx = (levelMs / 1000) * pxPerSec
    if (gapPx >= minGapPx) return levelMs
  }
  return levels[levels.length - 1]
}

/**
 * Returns the active clip bounds of the nearest ancestor capsule, or {0, durationMs}.
 *
 * A capsule's first and last timeline keyframes are its visibility boundaries. Their reserved
 * names (`intro`/`outro`) remain useful labels for clip tooling but are not required for this
 * boundary lookup. The lookup stays intentionally local to one parentId; capsule nesting is
 * resolved by the builder/distribution layer, not by this editor helper.
 */
export function findParentClipBounds(
  itemId: string,
  items: Item[],
  durationMs: number,
): { minMs: number; maxMs: number } {
  const item = items.find((i) => i.id === itemId)
  const parent = item?.parentId ? items.find((i) => i.id === item.parentId) : undefined
  if (!parent) return { minMs: 0, maxMs: durationMs }
  const keyframes = [...parent.keyframes].sort((left, right) => left.timeMs - right.timeMs)
  const intro = keyframes[0]
  const outro = keyframes.at(-1)
  return { minMs: intro?.timeMs ?? 0, maxMs: outro?.timeMs ?? durationMs }
}

/** Returns the first/last boundary times of the nearest ancestor capsule, or null if it has no keyframes. */
export function getParentClipMarkers(
  itemId: string,
  items: Item[],
): { introMs: number | null; outroMs: number | null } {
  const item = items.find((i) => i.id === itemId)
  const parent = item?.parentId ? items.find((i) => i.id === item.parentId) : undefined
  if (!parent) return { introMs: null, outroMs: null }
  const keyframes = [...parent.keyframes].sort((left, right) => left.timeMs - right.timeMs)
  return {
    introMs: keyframes[0]?.timeMs ?? null,
    outroMs: keyframes.at(-1)?.timeMs ?? null,
  }
}

export function generateSnapPoints(items: Item[]): SnapPoint[] {
  const points: SnapPoint[] = []
  for (const item of items) {
    for (const kf of item.keyframes) {
      points.push({ timeMs: kf.timeMs, source: 'keyframe', id: kf.id })
    }
  }
  return points
}

/** Every descendant id of `itemId` (itself excluded), computed by repeated parentId lookups — no `children` field to walk. */
export function descendantIds(items: Item[], itemId: string): string[] {
  const ids: string[] = []
  let frontier = [itemId]
  while (frontier.length > 0) {
    const next: string[] = []
    for (const item of items) {
      if (item.parentId !== null && frontier.includes(item.parentId)) {
        ids.push(item.id)
        next.push(item.id)
      }
    }
    frontier = next
  }
  return ids
}
