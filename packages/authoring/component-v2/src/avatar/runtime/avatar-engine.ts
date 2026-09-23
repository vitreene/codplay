/**
 * AvatarEngine — facade coordinating MorphEngine and GestureEngine.
 *
 * Responsibilities:
 *   - Load a GLB model and register its morph targets
 *   - Advance internal morph schedules on each frame (animate)
 *   - Reconstruct transient contributions for seek (prepareSeek / commitSeek)
 *   - Compose semantic pose, Three.js animation and bone deltas at one date
 *   - Expose mood, gesture and per-frame schedule registration
 *
 * The Three.js scene, camera, renderer and lights are managed by the caller.
 * The loaded model's scene group should be added to the caller's scene.
 */
import type { Camera, Object3D } from 'three'
import { MorphEngine } from '../morph/morph-engine.js'
import {
  createBoneMorphBinding,
} from '../morph/bone-morph-binding.js'
import { GestureEngine } from '../gesture/gesture-engine.js'
import { buildModelInstance } from '../model/model-loader.js'
import {
  GazeService,
} from '../gaze/gaze-service.js'
import { AvatarPoseComposer, createHipFeetBalanceDelta } from '../pose/avatar-pose.js'
import {
  createAvatarAnimationPlayer,
} from '../motion/avatar-animation-player.js'
import { AvatarDynamicBones } from '../model/dynamic-bones.js'
import type {
  AvatarEngine,
  AvatarEngineOptions,
  AvatarGazeLookAhead,
  AvatarGazeTarget,
  AvatarVector3,
  AvatarAnimationPlayer,
  BoneMorphBinding,
  BlinkScheduleFn,
} from '../avatar-types.js'

const NO_ROOT_MOTION: AvatarVector3 = { x: 0, y: 0, z: 0 }

