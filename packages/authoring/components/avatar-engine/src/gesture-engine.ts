/**
 * Gesture engine — applies TH body poses and procedural gesture overrides with easing.
 *
 * Templates are adapted from TalkingHead by Mika Suominen (met4citizen), MIT.
 * Source: https://github.com/met4citizen/TalkingHead
 *
 * Each template entry is either:
 *   { boneName.rotation: { x, y, z } }  where each value is either:
 *     - a fixed number
 *     - [min, max]                  → uniform random in [min, max]
 *     - [min, max, skewFrom, skewTo] → power-law-weighted random (TH rndDist)
 *
 * Transitions use exponential smoothing (RC filter) — tau ≈ 330ms, ~95% in 1 s.
 * Seek path (applyPose / snapToRest / snapToTargets) bypasses easing for instant reconstruction.
 */
import type { Object3D, Euler } from 'three'

/** Minimal PRNG interface — provide a seeded instance. */
export type Rng = { random(): number }

type RotationValue = number | [number, number] | [number, number, number, number]
type BoneRotation = { x?: RotationValue; y?: RotationValue; z?: RotationValue }
/** Template: boneName.rotation → axis values */
export type GestureTemplate = Record<string, BoneRotation>
export type BodyPoseTemplate = Record<string, BoneRotation>

/** Resolved pose: boneName → resolved Euler angles plus optional position deltas. */
export type ResolvedPose = Map<string, { x: number; y: number; z: number; px?: number; py?: number; pz?: number }>

type BoneState = {
  bone: Object3D
  /** Rest rotation captured at construction (post-retarget). */
  rx: number; ry: number; rz: number
  /** Rest position captured at construction (post-retarget). */
  px: number; py: number; pz: number
  /** Current body-pose baseline. Gestures release back to these values. */
  bx: number; by: number; bz: number
  /** Current eased rotation (written to bone.rotation). */
  x: number; y: number; z: number
  /** Target rotation. */
  tx: number; ty: number; tz: number
  /**
   * An axis becomes GE-owned the first time some gesture template defines it
   * for this bone. Unowned axes are never read or written by GE — they stay
   * the exclusive domain of the morph engine's bone callback (e.g. Head/Neck
   * x/y, driven by headRotateX/Y for idle sway + gaze). Without this, GE would
   * reset those axes to rest every frame, racing the callback's intermittent
   * (needsUpdate-gated) writes — visible as a head/neck flicker during gestures.
   */
  poseX: boolean; poseY: boolean; poseZ: boolean
  gestureX: boolean; gestureY: boolean; gestureZ: boolean
}

/**
 * Major-bone body poses adapted from TH poseTemplates.
 * These are the missing TH background poses: gestures are temporary overrides
 * layered above them, not replacements for a human rest stance.
 */
