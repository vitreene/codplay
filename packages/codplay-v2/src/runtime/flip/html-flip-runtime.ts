import { captureFlip, captureMeasurementTree, FlipCaptureCache } from './flip-capture'
import {
  FlipHistoricalPoseCache,
  resolveFlipPoseGraph,
} from './flip-pose-graph'
import {
  createOverlayCaptureNode,
  createOverlayHandoffNode,
  isOverlayNodeContinuing,
  resolveOverlayProjectionPose,
  type OverlayProjectionNode,
} from './overlay-projection-graph'
import { DiagnosticCollector } from '../../diagnostics'
import type {
  FlipCapture,
  FlipCaptureMetadata,
  FlipCaptureRequest,
  FlipCaptureResolver,
  FlipOperationResult,
  HtmlFlipProjection,
  HtmlMeasurementTree,
  HtmlFlipRuntimeOptions,
  FlipCaptureRuntimeResources,
  HtmlFlipOverlayContentState,
} from './types'

/** Runs HTML FLIP captures and commits one resolved pose per touched item. */
export class HtmlFlipRuntime {
  private readonly overlayNodes = new Map<string, OverlayProjectionNode>()
  private readonly activeLocalPoses = new Map<string, { captureId: string; handle: unknown }>()
  private readonly projection: HtmlFlipProjection
  private readonly cache: FlipCaptureCache
  private readonly captureResolver: FlipCaptureResolver | undefined
  private readonly getActiveCaptureDescriptors: HtmlFlipRuntimeOptions['getActiveCaptureDescriptors']
  private readonly diagnosticOutput: HtmlFlipRuntimeOptions['diagnosticOutput']
  private readonly historicalPoseCache = new FlipHistoricalPoseCache()
  private readonly overlayTemplates = new Map<string, ReadonlyMap<string, unknown>>()
  private overlayContentState: HtmlFlipOverlayContentState | undefined
  private lastProjectionTimeMs: number | undefined

  /** Creates one runtime around one host-owned HTML projection. */
  constructor(
    projection: HtmlFlipProjection,
    cache = new FlipCaptureCache(),
    captureResolver?: FlipCaptureResolver,
    options: HtmlFlipRuntimeOptions = {},
  ) {
    this.projection = projection
    this.cache = cache
    this.captureResolver = captureResolver
    this.diagnosticOutput = options.diagnosticOutput
    this.getActiveCaptureDescriptors = options.getActiveCaptureDescriptors
  }

  /** Captures one consumer mutation and stores only numeric pose data. */
  capture(request: FlipCaptureRequest): FlipOperationResult<FlipCapture> {
    try {
      this.reconcileActiveProjections(request.startAt)
      const active = this.cache.findActiveAll(request.hostContextId, request.projectionEpoch, request.startAt)
        .filter((capture) => capture.endAt > request.startAt)
      if (active.length > 0) {
        const presented = this.seekCaptures(active, request.startAt)
        if (!presented.ok) throw new Error(presented.diagnostics.errors.map((entry) => entry.message).join('\n'))
      }
      const overlayTemplates = this.captureOverlayTemplates(request.entries)
      const captured = captureFlip({
        ...request,
        mutate: () => {
          request.mutate()
          const activeAtLast = this.cache.findActiveAll(
            request.hostContextId,
            request.projectionEpoch,
            request.startAt + request.duration,
          )
          if (activeAtLast.length === 0) return
          const presented = this.seekCaptures(activeAtLast, request.startAt + request.duration, false)
          if (!presented.ok) throw new Error(presented.diagnostics.errors.map((entry) => entry.message).join('\n'))
        },
      }, this.projection, this.cache)
      if (overlayTemplates.size > 0) this.overlayTemplates.set(request.captureId, overlayTemplates)
      return { ok: true, value: captured, diagnostics: emptyDiagnostics() }
    } catch (error) {
      return this.failure('RUNTIME_FLIP_CAPTURE_FAILED', error, { captureId: request.captureId })
    }
  }

  /** Runs one capture transaction and presents its initial pose. */
  run(request: FlipCaptureRequest): FlipOperationResult<FlipCapture> {
    const captured = this.capture(request)
    if (!captured.ok) return captured
    const presented = this.seek(captured.value, captured.value.startAt)
    if (!presented.ok) return presented
    return captured
  }

