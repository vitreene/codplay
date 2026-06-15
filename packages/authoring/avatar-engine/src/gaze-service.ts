/**
 * GazeService — computes eye→camera direction and drives eyeLook morphs.
 *
 * Adapted from TalkingHead's eyeContact mechanism by Mika Suominen (met4citizen), MIT.
 * Source: https://github.com/met4citizen/TalkingHead
 *
 * TH's eyeContact works by reading the Head bone's current rotation (after body/gestures)
 * and compensating the eyes to remain locked on the camera. Here we use a simpler geometric
 * approach: world-space direction from eye-center to camera, mapped to eyeLook morphs.
 *
 * Must be called every tick() AND at seek() after engine.commitSeek(), before render.
 * Enabled/disabled by an 'avatar:gaze' CodPlay event — the event is materialized in the
 * track so seek replays it correctly before computeAndApply() runs.
 */
import { Vector3 } from 'three'
import type { Object3D, Camera } from 'three'
import type { MorphEngine } from './morph-engine.js'

/** Full eye movement range in radians (TH reference value). */
const REF_ANGLE = 0.5

const GAZE_MORPHS = [
  'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight',
] as const

export class GazeService {
  private enabled = false

  private readonly morphs: MorphEngine
  private readonly leftEye: Object3D | null
  private readonly rightEye: Object3D | null
  private readonly camera: Camera

  // Pre-allocated vectors — avoid GC per frame
  private readonly pL = new Vector3()
  private readonly pR = new Vector3()
  private readonly pEyes = new Vector3()
  private readonly dir = new Vector3()

  constructor(
    morphs: MorphEngine,
    leftEye: Object3D | null,
    rightEye: Object3D | null,
    camera: Camera,
  ) {
    this.morphs = morphs
    this.leftEye = leftEye
    this.rightEye = rightEye
    this.camera = camera
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (!enabled) {
      for (const name of GAZE_MORPHS) {
        this.morphs.setFixed(name, null)
      }
    }
  }

  /**
   * Compute world-space direction from eyes center to camera, map to eyeLook morphs.
   * Avatar is assumed to face +Z (standard Mixamo/GLB convention).
   * No-op if disabled or eye bones are absent.
   */
  computeAndApply(): void {
    if (!this.enabled || !this.leftEye || !this.rightEye) return

    this.leftEye.updateMatrixWorld(true)
    this.rightEye.updateMatrixWorld(true)
    this.pL.setFromMatrixPosition(this.leftEye.matrixWorld)
    this.pR.setFromMatrixPosition(this.rightEye.matrixWorld)
    this.pEyes.addVectors(this.pL, this.pR).multiplyScalar(0.5)
    this.dir.subVectors(this.camera.position, this.pEyes).normalize()

    // Vertical — dir.y > 0 means camera is above eyes → look up
    const pitch = Math.asin(Math.max(-1, Math.min(1, this.dir.y)))
    const vy = Math.min(1, Math.abs(pitch) / REF_ANGLE)
    if (pitch > 0) {
      this.morphs.snapFixed('eyeLookUpLeft', vy)
      this.morphs.snapFixed('eyeLookUpRight', vy)
      this.morphs.snapFixed('eyeLookDownLeft', 0)
      this.morphs.snapFixed('eyeLookDownRight', 0)
    } else {
      this.morphs.snapFixed('eyeLookUpLeft', 0)
      this.morphs.snapFixed('eyeLookUpRight', 0)
      this.morphs.snapFixed('eyeLookDownLeft', vy)
      this.morphs.snapFixed('eyeLookDownRight', vy)
    }

    // Horizontal — avatar faces +Z, its right is world +X
    // dir.x > 0: camera to avatar's right → both eyes look right
    //   left eye (world -X side) looking right = toward nose → eyeLookInLeft
    //   right eye (world +X side) looking right = away from nose → eyeLookOutRight
    const yaw = Math.asin(Math.max(-1, Math.min(1, this.dir.x)))
    const vx = Math.min(1, Math.abs(yaw) / REF_ANGLE)
    if (yaw > 0) {
      this.morphs.snapFixed('eyeLookInLeft', vx)
      this.morphs.snapFixed('eyeLookOutLeft', 0)
      this.morphs.snapFixed('eyeLookInRight', 0)
      this.morphs.snapFixed('eyeLookOutRight', vx)
    } else {
      this.morphs.snapFixed('eyeLookInLeft', 0)
      this.morphs.snapFixed('eyeLookOutLeft', vx)
      this.morphs.snapFixed('eyeLookInRight', vx)
      this.morphs.snapFixed('eyeLookOutRight', 0)
    }
  }
}
