import type { HtmlFlipProjection, FlipAncestorCapture, FlipAncestorEntry, FlipCapture, FlipCaptureRequest, FlipItemCapture } from './types'

/** Stores immutable HTML captures by their existing move/event identity. */
export class FlipCaptureCache {
  private readonly captures = new Map<string, FlipCapture>()

  /** Stores one capture and replaces only the same capture identity. */
  set(capture: FlipCapture): void {
    this.captures.set(capture.captureId, capture)
  }

  /** Reads one capture by event identity. */
  get(captureId: string): FlipCapture | undefined {
    return this.captures.get(captureId)
  }

  /** Finds the capture active for one host and time. */
  findActive(hostContextId: string, projectionEpoch: number, timeMs: number): FlipCapture | undefined {
    return this.findActiveAll(hostContextId, projectionEpoch, timeMs).at(-1)
  }

  /** Finds every capture active for one host and time, ordered by start time. */
  findActiveAll(hostContextId: string, projectionEpoch: number, timeMs: number): readonly FlipCapture[] {
    return [...this.captures.values()]
      .filter((capture) => capture.hostContextId === hostContextId)
      .filter((capture) => capture.projectionEpoch === projectionEpoch)
      .filter((capture) => timeMs >= capture.startAt && timeMs <= capture.endAt)
      .sort((left, right) => left.startAt - right.startAt)
  }

  /** Invalidates all captures from one obsolete host projection epoch. */
  invalidateEpoch(hostContextId: string, projectionEpoch: number): void {
    for (const [captureId, capture] of this.captures) {
      if (capture.hostContextId === hostContextId && capture.projectionEpoch !== projectionEpoch) this.captures.delete(captureId)
    }
  }
}

/** Captures FIRST, executes one consumer mutation, then captures LAST. */
export function captureFlip(
  request: FlipCaptureRequest,
  projection: HtmlFlipProjection,
  cache: FlipCaptureCache,
): FlipCapture {
  assertCaptureRequest(request, projection)
  const firstItems = new Map(request.entries.map((entry) => [entry.itemId, captureEntryPose(entry, projection)]))
  const firstAncestors = new Map((request.ancestors ?? []).map((entry) => [
    entry.ancestorId,
    projection.capturePose(requireHandle(projection, entry.ancestorId)),
  ]))

  request.mutate()

  if (request.hostContextId !== projection.getHostContextId()) throw new Error('FLIP capture crosses host contexts during mutation.')
  if (request.projectionEpoch !== projection.getProjectionEpoch()) throw new Error('FLIP host projection epoch changed during mutation.')

  const lastItems = new Map(request.entries.map((entry) => [entry.itemId, captureEntryPose(entry, projection)]))
  const lastAncestors = new Map((request.ancestors ?? []).map((entry) => [
    entry.ancestorId,
    projection.capturePose(requireHandle(projection, entry.ancestorId)),
  ]))
  const endAt = request.startAt + request.duration
  const entries: FlipItemCapture[] = []
  for (const entry of request.entries) {
    const from = firstItems.get(entry.itemId)
    const to = lastItems.get(entry.itemId)
    if (from === undefined || to === undefined) throw new Error(`FLIP item pose capture is incomplete: ${entry.itemId}`)
    entries.push({
      itemId: entry.itemId,
      ancestorIds: [...entry.ancestorIds],
      mode: entry.mode ?? 'local',
      startAt: request.startAt,
      endAt,
      duration: request.duration,
      ease: request.ease ?? 'out(2)',
      from,
      to,
      path: entry.path,
    })
  }

  const ancestors: FlipAncestorCapture[] = []
  for (const entry of request.ancestors ?? []) {
    const from = firstAncestors.get(entry.ancestorId)
    const to = lastAncestors.get(entry.ancestorId)
    if (from === undefined || to === undefined) throw new Error(`FLIP ancestor pose capture is incomplete: ${entry.ancestorId}`)
    ancestors.push({ ancestorId: entry.ancestorId, parentId: entry.parentId, regime: entry.regime, from, to })
  }

  const capture: FlipCapture = {
    captureId: request.captureId,
    hostContextId: request.hostContextId,
    projectionEpoch: request.projectionEpoch,
    startAt: request.startAt,
    endAt,
    duration: request.duration,
    ease: request.ease ?? 'out(2)',
    entries,
    ancestors,
  }
  cache.set(capture)
  return capture
}