export const POSE_TEMPLATES: Record<string, BodyPoseTemplate> = {
  side: {
    'Hips.rotation': { x: -0.003, y: -0.017, z: 0.1 },
    'Spine.rotation': { x: -0.103, y: -0.002, z: -0.063 },
    'Spine1.rotation': { x: 0.042, y: -0.02, z: -0.069 },
    'Spine2.rotation': { x: 0.131, y: -0.012, z: -0.065 },
    'Neck.rotation': { x: 0.027, y: 0.006, z: 0 },
    'Head.rotation': { x: 0.077, y: -0.065, z: 0 },
    'LeftShoulder.rotation': { x: 1.599, y: 0.084, z: -1.77 },
    'LeftArm.rotation': { x: 1.364, y: 0.052, z: -0.044 },
    'LeftForeArm.rotation': { x: 0.002, y: -0.007, z: 0.331 },
    'LeftHand.rotation': { x: 0.104, y: -0.067, z: -0.174 },
    'RightShoulder.rotation': { x: 1.541, y: 0.192, z: 1.775 },
    'RightArm.rotation': { x: 1.273, y: -0.352, z: -0.067 },
    'RightForeArm.rotation': { x: -0.011, y: -0.031, z: -0.357 },
    'RightHand.rotation': { x: -0.008, y: 0.312, z: -0.028 },
  },
  straight: {
    'Hips.rotation': { x: 0.047, y: 0.007, z: -0.007 },
    'Spine.rotation': { x: -0.143, y: -0.007, z: 0.005 },
    'Spine1.rotation': { x: -0.043, y: -0.014, z: 0.012 },
    'Spine2.rotation': { x: 0.072, y: -0.013, z: 0.013 },
    'Neck.rotation': { x: 0.048, y: -0.003, z: 0.012 },
    'Head.rotation': { x: 0.05, y: -0.02, z: -0.017 },
    'LeftShoulder.rotation': { x: 1.62, y: -0.166, z: -1.605 },
    'LeftArm.rotation': { x: 1.275, y: 0.544, z: -0.092 },
    'LeftForeArm.rotation': { x: 0, y: 0, z: 0.302 },
    'LeftHand.rotation': { x: -0.225, y: -0.154, z: 0.11 },
    'RightShoulder.rotation': { x: 1.615, y: 0.064, z: 1.53 },
    'RightArm.rotation': { x: 1.313, y: -0.424, z: 0.131 },
    'RightForeArm.rotation': { x: 0, y: 0, z: -0.317 },
    'RightHand.rotation': { x: -0.158, y: -0.639, z: -0.196 },
  },
  hip: {
    'Hips.rotation': { x: -0.036, y: 0.09, z: 0.135 },
    'Spine.rotation': { x: 0.076, y: -0.035, z: 0.01 },
    'Spine1.rotation': { x: -0.096, y: 0.013, z: -0.094 },
    'Spine2.rotation': { x: -0.014, y: 0.002, z: -0.097 },
    'Neck.rotation': { x: 0.034, y: -0.051, z: -0.075 },
    'Head.rotation': { x: 0.298, y: -0.1, z: 0.154 },
    'LeftShoulder.rotation': { x: 1.694, y: 0.011, z: -1.68 },
    'LeftArm.rotation': { x: 1.343, y: 0.177, z: -0.153 },
    'LeftForeArm.rotation': { x: -0.049, y: 0.134, z: 0.351 },
    'LeftHand.rotation': { x: 0.057, y: -0.189, z: -0.026 },
    'RightShoulder.rotation': { x: 1.597, y: 0.012, z: 1.816 },
    'RightArm.rotation': { x: 0.618, y: -1.274, z: -0.266 },
    'RightForeArm.rotation': { x: -0.395, y: -0.097, z: -1.342 },
    'RightHand.rotation': { x: -0.816, y: -0.057, z: -0.976 },
  },
  turn: {
    'Hips.rotation': { x: -0.07, y: -0.604, z: -0.004 },
    'Spine.rotation': { x: -0.007, y: 0.003, z: 0.071 },
    'Spine1.rotation': { x: -0.053, y: 0.024, z: -0.06 },
    'Spine2.rotation': { x: 0.074, y: 0.013, z: -0.068 },
    'Neck.rotation': { x: 0.03, y: 0.186, z: -0.077 },
    'Head.rotation': { x: 0.045, y: 0.243, z: -0.086 },
    'LeftShoulder.rotation': { x: 1.717, y: -0.085, z: -1.761 },
    'LeftArm.rotation': { x: 1.314, y: 0.07, z: -0.057 },
    'LeftForeArm.rotation': { x: -0.151, y: 0.714, z: 0.302 },
    'LeftHand.rotation': { x: -0.069, y: 0.003, z: -0.118 },
    'RightShoulder.rotation': { x: 1.605, y: 0.17, z: 1.625 },
    'RightArm.rotation': { x: 1.574, y: -0.655, z: 0.388 },
    'RightForeArm.rotation': { x: -0.36, y: -0.849, z: -0.465 },
    'RightHand.rotation': { x: 0.114, y: 0.416, z: -0.069 },
  },
  wide: {
    'Hips.rotation': { x: 0.064, y: -0.048, z: 0.059 },
    'Spine.rotation': { x: -0.123, y: 0, z: -0.018 },
    'Spine1.rotation': { x: 0.014, y: 0.003, z: -0.006 },
    'Spine2.rotation': { x: 0.04, y: 0.003, z: -0.007 },
    'Neck.rotation': { x: 0.101, y: 0.007, z: -0.035 },
    'Head.rotation': { x: -0.091, y: -0.049, z: 0.105 },
    'RightShoulder.rotation': { x: 1.831, y: 0.017, z: 1.731 },
    'RightArm.rotation': { x: -1.673, y: -1.102, z: -3.132 },
    'RightForeArm.rotation': { x: 0.265, y: 0.23, z: -0.824 },
    'RightHand.rotation': { x: -0.52, y: 0.345, z: -0.061 },
    'LeftShoulder.rotation': { x: 1.83, y: -0.063, z: -1.808 },
    'LeftArm.rotation': { x: -1.907, y: 1.228, z: -2.959 },
    'LeftForeArm.rotation': { x: -0.159, y: 0.268, z: 0.572 },
    'LeftHand.rotation': { x: 0.069, y: -0.498, z: -0.025 },
  },
}

/**
 * Gesture templates from TH gestureTemplates.
 * Arrays are random ranges; scalars are fixed.
 */
