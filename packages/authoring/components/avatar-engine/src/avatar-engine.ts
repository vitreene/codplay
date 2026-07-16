/**
 * AvatarEngine — facade coordinating MorphEngine, ExpressionEngine, and GestureEngine.
 *
 * Responsibilities:
 *   - Load a GLB model and register its morph targets
 *   - Advance morph easing on each frame (animate)
 *   - Snap morphs for seek (prepareSeek / commitSeek)
 *   - Expose setMood, playGesture, and per-frame fn registration
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
import { buildModelInstance } from './model-loader.js'
import type { ModelLoaderOptions } from './model-loader.js'
import { BreathAnimator } from './breath-animator.js'

export type AvatarEngineOptions = {
  /** Initial mood. Defaults to "neutral". */
  mood?: MoodName
}

/**
 * Per-frame head drift function. `elapsed` is the absolute scene-timeline ms
 * since the avatar's idle loop started (ms=0), not time since (re)registration —
 * implementations must be resync-safe: callable with any elapsed value, including
 * a direct jump on seek, and produce the value that position actually corresponds to.
 * Returns bone rotation values to apply instantly (snapFixed).
 */
export type HeadDriftFn = (args: { elapsed: number }) => { headRotateX?: number; headRotateY?: number } | null | void

/**
 * Per-frame blink scheduler. Handles epoch detection + close/hold/open curve.
 * `elapsed` is the absolute scene-timeline ms since the avatar's idle loop
 * started — same resync-safety requirement as HeadDriftFn (see above).
 * Returns the current eyesClosed value (0–1); may return null to mean
 * "leave the morph untouched" but is not required to.
 */
export type BlinkScheduleFn = (args: { elapsed: number }) => { eyesClosed: number } | null | void

/**
 * Per-frame breath scheduler. Handles epoch detection. Unlike HeadDriftFn/
 * BlinkScheduleFn, this is not resynced on seek (it fires a one-shot animation,
 * not a value to reconstruct) — only its internal elapsed counter is realigned
 * to the seek target by the engine, without calling the function.
 * Returns { triggerBreath: true } once per epoch to fire the BreathAnimator.
 */
export type BreathTriggerFn = (args: { elapsed: number }) => { triggerBreath: true } | null | void

export type AvatarEngine = {
  /**
   * Build one instance from preloaded GLB bytes — see model-preload.ts.
   * Parses the bytes into a fresh, independent scene (single-skeleton topology),
   * traverses it, and registers morph targets. Async: GLTFLoader.parse is
   * callback based, but the network fetch already happened during preload.
   * Returns the root Three.js group and the full bone map.
   * Add scene to your Three.js scene; use boneMap to access named bones (e.g. LeftEye/RightEye).
   */
  loadModel(buffer: ArrayBuffer, opts?: ModelLoaderOptions): Promise<{ scene: Group; boneMap: Map<string, Object3D> }>

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
   *
   * `timelineMs` is the absolute seek target — head-drift and blink are
   * pure (or resync-safe) functions of elapsed time since scene start, so
   * they are re-evaluated at exactly this position instead of staying at
   * the prepareSeek() reset value. Without this, blink/head-drift would
   * visibly freeze at their rest pose immediately after every seek instead
   * of showing the state that position actually corresponds to.
   */
  commitSeek(timelineMs: number): void

  /** Transition to a mood, updating morph baselines. */
  setMood(name: MoodName): void

  /** Transition to a TH body pose baseline. Gestures release back to this pose. */
  setPose(name: string): boolean

  /**
   * Start an eased transition to a named gesture pose.
   * @param name - Key from GESTURE_TEMPLATES ("handup", "shrug", etc.)
   * @param rng  - Seeded PRNG for reproducible random ranges.
   * @returns Resolved pose for seek-replay use.
   */
  playGesture(name: string, rng: Rng): ResolvedPose | null

  /**
   * Start an eased return of all gesture bones to rest.
   * Call in response to a `avatar:gesture { gesture: null }` event during playback.
   */
  releaseGesture(): void

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
  interface BoneRest { bone: Object3D; rx: number; ry: number; rz: number; sx: number; sy: number; sz: number }

  function capture(name: string): BoneRest | null {
    const b = boneMap.get(name)
    if (!b) return null
    return { bone: b, rx: b.rotation.x, ry: b.rotation.y, rz: b.rotation.z, sx: b.scale.x, sy: b.scale.y, sz: b.scale.z }
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
        if (spine1) spine1.bone.scale.set(spine1.sx, spine1.sy + value * 0.04, spine1.sz)
        else if (spine) spine.bone.scale.set(spine.sx, spine.sy + value * 0.04, spine.sz)
        break
    }
  }

  return { callback, dispose: () => { /* nothing to release */ } }
}

