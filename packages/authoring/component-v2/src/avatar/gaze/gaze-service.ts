/**
 * GazeService — calculates camera attention as an Avatar pose contribution.
 *
 * The service samples after AvatarPoseComposer has applied a provisional pose.
 * It never leaves rotations on bones: the composer receives and owns the
 * resulting correction as the final skeletal layer.
 */
import { Quaternion, Vector3 } from 'three'
import type { Camera, Object3D } from 'three'
import type { MorphEngine } from '../morph/morph-engine.js'
import type {
  AvatarGazeLookAhead,
  AvatarGazeTarget,
  AvatarGazeTargetTransition,
  AvatarPoseDelta,
  AvatarVector3,
} from '../avatar-types.js'
import { sampleTalkingHeadEasing } from '../avatar-easing.js'
import { createRandomSource, sampleTemplateNumber } from '../idle/th-animation-template.js'

/** Eye movement range in radians; eye morphs are secondary to head attention. */
const REF_ANGLE = 0.45
const HEAD_CONTACT_STRENGTH = 1.25
const HEAD_CONTACT_MAX_X = 0.4
const HEAD_CONTACT_MAX_Y = 0.75
const EYE_LOOK_STRENGTH = 0.45
const EYE_LOOK_DEADZONE = 0.06

/** Native TalkingHead contact defaults used by idle and speaking templates. */
export const TH_GAZE_DEFAULTS = {
  idleContact: 0.2,
  idleHeadMove: 0.5,
  speakingContact: 0.5,
  speakingHeadMove: 0.5,
  listeningContact: 0.5,
  listeningHeadMove: 0.5,
} as const

const GAZE_MORPHS = [
  'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight',
] as const

const LOOK_AHEAD_MORPHS = [
  'bodyRotateX', 'bodyRotateY', 'eyesRotateX', 'eyesRotateY',
  'browInnerUp', 'mouthLeft', 'mouthRight',
] as const

type AttentionBone = Readonly<{
  bone: Object3D
  weight: number
}>

type TargetTransition = Readonly<{
  from: AvatarGazeTarget
  to: AvatarGazeTarget
  startAt: number
  endAt: number
}>

type LookAheadMotion = Readonly<{
  request: AvatarGazeLookAhead
  targets: Readonly<Record<string, number>>
  from: Readonly<Record<string, number>>
}>

/** Builds a normalized neck/head chain so attention is not forced onto one bone. */
function buildAttentionBones(head: Object3D | null, necks: readonly Object3D[]): AttentionBone[] {
  const entries: AttentionBone[] = []
  for (const neck of necks) {
    const weight = neck.name === 'Neck' ? 0.08 : neck.name === 'Neck1' ? 0.14 : neck.name === 'Neck2' ? 0.23 : 0.12
    entries.push({ bone: neck, weight })
  }
  if (head !== null) entries.push({ bone: head, weight: 0.55 })

  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) return []
  return entries.map((entry) => ({ ...entry, weight: entry.weight / total }))
}

/** Calculates the Avatar contribution needed to maintain eye contact. */
export class GazeService {
  private enabled = false
  private contact = 1
  private headMove = 1
  private readonly morphs: MorphEngine
  private readonly leftEye: Object3D | null
  private readonly rightEye: Object3D | null
  private readonly head: Object3D | null
  private readonly camera: Camera | null
  private target: AvatarGazeTarget = 'camera'

  private readonly pL = new Vector3()
  private readonly pR = new Vector3()
  private readonly pEyes = new Vector3()
  private readonly pCamera = new Vector3()
  private readonly dir = new Vector3()
  private readonly fromDir = new Vector3()
  private readonly toDir = new Vector3()
  private readonly headWorldQuaternion = new Quaternion()
  private readonly attentionBones: readonly AttentionBone[]
  private targetTransition: TargetTransition | null = null
  private lookAhead: LookAheadMotion | null = null
  private lookAheadApplied = false

