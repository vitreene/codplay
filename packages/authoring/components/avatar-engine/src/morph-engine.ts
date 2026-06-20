/**
 * Morph target easing engine.
 *
 * Derived from TalkingHead by Mika Suominen (met4citizen), MIT licence.
 * Source: https://github.com/met4citizen/TalkingHead
 *
 * Simplified for data-driven use in CodPlay:
 * - Only two value channels: fixed (event-driven) and baseline (mood).
 * - No animation queue (system/realtime/newvalue channels removed).
 * - Bone-driven morphs (bodyRotate*, headRotate*, handFist*, chestInhale)
 *   dispatch to an optional onBone callback instead of writing to ms[].
 * - seek: snapAll() applies values instantly, bypassing easing.
 */

/** One Three.js SkinnedMesh morphTargetInfluences array + the index within it. */
export type MorphSlot = { influences: number[]; index: number }

export type BoneMorphName =
  | 'bodyRotateX' | 'bodyRotateY' | 'bodyRotateZ'
  | 'headRotateX' | 'headRotateY' | 'headRotateZ'
  | 'handFistLeft' | 'handFistRight'
  | 'chestInhale'

export type MorphEntry = {
  /** CodPlay event-set override. null = not overridden. */
  fixed: number | null
  /** Mood resting value. null = use 0. */
  baseline: number | null
  /** Current eased value. */
  value: number
  /** Last value written to Three.js. */
  applied: number
  /** Current velocity (per ms). */
  v: number
  needsUpdate: boolean
  /** Acceleration per ms (from TH: 0.01/1000 standard, 0.1/1000 for eyeBlink/eyeLook). */
  acc: number
  /** Max velocity per ms (from TH: 5/1000 standard, 1/1000 for bodyRotate). */
  maxv: number
  min: number
  max: number
  /** Applied value limiter — used for eyelid/brow interdependency. */
  limit: ((v: number) => number) | null
  /** Called when value changes — used for needsUpdate propagation. */
  onchange: ((v: number) => void) | null
  /** Three.js influence arrays hosting this morph (one per mesh that owns it). */
  slots: MorphSlot[]
  /** Set for bone-driven morphs — no slots, uses onBone callback instead. */
  boneName?: BoneMorphName
}

/** Aliases that fan out to multiple real morphs (from TH mtExtras). */
export type MorphAlias = {
  targets: { name: string; factor: number }[]
}

export type BoneCallback = (name: BoneMorphName, value: number) => void

const STD_ACC = 0.01 / 1000
const FAST_ACC = 0.1 / 1000
// Fast easing: ~22 % progress per 60 fps frame — visible in 2-3 frames, smooth crossfade.
// Used for eyeBlink (150 ms window) and viseme (needs to track phoneme tempo).
const LIVE_ACC = 1 / 1000
const STD_MAXV = 5 / 1000
const SLOW_MAXV = 1 / 1000

/** Returns default MorphEntry values for a given morph name. */
function defaultEntry(name: string): Omit<MorphEntry, 'slots'> {
  const isBodyRotate = name.startsWith('bodyRotate')
  const isHeadRotate = name.startsWith('headRotate')
  const isEyeBlink   = name.startsWith('eyeBlink')
  const isEyeLook    = name.startsWith('eyeLook')
  const isViseme     = name.startsWith('viseme_')

  return {
    fixed: null,
    baseline: isBodyRotate || isEyeLook ? null : 0,
    value: 0,
    applied: 0,
    v: 0,
    needsUpdate: false,
    acc: isEyeBlink || isViseme ? LIVE_ACC : isEyeLook || isHeadRotate ? FAST_ACC : STD_ACC,
    maxv: isBodyRotate ? SLOW_MAXV : STD_MAXV,
    min: isBodyRotate || isHeadRotate ? -1 : 0,
    max: 1,
    limit: null,
    onchange: null,
  }
}

/** Standard aliases (from TH mtExtras). */
export const MORPH_ALIASES: Record<string, MorphAlias> = {
  mouthOpen:    { targets: [{ name: 'jawOpen', factor: 0.5 }] },
  mouthSmile:   { targets: [{ name: 'mouthSmileLeft', factor: 0.8 }, { name: 'mouthSmileRight', factor: 0.8 }] },
  eyesClosed:   { targets: [{ name: 'eyeBlinkLeft', factor: 1 }, { name: 'eyeBlinkRight', factor: 1 }] },
  eyesLookUp:   { targets: [{ name: 'eyeLookUpLeft', factor: 1 }, { name: 'eyeLookUpRight', factor: 1 }] },
  eyesLookDown: { targets: [{ name: 'eyeLookDownLeft', factor: 1 }, { name: 'eyeLookDownRight', factor: 1 }] },
}

/** Bone-driven "morphs" — values are forwarded to onBone, not to ms[]. */
export const BONE_MORPH_NAMES: BoneMorphName[] = [
  'bodyRotateX', 'bodyRotateY', 'bodyRotateZ',
  'headRotateX', 'headRotateY', 'headRotateZ',
  'handFistLeft', 'handFistRight',
  'chestInhale',
]

export class MorphEngine {
  /** All tracked morphs (blend shape + bone). */
  readonly morphs = new Map<string, MorphEntry>()
  /** Alias definitions (read-only after init). */
  readonly aliases: typeof MORPH_ALIASES = MORPH_ALIASES

  private onBone: BoneCallback | null = null

