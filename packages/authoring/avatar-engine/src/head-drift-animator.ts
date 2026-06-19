/**
 * HeadDriftAnimator — continuous sinusoidal head micro-movement.
 *
 * Transposed from TalkingHead by Mika Suominen (met4citizen), MIT licence.
 * Source: https://github.com/met4citizen/TalkingHead
 *
 * Two sine waves per axis produce a slow, organic drift that cannot be
 * expressed as periodic semantic poses. Computation lives here so the
 * CodPlay strap only sends one enable event — no per-frame events.
 *
 * Enabled by `avatar:idle` (single event), reset by `engine.prepareSeek()`.
 * Works via the bone callback (headRotateX/Y are bone morphs), so Three.js
 * bone rotations are written directly — no mesh morph target involved.
 */
import type { MorphEngine } from './morph-engine.js'

export class HeadDriftAnimator {
  private readonly morphEngine: MorphEngine
  private _enabled = false
  private _elapsed = 0

  constructor(morphEngine: MorphEngine) {
    this.morphEngine = morphEngine
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled
    if (!enabled) {
      this.morphEngine.snapFixed('headRotateX', 0)
      this.morphEngine.snapFixed('headRotateY', 0)
    }
  }

  update(dt: number): void {
    if (!this._enabled) return
    this._elapsed += dt
    const t = this._elapsed
    // Original TH constants: two sine waves per axis, incommensurate periods.
    const hx = Math.sin(t * 0.00032) * 0.10 + Math.sin(t * 0.00071) * 0.04
    const hy = Math.sin(t * 0.00051) * 0.14 + Math.sin(t * 0.00087) * 0.06
    this.morphEngine.snapFixed('headRotateX', hx)
    this.morphEngine.snapFixed('headRotateY', hy)
  }

  reset(): void {
    this._elapsed = 0
    this._enabled = false
    this.morphEngine.snapFixed('headRotateX', 0)
    this.morphEngine.snapFixed('headRotateY', 0)
  }
}
