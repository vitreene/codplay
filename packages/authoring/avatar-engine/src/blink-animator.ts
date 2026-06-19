/**
 * BlinkAnimator — drives a single blink animation sequence via morphEngine.
 *
 * Triggered by trigger(). Advances each update(dt) call.
 * Uses snapFixed: the animator itself computes the smooth 0→1→0 curve, so the
 * morph engine's easing layer must be bypassed — setFixed would lag behind the
 * fast-changing per-frame target and the eye would never visibly close.
 * CodPlay is the sole source of time: update() is called from engine.animate().
 */
import type { MorphEngine } from './morph-engine.js'

const CLOSE_MS = 80
const HOLD_MS  = 80
const OPEN_MS  = 150
const TOTAL_MS = CLOSE_MS + HOLD_MS + OPEN_MS

export class BlinkAnimator {
  private readonly morphEngine: MorphEngine
  private _elapsed = -1

  constructor(morphEngine: MorphEngine) {
    this.morphEngine = morphEngine
  }

  /** Start a blink. Ignored if one is already in progress. */
  trigger(): void {
    if (this._elapsed >= 0) return
    this._elapsed = 0
  }

  update(dt: number): void {
    if (this._elapsed < 0) return
    this._elapsed += dt

    let v: number
    if (this._elapsed < CLOSE_MS) {
      v = this._elapsed / CLOSE_MS
    } else if (this._elapsed < CLOSE_MS + HOLD_MS) {
      v = 1
    } else if (this._elapsed < TOTAL_MS) {
      v = 1 - (this._elapsed - CLOSE_MS - HOLD_MS) / OPEN_MS
    } else {
      this.morphEngine.snapFixed('eyesClosed', 0)
      this._elapsed = -1
      return
    }

    this.morphEngine.snapFixed('eyesClosed', v)
  }

  /** Snap eyes open and cancel any in-progress animation. */
  reset(): void {
    this._elapsed = -1
    this.morphEngine.snapFixed('eyesClosed', 0)  // snap (not set) — seek reset must be instant
  }
}
