import type { AvatarEngine, ResolvedPose } from '@codplay/avatar-engine'
import { GESTURE_TEMPLATES, POSE_TEMPLATES } from '@codplay/avatar-engine'
import { resolveMotionDurationMs } from '../semantic-motion/avatar3d-motion-utils.js'
import type { Avatar3DMotion, Avatar3DMotionCatalog, Avatar3DMotionOverlayBone, Avatar3DMotionRef, Avatar3DMotionValue } from '../semantic-motion/avatar3d-motion-types.js'
import { BUILTIN_AVATAR3D_MOTIONS } from '../semantic-motion/avatar3d-motion-catalog.js'
import type { Avatar3DRuntimeUpdateInput, Avatar3DWarningReporter } from './avatar3d-runtime-types.js'

type Rotation = { x: number; y: number; z: number; px?: number; py?: number; pz?: number }
type PartialRotation = { x?: number; y?: number; z?: number }
type PartialPose = Map<string, PartialRotation>
type RotationValue = number | [number, number] | [number, number, number, number]
type RotationTemplate = Record<string, { x?: RotationValue; y?: RotationValue; z?: RotationValue }>

type PoseTransition = {
  from: PartialPose
  to: PartialPose
  startMs: number
  name: string
}

type GestureState = {
  from: ResolvedPose
  target: PartialPose | null
  startMs: number
  endMs: number
  name: string | null
}

type OverlayState = {
  bones: Map<string, Avatar3DMotionOverlayBone>
  startMs: number
  endMs: number
}

const SKELETON_EASE = 0.003
const GESTURE_TRANSITION_MS = 850
const OVERLAY_FADE_RAMP_MS = 300
const BODY_POSE_HEAD_BONES = new Set(['Head', 'Neck', 'Neck1', 'Neck2'])

/** Creates a deterministic Mulberry32 PRNG for TH random ranges. */
function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

/** Matches TH's exponential pose/gesture easing for a direct sample at elapsed ms. */
function easeAt(elapsedMs: number): number {
  return 1 - Math.exp(-SKELETON_EASE * Math.max(0, elapsedMs))
}

/** Smooth gesture interpolation: zero velocity at start/end avoids robotic snaps. */
function easeGestureAt(elapsedMs: number): number {
  const t = Math.max(0, Math.min(1, elapsedMs / GESTURE_TRANSITION_MS))
  return t * t * (3 - 2 * t)
}

/** Samples one TH scalar/range value. */
function sampleValue(value: RotationValue, random: () => number): number {
  if (typeof value === 'number') return value
  const [min, max, skewFrom, skewTo] = value.length === 4 ? value : [value[0], value[1], 1, 1]
  const u = random()
  const power = skewFrom + (skewTo - skewFrom) * u
  return min + (max - min) * Math.pow(u, 1 / Math.max(0.001, power))
}

/** Mirrors a TH bone name across the avatar sagittal plane. */
function mirrorBoneName(name: string): string {
  if (name.startsWith('Left')) return `Right${name.slice('Left'.length)}`
  if (name.startsWith('Right')) return `Left${name.slice('Right'.length)}`
  return name
}

/** Mirrors one scalar/range rotation value by negating its sampled result. */
function mirrorRotationValue(value: RotationValue): RotationValue {
  if (typeof value === 'number') return -value
  const mirrored: number[] = [-value[1], -value[0]]
  if (value.length === 4) mirrored.push(value[2], value[3])
  return mirrored as RotationValue
}

/** Converts TH `Bone.rotation` template entries into a resolved pose map. */
function resolveTemplate(template: RotationTemplate, seed: number, mirror = false): PartialPose {
  const random = mulberry32(seed)
  const pose: PartialPose = new Map()
  for (const [key, rot] of Object.entries(template)) {
    const dotIdx = key.lastIndexOf('.')
    const boneName = mirror ? mirrorBoneName(key.slice(0, dotIdx)) : key.slice(0, dotIdx)
    const prop = key.slice(dotIdx + 1)
    if (prop !== 'rotation') continue
    const next: PartialRotation = {}
    if (rot.x !== undefined) next.x = sampleValue(rot.x, random)
    if (rot.y !== undefined) next.y = sampleValue(mirror ? mirrorRotationValue(rot.y) : rot.y, random)
    if (rot.z !== undefined) next.z = sampleValue(mirror ? mirrorRotationValue(rot.z) : rot.z, random)
    pose.set(boneName, next)
  }
  return pose
}

/** Resolves body-pose templates without claiming head/neck axes owned by gaze and head motions. */
function resolveBodyPoseTemplate(template: RotationTemplate): PartialPose {
  const pose = resolveTemplate(template, 0)
  for (const boneName of BODY_POSE_HEAD_BONES) pose.delete(boneName)
  return pose
}

