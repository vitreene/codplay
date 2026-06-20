/**
 * AvatarEngine — facade coordinating MorphEngine, ExpressionEngine, and GestureEngine.
 *
 * Responsibilities:
 *   - Load a GLB model and register its morph targets
 *   - Advance morph easing on each frame (animate)
 *   - Snap morphs for seek (prepareSeek / commitSeek)
 *   - Expose setViseme, setExpression, setMood, playGesture
 *
 * The Three.js scene, camera, renderer and lights are managed by the caller.
 * The loaded model's scene group should be added to the caller's scene.
 */
import type { Group, Object3D } from 'three'
import { MorphEngine } from './morph-engine.js'
import type { BoneMorphName, BoneCallback } from './morph-engine.js'
import { ExpressionEngine } from './expression-engine.js'
import type { MoodName } from './expression-engine.js'
import { GestureEngine } from './gesture-engine.js'
import type { Rng, ResolvedPose } from './gesture-engine.js'
import { loadModel } from './model-loader.js'
import type { ModelLoaderOptions } from './model-loader.js'
import { BlinkAnimator } from './blink-animator.js'
import { BreathAnimator } from './breath-animator.js'
import { HeadDriftAnimator } from './head-drift-animator.js'

const VISEME_NAMES = [
  'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR',
  'aa', 'E', 'I', 'O', 'U',
]

export type AvatarEngineOptions = {
  /** Initial mood. Defaults to "neutral". */
  mood?: MoodName
}

/**
 * Per-frame head drift function. Receives cumulative elapsed ms since activation.
 * Returns bone rotation values to apply instantly (snapFixed).
 */
export type HeadDriftFn = (args: { elapsed: number }) => { headRotateX?: number; headRotateY?: number } | null | void

/**
 * Per-frame blink scheduler. Handles epoch detection + close/hold/open curve.
 * Returns the current eyesClosed value (0–1) or null when no blink is active.
 */
export type BlinkScheduleFn = (args: { elapsed: number }) => { eyesClosed: number } | null | void

/**
 * Per-frame breath scheduler. Handles epoch detection.
 * Returns { triggerBreath: true } once per epoch to fire the BreathAnimator.
 */
export type BreathTriggerFn = (args: { elapsed: number }) => { triggerBreath: true } | null | void