  /**
   * Register a blend-shape morph after discovering it in a GLB.
   * If called multiple times with the same name, the new slots are appended
   * (the morph may live on multiple meshes).
   */
  registerBlendMorph(name: string, slot: MorphSlot): void {
    const existing = this.morphs.get(name)
    if (existing) {
      existing.slots.push(slot)
    } else {
      this.morphs.set(name, { ...defaultEntry(name), slots: [slot] })
    }
  }

  /** Register all bone-driven morphs (no slots). */
  registerBoneMorphs(onBone: BoneCallback): void {
    this.onBone = onBone
    for (const bname of BONE_MORPH_NAMES) {
      if (!this.morphs.has(bname)) {
        this.morphs.set(bname, { ...defaultEntry(bname), slots: [], boneName: bname as BoneMorphName })
      }
    }
  }

  /**
   * Set the fixed override for a morph name.
   * Supports aliases (fanout to real morphs with factor scaling).
   */
  setFixed(name: string, value: number | null): void {
    const alias = this.aliases[name]
    if (alias) {
      for (const { name: target, factor } of alias.targets) {
        this._setFixed(target, value === null ? null : value * factor)
      }
      return
    }
    this._setFixed(name, value)
  }

  private _setFixed(name: string, value: number | null): void {
    const mt = this.morphs.get(name)
    if (!mt) return
    mt.fixed = value
    mt.needsUpdate = true
  }

  /**
   * Set the fixed override and immediately snap to the target — no easing.
   * Use for speech visemes, which must track the audio timing exactly.
   * Supports aliases.
   */
  snapFixed(name: string, value: number | null): void {
    const alias = this.aliases[name]
    if (alias) {
      for (const { name: target, factor } of alias.targets) {
        this._snapFixed(target, value === null ? null : value * factor)
      }
      return
    }
    this._snapFixed(name, value)
  }

  private _snapFixed(name: string, value: number | null): void {
    const mt = this.morphs.get(name)
    if (!mt) return
    mt.fixed = value
    const target = value !== null ? value : (mt.baseline ?? 0)
    const limited = mt.limit !== null ? mt.limit(target) : target
    const clamped = Math.max(mt.min, Math.min(mt.max, limited))
    mt.value = clamped
    mt.applied = clamped
    mt.v = 0
    mt.needsUpdate = false
    if (mt.boneName !== undefined) {
      this.onBone?.(mt.boneName, clamped)
    } else {
      for (const slot of mt.slots) {
        slot.influences[slot.index] = clamped
      }
    }
  }

  /**
   * Set the mood baseline for a morph (typically set by ExpressionEngine).
   * Supports aliases (fanout to real morphs with factor scaling).
   */
  setBaseline(name: string, value: number | null): void {
    const alias = this.aliases[name]
    if (alias) {
      for (const { name: target, factor } of alias.targets) {
        this._setBaseline(target, value === null ? null : value * factor)
      }
      return
    }
    this._setBaseline(name, value)
  }

  private _setBaseline(name: string, value: number | null): void {
    const mt = this.morphs.get(name)
    if (!mt) return
    mt.baseline = value
    mt.needsUpdate = true
  }

  /** Advance all morphs by deltaMs. */
  update(deltaMs: number): void {
    for (const [, o] of this.morphs) {
      if (!o.needsUpdate) continue

      const target = o.fixed !== null ? o.fixed : (o.baseline ?? 0)

      let newvalue: number
      const diff = target - o.value

      if (Math.abs(diff) < 0.005) {
        newvalue = target
        o.v = 0
        o.needsUpdate = false
      } else if (diff > 0) {
        if (o.v < 0) o.v = 0  // velocity was in wrong direction — reset before re-accelerating
        if (o.v < o.maxv) o.v += o.acc * deltaMs
        newvalue = o.value + diff * (1 - Math.exp(-o.v * deltaMs))
        if (newvalue >= target) { newvalue = target; o.v = 0; o.needsUpdate = false }
      } else {
        if (o.v > 0) o.v = 0  // velocity was in wrong direction — reset before re-accelerating
        if (o.v > -o.maxv) o.v -= o.acc * deltaMs
        newvalue = o.value + diff * (1 - Math.exp(o.v * deltaMs))
        if (newvalue <= target) { newvalue = target; o.v = 0; o.needsUpdate = false }
      }

      if (newvalue === o.value) continue
      o.value = newvalue
      o.onchange?.(newvalue)

      const limited = o.limit !== null ? o.limit(newvalue) : newvalue
      const clamped = Math.max(o.min, Math.min(o.max, limited))
      if (clamped === o.applied) continue
      o.applied = clamped

      if (o.boneName !== undefined) {
        this.onBone?.(o.boneName, clamped)
      } else {
        for (const slot of o.slots) {
          slot.influences[slot.index] = clamped
        }
      }
    }
  }

  /**
   * Snap all morphs to their current target instantly — no easing.
   * Called by the avatar engine after seek, before render.
   */
  snapAll(): void {
    for (const o of this.morphs.values()) {
      const target = o.fixed !== null ? o.fixed : (o.baseline ?? 0)
      const limited = o.limit !== null ? o.limit(target) : target
      const clamped = Math.max(o.min, Math.min(o.max, limited))
      o.value = target
      o.applied = clamped
      o.v = 0
      o.needsUpdate = false

      if (o.boneName !== undefined) {
        this.onBone?.(o.boneName, clamped)
      } else {
        for (const slot of o.slots) {
          slot.influences[slot.index] = clamped
        }
      }
    }
  }

  /**
   * Clear all fixed overrides and snap to baselines.
   * Used at the start of a seek to remove stale event state.
   */
  resetToBaselines(): void {
    for (const o of this.morphs.values()) {
      o.fixed = null
    }
    this.snapAll()
  }
}
