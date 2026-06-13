/**
 * Information dispatched to every RenderAdapter on each playback frame.
 *
 * nowMs           — monotonic wall-clock timestamp (performance.now())
 * deltaMs         — wall-clock delta since the previous tick; 0 on the first tick after play/resume
 * timelineMs      — current scene timeline position
 * timelineDeltaMs — delta in scene time (deltaMs × rate)
 * rate            — current playback rate
 */
export type RenderTickInfo = {
  nowMs: number
  deltaMs: number
  timelineMs: number
  timelineDeltaMs: number
  rate: number
}

/**
 * Information dispatched to every RenderAdapter after a seek.
 * State has already been reconstructed by track replay.
 * Adapters must snap to this position instantly — no easing.
 *
 * nowMs        — wall-clock time at the moment seek completed
 * timelineMs   — target scene position
 */
export type RenderSeekInfo = {
  nowMs: number
  timelineMs: number
}

/**
 * Coupling point between CodPlay's ticker and an external rendering library.
 *
 * CodPlay sends a rich info object; each adapter is responsible for translating
 * it to the library's own API. CodPlay knows nothing about the library internals.
 *
 * Adapters are called in registration order. Errors in one adapter are traced
 * as author warnings and do not interrupt the others.
 */
export interface RenderAdapter {
  /** Called every playback frame. Advance state, then render. */
  tick(info: RenderTickInfo): void
  /** Called once after seek reconstruction. Snap to position instantly — no easing. */
  seek(info: RenderSeekInfo): void
  /** Called when playback pauses. */
  pause?(): void
  /** Called when playback resumes after a pause. */
  resume?(): void
  /** Called when the playback rate changes. */
  rateChange?(rate: number): void
  /** Called on stop/destroy. Release resources. */
  stop?(): void
}
