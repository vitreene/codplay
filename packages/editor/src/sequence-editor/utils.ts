import type { LayoutProfile, TrackNode, SnapPoint } from './types'
import { TIME_STEP_MS } from './constants'

export function msToPixel(ms: number, pxPerSec: number): number {
  return (ms / 1000) * pxPerSec
}

export function pixelToMs(px: number, pxPerSec: number): number {
  return (px / pxPerSec) * 1000
}

export function snapToGrid(rawMs: number, snapPoints: SnapPoint[], thresholdPx: number, pxPerSec: number): number {
  const thresholdMs = pixelToMs(thresholdPx, pxPerSec)
  for (const point of snapPoints) {
    if (Math.abs(rawMs - point.timeMs) <= thresholdMs) return point.timeMs
  }
  return Math.round(rawMs / TIME_STEP_MS) * TIME_STEP_MS
}

export function clampMs(ms: number, minMs: number, maxMs: number): number {
  return Math.max(minMs, Math.min(maxMs, ms))
}

export function flattenTracks(tracks: TrackNode[]): TrackNode[] {
  const result: TrackNode[] = []
  for (const track of tracks) {
    result.push(track)
    if (track.children) result.push(...flattenTracks(track.children))
  }
  return result
}

export function getTrackRowHeight(track: TrackNode, profile: LayoutProfile): number {
  return track.kind === 'capsule' ? profile.rowHeightCapsule : profile.rowHeightElement
}

export function computeGraduationInterval(pxPerSec: number, levels: number[], minGapPx: number): number {
  for (const levelMs of levels) {
    const gapPx = (levelMs / 1000) * pxPerSec
    if (gapPx >= minGapPx) return levelMs
  }
  return levels[levels.length - 1]
}

/** Returns the active clip bounds of the nearest ancestor capsule, or {0, durationMs}. */
export function findParentClipBounds(
  trackId: string,
  tracks: TrackNode[],
  durationMs: number,
): { minMs: number; maxMs: number } {
  function search(nodes: TrackNode[]): TrackNode | null {
    for (const node of nodes) {
      if (node.children) {
        for (const child of node.children) {
          if (child.id === trackId || descendantIds(child).includes(trackId)) return node
        }
        const deeper = search(node.children)
        if (deeper) return deeper
      }
    }
    return null
  }
  function descendantIds(node: TrackNode): string[] {
    const ids: string[] = [node.id]
    for (const c of node.children ?? []) ids.push(...descendantIds(c))
    return ids
  }
  const parent = search(tracks)
  if (!parent) return { minMs: 0, maxMs: durationMs }
  const intro = parent.keyframes.find(k => k.name === 'intro')
  const outro = parent.keyframes.find(k => k.name === 'outro')
  return { minMs: intro?.timeMs ?? 0, maxMs: outro?.timeMs ?? durationMs }
}

/** Returns the intro/outro timeMs of the nearest ancestor capsule, or null if not set. */
export function getParentClipMarkers(
  trackId: string,
  tracks: TrackNode[],
): { introMs: number | null; outroMs: number | null } {
  function search(nodes: TrackNode[]): TrackNode | null {
    for (const node of nodes) {
      if (node.children) {
        for (const child of node.children) {
          if (child.id === trackId || descendantIds(child).includes(trackId)) return node
        }
        const deeper = search(node.children)
        if (deeper) return deeper
      }
    }
    return null
  }
  function descendantIds(node: TrackNode): string[] {
    const ids: string[] = [node.id]
    for (const c of node.children ?? []) ids.push(...descendantIds(c))
    return ids
  }
  const parent = search(tracks)
  if (!parent) return { introMs: null, outroMs: null }
  return {
    introMs: parent.keyframes.find(k => k.name === 'intro')?.timeMs ?? null,
    outroMs: parent.keyframes.find(k => k.name === 'outro')?.timeMs ?? null,
  }
}

export function generateSnapPoints(tracks: TrackNode[]): SnapPoint[] {
  const points: SnapPoint[] = []
  for (const track of flattenTracks(tracks)) {
    for (const kf of track.keyframes) {
      points.push({ timeMs: kf.timeMs, source: 'keyframe', id: kf.id })
    }
  }
  return points
}