export function createAvatarEngine(opts: AvatarEngineOptions = {}): AvatarEngine {
  const morphEngine = new MorphEngine(opts.baseline)
  let currentMood = opts.mood ?? 'neutral'
  let gestureEngine: GestureEngine | null = null
  let _blinkScheduleFn: BlinkScheduleFn | null = null
  let _blinkElapsed = 0
  let _gaze: GazeService | null = null
  let _gazeCamera: Camera | null = null
  let _gazeEnabled = false
  let _gazeContact: number | null = 1
  let _gazeHeadMove: number | null = 1
  let _gazeTarget: AvatarGazeTarget = 'camera'
  let _gazeLookAhead: AvatarGazeLookAhead | null = null
  let _boneMap: Map<string, Object3D> | null = null
  let _armature: Object3D | null = null
  let boneMorphBinding: BoneMorphBinding | null = null
  let poseComposer: AvatarPoseComposer | null = null
  let animationPlayer: AvatarAnimationPlayer | null = null
  let dynamicBones: AvatarDynamicBones | null = null
  let pendingDynamicDeltaMs = 0

  return {
    async loadModel(buffer, loaderOpts) {
      const result = await buildModelInstance(buffer, morphEngine, loaderOpts)
      gestureEngine = new GestureEngine(result.boneMap, opts.modelMovementFactor)
      _boneMap = result.boneMap
      _armature = result.armature ?? result.scene
      poseComposer = new AvatarPoseComposer(result.boneMap)
      animationPlayer = createAvatarAnimationPlayer(result.scene)
      dynamicBones = new AvatarDynamicBones(
        result.scene,
        result.boneMap,
        opts.dynamicBones,
        opts.dynamicBoneOptions,
      )
      boneMorphBinding = createBoneMorphBinding(result.boneMap)
      morphEngine.registerBoneMorphs(boneMorphBinding)
      morphEngine.snapAll()
      _gaze = createGazeService(_boneMap, _gazeCamera)
      applyGazeState()
      return {
        scene: result.scene,
        boneMap: result.boneMap,
        animations: result.animations,
      }
    },

    animate(deltaMs) {
      if (_blinkScheduleFn) {
        _blinkElapsed += deltaMs
        const r = _blinkScheduleFn({ elapsed: _blinkElapsed, mood: currentMood })
        if (r != null) morphEngine.snapFixed('eyesClosed', r.eyesClosed)
      }

      morphEngine.update(deltaMs)
      pendingDynamicDeltaMs = Math.max(0, deltaMs)
    },

    prepareSeek() {
      morphEngine.snapFixed('headRotateX', 0)
      morphEngine.snapFixed('headRotateY', 0)
      _blinkScheduleFn = null; _blinkElapsed = 0
      morphEngine.snapFixed('eyesClosed', 0)
      dynamicBones?.reset()
      pendingDynamicDeltaMs = 0
      gestureEngine?.reset()
      morphEngine.resetToBaselines()
      _gaze?.setEnabled(false)
      animationPlayer?.prepareSeek()
    },

    commitSeek(timelineMs) {
      // blink is epoch-based but resync-safe (no in-progress state to misread) —
      // a direct jump correctly reports whether timelineMs falls inside a blink window.
      if (_blinkScheduleFn) {
        _blinkElapsed = timelineMs
        const r = _blinkScheduleFn({ elapsed: timelineMs, mood: currentMood })
        morphEngine.snapFixed('eyesClosed', r ? r.eyesClosed : 0)
      }
      morphEngine.snapAll()
      applyGazeState()
    },

    setMood(name) {
      currentMood = name
    },

    setPose(name, startAt = 0) {
      return gestureEngine?.setBodyPose(name, startAt) ?? false
    },

    playGesture(name, rng, mirror = false, startAt = 0) {
      return gestureEngine?.applyGesture(name, rng, mirror, startAt) ?? null
    },

    releaseGesture(startAt = 0) {
      gestureEngine?.releaseGesture(startAt)
    },

    setGestureOverlay(overlay) {
      gestureEngine?.setOverlay(overlay)
    },

    setTalkingHands(options) {
      gestureEngine?.setTalkingHands(options)
    },

    setExplicitHandTargets(targets) {
      gestureEngine?.setExplicitHandTargets(targets)
    },

    setBlinkScheduleFn(fn) {
      _blinkScheduleFn = fn
      _blinkElapsed = 0
      if (!fn) morphEngine.snapFixed('eyesClosed', 0)
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

    setGazeHeadMove(value) {
      if (_gazeHeadMove === value) return
      _gazeHeadMove = value
      _gaze?.setHeadMove(value)
    },

    setGazeTarget(target, transition) {
      if (_gazeTarget === target && transition === undefined) return
      _gazeTarget = target
      _gaze?.setTarget(target, transition)
    },

    setGazeLookAhead(request) {
      _gazeLookAhead = request
      _gaze?.setLookAhead(request)
    },

    registerAnimation(name, clip, mode, rootMotion, entryTransitionMs) {
      animationPlayer?.register(name, clip, mode, rootMotion, entryTransitionMs)
    },

    getAnimation(name) {
      return animationPlayer?.get(name)
    },

    setAnimation(animation) {
      animationPlayer?.set(animation)
    },

    applyAnimationAt(timeMs) {
      const gestures = gestureEngine
      if (gestures === null || poseComposer === null) return NO_ROOT_MOTION
      const semantic = gestures.sampleAt(timeMs)

      const animation = animationPlayer?.sampleAt(timeMs) ?? null
      const suspendTalkingHands = animation !== null
        && (animation.releaseProgress === undefined || animation.releaseProgress < 1)
      const gestureOverlay = gestures.getOverlay(timeMs, semantic, suspendTalkingHands)

      const composedMorphDeltas = [
        boneMorphBinding?.getDelta() ?? new Map(),
        gestureOverlay,
      ]
      // Gaze must read the pose selected for this exact clock sample. Applying
      // it before the semantic and native layers makes it solve against the
      // previous frame, then add its correction to a different head pose.
      poseComposer.apply(poseComposer.compose(semantic, animation, composedMorphDeltas))

      const gaze = _gaze?.sample(timeMs)
      const composedDeltas = gaze === undefined || gaze.size === 0
        ? composedMorphDeltas
        : [...composedMorphDeltas, gaze]

      const balance = _armature === null || _boneMap === null
        ? new Map()
        : createHipFeetBalanceDelta(_armature, _boneMap)
      const balancedDeltas = balance.size === 0
        ? composedDeltas
        : [...composedDeltas, balance]
      poseComposer.apply(poseComposer.compose(semantic, animation, balancedDeltas))

      // TalkingHead advances DynamicBones after the semantic pose and clip
      // have been applied. The spring must observe this frame's parent
      // displacement, not the transform left by the previous frame.
      dynamicBones?.update(pendingDynamicDeltaMs)
      pendingDynamicDeltaMs = 0
      const dynamic = dynamicBones?.getDelta()
      if (dynamic !== undefined && dynamic.size > 0) {
        poseComposer.apply(poseComposer.compose(
          semantic,
          animation,
          [...balancedDeltas, dynamic],
        ))
      }
      morphEngine.reapplyFixed()
      return animation?.rootMotionOffset ?? NO_ROOT_MOTION
    },

    get morphEngine() { return morphEngine },
  }

  function createGazeService(
    boneMap: Map<string, Object3D> | null,
    camera: Camera | null,
  ): GazeService | null {
    if (boneMap === null) return null

    const leftEye = boneMap.get('LeftEye') ?? null
    const rightEye = boneMap.get('RightEye') ?? null
    const head = boneMap.get('Head') ?? null
    const necks = ['Neck', 'Neck1', 'Neck2']
      .map((name) => boneMap.get(name) ?? null)
      .filter((bone): bone is Object3D => bone !== null)

    const service = new GazeService(morphEngine, leftEye, rightEye, head, camera, necks)
    service.setTarget(_gazeTarget)
    service.setLookAhead(_gazeLookAhead)
    return service
  }

  function applyGazeState(): void {
    if (_gaze === null) return
    _gaze.setContact(_gazeContact)
    _gaze.setHeadMove(_gazeHeadMove)
    _gaze.setTarget(_gazeTarget)
    _gaze.setLookAhead(_gazeLookAhead)
    _gaze.setEnabled(_gazeEnabled)
  }

}