function assertCaptureRequest(request: FlipCaptureRequest, projection: HtmlFlipProjection): void {
  if (!Number.isFinite(request.startAt) || request.startAt < 0) throw new Error('FLIP capture startAt must be non-negative.')
  if (!Number.isFinite(request.duration) || request.duration <= 0) throw new Error('FLIP capture duration must be positive.')
  if (request.hostContextId !== projection.getHostContextId()) throw new Error('FLIP capture crosses host contexts.')
  if (request.projectionEpoch !== projection.getProjectionEpoch()) throw new Error('FLIP capture uses a stale host projection epoch.')
  const ids = new Set<string>()
  for (const entry of request.entries) {
    if (ids.has(entry.itemId)) throw new Error(`FLIP capture contains duplicate item: ${entry.itemId}`)
    ids.add(entry.itemId)
  }
  const ancestorIds = new Set<string>()
  const ancestorsById = new Map<string, FlipAncestorEntry>()
  for (const ancestor of request.ancestors ?? []) {
    if (ancestorIds.has(ancestor.ancestorId)) throw new Error(`FLIP capture contains duplicate ancestor: ${ancestor.ancestorId}`)
    ancestorIds.add(ancestor.ancestorId)
    ancestorsById.set(ancestor.ancestorId, ancestor)
    if (ancestor.parentId === ancestor.ancestorId) throw new Error(`FLIP ancestor cannot parent itself: ${ancestor.ancestorId}`)
    if (ancestor.parentId !== undefined && !ancestorIds.has(ancestor.parentId)) {
      const parentExists = (request.ancestors ?? []).some((candidate) => candidate.ancestorId === ancestor.parentId)
      if (!parentExists) throw new Error(`FLIP ancestor parent is missing: ${ancestor.parentId}`)
    }
  }
  for (const ancestor of request.ancestors ?? []) assertAncestorChain(ancestor.ancestorId, ancestorsById)
  for (const entry of request.entries) {
    const entryAncestorIds = new Set<string>()
    for (const ancestorId of entry.ancestorIds) {
      if (!ancestorIds.has(ancestorId)) throw new Error(`FLIP item references an uncaptured ancestor: ${ancestorId}`)
      if (entryAncestorIds.has(ancestorId)) throw new Error(`FLIP item contains duplicate ancestor: ${ancestorId}`)
      entryAncestorIds.add(ancestorId)
    }
    for (let index = 1; index < entry.ancestorIds.length; index += 1) {
      const parentId = entry.ancestorIds[index - 1]
      const ancestorId = entry.ancestorIds[index]
      if (ancestorsById.get(ancestorId)?.parentId !== parentId) {
        throw new Error(`FLIP item ancestor chain is not ordered: ${ancestorId}`)
      }
    }
  }

  function assertAncestorChain(ancestorId: string, ancestors: ReadonlyMap<string, FlipAncestorEntry>): void {
    const visited = new Set<string>()
    let current: string | undefined = ancestorId
    while (current !== undefined) {
      if (visited.has(current)) throw new Error(`FLIP ancestor cycle detected: ${current}`)
      visited.add(current)
      current = ancestors.get(current)?.parentId
    }
  }
}

function requireHandle(projection: HtmlFlipProjection, itemId: string): unknown {
  const handle = projection.resolveHandle(itemId)
  if (handle === undefined || handle === null) throw new Error(`FLIP HTML handle is missing: ${itemId}`)
  return handle
}

/** Selects the host pose seam appropriate to one local or overlay entry. */
function captureEntryPose(entry: FlipCaptureRequest['entries'][number], projection: HtmlFlipProjection): ReturnType<HtmlFlipProjection['capturePose']> {
  const handle = requireHandle(projection, entry.itemId)
  if (entry.mode === 'overlay-world' && projection.captureOverlayPose !== undefined) {
    return projection.captureOverlayPose(handle)
  }
  return projection.capturePose(handle)
}
