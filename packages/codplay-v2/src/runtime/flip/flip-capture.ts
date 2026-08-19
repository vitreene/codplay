import type {
  HtmlFlipProjection,
  FlipAncestorCapture,
  FlipAncestorEntry,
  FlipCapture,
  FlipCaptureMetadata,
  FlipCaptureRequest,
  FlipItemCapture,
  HtmlMeasurementTree,
} from './types'

/** Stores immutable HTML captures by their existing move/event identity. */
export class FlipCaptureCache {
  private readonly captures = new Map<string, FlipCapture>()
  private readonly identitiesByCaptureId = new Map<string, ReadonlySet<string>>()
  private readonly captureIdByIdentity = new Map<string, string>()

  /** Stores one capture while atomically canonicalizing grouped identities. */
  set(capture: FlipCapture): void {
    const canonicalCapture = normalizeCapture(capture)
    const incomingIdentities = captureIdentities(canonicalCapture)
    const conflictingCaptureIds = new Set<string>()
    for (const identity of incomingIdentities) {
      const existingId = this.captureIdByIdentity.get(identity)
      if (existingId === undefined || existingId === canonicalCapture.captureId) continue
      const existing = this.captures.get(existingId)
      if (existing === undefined) {
        this.captureIdByIdentity.delete(identity)
        continue
      }
      conflictingCaptureIds.add(existingId)
    }

    // A grouped live capture is the canonical realization of every covered
    // occurrence. Decide all conflicts before mutating the index so a rejected
    // downgrade cannot leave the cache half-replaced.
    for (const existingId of conflictingCaptureIds) {
      const existingIdentities = this.identitiesByCaptureId.get(existingId)
        ?? captureIdentities(this.captures.get(existingId)!)
      if (existingIdentities.size > incomingIdentities.size) return
    }

    for (const existingId of conflictingCaptureIds) this.remove(existingId)
    // Re-recording one primary identity refreshes that realization and its
    // aliases as one atomic entry.
    this.remove(canonicalCapture.captureId)
    this.captures.set(canonicalCapture.captureId, canonicalCapture)
    this.identitiesByCaptureId.set(canonicalCapture.captureId, incomingIdentities)
    for (const identity of incomingIdentities) {
      this.captureIdByIdentity.set(identity, canonicalCapture.captureId)
    }
  }

  /** Reads one capture by event identity. */
  get(captureId: string): FlipCapture | undefined {
    const primaryId = this.captureIdByIdentity.get(captureId) ?? (this.captures.has(captureId) ? captureId : undefined)
    return primaryId === undefined ? undefined : this.captures.get(primaryId)
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
      if (capture.hostContextId === hostContextId && capture.projectionEpoch !== projectionEpoch) this.remove(captureId)
    }
  }

  /** Removes one primary capture and every identity pointing to it. */
  private remove(captureId: string): void {
    const identities = this.identitiesByCaptureId.get(captureId)
      ?? (this.captures.has(captureId) ? captureIdentities(this.captures.get(captureId)!) : undefined)
    if (identities !== undefined) {
      for (const identity of identities) {
        if (this.captureIdByIdentity.get(identity) === captureId) this.captureIdByIdentity.delete(identity)
      }
    }
    this.identitiesByCaptureId.delete(captureId)
    this.captures.delete(captureId)
  }
}

/** Returns the primary and every covered compiled identity of one capture. */
function captureIdentities(capture: FlipCapture): ReadonlySet<string> {
  return new Set([capture.captureId, ...(capture.sourceCaptureIds ?? [])])
}

/** Removes duplicate aliases and the redundant primary identity. */
function normalizeCapture(capture: FlipCapture): FlipCapture {
  const aliases = normalizeSourceCaptureIds(capture.captureId, capture.sourceCaptureIds)
  if (capture.sourceCaptureIds === undefined || aliases.length === capture.sourceCaptureIds.length) return capture
  return Object.freeze({
    ...capture,
    sourceCaptureIds: aliases.length === 0 ? undefined : Object.freeze([...aliases]),
  })
}

