import { describe, expect, it } from 'vitest'
import { Bone, Group, PerspectiveCamera } from 'three'
import { AvatarCoordinator } from '../src/avatar/runtime/avatar-coordinator'
import { AvatarGestureComponent } from '../src/avatar/components/avatar-gesture-component'
import { GazeService } from '../src/avatar/gaze/gaze-service'
import { GestureEngine } from '../src/avatar/gesture/gesture-engine'
import { MorphEngine } from '../src/avatar/morph/morph-engine'
import { createBoneMorphBinding } from '../src/avatar/morph/bone-morph-binding'
import { AvatarPoseComposer } from '../src/avatar/pose/avatar-pose'

type HeadAction = Readonly<{ name: string; startAt: number; durationMs?: number }>

/** Builds an independent head whose final quaternion includes mood, gesture, and camera gaze. */
function createHeadFixture(actions: readonly HeadAction[] = [
  { name: 'nod_yes', startAt: 5_000, durationMs: 1_200 },
]) {
  const root = new Group()
  const head = new Bone()
  head.name = 'Head'
  head.position.y = 1.4
  const leftEye = new Bone()
  leftEye.name = 'LeftEye'
  leftEye.position.set(-0.03, 0, 0.12)
  const rightEye = new Bone()
  rightEye.name = 'RightEye'
  rightEye.position.set(0.03, 0, 0.12)
  head.add(leftEye, rightEye)
  root.add(head)
  const camera = new PerspectiveCamera()
  camera.position.set(0.3, 1.4, 2)
  root.add(camera)

  const bones = new Map([
    ['Head', head], ['LeftEye', leftEye], ['RightEye', rightEye],
  ])
  const semantic = new GestureEngine(bones)
  const composer = new AvatarPoseComposer(bones)
  const morphs = new MorphEngine()
  const binding = createBoneMorphBinding(bones)
  morphs.registerBoneMorphs(binding)
  const gaze = new GazeService(morphs, leftEye, rightEye, head, camera)
  const noop = () => undefined
  const engine = {
    morphEngine: morphs,
    setBlinkScheduleFn: noop, setMood: noop, setTalkingHands: noop,
    setAnimation: noop, setGazeCamera: noop,
    setGazeContact: (value: number | null) => gaze.setContact(value),
    setGazeHeadMove: (value: number | null) => gaze.setHeadMove(value),
    setGazeTarget: (target: 'camera' | 'ahead') => gaze.setTarget(target),
    setGazeLookAhead: noop,
    setGazeEnabled: (enabled: boolean) => gaze.setEnabled(enabled),
    setExplicitHandTargets: noop,
    setPose: (name: string, at: number, duration?: number) => semantic.setBodyPose(name, at, duration),
    playGesture: (name: string, rng: { random: () => number }, mirror: boolean, at: number) =>
      semantic.applyGesture(name, rng, mirror, at),
    releaseGesture: (at: number) => semantic.releaseGesture(at),
    setGestureOverlay: (overlay: never) => semantic.setOverlay(overlay),
    resetSemantic: () => semantic.reset(),
    prepareSeek: () => morphs.resetToBaselines(),
    commitSeek: () => morphs.snapAll(),
    animate: (deltaMs: number) => morphs.update(deltaMs),
    applyAnimationAt: (timeMs: number) => {
      const pose = semantic.sampleAt(timeMs)
      const boneDelta = binding.getDelta()
      composer.apply(composer.compose(pose, null, [boneDelta]))
      const gazeDelta = gaze.sample(timeMs)
      composer.apply(composer.compose(pose, null, [boneDelta, gazeDelta]))
      return { x: 0, y: 0, z: 0 }
    },
  }
  const coordinator = new AvatarCoordinator()
  coordinator.setIdleProfile({
    enabled: true, breathe: false, headMove: true,
    seed: 27, speaking: false, speakWithHands: false,
    poseChanges: false, pose: 'neutral',
  })
  coordinator.setGaze(true, 1, 1)
  coordinator.setGazeCamera(camera)
  coordinator.attachEngine(engine as never)
  const gesture = new AvatarGestureComponent({
    services: { declare: noop, get: noop, apply: noop },
    perso: { id: 'gesture', storyId: 'main', initial: { gesture: null } },
  } as never)

  /** Presents one authored date through the feature timeline and common Avatar composition. */
  function present(timeMs: number) {
    gesture.update({
      state: {}, timeMs,
      activeActions: actions.filter((action) => action.startAt <= timeMs).map((action, index) => ({
        name: `avatar:gesture:${action.name}`,
        startAt: action.startAt,
        elapsedMs: timeMs - action.startAt,
        action: action.durationMs === undefined ? {} : { durationMs: action.durationMs },
        eventId: `gesture-${index}`,
      })),
      target: coordinator,
    } as never)
    coordinator.applyAt(timeMs)
    return head.quaternion.clone()
  }
  return { present, read: () => ({
    bodyRotateX: morphs.getValue('bodyRotateX'),
  }) }
}

describe('Avatar head ownership', () => {
  it('keeps the final head orientation continuous at the first gesture with camera contact', () => {
    const playback = createHeadFixture()
    playback.present(0)
    const before = playback.present(4_999)
    const atStart = playback.present(5_000)
    const mid = playback.present(5_125)

    expect(before.angleTo(atStart)).toBeLessThan(0.01)

    const seeking = createHeadFixture()
    expect(seeking.present(5_000).angleTo(atStart)).toBeLessThan(1e-6)
    expect(seeking.present(5_125).angleTo(mid)).toBeLessThan(1e-6)
    expect(playback.present(4_999).angleTo(before)).toBeLessThan(1e-6)
    expect(playback.present(5_125).angleTo(mid)).toBeLessThan(1e-6)
  })

  it('keeps the head continuous through interrupted release and a later gesture', () => {
    const actions = [
      { name: 'nod_yes', startAt: 5_000, durationMs: 1_200 },
      { name: 'release', startAt: 5_600 },
      { name: 'bow', startAt: 5_700, durationMs: 1_000 },
      { name: 'release', startAt: 6_100 },
    ]
    const playback = createHeadFixture(actions)
    playback.present(0)
    for (const action of actions) {
      const before = playback.present(action.startAt - 1)
      const beforeState = playback.read()
      const atStart = playback.present(action.startAt)
      expect(before.angleTo(atStart), `${action.name} at ${action.startAt}`).toBeLessThan(0.015)
      if (action.name === 'bow') {
        expect(Math.abs(playback.read().bodyRotateX - beforeState.bodyRotateX)).toBeLessThan(0.001)
      }

      const seeking = createHeadFixture(actions)
      expect(seeking.present(action.startAt).angleTo(atStart)).toBeLessThan(1e-6)
      expect(seeking.read().bodyRotateX).toBeCloseTo(playback.read().bodyRotateX, 6)
    }
    const after = playback.present(6_225)
    const seeking = createHeadFixture(actions)
    expect(seeking.present(6_225).angleTo(after)).toBeLessThan(1e-6)
  })
})