  /** Stores one transaction result without reading or mutating the DOM again. */
  recordMeasurementTree(
    tree: HtmlMeasurementTree,
    metadata: FlipCaptureMetadata,
    resources: FlipCaptureRuntimeResources = {},
  ): FlipOperationResult<FlipCapture> {
    try {
      if (tree.hostContextId !== this.projection.getHostContextId()) throw new Error('FLIP capture crosses host contexts.')
      if (tree.projectionEpoch !== this.projection.getProjectionEpoch()) throw new Error('FLIP capture uses a stale host projection epoch.')
      const capture = captureMeasurementTree(tree, metadata, this.cache)
      if (resources.overlayTemplates !== undefined) {
        this.overlayTemplates.set(metadata.captureId, new Map(resources.overlayTemplates))
      }
      return { ok: true, value: capture, diagnostics: emptyDiagnostics() }
    } catch (error) {
      return this.failure('RUNTIME_FLIP_MEASUREMENT_FAILED', error, { captureId: metadata.captureId })
    }
  }

  /** Stores the logical descendant ownership for the next shared projection commit. */
  setOverlayContentState(state: HtmlFlipOverlayContentState | undefined): void {
    this.overlayContentState = state
  }

  /** Presents active captures before a new host measurement begins. */
  prepareCapture(
    hostContextId: string,
    projectionEpoch: number,
    timeMs: number,
  ): FlipOperationResult<void> {
    try {
      if (hostContextId !== this.projection.getHostContextId()) throw new Error('FLIP capture crosses host contexts.')
      if (projectionEpoch !== this.projection.getProjectionEpoch()) throw new Error('FLIP capture uses a stale host projection epoch.')
      this.reconcileActiveProjections(timeMs)
      const active = this.cache.findActiveAll(hostContextId, projectionEpoch, timeMs)
      if (active.length === 0) return { ok: true, value: undefined, diagnostics: emptyDiagnostics() }
      return this.seekCaptures(active, timeMs, false)
    } catch (error) {
      return this.failure('RUNTIME_FLIP_PREPARE_CAPTURE_FAILED', error, { hostContextId, projectionEpoch, timeMs })
    }
  }

  /** Resolves and commits every item in one capture at one timeline instant. */
  seek(capture: FlipCapture, timeMs: number): FlipOperationResult<void> {
    return this.seekCaptures([capture], timeMs)
  }

  /** Resolves several overlapping captures and commits them with one flush. */
  private seekCaptures(captures: readonly FlipCapture[], timeMs: number, finishCompleted = true): FlipOperationResult<void> {
    try {
      let needsHistoricalSuspension = false
      for (const capture of captures) {
        this.assertCaptureScope(capture)
        needsHistoricalSuspension ||= capture.ancestors.some((ancestor) => ancestor.regime === 'layout')
      }
      if (needsHistoricalSuspension) this.suspendTransientProjections()
      for (const capture of captures) {
        const poses = resolveFlipPoseGraph(capture, timeMs, this.projection, this.historicalPoseCache)
        for (const resolved of poses) {
          const handle = this.projection.resolveHandle(resolved.itemId)
          if (handle === undefined || handle === null) throw new Error(`FLIP HTML handle is missing: ${resolved.itemId}`)
          const entry = capture.entries.find((candidate) => candidate.itemId === resolved.itemId)
          if (entry === undefined) throw new Error(`FLIP capture item is missing: ${resolved.itemId}`)
          if (resolved.mode === 'overlay-world') {
            const existing = this.overlayNodes.get(resolved.itemId)
            // A stable sibling may be in handoff from an earlier list capture
            // while a newer simultaneous reflow gives it another slot. Only
            // the same compiled capture identity may retain that node; the
            // `isDirectMover` flag describes why the entry was measured, not
            // an ownership veto for a later list transition.
            if (existing !== undefined && this.sameCaptureOwnership(existing.captureId, capture)) {
              this.overlayNodes.set(resolved.itemId, createOverlayCaptureNode({
                itemId: resolved.itemId,
                captureId: capture.captureId,
                handle: existing.handle,
                ...this.resolveCaptureParentItemId(entry),
                destinationTargetId: entry.destinationTargetId,
              }))
              continue
            }
            if (existing?.state === 'handoff') this.releaseOverlaySubtree(resolved.itemId)
            this.releaseOverlayNodeIfReplaced(resolved.itemId, capture)
            const overlay = this.startOverlay(capture, resolved.itemId, handle)
            this.overlayNodes.set(resolved.itemId, createOverlayCaptureNode({
              itemId: resolved.itemId,
              captureId: capture.captureId,
              handle: overlay,
              ...this.resolveCaptureParentItemId(entry),
              destinationTargetId: entry.destinationTargetId,
            }))
          } else {
            this.releaseOverlaySubtree(resolved.itemId)
            this.cancelLocalPoseIfNeeded(resolved.itemId, capture)
            this.activeLocalPoses.set(resolved.itemId, { captureId: capture.captureId, handle })
            this.projection.applyLocalPose(handle, resolved)
          }
        }
      }
      this.syncOverlayContents()
      this.reconcileOverlayVisibility()
      this.applyOverlayProjectionNodes(timeMs)
      this.projection.flush()
      if (finishCompleted) {
        this.reconcileOverlayNodes(timeMs, true)
        this.finishCompletedLocalPoses(timeMs)
        this.lastProjectionTimeMs = timeMs
      }
      return { ok: true, value: undefined, diagnostics: emptyDiagnostics() }
    } catch (error) {
      return this.failure('RUNTIME_FLIP_SEEK_FAILED', error, {
        captureIds: captures.map((capture) => capture.captureId),
        timeMs,
      })
    }
  }