export const GESTURE_TEMPLATES: Record<string, GestureTemplate> = {
  handup: {
    'LeftShoulder.rotation': { x: [1.5,2,1,2], y: [0.2,0.4,1,2], z: [-1.5,-1.3,1,2] },
    'LeftArm.rotation': { x: [1.5,1.7,1,2], y: [-0.6,-0.4,1,2], z: [1,1.2,1,2] },
    'LeftForeArm.rotation': { x: -0.815, y: [-0.4,0,1,2], z: 1.575 },
    'LeftHand.rotation': { x: -0.529, y: -0.2, z: 0.022 },
    'LeftHandThumb1.rotation': { x: 0.745, y: -0.526, z: 0.604 },
    'LeftHandThumb2.rotation': { x: -0.107, y: -0.01, z: -0.142 },
    'LeftHandThumb3.rotation': { x: 0, y: 0.001, z: 0 },
    'LeftHandIndex1.rotation': { x: -0.126, y: -0.035, z: -0.087 },
    'LeftHandIndex2.rotation': { x: 0.255, y: 0.007, z: -0.085 },
    'LeftHandIndex3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandMiddle1.rotation': { x: -0.019, y: -0.128, z: -0.082 },
    'LeftHandMiddle2.rotation': { x: 0.233, y: 0.019, z: -0.074 },
    'LeftHandMiddle3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandRing1.rotation': { x: 0.005, y: -0.241, z: -0.122 },
    'LeftHandRing2.rotation': { x: 0.261, y: 0.021, z: -0.076 },
    'LeftHandRing3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandPinky1.rotation': { x: 0.059, y: -0.336, z: -0.2 },
    'LeftHandPinky2.rotation': { x: 0.153, y: 0.019, z: 0.001 },
    'LeftHandPinky3.rotation': { x: 0, y: 0, z: 0 },
  },
  index: {
    'LeftShoulder.rotation': { x: [1.5,2,1,2], y: [0.2,0.4,1,2], z: [-1.5,-1.3,1,2] },
    'LeftArm.rotation': { x: [1.5,1.7,1,2], y: [-0.6,-0.4,1,2], z: [1,1.2,1,2] },
    'LeftForeArm.rotation': { x: -0.815, y: [-0.4,0,1,2], z: 1.575 },
    'LeftHand.rotation': { x: -0.276, y: -0.506, z: -0.208 },
    'LeftHandThumb1.rotation': { x: 0.579, y: 0.228, z: 0.363 },
    'LeftHandThumb2.rotation': { x: -0.027, y: -0.04, z: -0.662 },
    'LeftHandThumb3.rotation': { x: 0, y: 0.001, z: 0 },
    'LeftHandIndex1.rotation': { x: 0, y: -0.105, z: 0.225 },
    'LeftHandIndex2.rotation': { x: 0.256, y: -0.103, z: -0.213 },
    'LeftHandIndex3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandMiddle1.rotation': { x: 1.453, y: 0.07, z: 0.021 },
    'LeftHandMiddle2.rotation': { x: 1.599, y: 0.062, z: 0.07 },
    'LeftHandMiddle3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandRing1.rotation': { x: 1.528, y: -0.073, z: 0.052 },
    'LeftHandRing2.rotation': { x: 1.386, y: 0.044, z: 0.053 },
    'LeftHandRing3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandPinky1.rotation': { x: 1.65, y: -0.204, z: 0.031 },
    'LeftHandPinky2.rotation': { x: 1.302, y: 0.071, z: 0.085 },
    'LeftHandPinky3.rotation': { x: 0, y: 0, z: 0 },
  },
  point: {
    'LeftShoulder.rotation': { x: 1.42, y: 0.08, z: -1.48 },
    'LeftArm.rotation': { x: 1.08, y: -0.7, z: 0.42 },
    'LeftForeArm.rotation': { x: -0.52, y: -0.2, z: 0.92 },
    'LeftHand.rotation': { x: -0.276, y: -0.506, z: -0.208 },
    'LeftHandThumb1.rotation': { x: 0.579, y: 0.228, z: 0.363 },
    'LeftHandThumb2.rotation': { x: -0.027, y: -0.04, z: -0.662 },
    'LeftHandThumb3.rotation': { x: 0, y: 0.001, z: 0 },
    'LeftHandIndex1.rotation': { x: 0, y: -0.105, z: 0.225 },
    'LeftHandIndex2.rotation': { x: 0.256, y: -0.103, z: -0.213 },
    'LeftHandIndex3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandMiddle1.rotation': { x: 1.453, y: 0.07, z: 0.021 },
    'LeftHandMiddle2.rotation': { x: 1.599, y: 0.062, z: 0.07 },
    'LeftHandMiddle3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandRing1.rotation': { x: 1.528, y: -0.073, z: 0.052 },
    'LeftHandRing2.rotation': { x: 1.386, y: 0.044, z: 0.053 },
    'LeftHandRing3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandPinky1.rotation': { x: 1.65, y: -0.204, z: 0.031 },
    'LeftHandPinky2.rotation': { x: 1.302, y: 0.071, z: 0.085 },
    'LeftHandPinky3.rotation': { x: 0, y: 0, z: 0 },
  },
  ok: {
    'LeftShoulder.rotation': { x: [1.5,2,1,2], y: [0.2,0.4,1,2], z: [-1.5,-1.3,1,2] },
    'LeftArm.rotation': { x: [1.5,1.7,1,1], y: [-0.6,-0.4,1,2], z: [1,1.2,1,2] },
    'LeftForeArm.rotation': { x: -0.415, y: [-0.4,0,1,2], z: 1.575 },
    'LeftHand.rotation': { x: -0.476, y: -0.506, z: -0.208 },
    'LeftHandThumb1.rotation': { x: 0.703, y: 0.445, z: 0.899 },
    'LeftHandThumb2.rotation': { x: -0.312, y: -0.04, z: -0.938 },
    'LeftHandThumb3.rotation': { x: -0.37, y: 0.024, z: -0.393 },
    'LeftHandIndex1.rotation': { x: 0.8, y: -0.086, z: -0.091 },
    'LeftHandIndex2.rotation': { x: 1.123, y: -0.046, z: -0.074 },
    'LeftHandIndex3.rotation': { x: 0.562, y: -0.013, z: -0.043 },
    'LeftHandMiddle1.rotation': { x: -0.019, y: -0.128, z: -0.082 },
    'LeftHandMiddle2.rotation': { x: 0.233, y: 0.019, z: -0.074 },
    'LeftHandMiddle3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandRing1.rotation': { x: 0.005, y: -0.241, z: -0.122 },
    'LeftHandRing2.rotation': { x: 0.261, y: 0.021, z: -0.076 },
    'LeftHandRing3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandPinky1.rotation': { x: 0.059, y: -0.336, z: -0.2 },
    'LeftHandPinky2.rotation': { x: 0.153, y: 0.019, z: 0.001 },
    'LeftHandPinky3.rotation': { x: 0, y: 0, z: 0 },
  },
  thumbup: {
    'LeftShoulder.rotation': { x: [1.5,2,1,2], y: [0.2,0.4,1,2], z: [-1.5,-1.3,1,2] },
    'LeftArm.rotation': { x: [1.5,1.7,1,2], y: [-0.6,-0.4,1,2], z: [1,1.2,1,2] },
    'LeftForeArm.rotation': { x: -0.415, y: 0.206, z: 1.575 },
    'LeftHand.rotation': { x: -0.276, y: -0.506, z: -0.208 },
    'LeftHandThumb1.rotation': { x: 0.208, y: -0.189, z: 0.685 },
    'LeftHandThumb2.rotation': { x: 0.129, y: -0.285, z: -0.163 },
    'LeftHandThumb3.rotation': { x: -0.047, y: 0.068, z: 0.401 },
    'LeftHandIndex1.rotation': { x: 1.412, y: -0.102, z: -0.152 },
    'LeftHandIndex2.rotation': { x: 1.903, y: -0.16, z: -0.114 },
    'LeftHandIndex3.rotation': { x: 0.535, y: -0.017, z: -0.062 },
    'LeftHandMiddle1.rotation': { x: 1.424, y: -0.103, z: -0.12 },
    'LeftHandMiddle2.rotation': { x: 1.919, y: -0.162, z: -0.114 },
    'LeftHandMiddle3.rotation': { x: 0.44, y: -0.012, z: -0.051 },
    'LeftHandRing1.rotation': { x: 1.619, y: -0.127, z: -0.053 },
    'LeftHandRing2.rotation': { x: 1.898, y: -0.16, z: -0.115 },
    'LeftHandRing3.rotation': { x: 0.262, y: -0.004, z: -0.031 },
    'LeftHandPinky1.rotation': { x: 1.661, y: -0.131, z: -0.016 },
    'LeftHandPinky2.rotation': { x: 1.715, y: -0.067, z: -0.13 },
    'LeftHandPinky3.rotation': { x: 0.627, y: -0.023, z: -0.071 },
  },
  thumbdown: {
    'LeftShoulder.rotation': { x: [1.5,2,1,2], y: [0.2,0.4,1,2], z: [-1.5,-1.3,1,2] },
    'LeftArm.rotation': { x: [1.5,1.7,1,2], y: [-0.6,-0.4,1,2], z: [1,1.2,1,2] },
    'LeftForeArm.rotation': { x: -2.015, y: 0.406, z: 1.575 },
    'LeftHand.rotation': { x: -0.176, y: -0.206, z: -0.208 },
    'LeftHandThumb1.rotation': { x: 0.208, y: -0.189, z: 0.685 },
    'LeftHandThumb2.rotation': { x: 0.129, y: -0.285, z: -0.163 },
    'LeftHandThumb3.rotation': { x: -0.047, y: 0.068, z: 0.401 },
    'LeftHandIndex1.rotation': { x: 1.412, y: -0.102, z: -0.152 },
    'LeftHandIndex2.rotation': { x: 1.903, y: -0.16, z: -0.114 },
    'LeftHandIndex3.rotation': { x: 0.535, y: -0.017, z: -0.062 },
    'LeftHandMiddle1.rotation': { x: 1.424, y: -0.103, z: -0.12 },
    'LeftHandMiddle2.rotation': { x: 1.919, y: -0.162, z: -0.114 },
    'LeftHandMiddle3.rotation': { x: 0.44, y: -0.012, z: -0.051 },
    'LeftHandRing1.rotation': { x: 1.619, y: -0.127, z: -0.053 },
    'LeftHandRing2.rotation': { x: 1.898, y: -0.16, z: -0.115 },
    'LeftHandRing3.rotation': { x: 0.262, y: -0.004, z: -0.031 },
    'LeftHandPinky1.rotation': { x: 1.661, y: -0.131, z: -0.016 },
    'LeftHandPinky2.rotation': { x: 1.715, y: -0.067, z: -0.13 },
    'LeftHandPinky3.rotation': { x: 0.627, y: -0.023, z: -0.071 },
  },
  side: {
    'LeftShoulder.rotation': { x: 1.755, y: -0.035, z: -1.63 },
    'LeftArm.rotation': { x: 1.263, y: -0.955, z: 1.024 },
    'LeftForeArm.rotation': { x: 0, y: 0, z: 0.8 },
    'LeftHand.rotation': { x: -0.36, y: -1.353, z: -0.184 },
    'LeftHandThumb1.rotation': { x: 0.137, y: -0.049, z: 0.863 },
    'LeftHandThumb2.rotation': { x: -0.293, y: 0.153, z: -0.193 },
    'LeftHandThumb3.rotation': { x: -0.271, y: -0.17, z: 0.18 },
    'LeftHandIndex1.rotation': { x: -0.018, y: 0.007, z: 0.28 },
    'LeftHandIndex2.rotation': { x: 0.247, y: -0.003, z: -0.025 },
    'LeftHandIndex3.rotation': { x: 0.13, y: -0.001, z: -0.013 },
    'LeftHandMiddle1.rotation': { x: 0.333, y: -0.015, z: 0.182 },
    'LeftHandMiddle2.rotation': { x: 0.313, y: -0.005, z: -0.032 },
    'LeftHandMiddle3.rotation': { x: 0.294, y: -0.004, z: -0.03 },
    'LeftHandRing1.rotation': { x: 0.456, y: -0.028, z: -0.092 },
    'LeftHandRing2.rotation': { x: 0.53, y: -0.014, z: -0.052 },
    'LeftHandRing3.rotation': { x: 0.478, y: -0.012, z: -0.047 },
    'LeftHandPinky1.rotation': { x: 0.647, y: -0.049, z: -0.184 },
    'LeftHandPinky2.rotation': { x: 0.29, y: -0.004, z: -0.029 },
    'LeftHandPinky3.rotation': { x: 0.501, y: -0.013, z: -0.049 },
  },
  shrug: {
    // Neck.z: morph bone callback only writes .x (headRotateX), never .z — no conflict.
    'Neck.rotation': { z: 0.08 },
    'Head.rotation': { z: 0.04 },
    'RightShoulder.rotation': { x: 1.732, y: -0.058, z: 1.407 },
    'RightArm.rotation': { x: 1.305, y: 0.46, z: 0.118 },
    'RightForeArm.rotation': { x: [0,2.0], y: [-1,0.2], z: -1.637 },
    'RightHand.rotation': { x: -0.048, y: 0.165, z: -0.39 },
    'RightHandThumb1.rotation': { x: 1.467, y: 0.599, z: -1.315 },
    'RightHandThumb2.rotation': { x: -0.255, y: -0.123, z: 0.119 },
    'RightHandThumb3.rotation': { x: 0, y: -0.002, z: 0 },
    'RightHandIndex1.rotation': { x: -0.293, y: -0.066, z: -0.112 },
    'RightHandIndex2.rotation': { x: 0.181, y: 0.007, z: 0.069 },
    'RightHandIndex3.rotation': { x: 0, y: 0, z: 0 },
    'RightHandMiddle1.rotation': { x: -0.063, y: -0.041, z: 0.032 },
    'RightHandMiddle2.rotation': { x: 0.149, y: 0.005, z: 0.05 },
    'RightHandMiddle3.rotation': { x: 0, y: 0, z: 0 },
    'RightHandRing1.rotation': { x: 0.152, y: -0.03, z: 0.132 },
    'RightHandRing2.rotation': { x: 0.194, y: 0.007, z: 0.058 },
    'RightHandRing3.rotation': { x: 0, y: 0, z: 0 },
    'RightHandPinky1.rotation': { x: 0.306, y: -0.015, z: 0.257 },
    'RightHandPinky2.rotation': { x: 0.15, y: -0.003, z: -0.003 },
    'RightHandPinky3.rotation': { x: 0, y: 0, z: 0 },
    'LeftShoulder.rotation': { x: 1.713, y: 0.141, z: -1.433 },
    'LeftArm.rotation': { x: 1.136, y: -0.422, z: -0.416 },
    'LeftForeArm.rotation': { x: 1.42, y: 0.123, z: 1.506 },
    'LeftHand.rotation': { x: 0.073, y: -0.138, z: 0.064 },
    'LeftHandThumb1.rotation': { x: 1.467, y: -0.599, z: 1.314 },
    'LeftHandThumb2.rotation': { x: -0.255, y: 0.123, z: -0.119 },
    'LeftHandThumb3.rotation': { x: 0, y: 0.001, z: 0 },
    'LeftHandIndex1.rotation': { x: -0.293, y: 0.066, z: 0.112 },
    'LeftHandIndex2.rotation': { x: 0.181, y: -0.007, z: -0.069 },
    'LeftHandIndex3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandMiddle1.rotation': { x: -0.062, y: 0.041, z: -0.032 },
    'LeftHandMiddle2.rotation': { x: 0.149, y: -0.005, z: -0.05 },
    'LeftHandMiddle3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandRing1.rotation': { x: 0.152, y: 0.03, z: -0.132 },
    'LeftHandRing2.rotation': { x: 0.194, y: -0.007, z: -0.058 },
    'LeftHandRing3.rotation': { x: 0, y: 0, z: 0 },
    'LeftHandPinky1.rotation': { x: 0.306, y: 0.015, z: -0.257 },
    'LeftHandPinky2.rotation': { x: 0.15, y: 0.003, z: 0.003 },
    'LeftHandPinky3.rotation': { x: 0, y: 0, z: 0 },
  },
  namaste: {
    'RightShoulder.rotation': { x: 1.758, y: 0.099, z: 1.604 },
    'RightArm.rotation': { x: 0.862, y: -0.292, z: -0.932 },
    'RightForeArm.rotation': { x: 0.083, y: 0.066, z: -1.791 },
    'RightHand.rotation': { x: -0.52, y: -0.001, z: -0.176 },
    'RightHandThumb1.rotation': { x: 0.227, y: 0.418, z: -0.776 },
    'RightHandThumb2.rotation': { x: -0.011, y: -0.003, z: 0.171 },
    'RightHandThumb3.rotation': { x: -0.041, y: -0.001, z: -0.013 },
    'RightHandIndex1.rotation': { x: -0.236, y: 0.003, z: -0.028 },
    'RightHandIndex2.rotation': { x: 0.004, y: 0, z: 0.001 },
    'RightHandIndex3.rotation': { x: 0.002, y: 0, z: 0 },
    'RightHandMiddle1.rotation': { x: -0.236, y: 0.003, z: -0.028 },
    'RightHandMiddle2.rotation': { x: 0.004, y: 0, z: 0.001 },
    'RightHandMiddle3.rotation': { x: 0.002, y: 0, z: 0 },
    'RightHandRing1.rotation': { x: -0.236, y: 0.003, z: -0.028 },
    'RightHandRing2.rotation': { x: 0.004, y: 0, z: 0.001 },
    'RightHandRing3.rotation': { x: 0.002, y: 0, z: 0 },
    'RightHandPinky1.rotation': { x: -0.236, y: 0.003, z: -0.028 },
    'RightHandPinky2.rotation': { x: 0.004, y: 0, z: 0.001 },
    'RightHandPinky3.rotation': { x: 0.002, y: 0, z: 0 },
    'LeftShoulder.rotation': { x: 1.711, y: -0.002, z: -1.625 },
    'LeftArm.rotation': { x: 0.683, y: 0.334, z: 0.977 },
    'LeftForeArm.rotation': { x: 0.086, y: -0.066, z: 1.843 },
    'LeftHand.rotation': { x: -0.595, y: -0.229, z: 0.096 },
    'LeftHandThumb1.rotation': { x: 0.404, y: -0.05, z: 0.537 },
    'LeftHandThumb2.rotation': { x: -0.02, y: 0.004, z: -0.154 },
    'LeftHandThumb3.rotation': { x: -0.049, y: 0.002, z: -0.019 },
    'LeftHandIndex1.rotation': { x: -0.113, y: -0.001, z: 0.014 },
    'LeftHandIndex2.rotation': { x: 0.003, y: 0, z: 0 },
    'LeftHandIndex3.rotation': { x: 0.002, y: 0, z: 0 },
    'LeftHandMiddle1.rotation': { x: -0.113, y: -0.001, z: 0.014 },
    'LeftHandMiddle2.rotation': { x: 0.004, y: 0, z: 0 },
    'LeftHandMiddle3.rotation': { x: 0.002, y: 0, z: 0 },
    'LeftHandRing1.rotation': { x: -0.113, y: -0.001, z: 0.014 },
    'LeftHandRing2.rotation': { x: 0.003, y: 0, z: 0 },
    'LeftHandRing3.rotation': { x: 0.002, y: 0, z: 0 },
    'LeftHandPinky1.rotation': { x: -0.122, y: -0.001, z: -0.057 },
    'LeftHandPinky2.rotation': { x: 0.012, y: 0.001, z: 0.07 },
    'LeftHandPinky3.rotation': { x: 0.002, y: 0, z: 0 },
  },
}

