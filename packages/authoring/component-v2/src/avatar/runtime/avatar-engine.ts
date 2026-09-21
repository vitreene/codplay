/**
 * AvatarEngine — facade coordinating MorphEngine, ExpressionEngine, and GestureEngine.
 *
 * Responsibilities:
 *   - Load a GLB model and register its morph targets
 *   - Advance morph easing on each frame (animate)
 *   - Snap morphs for seek (prepareSeek / commitSeek)
 *   - Snap the selected gesture after a feature replay (snapGesture)
 *   - Expose setMood, playGesture, and per-frame fn registration
 *
 * The Three.js scene, camera, renderer and lights are managed by the caller.
 * The loaded model's scene group should be added to the caller's scene.
 */
import type { AnimationClip, Camera, Group, Object3D } from 'three'
import { MorphEngine } from '../morph/morph-engine.js'
import { createBoneMorphBinding } from '../morph/bone-morph-binding.js'
import { ExpressionEngine } from '../mood/expression-engine.js'
import type { MoodName } from '../mood/expression-engine.js'
import { GestureEngine } from '../gesture/gesture-engine.js'
import type { Rng, ResolvedPose } from '../gesture/gesture-engine.js'
import type { AvatarGestureOverlay } from '../gesture/motion-catalog.js'
import { buildModelInstance } from '../model/model-loader.js'
import type { ModelLoaderOptions } from '../model/model-loader.js'
import { BreathAnimator } from '../idle/breath-animator.js'
import type { BlinkScheduleFn, BreathTriggerFn, HeadDriftFn } from '../idle/avatar-idle-schedule.js'
import { GazeService } from '../gaze/gaze-service.js'
import {
  createAvatarAnimationPlayer,
  type ActiveAnimation,
  type AvatarAnimationMode,
  type AvatarAnimationPlayer,
} from '../motion/avatar-animation-player.js'

export type { BlinkScheduleFn, BreathTriggerFn, HeadDriftFn } from '../idle/avatar-idle-schedule.js'

export type AvatarEngineOptions = {
  /** Initial mood. Defaults to "neutral". */
  mood?: MoodName
}