export type AvatarEngine = {
  /**
   * Load a GLB model.
   * Returns the root Three.js group and the full bone map.
   * Add scene to your Three.js scene; use boneMap to access named bones (e.g. LeftEye/RightEye).
   */
  loadModel(url: string, opts?: ModelLoaderOptions): Promise<{ scene: Group; boneMap: Map<string, Object3D> }>

  /**
   * Advance morph and gesture easing. Call every frame with the frame delta in ms.
   * AvatarEngine has no rate concept of its own — CodPlay is the single source of
   * time scaling and is responsible for passing an already-scaled delta when
   * playback rate differs from 1.
   */
  animate(deltaMs: number): void

  /**
   * Reset all morphs to baselines and snap all gesture bones to rest.
   * Called before seek track replay begins.
   */
  prepareSeek(): void

  /**
   * Snap morphs and gesture bones to their post-replay state.
   * Called after seek track replay completes.
   */
  commitSeek(): void

  /**
   * Set a viseme morph weight.
   * Accepts short names ("PP", "FF") or full ARKit names ("viseme_PP").
   */
  setViseme(name: string, weight: number | null): void

  /** Release all viseme overrides (set all to null — baseline takes over). */
  releaseVisemes(): void

  /**
   * Set an expression morph directly by ARKit name.
   * Accepts aliases: "mouthSmile", "eyesClosed", "eyesLookUp", "eyesLookDown".
   */
  setExpression(name: string, value: number | null): void

  /** Transition to a mood, updating morph baselines. */
  setMood(name: MoodName): void

  /**
   * Start an eased transition to a named gesture pose.
   * @param name - Key from GESTURE_TEMPLATES ("handup", "shrug", etc.)
   * @param rng  - Seeded PRNG for reproducible random ranges.
   * @returns Resolved pose for seek-replay use.
   */
  playGesture(name: string, rng: Rng): ResolvedPose | null

  /**
   * Replay a previously resolved gesture pose instantly (no PRNG needed).
   * Used during seek to restore gesture state.
   */
  replayGesture(pose: ResolvedPose): void

  /**
   * Start an eased return of all gesture bones to rest.
   * Call in response to a `avatar:gesture { gesture: null }` event during playback.
   */
  releaseGesture(): void

  /**
   * Snap all gesture bones to rest instantly (stop/rewind path).
   */
  resetGesture(): void

  /** Trigger a single blink animation. Ignored if a blink is already in progress. */
  triggerBlink(): void

  /** Trigger a single breath swell animation. Ignored if one is already in progress. */
  triggerBreath(): void

  /**
   * Register a per-frame head drift function. Called every animate() tick with
   * cumulative elapsed time. The returned headRotateX/Y are applied via snapFixed.
   * Pass null to stop. Cleared automatically by prepareSeek().
   */
  setHeadDriftFn(fn: HeadDriftFn | null): void

  /**
   * Register a per-frame blink scheduler. Called every animate() tick.
   * The returned eyesClosed value is applied via snapFixed on each frame.
   * Pass null to stop. Cleared automatically by prepareSeek().
   */
  setBlinkScheduleFn(fn: BlinkScheduleFn | null): void

  /**
   * Register a per-frame breath scheduler. Called every animate() tick.
   * When it returns { triggerBreath: true }, the BreathAnimator is triggered.
   * Pass null to stop. Cleared automatically by prepareSeek().
   */
  setBreathTriggerFn(fn: BreathTriggerFn | null): void

  /**
   * Enable or disable the built-in sinusoidal head drift (legacy — prefer setHeadDriftFn).
   * Disabled automatically by prepareSeek().
   */
  setHeadDriftEnabled(enabled: boolean): void

  /**
   * Transition head to a semantic pose direction with smooth easing.
   * @param look - 'left' | 'right' | 'up' | 'down' | 'center'
   * @param intensity - 0–1 scale factor applied to the pose's canonical rotation values
   */
  setHeadPose(look: string, intensity: number): void

  /** Direct access to the morph engine (for advanced use). */
  readonly morphEngine: MorphEngine
  /** Direct access to the expression engine. */
  readonly expressionEngine: ExpressionEngine
  /** Direct access to the gesture engine (null until model is loaded). */
  readonly gestureEngine: GestureEngine | null
}

/**
 * Bone rotation callback — maps BoneMorphName values to Three.js bone rotations.
 *
 * headRotateX/Y: applied directly to Head bone + fractional distribution to Neck (TH model).
 * bodyRotateX/Y/Z: distributed across Spine/Hips (TH model, simplified).
 * handFist*: finger curl via joint rotations (TH model).
 * chestInhale: not wired (Spine scale — TH-specific, skipped for now).
 *
 * Values are ABSOLUTE (not deltas). Rest rotations are captured at construction.
 */