  /** Resolves a cached capture without allowing a missing capture to be invented. */
  seekCached(hostContextId: string, projectionEpoch: number, timeMs: number): FlipOperationResult<void> {
    try {
      if (hostContextId !== this.projection.getHostContextId()) throw new Error('FLIP capture crosses host contexts.')
      if (projectionEpoch !== this.projection.getProjectionEpoch()) throw new Error('FLIP capture uses a stale host projection epoch.')
      if (this.lastProjectionTimeMs !== undefined && timeMs < this.lastProjectionTimeMs) {
        const canceled = this.cancel()
        if (!canceled.ok) return canceled
      }
      this.reconcileActiveProjections(timeMs)
      let captures = this.cache.findActiveAll(hostContextId, projectionEpoch, timeMs)
      const knownCaptureIds = new Set(captures.flatMap((capture) => [
        capture.captureId,
        ...(capture.sourceCaptureIds ?? []),
      ]))
      const scheduled = this.getActiveCaptureDescriptors?.(timeMs)
        .filter((descriptor) => !knownCaptureIds.has(descriptor.captureId)) ?? []
      const shouldResolve = this.captureResolver !== undefined
        && (scheduled.length > 0 || (this.getActiveCaptureDescriptors === undefined && captures.length === 0))
      if (shouldResolve) {
        const resolved = this.captureResolver({ hostContextId, projectionEpoch, timeMs, captures: scheduled })
        const resolvedCaptures = normalizeResolvedCaptures(resolved)
        for (const capture of resolvedCaptures) {
          if (timeMs < capture.startAt || timeMs > capture.endAt) {
            throw new Error(`FLIP capture resolver returned an inactive capture at ${timeMs}ms.`)
          }
          this.assertCaptureScope(capture)
          this.cache.set(capture)
        }
        captures = this.cache.findActiveAll(hostContextId, projectionEpoch, timeMs)
      }
      if (captures.length === 0) {
        this.lastProjectionTimeMs = timeMs
        return { ok: true, value: undefined, diagnostics: emptyDiagnostics() }
      }
      return this.seekCaptures(captures, timeMs)
    } catch (error) {
      return this.failure('RUNTIME_FLIP_COLD_SEEK_FAILED', error, { hostContextId, projectionEpoch, timeMs })
    }
  }

  /** Returns the furthest persisted capture end active at one host time. */
  getActiveEndAt(hostContextId: string, projectionEpoch: number, timeMs: number): number | undefined {
    const active = this.cache.findActiveAll(hostContextId, projectionEpoch, timeMs)
    if (active.length === 0) return undefined
    return Math.max(...active.map((capture) => capture.endAt))
  }

  /** Invalidates captures and overlays when the host coordinate epoch changes. */
  invalidateHost(hostContextId: string, projectionEpoch: number): FlipOperationResult<void> {
    this.cache.invalidateEpoch(hostContextId, projectionEpoch)
    this.historicalPoseCache.clear()
    this.overlayTemplates.clear()
    this.overlayContentState = undefined
    return this.cancel()
  }

