/**
 * GazeService — computes eye→camera direction and drives eyeLook morphs.
 *
 * Adapted from TalkingHead's eyeContact mechanism by Mika Suominen (met4citizen), MIT.
 * Source: https://github.com/met4citizen/TalkingHead
 *
 * TH's eyeContact works by reading the Head bone's current rotation (after body/gestures)
 * and compensating the eyes to remain locked on the user. Here we correct the neck/head
 * chain toward the user first, then map the remaining Head-local direction to eyeLook morphs.
 *
 * Must be called every tick() AND at seek() after all semantic layers, before render.
 * Enabled/disabled by an 'avatar:gaze' CodPlay event — the event is materialized in the
 * track so seek replays it correctly before computeAndApply() runs.
 */
import { Quaternion, Vector3 } from 'three'
import type { Object3D, Camera } from 'three'
import type { MorphEngine } from './morph-engine.js'

/** Eye movement range in radians; eye morphs are secondary to head/neck attention. */
const REF_ANGLE = 0.45
const HEAD_CONTACT_STRENGTH = 1.25
const HEAD_CONTACT_MAX_X = 0.4
const HEAD_CONTACT_MAX_Y = 0.75
const EYE_LOOK_STRENGTH = 0.45
const EYE_LOOK_DEADZONE = 0.06

const GAZE_MORPHS = [
  'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight',
] as const

/** Builds a normalized neck/head chain so attention is not forced onto one bone. */
function buildAttentionBones(head: Object3D | null, necks: readonly Object3D[]): Array<{ bone: Object3D; weight: number }> {
  const raw: Array<{ bone: Object3D; weight: number }> = []
  for (const neck of necks) {
    const weight = neck.name === 'Neck' ? 0.08 : neck.name === 'Neck1' ? 0.14 : neck.name === 'Neck2' ? 0.23 : 0.12
    raw.push({ bone: neck, weight })
  }
  if (head) raw.push({ bone: head, weight: 0.55 })

  const total = raw.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) return []
  return raw.map((entry) => ({ bone: entry.bone, weight: entry.weight / total }))
}

export class GazeService {
  private enabled = false

  private readonly morphs: MorphEngine
  private readonly leftEye: Object3D | null
  private readonly rightEye: Object3D | null
  private readonly head: Object3D | null
  private readonly attentionBones: Array<{ bone: Object3D; weight: number }>
  private readonly camera: Camera

  // Pre-allocated vectors — avoid GC per frame
  private readonly pL = new Vector3()
  private readonly pR = new Vector3()
  private readonly pEyes = new Vector3()
  private readonly pCamera = new Vector3()
  private readonly dir = new Vector3()
  private readonly headWorldQuaternion = new Quaternion()
  private readonly corrections = new Map<Object3D, { x: number; y: number }>()
  private contact = 1

  constructor(
    morphs: MorphEngine,
    leftEye: Object3D | null,
    rightEye: Object3D | null,
    head: Object3D | null,
    camera: Camera,
    necks: readonly Object3D[] = [],
  ) {
    this.morphs = morphs
    this.leftEye = leftEye
    this.rightEye = rightEye
    this.head = head
    this.camera = camera
    this.attentionBones = buildAttentionBones(head, necks)
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (!enabled) {
      this.clearHeadCorrection()
      for (const name of GAZE_MORPHS) {
        this.morphs.setFixed(name, null)
      }
    }
  }

  /** Sets eye-contact strength from MotionEngine's `eyeContact` channel. */
  setContact(value: number | null): void {
    const next = value === null ? 1 : Math.max(0, Math.min(1, value))
    if (next === this.contact) return
    this.contact = next
    if (next <= 0) {
      this.clearHeadCorrection()
      for (const name of GAZE_MORPHS) {
        this.morphs.setFixed(name, null)
      }
    }
  }

  /**
   * Applies a late head/eye constraint toward the camera.
   * No-op if disabled or eye bones are absent.
   */
  computeAndApply(): void {
    if (!this.enabled || !this.leftEye || !this.rightEye) return

    this.clearHeadCorrection()
    if (this.contact <= 0) return

    const headLocalDirection = this.computeHeadLocalCameraDirection()
    if (!headLocalDirection) return

    const pitch = Math.asin(Math.max(-1, Math.min(1, headLocalDirection.y)))
    const yaw = Math.asin(Math.max(-1, Math.min(1, headLocalDirection.x)))

    this.applyAttentionCorrection(pitch, yaw)

    const residualDirection = this.computeHeadLocalCameraDirection() ?? headLocalDirection

    this.applyEyeLook(residualDirection)
  }

