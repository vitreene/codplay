/**
 * Morph target state and easing.
 *
 * Derived from TalkingHead by Mika Suominen (met4citizen), MIT licence.
 * Source: https://github.com/met4citizen/TalkingHead
 *
 * Adapted for data-driven use in CodPlay:
 * - fixed is event-driven, system is reserved for gaze and other runtime
 *   constraints, ambient is the deterministic Avatar animation layer, and
 *   baseline is the mood/model resting value.
 * - The mutable animation queue is replaced by absolute-time component
 *   samples; realtime and newvalue are therefore not separate public layers.
 * - Bone-driven morphs (bodyRotate*, headRotate*, handFist*, chestInhale)
 *   dispatch to an optional onBone callback instead of writing to ms[].
 * - seek: snapAll() applies values instantly, bypassing easing.
 */
import type {
  BoneCallback,
  BoneMorphName,
  MorphAlias,
  MorphEntry,
  MorphSlot,
} from '../avatar-types.js'

const STD_ACC = 0.01 / 1000
const FAST_ACC = 0.1 / 1000
const STD_MAXV = 5 / 1000
const SLOW_MAXV = 1 / 1000

/** Returns default MorphEntry values for a given morph name. */
function defaultEntry(name: string): Omit<MorphEntry, 'slots'> {
  const isBodyRotate = name.startsWith('bodyRotate')
  const isHeadRotate = name.startsWith('headRotate')
  const isEyeBlink   = name.startsWith('eyeBlink')
  const isEyeLook    = name.startsWith('eyeLook')
  const isEyesDirection = name === 'eyesLookDown' || name === 'eyesLookUp'
  return {
    fixed: null,
    system: null,
    ambient: null,
    baseline: isBodyRotate || isEyeLook || isEyesDirection ? null : 0,
    value: 0,
    applied: 0,
    v: 0,
    needsUpdate: false,
    // TalkingHead accelerates only eyelids and eye direction. Visemes and
    // head/body rotations use the standard morph response.
    acc: isEyeBlink || isEyeLook ? FAST_ACC : STD_ACC,
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

/** Synthetic blend shapes TalkingHead adds when an ARKit model lacks them. */
export const TH_MIXED_MORPHS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  mouthOpen: { jawOpen: 0.5 },
  mouthSmile: { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 },
  eyesClosed: { eyeBlinkLeft: 1, eyeBlinkRight: 1 },
  eyesLookUp: { eyeLookUpLeft: 1, eyeLookUpRight: 1 },
  eyesLookDown: { eyeLookDownLeft: 1, eyeLookDownRight: 1 },
}

/** Bone-driven "morphs" — values are forwarded to onBone, not to ms[]. */
export const BONE_MORPH_NAMES: BoneMorphName[] = [
  'bodyRotateX', 'bodyRotateY', 'bodyRotateZ',
  'headRotateX', 'headRotateY', 'headRotateZ',
  'handFistLeft', 'handFistRight',
  'chestInhale',
]

/** Removes model baselines that TalkingHead reserves for runtime pose control. */
export function filterAvatarModelBaseline(
  baseline: Readonly<Record<string, number>> = {},
): Readonly<Record<string, number>> {
  const result: Record<string, number> = {}
  for (const [name, value] of Object.entries(baseline)) {
    if (name.startsWith('head') || name.startsWith('body') || name.startsWith('eyeBlink')) continue
    result[name] = value
  }
  return result
}

export class MorphEngine {
  /** All tracked morphs (blend shape + bone). */
  readonly morphs = new Map<string, MorphEntry>()
  /** Alias definitions (read-only after init). */
  readonly aliases: typeof MORPH_ALIASES = MORPH_ALIASES

  private readonly modelLimitBaseline: Readonly<Record<string, number>>
  private onBone: BoneCallback | null = null

  /** Creates one morph registry with the model baseline used by TH limits. */
  constructor(modelBaseline: Readonly<Record<string, number>> = {}) {
    this.modelLimitBaseline = { ...modelBaseline }
  }

  /** Reads the currently resolved value of one registered morph channel. */
  getValue(name: string): number {
    return this.readValue(name)
  }

  /** Reads the resting value used by one registered morph channel. */
  getBaseline(name: string): number {
    return this.morphs.get(name)?.baseline ?? 0
  }

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
      const entry = { ...defaultEntry(name), slots: [slot] }
      entry.limit = this.createLimit(name)
      entry.onchange = this.createOnChange(name)
      this.morphs.set(name, entry)
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
    if (this.morphs.has(name)) {
      this._setFixed(name, value)
      return
    }
    if (this.setDirectional(name, value, (target, next) => this._setFixed(target, next))) return
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

  /** Sets one runtime constraint without replacing an authored fixed value. */
  setSystem(name: string, value: number | null): void {
    if (this.morphs.has(name)) {
      this._setSystem(name, value)
      return
    }
    if (this.setDirectional(name, value, (target, next) => this._setSystem(target, next))) return
    const alias = this.aliases[name]
    if (alias) {
      for (const { name: target, factor } of alias.targets) {
        this._setSystem(target, value === null ? null : value * factor)
      }
      return
    }
    this._setSystem(name, value)
  }

  /** Stores one runtime constraint while retaining the current eased value. */
  private _setSystem(name: string, value: number | null): void {
    const mt = this.morphs.get(name)
    if (!mt) return
    mt.system = value
    mt.needsUpdate = true
  }

  /** Set one automatic Avatar animation value without replacing an event value. */
  setAmbient(name: string, value: number | null): void {
    if (this.morphs.has(name)) {
      this._setAmbient(name, value)
      return
    }
    if (this.setDirectional(name, value, (target, next) => this._setAmbient(target, next))) return
    const alias = this.aliases[name]
    if (alias) {
      for (const { name: target, factor } of alias.targets) {
        this._setAmbient(target, value === null ? null : value * factor)
      }
      return
    }
    this._setAmbient(name, value)
  }

  /** Stores one automatic value while retaining the current eased value. */
  private _setAmbient(name: string, value: number | null): void {
    const mt = this.morphs.get(name)
    if (!mt) return
    mt.ambient = value
    mt.needsUpdate = true
  }

  /** Applies one automatic Avatar value immediately at an absolute sample. */
  snapAmbient(name: string, value: number | null): void {
    if (this.morphs.has(name)) {
      this._snapAmbient(name, value)
      return
    }
    if (this.setDirectional(name, value, (target, next) => this._snapAmbient(target, next))) return
    const alias = this.aliases[name]
    if (alias) {
      for (const { name: target, factor } of alias.targets) {
        this._snapAmbient(target, value === null ? null : value * factor)
      }
      return
    }
    this._snapAmbient(name, value)
  }

  /** Snaps an automatic value without disturbing a fixed event override. */
  private _snapAmbient(name: string, value: number | null): void {
    const mt = this.morphs.get(name)
    if (!mt) return
    mt.ambient = value
    if (mt.fixed !== null) return
    const target = value !== null ? value : resolveTarget(mt)
    const limited = mt.limit !== null ? mt.limit(target) : target
    const clamped = Math.max(mt.min, Math.min(mt.max, limited))
    mt.value = clamped
    mt.applied = clamped
    mt.v = 0
    mt.needsUpdate = false
    this.applyEntry(mt, clamped)
    mt.onchange?.(clamped)
  }

  /** Applies one runtime constraint immediately without disturbing fixed input. */
  snapSystem(name: string, value: number | null): void {
    if (this.morphs.has(name)) {
      this._snapSystem(name, value)
      return
    }
    if (this.setDirectional(name, value, (target, next) => this._snapSystem(target, next))) return
    const alias = this.aliases[name]
    if (alias) {
      for (const { name: target, factor } of alias.targets) {
        this._snapSystem(target, value === null ? null : value * factor)
      }
      return
    }
    this._snapSystem(name, value)
  }

  /** Snaps one runtime constraint while preserving an authored fixed value. */
  private _snapSystem(name: string, value: number | null): void {
    const mt = this.morphs.get(name)
    if (!mt) return
    mt.system = value
    if (mt.fixed !== null) return
    const target = value !== null ? value : resolveTarget(mt)
    const limited = mt.limit !== null ? mt.limit(target) : target
    const clamped = Math.max(mt.min, Math.min(mt.max, limited))
    mt.value = clamped
    mt.applied = clamped
    mt.v = 0
    mt.needsUpdate = false
    this.applyEntry(mt, clamped)
    mt.onchange?.(clamped)
  }

  /**
   * Set the fixed override and immediately snap to the target — no easing.
   * Use for speech visemes, which must track the audio timing exactly.
   * Supports aliases.
   */
  snapFixed(name: string, value: number | null): void {
    if (this.morphs.has(name)) {
      this._snapFixed(name, value)
      return
    }
    if (this.setDirectional(name, value, (target, next) => this._snapFixed(target, next))) return
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
    const target = value !== null ? value : resolveTarget(mt)
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
    mt.onchange?.(clamped)
  }

  /**
   * Set the mood/model baseline for a morph.
   * Supports aliases (fanout to real morphs with factor scaling).
   */
  setBaseline(name: string, value: number | null): void {
    if (this.morphs.has(name)) {
      this._setBaseline(name, value)
      return
    }
    if (this.setDirectional(name, value, (target, next) => this._setBaseline(target, next))) return
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

      const target = resolveTarget(o)

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

      this.applyEntry(o, clamped)
    }
  }

  /** Rewrites the currently eased fixed channels after another layer touched bones. */
  reapplyFixed(): void {
    for (const entry of this.morphs.values()) {
      if (entry.fixed === null) continue
      const clamped = entry.applied
      if (entry.boneName !== undefined) {
        this.onBone?.(entry.boneName, clamped)
        continue
      }
      for (const slot of entry.slots) {
        slot.influences[slot.index] = clamped
      }
    }
  }

  /**
   * Snap all morphs to their current target instantly — no easing.
   * Called by the avatar engine after seek, before render.
   */
  snapAll(): void {
    for (const o of this.morphs.values()) {
      const target = resolveTarget(o)
      const limited = o.limit !== null ? o.limit(target) : target
      const clamped = Math.max(o.min, Math.min(o.max, limited))
      o.value = target
      o.applied = clamped
      o.v = 0
      o.needsUpdate = false

      this.applyEntry(o, clamped)
    }
  }

  /**
   * Clear all fixed overrides and snap to baselines.
   * Used at the start of a seek to remove stale event state.
   */
  resetToBaselines(): void {
    for (const o of this.morphs.values()) {
      o.fixed = null
      o.system = null
      o.ambient = null
    }
    this.snapAll()
  }

  /** Writes one clamped value to either the bone binding or mesh slots. */
  private applyEntry(entry: MorphEntry, value: number): void {
    if (entry.boneName !== undefined) {
      this.onBone?.(entry.boneName, value)
      return
    }
    for (const slot of entry.slots) {
      slot.influences[slot.index] = value
    }
  }

  /** Installs TH's eyelid dependency rules on one discovered ARKit morph. */
  private createLimit(name: string): ((value: number) => number) | null {
    if (name !== 'eyeBlinkLeft' && name !== 'eyeBlinkRight') return null
    const brow = name.endsWith('Left') ? 'browDownLeft' : 'browDownRight'
    return (value) => {
      const baseline = this.modelLimitBaseline[name]
      const lookDown = this.readValue('eyesLookDown')
      const browDown = this.readValue(brow)
      const closed = this.readApplied('eyesClosed')
      return Math.max(value, (baseline === undefined ? 1 : baseline)
        * (lookDown + browDown) / 2) - closed
    }
  }

  /** Marks eyelids dirty when the TH dependency morphs change. */
  private createOnChange(name: string): ((value: number) => void) | null {
    if (name !== 'eyesLookDown'
      && name !== 'eyeLookDownLeft'
      && name !== 'eyeLookDownRight'
      && name !== 'browDownLeft'
      && name !== 'browDownRight') return null
    return () => {
      const left = this.morphs.get('eyeBlinkLeft')
      const right = this.morphs.get('eyeBlinkRight')
      if (left !== undefined) left.needsUpdate = true
      if (right !== undefined) right.needsUpdate = true
    }
  }

  /** Reads the applied value of an actual morph or one of the TH aliases. */
  private readApplied(name: string): number {
    const entry = this.morphs.get(name)
    if (entry !== undefined) return entry.applied
    const alias = this.aliases[name]
    if (alias === undefined || alias.targets.length === 0) return 0
    let total = 0
    for (const target of alias.targets) {
      total += (this.morphs.get(target.name)?.applied ?? 0) * target.factor
    }
    return total / alias.targets.length
  }

  /** Reads the eased dependency value used by TalkingHead's eyelid limiter. */
  private readValue(name: string): number {
    if (name === 'eyesRotateX') {
      return this.readValue('eyesLookDown') - this.readValue('eyesLookUp')
    }
    if (name === 'eyesRotateY') {
      return this.readValue('eyeLookOutLeft') - this.readValue('eyeLookInLeft')
    }
    const entry = this.morphs.get(name)
    if (entry !== undefined) return entry.value
    const alias = this.aliases[name]
    if (alias === undefined || alias.targets.length === 0) return 0
    let total = 0
    for (const target of alias.targets) {
      total += (this.morphs.get(target.name)?.value ?? 0) * target.factor
    }
    return total / alias.targets.length
  }

  /** Expands TH's signed eye rotation channels into ARKit direction channels. */
  private setDirectional(
    name: string,
    value: number | null,
    setter: (target: string, next: number | null) => void,
  ): boolean {
    if (name === 'eyesRotateX') {
      setter('eyesLookDown', value === null ? null : Math.max(0, value))
      setter('eyesLookUp', value === null ? null : Math.max(0, -value))
      return true
    }
    if (name === 'eyesRotateY') {
      setter('eyeLookOutLeft', value === null ? null : Math.max(0, value))
      setter('eyeLookInLeft', value === null ? null : Math.max(0, -value))
      setter('eyeLookOutRight', value === null ? null : Math.max(0, -value))
      setter('eyeLookInRight', value === null ? null : Math.max(0, value))
      return true
    }
    return false
  }
}

/** Resolves the priority order used by TH's fixed/system/baseline channels. */
function resolveTarget(entry: MorphEntry): number {
  if (entry.fixed !== null) return entry.fixed
  if (entry.system !== null) return entry.system
  if (entry.ambient !== null) return entry.ambient
  return entry.baseline ?? 0
}