  /** Retains model and camera references only while the Avatar instance is alive. */
  constructor(
    morphs: MorphEngine,
    leftEye: Object3D | null,
    rightEye: Object3D | null,
    head: Object3D | null,
    camera: Camera | null,
    necks: readonly Object3D[] = [],
  ) {
    this.morphs = morphs
    this.leftEye = leftEye
    this.rightEye = rightEye
    this.head = head
    this.camera = camera
    this.attentionBones = buildAttentionBones(head, necks)
  }

  /** Selects a gaze target, optionally interpolating it on the absolute clock. */
  setTarget(target: AvatarGazeTarget, transition?: AvatarGazeTargetTransition): void {
    if (transition === undefined) {
      if (this.target === target && this.targetTransition === null) return
      this.target = target
      this.targetTransition = null
      return
    }

    const startAt = Number.isFinite(transition.startAt) ? transition.startAt : 0
    const durationMs = Number.isFinite(transition.durationMs)
      ? Math.max(0, transition.durationMs)
      : 0
    if (this.target === target
      && this.targetTransition?.startAt === startAt
      && this.targetTransition?.endAt === startAt + durationMs) return
    if (durationMs === 0) {
      this.target = target
      this.targetTransition = null
      return
    }

    const from = this.resolveTargetAt(startAt)
    this.target = target
    this.targetTransition = {
      from,
      to: target,
      startAt,
      endAt: startAt + durationMs,
    }
  }

