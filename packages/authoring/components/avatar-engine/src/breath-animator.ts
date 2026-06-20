/**
 * BreathAnimator — drives a single breath swell via morphEngine.
 *
 * Triggered by trigger(). Advances each update(dt) call.
 * Uses snapFixed to bypass MorphEngine easing — the breath has its own triangle envelope.
 * CodPlay is the sole source of time: update() is called from engine.animate().
 */
import type { MorphEngine } from './morph-engine.js'

const TOTAL_MS = 1500
const PEAK     = 0.12

export class BreathAnimator {
  private readonly morphEngine: MorphEngine
  private _elapsed = -1

  constructor(morphEngine: MorphEngine) {
    this.morphEngine = morphEngine
  }

  /** Start a breath swell. Ignored if one is already in progress. */
  trigger(): void {
    if (this._elapsed >= 0) return
    this._elapsed = 0
  }

  update(dt: number): void {
    if (this._elapsed < 0) return
    this._elapsed += dt

    if (this._elapsed >= TOTAL_MS) {
      this.morphEngine.snapFixed('mouthShrugLower', 0)
      this._elapsed = -1
      return
    }

    const t = this._elapsed / TOTAL_MS
    let v: number
    if (t < 0.33) {
      v = (t / 0.33) * PEAK
    } else if (t < 0.66) {
      v = PEAK
    } else {
      v = ((1 - t) / 0.34) * PEAK
    }

    this.morphEngine.snapFixed('mouthShrugLower', v)
  }

  /** Snap breath to rest and cancel any in-progress animation. */
  reset(): void {
    this._elapsed = -1
    this.morphEngine.snapFixed('mouthShrugLower', 0)
  }
}
