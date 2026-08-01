/** Information sent to each render adapter on every accepted engine frame. */
export type RenderTickInfo = Readonly<{
  nowMs: number
  deltaMs: number
  timelineMs: number
  timelineDeltaMs: number
  rate: number
}>

/** Information sent to each render adapter after a logical seek. */
export type RenderSeekInfo = Readonly<{
  nowMs: number
  timelineMs: number
}>

/** Boundary between the V2 player clock and an external render implementation. */
export interface RenderAdapter {
  /** Advances one adapter and lets it render the resulting state. */
  tick(info: RenderTickInfo): void

  /** Resets adapter-local temporal state before seek reconstruction. */
  prepareSeek?(): void

  /** Snaps the adapter to the reconstructed seek state without easing. */
  seek(info: RenderSeekInfo): void

  /** Notifies the adapter that logical playback paused. */
  pause?(): void

  /** Notifies the adapter that logical playback resumed. */
  resume?(): void

  /** Notifies the adapter that the playback rate changed. */
  rateChange?(rate: number): void

  /** Releases adapter resources when the player stops. */
  stop?(): void
}