  /** Enables or disables the gaze contribution and clears eye morph overrides. */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (!enabled) this.clearEyeLook()
  }

  /** Sets the normalized contact strength used by the sampled contribution. */
  setContact(value: number | null): void {
    const next = value === null ? 1 : Math.max(0, Math.min(1, value))
    if (next === this.contact) return
    this.contact = next
    if (next <= 0) this.clearEyeLook()
  }

  /** Sets the independent head-motion strength used by camera contact. */
  setHeadMove(value: number | null): void {
    this.headMove = value === null ? 1 : Math.max(0, Math.min(1, value))
  }

  /** Installs or clears one absolute TalkingHead look-ahead template. */
  setLookAhead(request: AvatarGazeLookAhead | null): void {
    if (request === null) {
      this.lookAhead = null
      this.clearLookAhead()
      return
    }
    if (this.lookAhead?.request.startAt === request.startAt
      && this.lookAhead.request.durationMs === request.durationMs
      && this.lookAhead.request.seed === request.seed) return

    const random = createRandomSource(request.seed)
    const bodyRotateX = (random.random() - 0.5) / 4
    const bodyRotateY = (random.random() - 0.5) / 4
    const targets: Record<string, number> = {
      bodyRotateX,
      bodyRotateY,
      eyesRotateX: -3 * bodyRotateX + 0.1,
      eyesRotateY: -5 * bodyRotateY,
      browInnerUp: this.morphs.getBaseline('browInnerUp') + sampleTemplateNumber([0, 0.7], random),
      mouthLeft: this.morphs.getBaseline('mouthLeft') + sampleTemplateNumber([0, 0.7], random),
      mouthRight: this.morphs.getBaseline('mouthRight') + sampleTemplateNumber([0, 0.7], random),
    }
    const from: Record<string, number> = {}
    for (const name of LOOK_AHEAD_MORPHS) from[name] = this.morphs.getValue(name)
    this.lookAhead = { request, targets, from }
    this.lookAheadApplied = false
  }

  /** Samples the head correction and applies only the corresponding eye morphs. */
  sample(timeMs = 0): AvatarPoseDelta {
    const lookAheadActive = this.sampleLookAhead(timeMs)
    if (lookAheadActive) {
      this.clearEyeLook()
      return new Map()
    }
    if (!this.enabled || this.leftEye === null || this.rightEye === null || this.contact <= 0) {
      return new Map()
    }

    const headLocalDirection = this.computeHeadLocalDirection(timeMs)
    if (headLocalDirection === null) return new Map()

    const pitch = Math.asin(clampSigned(headLocalDirection.y))
    const yaw = Math.asin(clampSigned(headLocalDirection.x))
    const correction = this.createAttentionCorrection(pitch, yaw)
    this.applyTemporaryCorrection(correction, 1)
    const residual = this.computeHeadLocalDirection(timeMs) ?? headLocalDirection
    this.applyTemporaryCorrection(correction, -1)
    this.applyEyeLook(residual)
    return correction
  }

  /** Samples the finite native look-ahead template and reports whether it owns gaze. */
  private sampleLookAhead(timeMs: number): boolean {
    const motion = this.lookAhead
    if (motion === null) return false

    const revealAt = motion.request.startAt + 750
    const endAt = revealAt + Math.max(0, motion.request.durationMs)
    if (timeMs < motion.request.startAt || timeMs > endAt) {
      if (this.lookAheadApplied) this.clearLookAhead()
      return false
    }

    const progress = sampleTalkingHeadEasing(
      (timeMs - motion.request.startAt) / 750,
    )
    for (const name of LOOK_AHEAD_MORPHS) {
      const from = motion.from[name] ?? 0
      const target = motion.targets[name] ?? from
      this.morphs.snapSystem(name, from + (target - from) * progress)
    }
    this.lookAheadApplied = timeMs >= revealAt
    return this.lookAheadApplied
  }

  /** Computes the selected attention direction in Head-local coordinates. */
  private computeHeadLocalDirection(timeMs: number): Vector3 | null {
    if (this.leftEye === null || this.rightEye === null) return null
    this.leftEye.updateMatrixWorld(true)
    this.rightEye.updateMatrixWorld(true)
    this.pL.setFromMatrixPosition(this.leftEye.matrixWorld)
    this.pR.setFromMatrixPosition(this.rightEye.matrixWorld)
    this.pEyes.addVectors(this.pL, this.pR).multiplyScalar(0.5)

    if (this.head !== null) {
      this.head.updateMatrixWorld(true)
      this.head.getWorldQuaternion(this.headWorldQuaternion).invert()
    }

    const transition = this.targetTransition
    if (transition === null) {
      if (!this.resolveTargetDirection(this.target, this.dir)) return null
    } else if (timeMs <= transition.startAt) {
      if (!this.resolveTargetDirection(transition.from, this.dir)) return null
    } else if (timeMs >= transition.endAt) {
      if (!this.resolveTargetDirection(transition.to, this.dir)) return null
    } else {
      if (!this.resolveTargetDirection(transition.from, this.fromDir)) return null
      if (!this.resolveTargetDirection(transition.to, this.toDir)) return null
      const progress = (timeMs - transition.startAt) / (transition.endAt - transition.startAt)
      this.dir.lerpVectors(this.fromDir, this.toDir, sampleTalkingHeadEasing(progress)).normalize()
    }
    return this.dir
  }

  /** Resolves one target direction in head-local coordinates. */
  private resolveTargetDirection(target: AvatarGazeTarget, result: Vector3): boolean {
    if (target === 'ahead') {
      result.set(0.035, 0.025, 1).normalize()
    } else {
      if (this.camera === null) return false
      this.camera.updateMatrixWorld(true)
      this.camera.getWorldPosition(this.pCamera)
      result.subVectors(this.pCamera, this.pEyes).normalize()
    }
    if (this.head !== null) result.applyQuaternion(this.headWorldQuaternion).normalize()
    return true
  }

  /** Returns the target active at the beginning of a new transition. */
  private resolveTargetAt(timeMs: number): AvatarGazeTarget {
    const transition = this.targetTransition
    if (transition === null) return this.target
    if (timeMs <= transition.startAt) return transition.from
    if (timeMs >= transition.endAt) return transition.to
    return transition.to
  }

  /** Creates the distributed neck and head correction without writing persistent state. */
  private createAttentionCorrection(pitch: number, yaw: number): AvatarPoseDelta {
    const result = new Map<Object3D, { rotation: AvatarVector3 }>()
    const totalX = clamp(pitch * -HEAD_CONTACT_STRENGTH * this.headMove, HEAD_CONTACT_MAX_X)
    const totalY = clamp(yaw * HEAD_CONTACT_STRENGTH * this.headMove, HEAD_CONTACT_MAX_Y)
    for (const { bone, weight } of this.attentionBones) {
      result.set(bone, {
        rotation: { x: totalX * weight, y: totalY * weight, z: 0 },
      })
    }
    return result
  }

  /** Temporarily applies a candidate correction while computing eye residuals. */
  private applyTemporaryCorrection(correction: AvatarPoseDelta, direction: 1 | -1): void {
    for (const [bone, contribution] of correction) {
      const rotation = contribution.rotation
      if (rotation === undefined) continue
      bone.rotation.x += rotation.x * direction
      bone.rotation.y += rotation.y * direction
      bone.rotation.z += rotation.z * direction
      bone.updateMatrixWorld(true)
    }
  }

  /** Applies ARKit eye-look morphs from the residual local camera direction. */
  private applyEyeLook(direction: Vector3): void {
    const pitch = Math.asin(clampSigned(direction.y))
    const vertical = Math.abs(pitch) < EYE_LOOK_DEADZONE
      ? 0
      : Math.min(1, Math.abs(pitch) / REF_ANGLE) * this.contact * EYE_LOOK_STRENGTH
    if (pitch > EYE_LOOK_DEADZONE) {
      this.setEyeMorphs('eyeLookUpLeft', 'eyeLookUpRight', vertical)
      this.setEyeMorphs('eyeLookDownLeft', 'eyeLookDownRight', 0)
    } else if (pitch < -EYE_LOOK_DEADZONE) {
      this.setEyeMorphs('eyeLookUpLeft', 'eyeLookUpRight', 0)
      this.setEyeMorphs('eyeLookDownLeft', 'eyeLookDownRight', vertical)
    } else {
      this.setEyeMorphs('eyeLookUpLeft', 'eyeLookUpRight', 0)
      this.setEyeMorphs('eyeLookDownLeft', 'eyeLookDownRight', 0)
    }

    const yaw = Math.asin(clampSigned(direction.x))
    const horizontal = Math.abs(yaw) < EYE_LOOK_DEADZONE
      ? 0
      : Math.min(1, Math.abs(yaw) / REF_ANGLE) * this.contact * EYE_LOOK_STRENGTH
    if (yaw > EYE_LOOK_DEADZONE) {
      this.morphs.snapSystem('eyeLookInLeft', horizontal)
      this.morphs.snapSystem('eyeLookOutLeft', 0)
      this.morphs.snapSystem('eyeLookInRight', 0)
      this.morphs.snapSystem('eyeLookOutRight', horizontal)
    } else if (yaw < -EYE_LOOK_DEADZONE) {
      this.morphs.snapSystem('eyeLookInLeft', 0)
      this.morphs.snapSystem('eyeLookOutLeft', horizontal)
      this.morphs.snapSystem('eyeLookInRight', horizontal)
      this.morphs.snapSystem('eyeLookOutRight', 0)
    } else {
      this.morphs.snapSystem('eyeLookInLeft', 0)
      this.morphs.snapSystem('eyeLookOutLeft', 0)
      this.morphs.snapSystem('eyeLookInRight', 0)
      this.morphs.snapSystem('eyeLookOutRight', 0)
    }
  }

  /** Applies the same value to the two vertical eye morphs of one direction. */
  private setEyeMorphs(first: string, second: string, value: number): void {
    this.morphs.snapSystem(first, value)
    this.morphs.snapSystem(second, value)
  }

  /** Clears every runtime eye-look value owned by the gaze contribution. */
  private clearEyeLook(): void {
    for (const name of GAZE_MORPHS) {
      this.morphs.setSystem(name, null)
    }
  }

  /** Releases the morph channels owned by the finite look-ahead template. */
  private clearLookAhead(): void {
    for (const name of LOOK_AHEAD_MORPHS) this.morphs.snapSystem(name, null)
    this.lookAheadApplied = false
  }
}

/** Clamps a trigonometric input to the domain accepted by asin. */
function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

/** Clamps an attention correction symmetrically around zero. */
function clamp(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value))
}