  /** Finishes active overlays without changing the capture cache or host epoch. */
  cancel(): FlipOperationResult<void> {
    const diagnostics = new DiagnosticCollector({ output: this.diagnosticOutput })
    try {
      for (const itemId of [...this.overlayNodes.keys()]) this.releaseOverlaySubtree(itemId)
      this.overlayNodes.clear()
      for (const { captureId, handle } of this.activeLocalPoses.values()) this.projection.cancelLocalPose(handle, captureId)
      this.activeLocalPoses.clear()
      this.lastProjectionTimeMs = undefined
    } catch (error) {
      diagnostics.error('RUNTIME_FLIP_CANCEL_FAILED', error instanceof Error ? error.message : 'FLIP cancellation failed.')
      return { ok: false, diagnostics: diagnostics.report() }
    }
    return { ok: true, value: undefined, diagnostics: diagnostics.report() }
  }

  /** Releases every active projection and host-owned transient resource. */
  destroy(): void {
    this.cancel()
    this.projection.destroy?.()
    this.historicalPoseCache.clear()
    this.overlayTemplates.clear()
    this.overlayContentState = undefined
  }

  private startOverlay(capture: FlipCapture, itemId: string, handle: unknown): unknown {
    const entry = capture.entries.find((candidate) => candidate.itemId === itemId)
    if (entry === undefined) throw new Error(`FLIP capture item is missing: ${itemId}`)
    this.projection.excludeOverlayItem?.(itemId, entry.sourceTargetId)
    const template = this.findOverlayTemplate(capture, itemId)
    return this.projection.beginOverlay(handle, entry.from, entry.to, template, entry.overlayTargetByPerso)
  }

  /** Links a stable reflow sibling to the active overlay of its logical parent. */
  private resolveCaptureParentItemId(entry: FlipCapture['entries'][number]): Readonly<{ captureParentItemId?: string }> {
    if (entry.isDirectMover !== false) return {}
    const logicalParents = entry.overlayParentIds === undefined
      ? [entry.destinationParentId, entry.sourceParentId]
      : [
          ...[...entry.overlayParentIds].reverse(),
          entry.destinationParentId,
          entry.sourceParentId,
        ]
    for (const parentId of logicalParents) {
      if (parentId !== undefined && this.overlayNodes.has(parentId)) {
        return { captureParentItemId: parentId }
      }
    }
    return {}
  }

  /** Captures immutable FIRST subtrees before a generic mutation can reorder them. */
  private captureOverlayTemplates(entries: readonly import('./types').FlipEntry[]): ReadonlyMap<string, unknown> {
    if (this.projection.captureOverlayTemplate === undefined) return new Map()
    const templates = new Map<string, unknown>()
    const overlayItemIds = entries
      .filter((entry) => entry.mode === 'overlay-world')
      .map((entry) => entry.itemId)
    for (const entry of entries) {
      if (entry.mode !== 'overlay-world') continue
      const handle = this.projection.resolveHandle(entry.itemId)
      if (handle === undefined || handle === null) continue
      const descendantItemIds = entry.overlayTargetByPerso === undefined
        ? overlayItemIds.filter((itemId) => itemId !== entry.itemId)
        : Object.keys(entry.overlayTargetByPerso)
      const template = this.projection.captureOverlayTemplate(handle, descendantItemIds)
      if (template !== undefined) templates.set(entry.itemId, template)
    }
    return templates
  }

  /** Resolves a capture's immutable FIRST subtree through its primary or alias ID. */
  private findOverlayTemplate(capture: FlipCapture, itemId: string): unknown {
    const primary = this.overlayTemplates.get(capture.captureId)?.get(itemId)
    if (primary !== undefined) return primary
    for (const alias of capture.sourceCaptureIds ?? []) {
      const template = this.overlayTemplates.get(alias)?.get(itemId)
      if (template !== undefined) return template
    }
    return undefined
  }

  /** Finishes projections whose persisted captures ended before a new runtime instant. */
  private reconcileActiveProjections(timeMs: number): void {
    this.reconcileOverlayNodes(timeMs, false)
    for (const [itemId, active] of this.activeLocalPoses) {
      const capture = this.cache.get(active.captureId)
      if (capture === undefined || timeMs <= capture.endAt) continue
      this.projection.finishLocalPose(active.handle, active.captureId)
      this.activeLocalPoses.delete(itemId)
    }
  }

  /** Prevents a capture from being projected into another host or epoch. */
  private assertCaptureScope(capture: FlipCapture): void {
    if (capture.hostContextId !== this.projection.getHostContextId()) throw new Error('FLIP capture crosses host contexts.')
    if (capture.projectionEpoch !== this.projection.getProjectionEpoch()) throw new Error('FLIP capture uses a stale host projection epoch.')
  }