/** Linear interpolation between two rotations. */
function lerpRotation(from: Rotation, to: Rotation, alpha: number): Rotation {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
    z: from.z + (to.z - from.z) * alpha,
  }
}

/** Merges a base pose with partial override rotations. */
function composePose(base: ResolvedPose, overrides: PartialPose): ResolvedPose {
  const out: ResolvedPose = new Map()
  for (const [bone, rot] of base) out.set(bone, { x: rot.x, y: rot.y, z: rot.z })
  for (const [bone, rot] of overrides) {
    const current = out.get(bone) ?? { x: 0, y: 0, z: 0 }
    out.set(bone, {
      x: rot.x ?? current.x,
      y: rot.y ?? current.y,
      z: rot.z ?? current.z,
    })
  }
  return out
}

/** Extracts the first MotionEngine pose command from one channel. */
function resolvePoseCommand(values: readonly Avatar3DMotionValue[] | undefined): { name: string | null; unsupportedFeature: string | null } {
  if (!values) return { name: null, unsupportedFeature: null }
  for (const value of values) {
    if (value === null) continue
    if (typeof value !== 'string') return { name: null, unsupportedFeature: 'channel:pose:invalid_command' }
    return { name: value, unsupportedFeature: null }
  }
  return { name: null, unsupportedFeature: null }
}

/** Extracts the first MotionEngine gesture command from one channel. */
function resolveGestureCommand(values: readonly Avatar3DMotionValue[] | undefined): { name: string | null; mirror: boolean; unsupportedFeature: string | null } {
  if (!values) return { name: null, mirror: false, unsupportedFeature: null }
  for (const value of values) {
    if (value === null) continue
    if (!Array.isArray(value) || typeof value[0] !== 'string') return { name: null, mirror: false, unsupportedFeature: 'channel:gesture:invalid_command' }
    return { name: value[0], mirror: value[2] === true, unsupportedFeature: null }
  }
  return { name: null, mirror: false, unsupportedFeature: null }
}

/** Deterministic evaluator for TH body pose + gesture composition. */
export class AvatarSkeletalController {
  private readonly engine: AvatarEngine
  private readonly catalog: Avatar3DMotionCatalog
  private readonly report: Avatar3DWarningReporter
  private poseTransition: PoseTransition
  private gesture: GestureState | null = null
  private overlay: OverlayState | null = null

  /** Creates one skeletal controller with TH's default `side` pose baseline. */
  constructor(input: {
    engine: AvatarEngine
    localMotions?: Avatar3DMotionCatalog
    report: Avatar3DWarningReporter
  }) {
    this.engine = input.engine
    this.catalog = { ...BUILTIN_AVATAR3D_MOTIONS, ...input.localMotions }
    this.report = input.report
    const side = resolveBodyPoseTemplate(POSE_TEMPLATES.side as RotationTemplate)
    this.poseTransition = { from: side, to: side, startMs: 0, name: 'side' }
  }

  /** Handles direct pose/gesture events and MotionEngine `vs.pose`/`vs.gesture`. */
  handleUpdate(input: Avatar3DRuntimeUpdateInput): boolean {
    if ('pose' in input.action) {
      const pose = input.action['pose']
      if (typeof pose === 'string') this.setPose(pose, input.eventMs)
      return true
    }

    if ('gesture' in input.action) {
      const gesture = input.action['gesture']
      if (typeof gesture === 'string') this.startGesture(gesture, input.eventMs, Number.POSITIVE_INFINITY, input.eventSeq)
      else this.releaseGesture(input.eventMs)
      return true
    }

    if (!('motion' in input.action)) return false
    const ref = input.action['motion'] as Avatar3DMotionRef | null | undefined
    if (ref == null) {
      this.overlay = null
      return false
    }

    const motion = this.resolveMotion(ref)
    if (!motion) return false

    let handled = false
    const motionTrack = motion._track ?? 'action'
    if (motionTrack === 'action') this.overlay = null

    if (this.startOverlay(motion, input.eventMs)) handled = true

    const poseCommand = resolvePoseCommand(motion.vs?.pose)
    if (poseCommand.unsupportedFeature) {
      this.report('AVATAR3D_MOTION_POSE_UNSUPPORTED', 'Avatar3D motion pose command is not supported', { feature: poseCommand.unsupportedFeature })
      handled = true
    } else if (poseCommand.name) {
      this.setPose(poseCommand.name, input.eventMs)
      handled = true
    }

    const gestureCommand = resolveGestureCommand(motion.vs?.gesture)
    if (gestureCommand.unsupportedFeature) {
      this.report('AVATAR3D_MOTION_GESTURE_UNSUPPORTED', 'Avatar3D motion gesture command is not supported', { feature: gestureCommand.unsupportedFeature })
      handled = true
    } else if (gestureCommand.name) {
      const durationMs = resolveMotionDurationMs(motion.dt)
      this.startGesture(gestureCommand.name, input.eventMs, durationMs > 0 ? input.eventMs + durationMs : Number.POSITIVE_INFINITY, input.eventSeq, gestureCommand.mirror)
      handled = true
    }

    return handled
  }

