import type {
  ItemMotionTrack,
  MotionAttachment,
  MotionGraph,
  MotionResetBoundary,
  MotionResetTimesByItem,
  MotionSegment,
} from '../types'
import type { MutableMotionGraph, MutableMotionTrack } from './graph-types'

/** Replaces one prepared segment inside the private build transaction. */
export function replaceMotionSegment(
  graph: MutableMotionGraph,
  itemId: string,
  segmentId: string,
  replacement: MotionSegment | undefined,
): void {
  const track = graph.tracksByItem.get(itemId)
  if (track === undefined) return
  const index = track.segmentIndexById.get(segmentId)
  if (index === undefined) return

  if (replacement === undefined) {
    track.segments.splice(index, 1)
    track.segmentsById.delete(segmentId)
    track.segmentIndexById.delete(segmentId)
    for (let shiftedIndex = index; shiftedIndex < track.segments.length; shiftedIndex += 1) {
      track.segmentIndexById.set(track.segments[shiftedIndex]!.id, shiftedIndex)
    }
  }
  else {
    track.segments[index] = replacement
    track.segmentsById.set(segmentId, replacement)
  }
  if (track.segments.length === 0) {
    graph.tracksByItem.delete(itemId)
    graph.presentationItemIds.delete(itemId)
  }
}

/** Returns one segment through the preparation index when available. */
export function findTrackSegment(
  track: ItemMotionTrack | MutableMotionTrack | undefined,
  segmentId: string,
): MotionSegment | undefined {
  if (track === undefined) return undefined
  if ('segmentsById' in track) return track.segmentsById.get(segmentId)
  return track.segments.find((segment) => segment.id === segmentId)
}

/** Materializes one private work graph at the presentation boundary. */
export function finalizeMotionGraph(graph: MutableMotionGraph): MotionGraph {
  const tracksByItem = new Map<string, ItemMotionTrack>()
  const attachmentCache = new WeakMap<MotionAttachment, MotionAttachment>()
  for (const [itemId, track] of graph.tracksByItem) {
    const segments = track.segments.map((segment) => finalizeMotionSegment(segment, attachmentCache))
    tracksByItem.set(itemId, Object.freeze({
      itemId,
      segments: Object.freeze(segments),
    }))
  }
  const revision = createGraphRevision(tracksByItem, graph.resetTimesByItem)
  return Object.freeze({
    revision,
    tracksByItem,
    resetTimesByItem: graph.resetTimesByItem,
    presentationItemIds: Object.freeze([...graph.presentationItemIds]),
  })
}

/** Freezes one segment and its nested mutable collections at the final boundary. */
function finalizeMotionSegment(
  segment: MotionSegment,
  attachmentCache: WeakMap<MotionAttachment, MotionAttachment>,
): MotionSegment {
  const from = finalizeMotionAttachment(segment.from, attachmentCache)
  const to = finalizeMotionAttachment(segment.to, attachmentCache)
  const keyframes = segment.keyframes === undefined
    ? undefined
    : Object.freeze(segment.keyframes.map((keyframe) => Object.freeze({
      ...keyframe,
      attachment: finalizeMotionAttachment(keyframe.attachment, attachmentCache),
    })))
  const retargets = segment.retargets === undefined
    ? undefined
    : Object.freeze(segment.retargets.map((retarget) => Object.freeze({
      ...retarget,
      from: finalizeMotionAttachment(retarget.from, attachmentCache),
      to: finalizeMotionAttachment(retarget.to, attachmentCache),
    })))
  return Object.freeze({
    ...segment,
    from,
    to,
    ...(keyframes === undefined ? {} : { keyframes }),
    ...(retargets === undefined ? {} : { retargets }),
  })
}

/** Freezes one attachment once while preserving shared endpoint identity. */
function finalizeMotionAttachment(
  attachment: MotionAttachment,
  cache: WeakMap<MotionAttachment, MotionAttachment>,
): MotionAttachment {
  const existing = cache.get(attachment)
  if (existing !== undefined) return existing
  const finalized = Object.freeze({ ...attachment })
  cache.set(attachment, finalized)
  return finalized
}

/** Computes the stable graph revision once, after all operations are complete. */
function createGraphRevision(
  tracksByItem: ReadonlyMap<string, ItemMotionTrack>,
  resetTimesByItem: MotionResetTimesByItem,
): string {
  return JSON.stringify({ tracks: [...tracksByItem].map(([itemId, track]) => [
    itemId,
    track.segments.map((segment) => ({
      id: segment.id,
      startAt: segment.startAt,
      endAt: segment.endAt,
      duration: segment.duration,
      delay: segment.delay,
      ease: segment.ease,
      presentationMode: segment.presentationMode,
      resize: segment.resize,
      targetReflow: segment.targetReflow,
      direct: segment.direct,
      eventSeq: segment.eventSeq,
      from: segment.from,
      to: segment.to,
      retargets: segment.retargets,
      keyframes: segment.keyframes,
      materializerOwned: segment.materializerOwned,
      path: segment.path,
    })),
  ]), resets: [...resetTimesByItem] })
}

/** Clones reset barriers into the immutable graph-owned representation. */
export function normalizeResetTimes(
  resetTimesByItem: MotionResetTimesByItem | undefined,
): MotionResetTimesByItem {
  const normalized = new Map<string, readonly MotionResetBoundary[]>()
  for (const [itemId, times] of resetTimesByItem ?? []) {
    const valid = [...times]
      .filter((boundary) => Number.isFinite(boundary.timeMs) && Number.isFinite(boundary.eventSeq))
      .sort((left, right) => left.timeMs - right.timeMs || left.eventSeq - right.eventSeq)
      .filter((boundary, index, boundaries) => index === 0
        || boundary.timeMs !== boundaries[index - 1]!.timeMs
        || boundary.eventSeq !== boundaries[index - 1]!.eventSeq)
    if (valid.length > 0) normalized.set(itemId, Object.freeze(valid))
  }
  return normalized
}

/** Returns the latest reset barrier not later than one logical time. */
export function latestResetAt(
  resetTimesByItem: MotionResetTimesByItem,
  itemId: string,
  timeMs: number,
): MotionResetBoundary | undefined {
  const times = resetTimesByItem.get(itemId)
  if (times === undefined) return undefined
  let latest: MotionResetBoundary | undefined
  for (const resetAt of times) {
    if (resetAt.timeMs > timeMs) break
    latest = resetAt
  }
  return latest
}

/** Tests whether a motion segment starts after an ordered reset boundary. */
export function isAfterReset(segment: MotionSegment, reset: MotionResetBoundary): boolean {
  return segment.startAt > reset.timeMs
    || (segment.startAt === reset.timeMs
      && segment.eventSeq !== undefined
      && segment.eventSeq > reset.eventSeq)
}