  /** Computes the camera direction in Head-local coordinates. */
  private computeHeadLocalCameraDirection(): Vector3 | null {
    if (!this.leftEye || !this.rightEye) return null

    this.leftEye.updateMatrixWorld(true)
    this.rightEye.updateMatrixWorld(true)
    this.camera.updateMatrixWorld(true)
    this.pL.setFromMatrixPosition(this.leftEye.matrixWorld)
    this.pR.setFromMatrixPosition(this.rightEye.matrixWorld)
    this.pEyes.addVectors(this.pL, this.pR).multiplyScalar(0.5)
    this.camera.getWorldPosition(this.pCamera)
    this.dir.subVectors(this.pCamera, this.pEyes).normalize()

    if (this.head) {
      this.head.updateMatrixWorld(true)
      this.head.getWorldQuaternion(this.headWorldQuaternion).invert()
      this.dir.applyQuaternion(this.headWorldQuaternion).normalize()
    }

    return this.dir
  }

  /** Removes the previous additive head correction before computing the next one. */
  private clearHeadCorrection(): void {
    if (this.corrections.size === 0) return
    for (const [bone, correction] of this.corrections) {
      bone.rotation.x -= correction.x
      bone.rotation.y -= correction.y
      bone.updateMatrixWorld(true)
    }
    this.corrections.clear()
  }

  /** Rotates the neck/head chain toward the user before eye morphs handle the residual. */
  private applyAttentionCorrection(pitch: number, yaw: number): void {
    if (this.attentionBones.length === 0) return

    const totalX = Math.max(-HEAD_CONTACT_MAX_X, Math.min(HEAD_CONTACT_MAX_X, -pitch * HEAD_CONTACT_STRENGTH * this.contact))
    const totalY = Math.max(-HEAD_CONTACT_MAX_Y, Math.min(HEAD_CONTACT_MAX_Y, yaw * HEAD_CONTACT_STRENGTH * this.contact))
    for (const { bone, weight } of this.attentionBones) {
      const x = totalX * weight
      const y = totalY * weight
      bone.rotation.x += x
      bone.rotation.y += y
      bone.updateMatrixWorld(true)
      this.corrections.set(bone, { x, y })
    }
  }

  /** Applies ARKit eye-look morphs from a Head-local camera direction. */
  private applyEyeLook(direction: Vector3): void {

    // Vertical — dir.y > 0 means camera is above eyes → look up
    const pitch = Math.asin(Math.max(-1, Math.min(1, direction.y)))
    const vy = Math.abs(pitch) < EYE_LOOK_DEADZONE ? 0 : Math.min(1, Math.abs(pitch) / REF_ANGLE) * this.contact * EYE_LOOK_STRENGTH
    if (pitch > EYE_LOOK_DEADZONE) {
      this.morphs.snapFixed('eyeLookUpLeft', vy)
      this.morphs.snapFixed('eyeLookUpRight', vy)
      this.morphs.snapFixed('eyeLookDownLeft', 0)
      this.morphs.snapFixed('eyeLookDownRight', 0)
    } else if (pitch < -EYE_LOOK_DEADZONE) {
      this.morphs.snapFixed('eyeLookUpLeft', 0)
      this.morphs.snapFixed('eyeLookUpRight', 0)
      this.morphs.snapFixed('eyeLookDownLeft', vy)
      this.morphs.snapFixed('eyeLookDownRight', vy)
    } else {
      this.morphs.snapFixed('eyeLookUpLeft', 0)
      this.morphs.snapFixed('eyeLookUpRight', 0)
      this.morphs.snapFixed('eyeLookDownLeft', 0)
      this.morphs.snapFixed('eyeLookDownRight', 0)
    }

    // Horizontal — avatar faces +Z, its right is world +X
    // dir.x > 0: camera to avatar's right → both eyes look right
    //   left eye (world -X side) looking right = toward nose → eyeLookInLeft
    //   right eye (world +X side) looking right = away from nose → eyeLookOutRight
    const yaw = Math.asin(Math.max(-1, Math.min(1, direction.x)))
    const vx = Math.abs(yaw) < EYE_LOOK_DEADZONE ? 0 : Math.min(1, Math.abs(yaw) / REF_ANGLE) * this.contact * EYE_LOOK_STRENGTH
    if (yaw > EYE_LOOK_DEADZONE) {
      this.morphs.snapFixed('eyeLookInLeft', vx)
      this.morphs.snapFixed('eyeLookOutLeft', 0)
      this.morphs.snapFixed('eyeLookInRight', 0)
      this.morphs.snapFixed('eyeLookOutRight', vx)
    } else if (yaw < -EYE_LOOK_DEADZONE) {
      this.morphs.snapFixed('eyeLookInLeft', 0)
      this.morphs.snapFixed('eyeLookOutLeft', vx)
      this.morphs.snapFixed('eyeLookInRight', vx)
      this.morphs.snapFixed('eyeLookOutRight', 0)
    } else {
      this.morphs.snapFixed('eyeLookInLeft', 0)
      this.morphs.snapFixed('eyeLookOutLeft', 0)
      this.morphs.snapFixed('eyeLookInRight', 0)
      this.morphs.snapFixed('eyeLookOutRight', 0)
    }
  }
}