  /** Clears transient state before seek replay reconstructs events. */
  prepareSeek(): void {
    const side = resolveBodyPoseTemplate(POSE_TEMPLATES.side as RotationTemplate)
    this.poseTransition = { from: side, to: side, startMs: 0, name: 'side' }
    this.gesture = null
    this.overlay = null
  }

  /** Evaluates and applies the composed skeleton pose at one timeline position. */
  evaluate(timelineMs: number): void {
    this.engine.gestureEngine?.applyResolvedSemanticPose?.(this.sampleSkeleton(timelineMs))
  }

  /** Stops all transient skeletal state. */
  stop(): void {
    this.gesture = null
    this.overlay = null
  }

  /** Resolves an inline motion or catalog reference. */
  private resolveMotion(ref: Avatar3DMotionRef | null | undefined): Avatar3DMotion | null {
    if (ref == null) return null
    if (typeof ref !== 'string') return ref
    return this.catalog[ref] ?? null
  }

  /** Starts a deterministic transition to one TH body pose. */
  private setPose(name: string, eventMs: number): void {
    const template = POSE_TEMPLATES[name]
    if (!template) {
      this.report('AVATAR3D_POSE_NOT_FOUND', 'Avatar3D body pose was not found', { pose: name })
      return
    }
    this.poseTransition = {
      from: this.sampleBodyPose(eventMs),
      to: resolveBodyPoseTemplate(template as RotationTemplate),
      startMs: eventMs,
      name,
    }
  }

  /** Starts a deterministic gesture override over the current body pose. */
  private startGesture(name: string, startMs: number, endMs: number, seed: number, mirror = false): void {
    const template = GESTURE_TEMPLATES[name]
    if (!template) {
      this.report('AVATAR3D_GESTURE_NOT_FOUND', 'Avatar3D gesture was not found', { gesture: name })
      return
    }
    this.gesture = {
      from: this.sampleSkeleton(startMs),
      target: resolveTemplate(template as RotationTemplate, seed, mirror),
      startMs,
      endMs,
      name,
    }
  }

  /** Starts a deterministic MotionEngine poseDelta-style rotation overlay. */
  private startOverlay(motion: Avatar3DMotion, eventMs: number): boolean {
    const overlay = motion._overlay
    if (!overlay) return false

    const bones = new Map<string, Avatar3DMotionOverlayBone>()
    for (const [boneName, boneOverlay] of Object.entries(overlay.bones ?? {})) {
      if (boneOverlay.custom && boneOverlay.custom !== 'jump') {
        this.report('AVATAR3D_MOTION_OVERLAY_UNSUPPORTED', 'Avatar3D motion overlay custom effect is not supported', { bone: boneName, custom: boneOverlay.custom })
        continue
      }
      if (boneOverlay.amp !== undefined && !boneOverlay.amp.every((value) => typeof value === 'number' && Number.isFinite(value))) {
        this.report('AVATAR3D_MOTION_OVERLAY_UNSUPPORTED', 'Avatar3D motion overlay amplitude is invalid', { bone: boneName })
        continue
      }
      bones.set(boneName, boneOverlay)
    }

    const baseDurationMs = resolveMotionDurationMs(motion.dt)
    const durationMs = overlay.duration ?? baseDurationMs
    if (bones.size === 0 || durationMs <= 0) return true

    const delayMs = overlay.delay ?? 0
    this.overlay = {
      bones,
      startMs: eventMs + delayMs,
      endMs: eventMs + delayMs + durationMs,
    }
    return true
  }

  /** Starts deterministic release of the active gesture back to the current body pose. */
  private releaseGesture(eventMs: number): void {
    if (!this.gesture) return
    this.gesture = {
      from: this.sampleSkeleton(eventMs),
      target: null,
      startMs: eventMs,
      endMs: eventMs,
      name: null,
    }
  }

  /** Samples the current body pose transition at a timeline position. */
  private sampleBodyPose(timelineMs: number): ResolvedPose {
    const alpha = easeAt(timelineMs - this.poseTransition.startMs)
    const out: ResolvedPose = new Map()
    const bones = new Set([...this.poseTransition.from.keys(), ...this.poseTransition.to.keys()])
    for (const bone of bones) {
      const from = this.poseTransition.from.get(bone) ?? {}
      const to = this.poseTransition.to.get(bone) ?? from
      out.set(bone, lerpRotation(
        { x: from.x ?? 0, y: from.y ?? 0, z: from.z ?? 0 },
        { x: to.x ?? from.x ?? 0, y: to.y ?? from.y ?? 0, z: to.z ?? from.z ?? 0 },
        alpha,
      ))
    }
    return out
  }