function createBoneCallback(boneMap: Map<string, Object3D>): { callback: BoneCallback; dispose: () => void } {
  interface BoneRest { bone: Object3D; rx: number; ry: number; rz: number }

  function capture(name: string): BoneRest | null {
    const b = boneMap.get(name)
    if (!b) return null
    return { bone: b, rx: b.rotation.x, ry: b.rotation.y, rz: b.rotation.z }
  }

  const head    = capture('Head')
  const neck    = capture('Neck')
  const spine1  = capture('Spine1')
  const spine   = capture('Spine')
  const hips    = capture('Hips')
  const lupleg  = capture('LeftUpLeg')
  const rupleg  = capture('RightUpLeg')
  const lleg    = capture('LeftLeg')
  const rleg    = capture('RightLeg')

  function fingerBones(side: 'Left' | 'Right'): BoneRest[][] {
    return ['HandThumb', 'HandIndex', 'HandMiddle', 'HandRing', 'HandPinky'].map(f =>
      [1, 2, 3].map(i => capture(`${side}${f}${i}`)).filter((b): b is BoneRest => b !== null)
    )
  }

  const leftFingers  = fingerBones('Left')
  const rightFingers = fingerBones('Right')

  const callback: BoneCallback = (name: BoneMorphName, value: number) => {
    switch (name) {
      case 'headRotateX':
        if (head) head.bone.rotation.x = head.rx + value
        if (neck) neck.bone.rotation.x = neck.rx + value * 0.3
        break
      case 'headRotateY':
        if (head) head.bone.rotation.y = head.ry + value
        if (neck) neck.bone.rotation.y = neck.ry + value * 0.3
        break
      case 'headRotateZ':
        if (head) head.bone.rotation.z = head.rz + value
        break
      case 'bodyRotateX':
        if (head)   head.bone.rotation.x   = head.rx   + value
        if (spine1) spine1.bone.rotation.x = spine1.rx + value / 2
        if (spine)  spine.bone.rotation.x  = spine.rx  + value / 8
        if (hips)   hips.bone.rotation.x   = hips.rx   + value / 24
        break
      case 'bodyRotateY':
        if (head)   head.bone.rotation.y   = head.ry   + value
        if (spine1) spine1.bone.rotation.y = spine1.ry + value / 2
        if (spine)  spine.bone.rotation.y  = spine.ry  + value / 2
        if (hips)   hips.bone.rotation.y   = hips.ry   + value / 4
        if (lupleg) lupleg.bone.rotation.y = lupleg.ry + value / 2
        if (rupleg) rupleg.bone.rotation.y = rupleg.ry + value / 2
        if (lleg)   lleg.bone.rotation.y   = lleg.ry   + value / 4
        if (rleg)   rleg.bone.rotation.y   = rleg.ry   + value / 4
        break
      case 'bodyRotateZ':
        if (head)   head.bone.rotation.z   = head.rz   + value
        if (spine1) spine1.bone.rotation.z = spine1.rz + value / 12
        if (spine)  spine.bone.rotation.z  = spine.rz  + value / 12
        if (hips)   hips.bone.rotation.z   = hips.rz   + value / 24
        break
      case 'handFistLeft': {
        const sign = -1
        for (let i = 0; i < leftFingers.length; i++) {
          const joints = leftFingers[i]!
          if (i === 0) { // thumb
            if (joints[1]) joints[1].bone.rotation.z = joints[1].rz + sign * value
            if (joints[2]) joints[2].bone.rotation.z = joints[2].rz + sign * value
          } else {
            if (joints[0]) joints[0].bone.rotation.x = joints[0].rx + value
            if (joints[1]) joints[1].bone.rotation.x = joints[1].rx + 1.5 * value
            if (joints[2]) joints[2].bone.rotation.x = joints[2].rx + 1.5 * value
          }
        }
        break
      }
      case 'handFistRight': {
        const sign = 1
        for (let i = 0; i < rightFingers.length; i++) {
          const joints = rightFingers[i]!
          if (i === 0) { // thumb
            if (joints[1]) joints[1].bone.rotation.z = joints[1].rz + sign * value
            if (joints[2]) joints[2].bone.rotation.z = joints[2].rz + sign * value
          } else {
            if (joints[0]) joints[0].bone.rotation.x = joints[0].rx + value
            if (joints[1]) joints[1].bone.rotation.x = joints[1].rx + 1.5 * value
            if (joints[2]) joints[2].bone.rotation.x = joints[2].rx + 1.5 * value
          }
        }
        break
      }
      case 'chestInhale':
        // Chest scale via Spine — skipped, no visual bones available here
        break
    }
  }

  return { callback, dispose: () => { /* nothing to release */ } }
}

// Canonical head rotation values at intensity = 1 (radians).
// headRotateX: positive = tilt down, negative = tilt up.
// headRotateY: positive = turn right, negative = turn left.
const HEAD_POSES: Record<string, { x: number; y: number }> = {
  left:   { x:  0,    y: -0.14 },
  right:  { x:  0,    y:  0.14 },
  up:     { x: -0.10, y:  0    },
  down:   { x:  0.10, y:  0    },
  center: { x:  0,    y:  0    },
}