// RC-filter easing: tau ≈ 330 ms → ~95 % of target reached in ~1 s.
const GESTURE_EASE = 0.003

/**
 * Sample a rotation value using TH's rndDist algorithm.
 * [min, max]               → uniform
 * [min, max, from, to]     → power-law weighted toward 'from' side
 */
function sampleValue(v: RotationValue, rng: Rng): number {
  if (typeof v === 'number') return v
  const [min, max, skewFrom, skewTo] = v.length === 4 ? v : [v[0], v[1], 1, 1]
  const u = rng.random()
  const power = skewFrom + (skewTo - skewFrom) * u
  return min + (max - min) * Math.pow(u, 1 / Math.max(0.001, power))
}

/** Returns the active baseline value for an axis, falling back to captured rest. */
function baseX(s: BoneState): number { return s.poseX ? s.bx : s.rx }
function baseY(s: BoneState): number { return s.poseY ? s.by : s.ry }
function baseZ(s: BoneState): number { return s.poseZ ? s.bz : s.rz }

export class GestureEngine {
  private readonly state = new Map<string, BoneState>()

  /**
   * Build easing state for every node in boneMap.
   * Rest rotations are captured at construction time (post-retarget, pre-gesture).
   */
  constructor(boneMap: Map<string, Object3D>) {
    for (const [name, bone] of boneMap) {
      const { x, y, z } = bone.rotation as Euler
      const pos = bone.position
      this.state.set(name, {
        bone, rx: x, ry: y, rz: z, px: pos.x, py: pos.y, pz: pos.z, bx: x, by: y, bz: z, x, y, z, tx: x, ty: y, tz: z,
        poseX: false, poseY: false, poseZ: false,
        gestureX: false, gestureY: false, gestureZ: false,
      })
    }
  }