export function createAvatarEngine(opts: AvatarEngineOptions = {}): AvatarEngine {
  const morphEngine = new MorphEngine()
  const expressionEngine = new ExpressionEngine(morphEngine)
  const breathAnimator = new BreathAnimator(morphEngine)
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
    async loadModel(buffer, loaderOpts) {
      const result = await buildModelInstance(buffer, morphEngine, loaderOpts)
      gestureEngine = new GestureEngine(result.boneMap)
      const { callback } = createBoneCallback(result.boneMap)
      morphEngine.registerBoneMorphs(callback)
      expressionEngine.applyInitial()
      morphEngine.snapAll()
      return { scene: result.scene, boneMap: result.boneMap }
    },

    animate(deltaMs) {
      if (_headDriftFn) {
        _headDriftElapsed += deltaMs
        const r = _headDriftFn({ elapsed: _headDriftElapsed })
        if (r) {
          if (r.headRotateX !== undefined) morphEngine.snapFixed('headRotateX', r.headRotateX)
          if (r.headRotateY !== undefined) morphEngine.snapFixed('headRotateY', r.headRotateY)
        }
      }

      if (_blinkScheduleFn) {
        _blinkElapsed += deltaMs
        const r = _blinkScheduleFn({ elapsed: _blinkElapsed })
        if (r != null) morphEngine.snapFixed('eyesClosed', r.eyesClosed)
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
      _headDriftFn = null; _headDriftElapsed = 0
      morphEngine.snapFixed('headRotateX', 0)
      morphEngine.snapFixed('headRotateY', 0)
      _blinkScheduleFn = null; _blinkElapsed = 0
      morphEngine.snapFixed('eyesClosed', 0)
      _breathTriggerFn = null; _breathElapsed = 0
      breathAnimator.reset()
      gestureEngine?.snapToRest()
      morphEngine.resetToBaselines()
    },

    commitSeek(timelineMs) {
      // headDrift is a pure function of elapsed (no internal state) — a direct
      // jump to timelineMs reconstructs the exact pose for this position.
      if (_headDriftFn) {
        _headDriftElapsed = timelineMs
        const r = _headDriftFn({ elapsed: timelineMs })
        if (r) {
          if (r.headRotateX !== undefined) morphEngine.snapFixed('headRotateX', r.headRotateX)
          if (r.headRotateY !== undefined) morphEngine.snapFixed('headRotateY', r.headRotateY)
        }
      }
      // blink is epoch-based but resync-safe (no in-progress state to misread) —
      // a direct jump correctly reports whether timelineMs falls inside a blink window.
      if (_blinkScheduleFn) {
        _blinkElapsed = timelineMs
        const r = _blinkScheduleFn({ elapsed: timelineMs })
        morphEngine.snapFixed('eyesClosed', r ? r.eyesClosed : 0)
      }
      // breath is a one-shot trigger, not a value to reconstruct — resync the
      // elapsed counter only, so the next animate() tick checks the right epoch
      // without firing a spurious trigger mid-seek.
      if (_breathTriggerFn) {
        _breathElapsed = timelineMs
      }
      gestureEngine?.snapToTargets()
      morphEngine.snapAll()
    },

    setMood(name) {
      expressionEngine.setMood(name)
    },

    setPose(name) {
      return gestureEngine?.setBodyPose(name) ?? false
    },

    playGesture(name, rng) {
      return gestureEngine?.applyGesture(name, rng) ?? null
    },

    releaseGesture() {
      gestureEngine?.resetPose()
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

    get morphEngine() { return morphEngine },
    get expressionEngine() { return expressionEngine },
    get gestureEngine() { return gestureEngine },
  }
}
