import { describe, expect, it } from 'vitest'
import { Bone, Group } from 'three'
import { sampleThIdle } from '../src/avatar/idle/th-idle-animation'
import { sampleLoopedTemplate } from '../src/avatar/idle/th-animation-template'
import { sampleTalkingHeadEasing } from '../src/avatar/avatar-easing'
import { getThPoseChoices, resolveThPoseChoice } from '../src/avatar/idle/th-mood-data'
import { GestureEngine } from '../src/avatar/gesture/gesture-engine'
import { TalkingHandsPlanner } from '../src/avatar/gesture/talking-hands'

describe('TalkingHead idle adaptation', () => {
  it('samples the same automatic frame for the same absolute time', () => {
    const options = {
      enabled: true,
      breathe: true,
      headMove: true,
      seed: 41,
    } as const

    expect(sampleThIdle('neutral', 2_400, options)).toEqual(
      sampleThIdle('neutral', 2_400, options),
    )
  })

  it('does not create idle channels when the feature is disabled', () => {
    const frame = sampleThIdle('neutral', 2_400, {
      enabled: false,
      breathe: true,
      headMove: true,
      seed: 41,
    })

    expect(frame).toEqual({ morphs: {}, overlay: null })
  })

  it('keeps the current value through the initial TH template segment', () => {
    const frame = sampleLoopedTemplate({
      dt: [100, 100],
      vs: { testChannel: [0, 1] },
    }, 125, 41)

    expect(frame.testChannel).toBeCloseTo(sampleTalkingHeadEasing(0.25))
    expect(frame.testChannel).not.toBeCloseTo(0.25)
  })

  it('solves deterministic speaking hands independently from scene data', () => {
    const bones = createSpeakingHandBones()
    const pose = new GestureEngine(bones).sampleAt(0)
    const planner = new TalkingHandsPlanner(bones)
    const options = { enabled: true, probability: 1, seed: 41 } as const
    const first = planner.sample(1_500, pose, options)
    const replayed = planner.sample(1_500, pose, options)

    expect(first.size).toBeGreaterThan(0)
    expect(first).toEqual(replayed)
  })

  it('lets an active speaking-hand phrase finish after speech goes idle', () => {
    const bones = createSpeakingHandBones()
    const pose = new GestureEngine(bones).sampleAt(0)
    const planner = new TalkingHandsPlanner(bones)

    planner.sample(1_500, pose, { enabled: true, probability: 1, seed: 41 })
    const duringReturn = planner.sample(2_000, pose, { enabled: false, probability: 1, seed: 41 })
    const afterReturn = planner.sample(3_700, pose, { enabled: false, probability: 1, seed: 41 })

    expect(duringReturn.size).toBeGreaterThan(0)
    expect(afterReturn.size).toBe(0)
  })

  it('reconciles the return target with a pose that changed during the phrase', () => {
    const bones = createSpeakingHandBones()
    const initialEngine = new GestureEngine(bones)
    const changedEngine = new GestureEngine(bones)
    const initialPose = initialEngine.sampleAt(0)
    changedEngine.setBodyPose('side', 0, 0)
    const changedPose = changedEngine.sampleAt(0)
    const options = { enabled: true, probability: 1, seed: 41 } as const
    const leftArm = bones.get('LeftArm')!

    const planner = new TalkingHandsPlanner(bones)
    planner.sample(0, initialPose, options)
    planner.sample(1_325, initialPose, options)
    const returnFromInitialPose = planner.sample(2_000, initialPose, options).get(leftArm)

    const replanned = new TalkingHandsPlanner(bones)
    replanned.sample(0, initialPose, options)
    replanned.sample(1_325, initialPose, options)
    const returnFromChangedPose = replanned.sample(2_000, changedPose, options).get(leftArm)

    expect(returnFromInitialPose).toBeDefined()
    expect(returnFromChangedPose).toBeDefined()
    expect(returnFromChangedPose).not.toEqual(returnFromInitialPose)
  })

  it('adds TalkingHead close-view facial variation without changing full view', () => {
    const full = sampleThIdle('neutral', 750, {
      enabled: true,
      breathe: true,
      headMove: true,
      seed: 7,
      view: 'full',
    })
    const close = sampleThIdle('neutral', 750, {
      enabled: true,
      breathe: true,
      headMove: true,
      seed: 7,
      view: 'upper',
    })

    const randomizedChannels = [
      'mouthDimpleLeft', 'mouthDimpleRight', 'mouthLeft', 'mouthPressLeft',
      'mouthPressRight', 'mouthStretchLeft', 'mouthStretchRight',
      'mouthShrugLower', 'mouthShrugUpper', 'noseSneerLeft', 'noseSneerRight',
      'mouthRollLower', 'mouthRollUpper', 'browDownLeft', 'browDownRight',
      'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff',
      'cheekSquintLeft', 'cheekSquintRight',
    ]
    expect(randomizedChannels.some((name) => close.morphs[name] !== full.morphs[name])).toBe(true)
  })

  it('replays the native probabilistic head-move task from absolute time', () => {
    const options = {
      enabled: true,
      breathe: false,
      headMove: true,
      seed: 41,
      poseChanges: false,
    }
    const first = Array.from({ length: 320 }, (_, index) => sampleThIdle(
      'neutral',
      index * 100,
      options,
    ))
    const replayed = Array.from({ length: 320 }, (_, index) => sampleThIdle(
      'neutral',
      index * 100,
      options,
    ))

    expect(first).toEqual(replayed)
    expect(first.some((frame) => Math.abs(frame.morphs.headRotateX ?? 0) > 0)).toBe(true)
    expect(first.some((frame) => Math.abs(frame.morphs.headRotateY ?? 0) > 0)).toBe(true)
  })

  it('uses the TH eye-contact and head-move profiles when selecting idle alternatives', () => {
    const noContact = Array.from({ length: 320 }, (_, index) => sampleThIdle(
      'neutral',
      index * 100,
      {
        enabled: true,
        breathe: false,
        headMove: true,
        seed: 41,
        eyeContactProbability: 0,
        headMoveProbability: 0,
      },
    ))
    const fullContact = Array.from({ length: 320 }, (_, index) => sampleThIdle(
      'neutral',
      index * 100,
      {
        enabled: true,
        breathe: false,
        headMove: true,
        seed: 41,
        eyeContactProbability: 1,
        headMoveProbability: 1,
      },
    ))

    expect(noContact.some((frame) => frame.eyeContact === 1)).toBe(false)
    expect(noContact.some((frame) => Math.abs(frame.morphs.headRotateX ?? 0) > 0)).toBe(false)
    expect(fullContact.some((frame) => frame.eyeContact === 1)).toBe(true)
    expect(fullContact.some((frame) => Math.abs(frame.morphs.headRotateX ?? 0) > 0)).toBe(true)
  })

  it('resolves native pose variants by view before body form', () => {
    const choice = getThPoseChoices('love', false)[6]!

    expect(resolveThPoseChoice(choice, 'M', 'upper').name).toBe('side')
    expect(resolveThPoseChoice(choice, 'M', 'full').name).toBe('bend')
  })
})

/** Builds two minimal TH-compatible arm chains for the autonomous IK test. */
function createSpeakingHandBones(): Map<string, Bone> {
  const root = new Group()
  const result = new Map<string, Bone>()
  for (const side of ['Left', 'Right'] as const) {
    const shoulder = new Bone()
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
      const bone = new Bone()
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
