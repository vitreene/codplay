import { describe, expect, it } from 'vitest'
import { Euler, Object3D } from 'three'
import { GestureEngine } from '../src/avatar/gesture/gesture-engine'
import { AvatarPoseComposer } from '../src/avatar/pose/avatar-pose'

describe('Avatar gesture engine', () => {
  it('samples the same eased body pose at one absolute date without writing the bone itself', () => {
    const played = createSample(500)
    const seeked = createSample(500)

    expect(played).toEqual(seeked)
    expect(played).toBeLessThan(0)
    expect(played).toBeGreaterThan(-0.003)
  })

  it('suspends speaking hands while an external motion owns the skeleton', () => {
    const bones = createSpeakingHandBones()
    const engine = new GestureEngine(bones)
    const pose = engine.sampleAt(0)
    engine.setTalkingHands({ enabled: true, probability: 1, seed: 41 })

    const duringMotion = engine.getOverlay(1_500, pose, true)
    const afterMotion = engine.getOverlay(1_500, pose, false)

    expect(duringMotion.size).toBe(0)
    expect(afterMotion.size).toBeGreaterThan(0)
  })
})

/** Resolves and applies a synthetic neutral-pose sample at one absolute time. */
function createSample(timeMs: number): number {
  const hips = new Object3D()
  hips.name = 'Hips'
  const bones = new Map([[hips.name, hips]])
  const gestures = new GestureEngine(bones)
  const composer = new AvatarPoseComposer(bones)

  expect(gestures.setBodyPose('neutral', 0, 1_000)).toBe(true)
  const pose = gestures.sampleAt(timeMs)
  expect(hips.rotation.x).toBe(0)
  composer.apply(pose)
  return new Euler().setFromQuaternion(hips.quaternion, hips.rotation.order).x
}

/** Builds the minimal Mixamo arm chains required by the speaking-hands solver. */
function createSpeakingHandBones(): Map<string, Object3D> {
  const root = new Object3D()
  const result = new Map<string, Object3D>()
  for (const side of ['Left', 'Right'] as const) {
    const shoulder = new Object3D()
    shoulder.name = `${side}Shoulder`
    shoulder.position.set(side === 'Left' ? 0.35 : -0.35, 1.2, 0)
    root.add(shoulder)
    let parent = shoulder
    for (const [name, position] of [
      [`${side}Arm`, [side === 'Left' ? 0.25 : -0.25, -0.35, 0]],
      [`${side}ForeArm`, [side === 'Left' ? 0.3 : -0.3, -0.35, 0]],
      [`${side}Hand`, [side === 'Left' ? 0.2 : -0.2, -0.25, 0]],
      [`${side}HandMiddle1`, [0, -0.12, 0]],
    ] as const) {
      const bone = new Object3D()
      bone.name = name
      bone.position.set(position[0], position[1], position[2])
      parent.add(bone)
      result.set(name, bone)
      parent = bone
    }
    result.set(shoulder.name, shoulder)
  }
  root.updateMatrixWorld(true)
  return result
}