  /**
   * Advance easing toward targets. Called every frame by engine.animate().
   * Only writes axes claimed by body poses or gesture templates —
   * unclaimed axes (e.g. Head/Neck x/y) are left entirely to the morph engine's
   * bone callback, so the two never race on the same rotation channel.
   */
  update(deltaMs: number): void {
    const alpha = 1 - Math.exp(-GESTURE_EASE * deltaMs)
    for (const s of this.state.values()) {
      if (!s.poseX && !s.poseY && !s.poseZ && !s.gestureX && !s.gestureY && !s.gestureZ) continue
      const e = s.bone.rotation as Euler
      if (s.poseX || s.gestureX) {
        const dx = s.tx - s.x
        s.x = Math.abs(dx) < 1e-4 ? s.tx : s.x + dx * alpha
        e.x = s.x
      }
      if (s.poseY || s.gestureY) {
        const dy = s.ty - s.y
        s.y = Math.abs(dy) < 1e-4 ? s.ty : s.y + dy * alpha
        e.y = s.y
      }
      if (s.poseZ || s.gestureZ) {
        const dz = s.tz - s.z
        s.z = Math.abs(dz) < 1e-4 ? s.tz : s.z + dz * alpha
        e.z = s.z
      }
    }
  }

  /** Start an eased transition to a TH body-pose baseline. */
  setBodyPose(name: string): boolean {
    const template = POSE_TEMPLATES[name]
    if (!template) return false

    for (const s of this.state.values()) {
      if (s.poseX) { s.poseX = false; s.bx = s.rx; if (!s.gestureX) s.tx = s.rx }
      if (s.poseY) { s.poseY = false; s.by = s.ry; if (!s.gestureY) s.ty = s.ry }
      if (s.poseZ) { s.poseZ = false; s.bz = s.rz; if (!s.gestureZ) s.tz = s.rz }
    }

    for (const [key, boneRot] of Object.entries(template)) {
      const dotIdx = key.lastIndexOf('.')
      const boneName = key.slice(0, dotIdx)
      const prop = key.slice(dotIdx + 1)
      if (prop !== 'rotation') continue

      const s = this.state.get(boneName)
      if (!s) continue

      if (boneRot.x !== undefined) { s.poseX = true; s.bx = sampleValue(boneRot.x, { random: () => 0.5 }); if (!s.gestureX) s.tx = s.bx }
      if (boneRot.y !== undefined) { s.poseY = true; s.by = sampleValue(boneRot.y, { random: () => 0.5 }); if (!s.gestureY) s.ty = s.by }
      if (boneRot.z !== undefined) { s.poseZ = true; s.bz = sampleValue(boneRot.z, { random: () => 0.5 }); if (!s.gestureZ) s.tz = s.bz }
    }

    return true
  }

