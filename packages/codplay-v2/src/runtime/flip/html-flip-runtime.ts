import { captureFlip, FlipCaptureCache } from './flip-capture'
import { FlipHistoricalPoseCache, resolveFlipPoseGraph } from './flip-pose-graph'
import type { FlipCapture, FlipCaptureRequest, FlipCaptureResolver, HtmlFlipProjection } from './types'

/** Runs HTML FLIP captures and commits one resolved pose per touched item. */
export class HtmlFlipRuntime {
  private readonly activeOverlays = new Map<string, { captureId: string; handle: unknown }>()
  private readonly projection: HtmlFlipProjection
  private readonly cache: FlipCaptureCache
  private readonly captureResolver: FlipCaptureResolver | undefined
  private readonly historicalPoseCache = new FlipHistoricalPoseCache()

  /** Creates one runtime around one host-owned HTML projection. */
  constructor(
    projection: HtmlFlipProjection,
    cache = new FlipCaptureCache(),
    captureResolver?: FlipCaptureResolver,
  ) {
    this.projection = projection
    this.cache = cache
    this.captureResolver = captureResolver
  }

  /** Captures one consumer mutation and stores only numeric pose data. */
  capture(request: FlipCaptureRequest): FlipCapture {
    return captureFlip(request, this.projection, this.cache)
  }

  /** Runs one capture transaction and presents its initial pose. */
  run(request: FlipCaptureRequest): FlipCapture {
    const capture = this.capture(request)
    this.seek(capture, capture.startAt)
    return capture
  }

  /** Resolves and commits every item in one capture at one timeline instant. */
  seek(capture: FlipCapture, timeMs: number): void {
    this.assertCaptureScope(capture)
    const poses = resolveFlipPoseGraph(capture, timeMs, this.projection, this.historicalPoseCache)
    for (const resolved of poses) {
      const handle = this.projection.resolveHandle(resolved.itemId)
      if (handle === undefined || handle === null) throw new Error(`FLIP HTML handle is missing: ${resolved.itemId}`)
      if (resolved.mode === 'overlay-world') {
        const active = this.activeOverlays.get(resolved.itemId)
        if (active !== undefined && active.captureId !== capture.captureId) {
          this.projection.finishOverlay(active.handle)
          this.activeOverlays.delete(resolved.itemId)
        }
        const overlay = this.activeOverlays.get(resolved.itemId)?.handle
          ?? this.startOverlay(capture, resolved.itemId, handle)
        this.activeOverlays.set(resolved.itemId, { captureId: capture.captureId, handle: overlay })
        this.projection.applyOverlayPose(overlay, resolved)
      } else {
        this.projection.applyLocalPose(handle, resolved)
      }
    }
    this.projection.flush()
    this.finishCompletedOverlays(capture, timeMs)
  }

  /** Resolves a cached capture without allowing a missing capture to be invented. */
  seekCached(hostContextId: string, projectionEpoch: number, timeMs: number): void {
    if (hostContextId !== this.projection.getHostContextId()) throw new Error('FLIP capture crosses host contexts.')
    if (projectionEpoch !== this.projection.getProjectionEpoch()) throw new Error('FLIP capture uses a stale host projection epoch.')
    let capture = this.cache.findActive(hostContextId, projectionEpoch, timeMs)
    if (capture === undefined && this.captureResolver !== undefined) {
      capture = this.captureResolver({ hostContextId, projectionEpoch, timeMs })
    }
    if (capture === undefined) throw new Error(`FLIP capture is missing at ${timeMs}ms for host ${hostContextId}.`)
    if (timeMs < capture.startAt || timeMs > capture.endAt) throw new Error(`FLIP capture resolver returned an inactive capture at ${timeMs}ms.`)
    this.assertCaptureScope(capture)
    this.cache.set(capture)
    this.seek(capture, timeMs)
  }

  /** Invalidates captures and overlays when the host coordinate epoch changes. */
  invalidateHost(hostContextId: string, projectionEpoch: number): void {
    this.cache.invalidateEpoch(hostContextId, projectionEpoch)
    this.historicalPoseCache.clear()
    this.cancel()
  }

  /** Finishes active overlays without changing the capture cache or host epoch. */
  cancel(): void {
    for (const { handle } of this.activeOverlays.values()) this.projection.finishOverlay(handle)
    this.activeOverlays.clear()
  }

  private startOverlay(capture: FlipCapture, itemId: string, handle: unknown): unknown {
    const entry = capture.entries.find((candidate) => candidate.itemId === itemId)
    if (entry === undefined) throw new Error(`FLIP capture item is missing: ${itemId}`)
    return this.projection.beginOverlay(handle, entry.from, entry.to)
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
      this.activeOverlays.delete(entry.itemId)
    }
  }
}