export function createAvatarEngine(opts: AvatarEngineOptions = {}): AvatarEngine {
  const morphEngine = new MorphEngine()
  const expressionEngine = new ExpressionEngine(morphEngine)
  const blinkAnimator     = new BlinkAnimator(morphEngine)
  const breathAnimator    = new BreathAnimator(morphEngine)
  const headDriftAnimator = new HeadDriftAnimator(morphEngine)
  let gestureEngine: GestureEngine | null = null
  let _headDriftFn: HeadDriftFn | null = null
  let _headDriftElapsed = 0
  let _blinkScheduleFn: BlinkScheduleFn | null = null
  let _blinkElapsed = 0
  let _breathTriggerFn: BreathTriggerFn | null = null
  let _breathElapsed = 0

  if (opts.mood) {
    expressionEngine.setMood(opts.mood)
  }

  return {
    async loadModel(url, loaderOpts) {
      const result = await loadModel(url, morphEngine, loaderOpts)
      gestureEngine = new GestureEngine(result.boneMap)
      const { callback } = createBoneCallback(result.boneMap)
      morphEngine.registerBoneMorphs(callback)
      expressionEngine.applyInitial()
      morphEngine.snapAll()
      return { scene: result.scene, boneMap: result.boneMap }
    },

    animate(deltaMs) {
      // fn-based drift takes priority over the legacy HeadDriftAnimator.
      if (_headDriftFn) {
        _headDriftElapsed += deltaMs
        const r = _headDriftFn({ elapsed: _headDriftElapsed })
        if (r) {
          if (r.headRotateX !== undefined) morphEngine.snapFixed('headRotateX', r.headRotateX)
          if (r.headRotateY !== undefined) morphEngine.snapFixed('headRotateY', r.headRotateY)
        }
      } else {
        headDriftAnimator.update(deltaMs)
      }

      if (_blinkScheduleFn) {
        _blinkElapsed += deltaMs
        const r = _blinkScheduleFn({ elapsed: _blinkElapsed })
        if (r != null) morphEngine.snapFixed('eyesClosed', r.eyesClosed)
      } else {
        blinkAnimator.update(deltaMs)
      }

      if (_breathTriggerFn) {
        _breathElapsed += deltaMs
        const r = _breathTriggerFn({ elapsed: _breathElapsed })
        if (r?.triggerBreath) breathAnimator.trigger()
      }
      breathAnimator.update(deltaMs)

      gestureEngine?.update(deltaMs)
      morphEngine.update(deltaMs)
    },

    prepareSeek() {
      _headDriftFn = null
      _headDriftElapsed = 0
      _blinkScheduleFn = null
      _blinkElapsed = 0
      _breathTriggerFn = null
      _breathElapsed = 0
      headDriftAnimator.reset()
      blinkAnimator.reset()
      breathAnimator.reset()
      gestureEngine?.snapToRest()
      morphEngine.resetToBaselines()
    },

    commitSeek() {
      gestureEngine?.snapToTargets()
      morphEngine.snapAll()
    },

    setViseme(name, weight) {
      const full = name.startsWith('viseme_') ? name : `viseme_${name}`
      morphEngine.setFixed(full, weight)
    },

    releaseVisemes() {
      for (const name of VISEME_NAMES) {
        morphEngine.setFixed(`viseme_${name}`, null)
      }
    },

    setExpression(name, value) {
      morphEngine.setFixed(name, value)
    },

    setMood(name) {
      expressionEngine.setMood(name)
    },

    playGesture(name, rng) {
      return gestureEngine?.applyGesture(name, rng) ?? null
    },

    replayGesture(pose) {
      gestureEngine?.applyPose(pose)
    },

    releaseGesture() {
      gestureEngine?.resetPose()
    },

    resetGesture() {
      gestureEngine?.snapToRest()
    },

    triggerBlink() {
      blinkAnimator.trigger()
    },

    triggerBreath() {
      breathAnimator.trigger()
    },

    setHeadDriftFn(fn) {
      _headDriftFn = fn
      _headDriftElapsed = 0
      if (!fn) {
        morphEngine.snapFixed('headRotateX', 0)
        morphEngine.snapFixed('headRotateY', 0)
      }
    },

    setBlinkScheduleFn(fn) {
      _blinkScheduleFn = fn
      _blinkElapsed = 0
      if (!fn) morphEngine.snapFixed('eyesClosed', 0)
    },

    setBreathTriggerFn(fn) {
      _breathTriggerFn = fn
      _breathElapsed = 0
    },

    setHeadDriftEnabled(enabled) {
      headDriftAnimator.setEnabled(enabled)
    },

    setHeadPose(look, intensity) {
      const pose = HEAD_POSES[look] ?? HEAD_POSES['center']!
      morphEngine.setFixed('headRotateX', pose.x * intensity)
      morphEngine.setFixed('headRotateY', pose.y * intensity)
    },

    get morphEngine() { return morphEngine },
    get expressionEngine() { return expressionEngine },
    get gestureEngine() { return gestureEngine },
  }
}