  /** Snap to the current body pose baseline, or captured rest if no pose is active. */
  snapToBodyPose(): void {
    for (const s of this.state.values()) {
      if (!s.poseX && !s.poseY && !s.poseZ) continue
      const e = s.bone.rotation as Euler
      if (s.poseX && !s.gestureX) { s.x = s.bx; s.tx = s.bx; e.x = s.bx }
      if (s.poseY && !s.gestureY) { s.y = s.by; s.ty = s.by; e.y = s.by }
      if (s.poseZ && !s.gestureZ) { s.z = s.bz; s.tz = s.bz; e.z = s.bz }
    }
  }

  /**
   * Apply one already-composed semantic skeleton pose directly.
   * This is the deterministic path used by higher-level evaluators: the caller
   * computes pose + gesture at timelineMs, then GE only writes bones.
   */
  applyResolvedSemanticPose(pose: ResolvedPose): void {
    for (const [boneName, s] of this.state) {
      const rot = pose.get(boneName)
      const e = s.bone.rotation as Euler

      if (rot) {
        s.poseX = true; s.gestureX = false; s.bx = rot.x; s.x = rot.x; s.tx = rot.x; e.x = rot.x
        s.poseY = true; s.gestureY = false; s.by = rot.y; s.y = rot.y; s.ty = rot.y; e.y = rot.y
        s.poseZ = true; s.gestureZ = false; s.bz = rot.z; s.z = rot.z; s.tz = rot.z; e.z = rot.z
        s.bone.position.x = s.px + (rot.px ?? 0)
        s.bone.position.y = s.py + (rot.py ?? 0)
        s.bone.position.z = s.pz + (rot.pz ?? 0)
        continue
      }

      if (!s.poseX && !s.poseY && !s.poseZ && !s.gestureX && !s.gestureY && !s.gestureZ) continue
      s.poseX = false; s.gestureX = false; s.bx = s.rx; s.x = s.rx; s.tx = s.rx; e.x = s.rx
      s.poseY = false; s.gestureY = false; s.by = s.ry; s.y = s.ry; s.ty = s.ry; e.y = s.ry
      s.poseZ = false; s.gestureZ = false; s.bz = s.rz; s.z = s.rz; s.tz = s.rz; e.z = s.rz
      s.bone.position.set(s.px, s.py, s.pz)
    }
  }

