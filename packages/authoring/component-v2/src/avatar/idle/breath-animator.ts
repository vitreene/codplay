/**
 * BreathAnimator — drives one facial and torso breath swell via MorphEngine.
 *
 * Triggered by trigger(). Advances each update(dt) call.
 * Uses snapFixed to bypass MorphEngine easing — the breath has its own triangle envelope.
 * CodPlay is the sole source of time: update() is called from engine.animate().
 */
import type { MorphEngine } from '../morph/morph-engine.js'

const TOTAL_MS = 1500
const MOUTH_PEAK = 0.12
const CHEST_PEAK = 0.8

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
      this.morphEngine.snapFixed('chestInhale', null)
      this.morphEngine.snapFixed('mouthShrugLower', null)
      this._elapsed = -1
      return
    }

    const t = this._elapsed / TOTAL_MS
    let envelope: number
    if (t < 0.33) {
      envelope = t / 0.33
    } else if (t < 0.66) {
      envelope = 1
    } else {
      envelope = (1 - t) / 0.34
    }

    this.morphEngine.snapFixed('chestInhale', envelope * CHEST_PEAK)
    this.morphEngine.snapFixed('mouthShrugLower', envelope * MOUTH_PEAK)
  }

  /** Snap breath to rest and cancel any in-progress animation. */
  reset(): void {
    this._elapsed = -1
    this.morphEngine.snapFixed('chestInhale', null)
    this.morphEngine.snapFixed('mouthShrugLower', null)
  }
}