  /** Samples pose + gesture composition at one timeline position. */
  private sampleSkeleton(timelineMs: number): ResolvedPose {
    const base = this.sampleBodyPose(timelineMs)
    const gesture = this.gesture
    if (!gesture || timelineMs < gesture.startMs) return this.applyOverlay(base, timelineMs)

    if (gesture.target && timelineMs < gesture.endMs) {
      return this.applyOverlay(composePose(base, this.sampleGestureOverlay(gesture.from, gesture.target, timelineMs - gesture.startMs, base)), timelineMs)
    }

    const releaseFrom = gesture.target
      ? this.sampleGestureOverlay(gesture.from, gesture.target, gesture.endMs - gesture.startMs, base)
      : gesture.from
    const alpha = easeGestureAt(timelineMs - gesture.endMs)
    if (alpha > 0.999) return this.applyOverlay(base, timelineMs)

    const released: PartialPose = new Map()
    for (const [bone, from] of releaseFrom) {
      const to = base.get(bone) ?? { x: 0, y: 0, z: 0 }
      released.set(bone, {
        x: from.x === undefined ? undefined : from.x + (to.x - from.x) * alpha,
        y: from.y === undefined ? undefined : from.y + (to.y - from.y) * alpha,
        z: from.z === undefined ? undefined : from.z + (to.z - from.z) * alpha,
      })
    }
    return this.applyOverlay(composePose(base, released), timelineMs)
  }

  /** Adds a MotionEngine poseDelta-style overlay to the resolved skeletal pose. */
  private applyOverlay(base: ResolvedPose, timelineMs: number): ResolvedPose {
    const overlay = this.overlay
    if (!overlay || timelineMs < overlay.startMs || timelineMs >= overlay.endMs) return base

    const elapsedMs = timelineMs - overlay.startMs
    const durationMs = overlay.endMs - overlay.startMs
    const timeSeconds = elapsedMs / 1000
    const fadeIn = Math.min(elapsedMs / OVERLAY_FADE_RAMP_MS, 1)
    const fadeOut = Math.min((durationMs - elapsedMs) / OVERLAY_FADE_RAMP_MS, 1)
    const envelope = fadeIn * fadeOut
    const out: ResolvedPose = new Map()
    for (const [bone, rot] of base) out.set(bone, { x: rot.x, y: rot.y, z: rot.z })

    for (const [boneName, osc] of overlay.bones) {
      const amp = osc.amp ?? []
      const freq = Number.isFinite(osc.freq) ? osc.freq ?? 0 : 0
      const phase = Number.isFinite(osc.phase) ? osc.phase ?? 0 : 0
      const current = out.get(boneName) ?? { x: 0, y: 0, z: 0 }
      if (osc.custom === 'jump') {
        const progress = Math.max(0, Math.min(1, elapsedMs / durationMs))
        out.set(boneName, {
          ...current,
          py: Math.sin(progress * Math.PI) * 0.12,
        })
        continue
      }
      const xy = Math.sin(timeSeconds * freq) * envelope
      out.set(boneName, {
        x: current.x + xy * (amp[0] ?? 0),
        y: current.y + xy * (amp[1] ?? 0),
        z: current.z + Math.sin(timeSeconds * freq + phase) * (amp[2] ?? 0) * envelope,
      })
    }

    return out
  }

  /** Samples gesture override rotations for only the bones controlled by the gesture. */
  private sampleGestureOverlay(fromSkeleton: ResolvedPose, target: PartialPose, elapsedMs: number, base: ResolvedPose): PartialPose {
    const alpha = easeGestureAt(elapsedMs)
    const out: PartialPose = new Map()
    const bones = new Set([...target.keys()])
    for (const [bone, from] of fromSkeleton) {
      const baseRot = base.get(bone) ?? { x: 0, y: 0, z: 0 }
      if (Math.abs(from.x - baseRot.x) > 1e-4 || Math.abs(from.y - baseRot.y) > 1e-4 || Math.abs(from.z - baseRot.z) > 1e-4) {
        bones.add(bone)
      }
    }

    for (const bone of bones) {
      const to = target.get(bone)
      const from = fromSkeleton.get(bone) ?? base.get(bone) ?? { x: 0, y: 0, z: 0 }
      const baseRot = base.get(bone) ?? { x: 0, y: 0, z: 0 }
      const toX = to?.x ?? baseRot.x
      const toY = to?.y ?? baseRot.y
      const toZ = to?.z ?? baseRot.z
      out.set(bone, {
        x: from.x + (toX - from.x) * alpha,
        y: from.y + (toY - from.y) * alpha,
        z: from.z + (toZ - from.z) * alpha,
      })
    }
    return out
  }
}