export type AvatarEngine = {
  /**
   * Build one instance from preloaded GLB bytes — see threejs-preload.ts.
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
  playGesture(name: string, rng: Rng, mirror?: boolean): ResolvedPose | null

  /** Snap the currently selected gesture targets after a feature replay. */
  snapGesture(): void

  /**
   * Start an eased return of all gesture bones to rest.
   * Call in response to a `avatar:gesture { gesture: null }` event during playback.
   */
  releaseGesture(): void

  /** Replaces the current semantic motion overlay on the loaded model. */
  setGestureOverlay(overlay: AvatarGestureOverlay | null): void

  /**
   * Register a per-frame idle drift function. Called every animate() tick with
   * cumulative elapsed time. Returned head/body rotations are applied via
   * snapFixed after the body-pose easing. Pass null to stop. Cleared by seek.
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

  /** Use the current Three.js host camera for the Avatar gaze constraint. */
  setGazeCamera(camera: Camera | null): void

  /** Enable or disable the gaze constraint without owning its event source. */
  setGazeEnabled(enabled: boolean): void

  /** Set the gaze contact strength; null restores the default full contact. */
  setGazeContact(value: number | null): void

  /** Direct access to the morph engine (for advanced use). */
  readonly morphEngine: MorphEngine
  /** Direct access to the expression engine. */
  readonly expressionEngine: ExpressionEngine
  /** Direct access to the gesture engine (null until model is loaded). */
  readonly gestureEngine: GestureEngine | null

  /** Registers one animation clip associated with this Avatar. */
  registerAnimation(name: string, clip: AnimationClip, mode: AvatarAnimationMode): void

  /** Returns the default playback mode for one registered Avatar animation. */
  getAnimation(name: string): AvatarAnimationMode | undefined

  /** Selects or releases one animation on the absolute CodPlay timeline. */
  setAnimation(animation: ActiveAnimation | null): void

  /** Applies the selected animation at one absolute CodPlay time. */
  applyAnimationAt(timeMs: number): void
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
  let _gaze: GazeService | null = null
  let _gazeCamera: Camera | null = null
  let _gazeEnabled = false
  let _gazeContact: number | null = 1
  let _boneMap: Map<string, Object3D> | null = null
  let _gestureOverlay: AvatarGestureOverlay | null = null
  let _appliedGestureOverlay: AvatarGestureOverlay | null = null
  let animationPlayer: AvatarAnimationPlayer | null = null

  if (opts.mood) {
    expressionEngine.setMood(opts.mood)
  }

  return {
    async loadModel(buffer, loaderOpts) {
      const result = await buildModelInstance(buffer, morphEngine, loaderOpts)
      gestureEngine = new GestureEngine(result.boneMap)
      _boneMap = result.boneMap
      animationPlayer = createAvatarAnimationPlayer(result.scene)
      morphEngine.registerBoneMorphs(createBoneMorphBinding(result.boneMap))
      expressionEngine.applyInitial()
      morphEngine.snapAll()
      _gaze = createGazeService(_boneMap, _gazeCamera)
      applyGazeState()
      applyGestureOverlay()
      return { scene: result.scene, boneMap: result.boneMap }
    },

    animate(deltaMs) {
      removeGestureOverlay()
      gestureEngine?.update(deltaMs)

      if (_headDriftFn) {
        _headDriftElapsed += deltaMs
        applyHeadDrift(_headDriftFn({ elapsed: _headDriftElapsed }))
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

      morphEngine.update(deltaMs)
      morphEngine.reapplyFixed()
      applyGestureOverlay()
      _gaze?.computeAndApply()
    },

    prepareSeek() {
      removeGestureOverlay()
      _gestureOverlay = null
      _headDriftFn = null; _headDriftElapsed = 0
      morphEngine.snapFixed('headRotateX', 0)
      morphEngine.snapFixed('headRotateY', 0)
      _blinkScheduleFn = null; _blinkElapsed = 0
      morphEngine.snapFixed('eyesClosed', 0)
      _breathTriggerFn = null; _breathElapsed = 0
      breathAnimator.reset()
      gestureEngine?.snapToRest()
      morphEngine.resetToBaselines()
      _gaze?.setEnabled(false)
      animationPlayer?.prepareSeek()
    },

    commitSeek(timelineMs) {
      gestureEngine?.snapToTargets()

      // headDrift is a pure function of elapsed (no internal state) — a direct
      // jump to timelineMs reconstructs the exact pose for this position.
      if (_headDriftFn) {
        _headDriftElapsed = timelineMs
        applyHeadDrift(_headDriftFn({ elapsed: timelineMs }))
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
      morphEngine.snapAll()
      applyGazeState()
      _gaze?.computeAndApply()
    },

    setMood(name) {
      expressionEngine.setMood(name)
    },

    setPose(name) {
      return gestureEngine?.setBodyPose(name) ?? false
    },

    playGesture(name, rng, mirror = false) {
      return gestureEngine?.applyGesture(name, rng, mirror) ?? null
    },

    snapGesture() {
      gestureEngine?.snapToTargets()
    },

    releaseGesture() {
      gestureEngine?.resetPose()
    },

    setGestureOverlay(overlay) {
      removeGestureOverlay()
      _gestureOverlay = overlay
      applyGestureOverlay()
    },

    setHeadDriftFn(fn) {
      _headDriftFn = fn
      _headDriftElapsed = 0
      if (!fn) {
        morphEngine.snapFixed('bodyRotateX', 0)
        morphEngine.snapFixed('bodyRotateY', 0)
        morphEngine.snapFixed('bodyRotateZ', 0)
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
      if (!fn) breathAnimator.reset()
    },

    setGazeCamera(camera) {
      if (_gazeCamera === camera) return
      _gaze?.setEnabled(false)
      _gazeCamera = camera
      _gaze = createGazeService(_boneMap, _gazeCamera)
      applyGazeState()
    },

    setGazeEnabled(enabled) {
      if (_gazeEnabled === enabled) return
      _gazeEnabled = enabled
      _gaze?.setEnabled(enabled)
    },

    setGazeContact(value) {
      if (_gazeContact === value) return
      _gazeContact = value
      _gaze?.setContact(value)
    },

    registerAnimation(name, clip, mode) {
      animationPlayer?.register(name, clip, mode)
    },

    getAnimation(name) {
      return animationPlayer?.get(name)
    },

    setAnimation(animation) {
      removeGestureOverlay()
      _gaze?.clearAppliedCorrection()
      if (animation?.releaseAt !== undefined) {
        // Freeze the semantic destination at the hand-off boundary. The
        // animation player then interpolates from the clip pose to this
        // destination identically during Play and Seek.
        gestureEngine?.snapToTargets()
      }
      animationPlayer?.set(animation)
      applyGestureOverlay()
    },

    applyAnimationAt(timeMs) {
      animationPlayer?.applyAt(timeMs)
      // Animation clips can write head bones; keep the camera constraint last.
      _gaze?.computeAndApply()
    },

    get morphEngine() { return morphEngine },
    get expressionEngine() { return expressionEngine },
    get gestureEngine() { return gestureEngine },
  }

  function createGazeService(
    boneMap: Map<string, Object3D> | null,
    camera: Camera | null,
  ): GazeService | null {
    if (boneMap === null || camera === null) return null

    const leftEye = boneMap.get('LeftEye') ?? null
    const rightEye = boneMap.get('RightEye') ?? null
    const head = boneMap.get('Head') ?? null
    const necks = ['Neck', 'Neck1', 'Neck2']
      .map((name) => boneMap.get(name) ?? null)
      .filter((bone): bone is Object3D => bone !== null)

    return new GazeService(morphEngine, leftEye, rightEye, head, camera, necks)
  }

  function applyGazeState(): void {
    if (_gaze === null) return
    _gaze.setContact(_gazeContact)
    _gaze.setEnabled(_gazeEnabled)
  }

  function applyHeadDrift(value: ReturnType<HeadDriftFn>): void {
    if (value === null || value === undefined) return
    if (value.bodyRotateX !== undefined) morphEngine.snapFixed('bodyRotateX', value.bodyRotateX)
    if (value.bodyRotateY !== undefined) morphEngine.snapFixed('bodyRotateY', value.bodyRotateY)
    if (value.bodyRotateZ !== undefined) morphEngine.snapFixed('bodyRotateZ', value.bodyRotateZ)
    if (value.headRotateX !== undefined) morphEngine.snapFixed('headRotateX', value.headRotateX)
    if (value.headRotateY !== undefined) morphEngine.snapFixed('headRotateY', value.headRotateY)
  }

  /** Removes the overlay written during the previous engine frame. */
  function removeGestureOverlay(): void {
    if (_appliedGestureOverlay === null) return
    gestureEngine?.applyOverlay(_appliedGestureOverlay, -1)
    _appliedGestureOverlay = null
  }

  /** Applies the currently selected overlay once on the loaded model. */
  function applyGestureOverlay(): void {
    if (_gestureOverlay === null || gestureEngine === null) return
    gestureEngine.applyOverlay(_gestureOverlay)
    _appliedGestureOverlay = _gestureOverlay
  }
}
