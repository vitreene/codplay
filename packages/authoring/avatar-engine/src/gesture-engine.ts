/**
 * Gesture engine — applies procedural bone-rotation poses with easing.
 *
 * Gesture templates are taken verbatim from TalkingHead by Mika Suominen (met4citizen), MIT.
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

/** Resolved pose: boneName → resolved Euler angles */
export type ResolvedPose = Map<string, { x: number; y: number; z: number }>

type BoneState = {
  bone: Object3D
  /** Rest rotation captured at construction (post-retarget). */
  rx: number; ry: number; rz: number
  /** Current eased rotation (written to bone.rotation). */
  x: number; y: number; z: number
  /** Target rotation. */
  tx: number; ty: number; tz: number
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

function resolveRotation(r: BoneRotation, rng: Rng): { x: number; y: number; z: number } {
  return {
    x: r.x !== undefined ? sampleValue(r.x, rng) : 0,
    y: r.y !== undefined ? sampleValue(r.y, rng) : 0,
    z: r.z !== undefined ? sampleValue(r.z, rng) : 0,
  }
}

export class GestureEngine {
  private readonly state = new Map<string, BoneState>()

  /**
   * Build easing state for every node in boneMap.
   * Rest rotations are captured at construction time (post-retarget, pre-gesture).
   */
  constructor(boneMap: Map<string, Object3D>) {
    for (const [name, bone] of boneMap) {
      const { x, y, z } = bone.rotation as Euler
      this.state.set(name, { bone, rx: x, ry: y, rz: z, x, y, z, tx: x, ty: y, tz: z })
    }
  }

  /**
   * Advance easing toward targets. Called every frame by engine.animate().
   * gestureEngine.update() should run BEFORE morphEngine.update() so morph
   * bone callbacks (headRotateX/Y) always overwrite gesture targets on the head.
   */
  update(deltaMs: number): void {
    const alpha = 1 - Math.exp(-GESTURE_EASE * deltaMs)
    for (const s of this.state.values()) {
      const dx = s.tx - s.x
      const dy = s.ty - s.y
      const dz = s.tz - s.z
      if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4 && Math.abs(dz) < 1e-4) {
        // Clamp to exact target to stop iteration
        if (s.x !== s.tx || s.y !== s.ty || s.z !== s.tz) {
          s.x = s.tx; s.y = s.ty; s.z = s.tz
          const e = s.bone.rotation as Euler
          e.x = s.x; e.y = s.y; e.z = s.z
        }
        continue
      }
      s.x += dx * alpha
      s.y += dy * alpha
      s.z += dz * alpha
      const e = s.bone.rotation as Euler
      e.x = s.x; e.y = s.y; e.z = s.z
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

    // Reset ALL bones to rest first so previous gesture doesn't linger.
    for (const s of this.state.values()) {
      s.tx = s.rx; s.ty = s.ry; s.tz = s.rz
    }

    const pose: ResolvedPose = new Map()

    for (const [key, boneRot] of Object.entries(template)) {
      const dotIdx = key.lastIndexOf('.')
      const boneName = key.slice(0, dotIdx)
      const prop = key.slice(dotIdx + 1)
      if (prop !== 'rotation') continue

      const s = this.state.get(boneName)
      if (!s) continue

      const resolved = resolveRotation(boneRot, rng)
      pose.set(boneName, resolved)
      // Set target only — update() advances easing each frame.
      s.tx = resolved.x; s.ty = resolved.y; s.tz = resolved.z
    }

    return pose
  }

  /**
   * Start an eased return to rest pose for all bones currently off-rest.
   * Used when a `avatar:gesture` event fires with `gesture: null` during playback.
   */
  resetPose(): void {
    for (const s of this.state.values()) {
      s.tx = s.rx; s.ty = s.ry; s.tz = s.rz
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
      s.x = s.rx; s.tx = s.rx
      s.y = s.ry; s.ty = s.ry
      s.z = s.rz; s.tz = s.rz
      const e = s.bone.rotation as Euler
      e.x = s.rx; e.y = s.ry; e.z = s.rz
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
