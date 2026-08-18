import { captureFlip, FlipCaptureCache } from './flip-capture'
import { FlipHistoricalPoseCache, resolveFlipPoseGraph } from './flip-pose-graph'
import { DiagnosticCollector } from '../../diagnostics'
import type {
  FlipCapture,
  FlipCaptureRequest,
  FlipCaptureResolver,
  FlipOperationResult,
  HtmlFlipProjection,
  HtmlFlipRuntimeOptions,
} from './types'

/** Runs HTML FLIP captures and commits one resolved pose per touched item. */
export class HtmlFlipRuntime {
  private readonly activeOverlays = new Map<string, { captureId: string; handle: unknown }>()
  private readonly activeLocalPoses = new Map<string, { captureId: string; handle: unknown }>()
  private readonly projection: HtmlFlipProjection
  private readonly cache: FlipCaptureCache
  private readonly captureResolver: FlipCaptureResolver | undefined
  private readonly diagnosticOutput: HtmlFlipRuntimeOptions['diagnosticOutput']
  private readonly historicalPoseCache = new FlipHistoricalPoseCache()
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
  }

  /** Captures one consumer mutation and stores only numeric pose data. */
  capture(request: FlipCaptureRequest): FlipOperationResult<FlipCapture> {
    try {
      this.reconcileActiveProjections(request.startAt)
      const active = this.cache.findActiveAll(request.hostContextId, request.projectionEpoch, request.startAt)
        .filter((capture) => capture.endAt > request.startAt)
        .filter((capture) => capture.entries.some((entry) => entry.mode === 'overlay-world'))
      if (active.length > 0) {
        const presented = this.seekCaptures(active, request.startAt)
        if (!presented.ok) throw new Error(presented.diagnostics.errors.map((entry) => entry.message).join('\n'))
      }
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

  /** Resolves and commits every item in one capture at one timeline instant. */
  seek(capture: FlipCapture, timeMs: number): FlipOperationResult<void> {
    return this.seekCaptures([capture], timeMs)
  }

  /** Resolves several overlapping captures and commits them with one flush. */
  private seekCaptures(captures: readonly FlipCapture[], timeMs: number, finishCompleted = true): FlipOperationResult<void> {
    try {
      for (const capture of captures) {
        this.assertCaptureScope(capture)
        const poses = resolveFlipPoseGraph(capture, timeMs, this.projection, this.historicalPoseCache)
        for (const resolved of poses) {
          const handle = this.projection.resolveHandle(resolved.itemId)
          if (handle === undefined || handle === null) throw new Error(`FLIP HTML handle is missing: ${resolved.itemId}`)
          if (resolved.mode === 'overlay-world') {
            this.cancelLocalPoseIfNeeded(resolved.itemId, capture.captureId)
            const active = this.activeOverlays.get(resolved.itemId)
            if (active !== undefined && active.captureId !== capture.captureId) {
              this.projection.finishOverlay(active.handle)
              this.projection.restoreOverlayItem?.(resolved.itemId)
              this.activeOverlays.delete(resolved.itemId)
            }
            const overlay = this.activeOverlays.get(resolved.itemId)?.handle
              ?? this.startOverlay(capture, resolved.itemId, handle)
            this.activeOverlays.set(resolved.itemId, { captureId: capture.captureId, handle: overlay })
            this.projection.applyOverlayPose(overlay, resolved)
          } else {
            const activeOverlay = this.activeOverlays.get(resolved.itemId)
            if (activeOverlay !== undefined) {
              this.projection.finishOverlay(activeOverlay.handle)
              this.projection.restoreOverlayItem?.(resolved.itemId)
              this.activeOverlays.delete(resolved.itemId)
            }
            this.cancelLocalPoseIfNeeded(resolved.itemId, capture.captureId)
            this.activeLocalPoses.set(resolved.itemId, { captureId: capture.captureId, handle })
            this.projection.applyLocalPose(handle, resolved)
          }
        }
      }
      this.projection.flush()
      if (finishCompleted) for (const capture of captures) this.finishCompletedOverlays(capture, timeMs)
      this.lastProjectionTimeMs = timeMs
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
      if (captures.length === 0 && this.captureResolver !== undefined) {
        const capture = this.captureResolver({ hostContextId, projectionEpoch, timeMs })
        captures = capture === undefined ? [] : [capture]
      }
      if (captures.length === 0) {
        this.lastProjectionTimeMs = timeMs
        return { ok: true, value: undefined, diagnostics: emptyDiagnostics() }
      }
      for (const capture of captures) {
        if (timeMs < capture.startAt || timeMs > capture.endAt) throw new Error(`FLIP capture resolver returned an inactive capture at ${timeMs}ms.`)
        this.assertCaptureScope(capture)
        this.cache.set(capture)
      }
      return this.seekCaptures(captures, timeMs)
    } catch (error) {
      return this.failure('RUNTIME_FLIP_COLD_SEEK_FAILED', error, { hostContextId, projectionEpoch, timeMs })
    }
  }

  /** Invalidates captures and overlays when the host coordinate epoch changes. */
  invalidateHost(hostContextId: string, projectionEpoch: number): FlipOperationResult<void> {
    this.cache.invalidateEpoch(hostContextId, projectionEpoch)
    this.historicalPoseCache.clear()
    return this.cancel()
  }

  /** Finishes active overlays without changing the capture cache or host epoch. */
  cancel(): FlipOperationResult<void> {
    const diagnostics = new DiagnosticCollector({ output: this.diagnosticOutput })
    try {
      for (const [itemId, { handle }] of this.activeOverlays) {
        this.projection.finishOverlay(handle)
        this.projection.restoreOverlayItem?.(itemId)
      }
      this.activeOverlays.clear()
      for (const { captureId, handle } of this.activeLocalPoses.values()) this.projection.cancelLocalPose(handle, captureId)
      this.activeLocalPoses.clear()
      this.lastProjectionTimeMs = undefined
    } catch (error) {
      diagnostics.error('RUNTIME_FLIP_CANCEL_FAILED', error instanceof Error ? error.message : 'FLIP cancellation failed.')
      return { ok: false, diagnostics: diagnostics.report() }
    }
    return { ok: true, value: undefined, diagnostics: diagnostics.report() }
  }

  private startOverlay(capture: FlipCapture, itemId: string, handle: unknown): unknown {
    const entry = capture.entries.find((candidate) => candidate.itemId === itemId)
    if (entry === undefined) throw new Error(`FLIP capture item is missing: ${itemId}`)
    this.projection.excludeOverlayItem?.(itemId)
    return this.projection.beginOverlay(handle, entry.from, entry.to)
  }

  /** Finishes projections whose persisted captures ended before a new runtime instant. */
  private reconcileActiveProjections(timeMs: number): void {
    for (const [itemId, active] of this.activeOverlays) {
      const capture = this.cache.get(active.captureId)
      if (capture === undefined || timeMs <= capture.endAt) continue
      this.projection.finishOverlay(active.handle)
      this.projection.restoreOverlayItem?.(itemId)
      this.activeOverlays.delete(itemId)
    }
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

  private finishCompletedOverlays(capture: FlipCapture, timeMs: number): void {
    for (const entry of capture.entries) {
      if (entry.mode !== 'overlay-world' || timeMs < entry.endAt) continue
      const active = this.activeOverlays.get(entry.itemId)
      if (active === undefined || active.captureId !== capture.captureId) continue
      this.projection.finishOverlay(active.handle)
      this.projection.restoreOverlayItem?.(entry.itemId)
      this.activeOverlays.delete(entry.itemId)
    }

    for (const entry of capture.entries) {
      if (entry.mode !== 'local' || timeMs < entry.endAt) continue
      const active = this.activeLocalPoses.get(entry.itemId)
      if (active === undefined || active.captureId !== capture.captureId) continue
      this.projection.finishLocalPose(active.handle, active.captureId)
      this.activeLocalPoses.delete(entry.itemId)
    }
  }

  /** Cancels a previous local projection when a newer capture takes ownership. */
  private cancelLocalPoseIfNeeded(itemId: string, captureId: string): void {
    const active = this.activeLocalPoses.get(itemId)
    if (active === undefined || active.captureId === captureId) return
    this.projection.cancelLocalPose(active.handle, active.captureId)
    this.activeLocalPoses.delete(itemId)
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