/** Returns unique aliases without the primary capture identity. */
function normalizeSourceCaptureIds(captureId: string, sourceCaptureIds: readonly string[] | undefined): readonly string[] {
  if (sourceCaptureIds === undefined) return []
  return [...new Set(sourceCaptureIds)].filter((identity) => identity !== captureId)
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
      ...(entry.sourceTargetId === undefined ? {} : { sourceTargetId: entry.sourceTargetId }),
      ...(entry.destinationTargetId === undefined ? {} : { destinationTargetId: entry.destinationTargetId }),
      ...(entry.sourceParentId === undefined ? {} : { sourceParentId: entry.sourceParentId }),
      ...(entry.destinationParentId === undefined ? {} : { destinationParentId: entry.destinationParentId }),
      ...(entry.overlayParentIds === undefined ? {} : { overlayParentIds: Object.freeze([...entry.overlayParentIds]) }),
      ...(entry.isDirectMover === undefined ? {} : { isDirectMover: entry.isDirectMover }),
      ...(entry.overlayTargetByPerso === undefined
        ? {}
        : { overlayTargetByPerso: Object.freeze({ ...entry.overlayTargetByPerso }) }),
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

/** Converts a DOM-free FIRST/LAST tree into one immutable numeric capture. */
export function captureMeasurementTree(
  tree: HtmlMeasurementTree,
  metadata: FlipCaptureMetadata,
  cache?: FlipCaptureCache,
): FlipCapture {
  assertMeasurementTree(tree, metadata)
  const endAt = metadata.startAt + metadata.duration
  const sourceCaptureIds = normalizeSourceCaptureIds(metadata.captureId, metadata.sourceCaptureIds)
  const entries: readonly FlipItemCapture[] = tree.items.map((item) => Object.freeze({
    itemId: item.itemId,
    ancestorIds: Object.freeze([...item.ancestorIds]),
    ...(item.sourceTargetId === undefined ? {} : { sourceTargetId: item.sourceTargetId }),
    ...(item.destinationTargetId === undefined ? {} : { destinationTargetId: item.destinationTargetId }),
    ...(item.sourceParentId === undefined ? {} : { sourceParentId: item.sourceParentId }),
    ...(item.destinationParentId === undefined ? {} : { destinationParentId: item.destinationParentId }),
    ...(item.overlayParentIds === undefined ? {} : { overlayParentIds: Object.freeze([...item.overlayParentIds]) }),
    ...(item.isDirectMover === undefined ? {} : { isDirectMover: item.isDirectMover }),
    ...(item.overlayTargetByPerso === undefined
      ? {}
      : { overlayTargetByPerso: Object.freeze({ ...item.overlayTargetByPerso }) }),
    mode: item.mode,
    startAt: metadata.startAt,
    endAt,
    duration: metadata.duration,
    ease: metadata.ease ?? 'out(2)',
    from: item.first,
    to: item.last,
    ...(item.path === undefined ? {} : { path: item.path }),
  }))
  const ancestors: readonly FlipAncestorCapture[] = tree.ancestors.map((ancestor) => Object.freeze({
    ancestorId: ancestor.ancestorId,
    ...(ancestor.parentId === undefined ? {} : { parentId: ancestor.parentId }),
    regime: ancestor.regime,
    from: ancestor.first,
    to: ancestor.last,
  }))
  const capture: FlipCapture = Object.freeze({
    captureId: metadata.captureId,
    ...(sourceCaptureIds.length === 0
      ? {}
      : { sourceCaptureIds: Object.freeze([...sourceCaptureIds]) }),
    hostContextId: tree.hostContextId,
    projectionEpoch: tree.projectionEpoch,
    startAt: metadata.startAt,
    endAt,
    duration: metadata.duration,
    ease: metadata.ease ?? 'out(2)',
    entries: Object.freeze(entries),
    ancestors: Object.freeze(ancestors),
  })
  cache?.set(capture)
  return capture
}

/** Validates the synchronous tree before it becomes persisted FLIP data. */
function assertMeasurementTree(tree: HtmlMeasurementTree, metadata: FlipCaptureMetadata): void {
  if (!Number.isFinite(tree.logicalTimeMs) || tree.logicalTimeMs < 0) {
    throw new Error('HTML measurement tree logicalTimeMs must be non-negative.')
  }
  if (!Number.isFinite(metadata.startAt) || metadata.startAt < 0) {
    throw new Error('FLIP capture startAt must be non-negative.')
  }
  if (!Number.isFinite(metadata.duration) || metadata.duration <= 0) {
    throw new Error('FLIP capture duration must be positive.')
  }
  const itemIds = new Set<string>()
  for (const item of tree.items) {
    if (itemIds.has(item.itemId)) throw new Error(`FLIP measurement tree contains duplicate item: ${item.itemId}`)
    itemIds.add(item.itemId)
    assertOverlayTargetByPerso(item.itemId, item.overlayTargetByPerso)
    assertEntryParentOwnership(item.itemId, item.sourceParentId, item.destinationParentId)
  }
  const ancestorIds = new Set<string>()
  const ancestorsById = new Map<string, HtmlMeasurementTree['ancestors'][number]>()
  for (const ancestor of tree.ancestors) {
    if (ancestorIds.has(ancestor.ancestorId)) {
      throw new Error(`FLIP measurement tree contains duplicate ancestor: ${ancestor.ancestorId}`)
    }
    ancestorIds.add(ancestor.ancestorId)
    ancestorsById.set(ancestor.ancestorId, ancestor)
    if (ancestor.parentId === ancestor.ancestorId) throw new Error(`FLIP ancestor cannot parent itself: ${ancestor.ancestorId}`)
    if (ancestor.parentId !== undefined && !ancestorIds.has(ancestor.parentId)
      && !tree.ancestors.some((candidate) => candidate.ancestorId === ancestor.parentId)) {
      throw new Error(`FLIP ancestor parent is missing: ${ancestor.parentId}`)
    }
  }
  for (const ancestor of tree.ancestors) {
    const visited = new Set<string>()
    let current: string | undefined = ancestor.ancestorId
    while (current !== undefined) {
      if (visited.has(current)) throw new Error(`FLIP ancestor cycle detected: ${current}`)
      visited.add(current)
      current = ancestorsById.get(current)?.parentId
    }
  }
  for (const item of tree.items) {
    const itemAncestors = new Set<string>()
    for (const ancestorId of item.ancestorIds) {
      if (!ancestorIds.has(ancestorId)) throw new Error(`FLIP item references an uncaptured ancestor: ${ancestorId}`)
      if (itemAncestors.has(ancestorId)) throw new Error(`FLIP item contains duplicate ancestor: ${ancestorId}`)
      itemAncestors.add(ancestorId)
    }
    for (let index = 1; index < item.ancestorIds.length; index += 1) {
      const parentId = item.ancestorIds[index - 1]!
      const ancestorId = item.ancestorIds[index]!
      if (ancestorsById.get(ancestorId)?.parentId !== parentId) {
        throw new Error(`FLIP item ancestor chain is not ordered: ${ancestorId}`)
      }
    }
  }
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
    assertOverlayTargetByPerso(entry.itemId, entry.overlayTargetByPerso)
    assertEntryParentOwnership(entry.itemId, entry.sourceParentId, entry.destinationParentId)
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

/** Validates the parent references consumed by the recursive overlay graph. */
function assertEntryParentOwnership(
  itemId: string,
  sourceParentId: string | undefined,
  destinationParentId: string | undefined,
): void {
  for (const [phase, parentId] of [
    ['source', sourceParentId],
    ['destination', destinationParentId],
  ] as const) {
    if (parentId === undefined) continue
    if (parentId.length === 0) throw new Error(`FLIP ${phase} parent is invalid for item: ${itemId}`)
    if (parentId === itemId) throw new Error(`FLIP ${phase} parent cannot be the item itself: ${itemId}`)
  }
}

/** Validates the target snapshot used to reconcile nested overlay descendants. */
function assertOverlayTargetByPerso(
  ownerPersoKey: string,
  targetByPerso: Readonly<Record<string, string>> | undefined,
): void {
  if (targetByPerso === undefined) return
  for (const [persoKey, targetId] of Object.entries(targetByPerso)) {
    if (persoKey.length === 0 || persoKey === ownerPersoKey) {
      throw new Error(`FLIP overlay descendant identity is invalid: ${persoKey}`)
    }
    if (targetId.length === 0) throw new Error(`FLIP overlay descendant target is invalid: ${persoKey}`)
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