  /** Projects every active overlay node after recursively resolving its parent chain. */
  private applyOverlayProjectionNodes(timeMs: number): void {
    for (const node of this.overlayNodes.values()) {
      const resolved = resolveOverlayProjectionPose(
        node,
        this.overlayNodes,
        timeMs,
        (captureId) => this.cache.get(captureId),
        this.projection,
        this.historicalPoseCache,
      )
      if (resolved === undefined) continue
      this.projection.applyOverlayPose(node.handle, resolved)
    }
  }

  /** Reconciles every active ghost with the logical content of the current scene. */
  private syncOverlayContents(): void {
    const state = this.overlayContentState
    const sync = this.projection.syncOverlayContent
    if (state === undefined || sync === undefined) return
    for (const node of this.overlayNodes.values()) {
      const descendantItemIds = state.descendantsByOverlay[node.itemId] ?? []
      const descendantTargetByPerso: Record<string, string> = {}
      for (const itemId of descendantItemIds) {
        const targetId = state.targetByItem[itemId]
        if (targetId !== undefined) descendantTargetByPerso[itemId] = targetId
      }
      sync(node.handle, descendantItemIds, descendantTargetByPerso)
    }
  }

  /** Reasserts descendant ownership after the complete overlay forest is known. */
  private reconcileOverlayVisibility(): void {
    for (const node of this.overlayNodes.values()) {
      const capture = this.cache.get(node.captureId)
      const entry = capture?.entries.find((candidate) => candidate.itemId === node.itemId)
      if (entry?.mode !== 'overlay-world') continue
      // Visibility is a commit-wide property. Repeating the idempotent claim
      // after every capture has been resolved prevents a cold seek from
      // leaving a parent clone visible when its child ghost was materialized
      // earlier or when a later handoff restored a different target. The
      // active child ghost owns the item globally for this commit, so every
      // parent clone is hidden; target-specific restoration is reserved for
      // the release phase after this node no longer owns the item.
      this.projection.excludeOverlayItem?.(node.itemId)
    }
  }

  /** Completes direct nodes and propagates parent completion through the overlay tree. */
  private reconcileOverlayNodes(timeMs: number, includeEndpoint: boolean): void {
    let changed = true
    while (changed) {
      changed = false
      for (const snapshot of [...this.overlayNodes.values()]) {
        const node = this.overlayNodes.get(snapshot.itemId)
        if (node === undefined) continue
        if (node.state === 'capture') {
          const capture = this.cache.get(node.captureId)
          const ended = capture === undefined
            || (includeEndpoint ? timeMs >= capture.endAt : timeMs > capture.endAt)
          if (!ended) continue
          const entry = capture?.entries.find((candidate) => candidate.itemId === node.itemId)
          const parent = entry?.destinationParentId === undefined
            ? undefined
            : this.overlayNodes.get(entry.destinationParentId)
          const canHandoff = parent !== undefined
            && this.isParentContinuing(parent, capture?.endAt ?? timeMs)
          if (capture !== undefined && entry !== undefined && canHandoff && parent !== undefined) {
            const handoff = createOverlayHandoffNode(
              { ...node, ...(entry.destinationTargetId === undefined ? {} : { destinationTargetId: entry.destinationTargetId }) },
              parent,
              capture.endAt,
              this.overlayNodes,
              (captureId) => this.cache.get(captureId),
              this.projection,
              this.historicalPoseCache,
            )
            if (handoff !== undefined) {
              this.overlayNodes.set(node.itemId, handoff)
              changed = true
              continue
            }
          }
          this.releaseOverlaySubtree(node.itemId)
          changed = true
          continue
        }

        if (node.parentItemId === undefined) {
          this.releaseOverlaySubtree(node.itemId)
          changed = true
          continue
        }
        const parent = this.overlayNodes.get(node.parentItemId)
        if (parent === undefined || !this.isParentContinuing(parent, timeMs, includeEndpoint)) {
          this.releaseOverlaySubtree(node.itemId)
          changed = true
        }
      }
    }
  }

  /** Reports whether a parent node still supplies a visible trajectory. */
  private isParentContinuing(node: OverlayProjectionNode, timeMs: number, includeEndpoint = false): boolean {
    return isOverlayNodeContinuing(
      node,
      this.overlayNodes,
      timeMs,
      includeEndpoint,
      (captureId) => this.cache.get(captureId),
    )
  }