  /**
   * Start an eased transition to a named gesture pose.
   * All bones NOT in the new template ease back to rest — prevents superposition
   * of successive gestures (e.g. shrug → handup would otherwise keep the shrug's
   * right-arm targets alive while the left arm transitioned to handup).
   * Returns the resolved pose for seek-replay use.
   */
  applyGesture(name: string, rng: Rng): ResolvedPose | null {
    const template = GESTURE_TEMPLATES[name]
    if (!template) return null

    // Ease previous gesture axes back to the active body pose baseline.
    for (const s of this.state.values()) {
      if (s.gestureX) { s.gestureX = false; s.tx = baseX(s) }
      if (s.gestureY) { s.gestureY = false; s.ty = baseY(s) }
      if (s.gestureZ) { s.gestureZ = false; s.tz = baseZ(s) }
    }

    const pose: ResolvedPose = new Map()

    for (const [key, boneRot] of Object.entries(template)) {
      const dotIdx = key.lastIndexOf('.')
      const boneName = key.slice(0, dotIdx)
      const prop = key.slice(dotIdx + 1)
      if (prop !== 'rotation') continue

      const s = this.state.get(boneName)
      if (!s) continue

      // Axes absent from the template fall back to active body pose (not 0) — a partial
      // entry like { z: 0.08 } must leave x/y untouched, never snap to world-zero.
      const rx = boneRot.x !== undefined ? sampleValue(boneRot.x, rng) : baseX(s)
      const ry = boneRot.y !== undefined ? sampleValue(boneRot.y, rng) : baseY(s)
      const rz = boneRot.z !== undefined ? sampleValue(boneRot.z, rng) : baseZ(s)
      pose.set(boneName, { x: rx, y: ry, z: rz })

      // Claim only the axes this template actually defines, and set their target.
      if (boneRot.x !== undefined) { s.gestureX = true; s.tx = rx }
      if (boneRot.y !== undefined) { s.gestureY = true; s.ty = ry }
      if (boneRot.z !== undefined) { s.gestureZ = true; s.tz = rz }
    }

    return pose
  }