  /** Completes local poses at their inclusive LAST boundary. */
  private finishCompletedLocalPoses(timeMs: number): void {
    for (const [itemId, active] of this.activeLocalPoses) {
      const capture = this.cache.get(active.captureId)
      if (capture === undefined || timeMs < capture.endAt) continue
      this.projection.finishLocalPose(active.handle, active.captureId)
      this.activeLocalPoses.delete(itemId)
    }
  }

  /** Replaces a node only when a different capture takes its logical ownership. */
  private releaseOverlayNodeIfReplaced(itemId: string, capture: FlipCapture): void {
    const active = this.overlayNodes.get(itemId)
    if (active === undefined || this.sameCaptureOwnership(active.captureId, capture)) return
    this.releaseOverlaySubtree(itemId)
  }

  /** Releases one overlay node and restores only its destination ownership. */
  private releaseOverlayNode(itemId: string): void {
    const node = this.overlayNodes.get(itemId)
    if (node === undefined) return
    this.projection.finishOverlay(node.handle)
    this.restoreOverlayItem(node.captureId, itemId, node.destinationTargetId)
    this.overlayNodes.delete(itemId)
  }

  /** Releases a node and every recursive handoff descendant that depends on it. */
  private releaseOverlaySubtree(itemId: string): void {
    const dependents = [...this.overlayNodes.values()]
      .filter((node) => node.state === 'handoff' && node.parentItemId === itemId)
    for (const dependent of dependents) this.releaseOverlaySubtree(dependent.itemId)
    this.releaseOverlayNode(itemId)
  }

  /** Restores a descendant only in ghosts whose FIRST target matches its LAST target. */
  private restoreOverlayItem(captureId: string, itemId: string, destinationTargetId?: string): void {
    const capture = this.cache.get(captureId)
    const entry = capture?.entries.find((candidate) => candidate.itemId === itemId)
    this.projection.restoreOverlayItem?.(itemId, destinationTargetId ?? entry?.destinationTargetId)
  }

  /** Cancels a previous local projection when a newer capture takes ownership. */
  private cancelLocalPoseIfNeeded(itemId: string, capture: FlipCapture): void {
    const active = this.activeLocalPoses.get(itemId)
    if (active === undefined || this.sameCaptureOwnership(active.captureId, capture)) return
    this.projection.cancelLocalPose(active.handle, active.captureId)
    this.activeLocalPoses.delete(itemId)
  }

  /** Keeps one projection handle when a grouped capture replaces its aliases. */
  private sameCaptureOwnership(activeCaptureId: string, capture: FlipCapture): boolean {
    if (activeCaptureId === capture.captureId) return true
    const activeCapture = this.cache.get(activeCaptureId)
    if (activeCapture === undefined) return false
    const activeIdentities = new Set([activeCapture.captureId, ...(activeCapture.sourceCaptureIds ?? [])])
    const captureIdentities = new Set([capture.captureId, ...(capture.sourceCaptureIds ?? [])])
    for (const identity of activeIdentities) if (captureIdentities.has(identity)) return true
    return false
  }

  /** Clears host transient writes before a historical layout realization. */
  private suspendTransientProjections(): void {
    this.projection.suspendTransientForHistorical?.()
    this.overlayNodes.clear()
    this.activeLocalPoses.clear()
  }

  /** Converts one boundary exception into the shared V2 diagnostic result. */
  private failure<T>(code: string, error: unknown, context: Record<string, unknown>): FlipOperationResult<T> {
    const diagnostics = new DiagnosticCollector({ output: this.diagnosticOutput })
    diagnostics.error(code, error instanceof Error ? error.message : 'HTML FLIP operation failed.', { context })
    return { ok: false, diagnostics: diagnostics.report() }
  }
}

/** Creates an empty detached diagnostic report for one successful operation. */
function emptyDiagnostics() {
  return new DiagnosticCollector({ output: () => undefined }).report()
}

/** Normalizes the legacy single-capture resolver result to the shared list form. */
function normalizeResolvedCaptures(
  resolved: FlipCapture | readonly FlipCapture[] | undefined,
): readonly FlipCapture[] {
  if (resolved === undefined) return []
  return Array.isArray(resolved)
    ? [...(resolved as readonly FlipCapture[])]
    : [resolved as FlipCapture]
}