  /**
   * Start an eased return to rest pose for all bones currently off-rest.
   * Used when a `avatar:gesture` event fires with `gesture: null` during playback.
   */
  resetPose(): void {
    for (const s of this.state.values()) {
      if (s.gestureX) { s.gestureX = false; s.tx = baseX(s) }
      if (s.gestureY) { s.gestureY = false; s.ty = baseY(s) }
      if (s.gestureZ) { s.gestureZ = false; s.tz = baseZ(s) }
    }
  }

  /**
   * Replay a previously-resolved pose instantly (seek path — no easing).
   * Sets both current and target so no easing runs after.
   */
  applyPose(pose: ResolvedPose): void {
    for (const [boneName, rot] of pose) {
      const s = this.state.get(boneName)
      if (!s) continue
      s.x = rot.x; s.tx = rot.x
      s.y = rot.y; s.ty = rot.y
      s.z = rot.z; s.tz = rot.z
      s.gestureX = true; s.gestureY = true; s.gestureZ = true
      const e = s.bone.rotation as Euler
      e.x = rot.x; e.y = rot.y; e.z = rot.z
    }
  }

  /**
   * Snap all bones to rest instantly (stop/rewind path).
   * Sets both current and target so update() has nothing to do.
   */
  snapToRest(): void {
    for (const s of this.state.values()) {
      if (!s.poseX && !s.poseY && !s.poseZ && !s.gestureX && !s.gestureY && !s.gestureZ) continue
      const e = s.bone.rotation as Euler
      if (s.poseX || s.gestureX) { s.poseX = false; s.gestureX = false; s.bx = s.rx; s.x = s.rx; s.tx = s.rx; e.x = s.rx }
      if (s.poseY || s.gestureY) { s.poseY = false; s.gestureY = false; s.by = s.ry; s.y = s.ry; s.ty = s.ry; e.y = s.ry }
      if (s.poseZ || s.gestureZ) { s.poseZ = false; s.gestureZ = false; s.bz = s.rz; s.z = s.rz; s.tz = s.rz; e.z = s.rz }
    }
  }

  /**
   * Snap all bones to their current targets instantly (after seek replay).
   * Bones reflect the replayed gesture state immediately.
   */
  snapToTargets(): void {
    for (const s of this.state.values()) {
      if (s.x === s.tx && s.y === s.ty && s.z === s.tz) continue
      s.x = s.tx; s.y = s.ty; s.z = s.tz
      const e = s.bone.rotation as Euler
      e.x = s.tx; e.y = s.ty; e.z = s.tz
    }
  }
}
