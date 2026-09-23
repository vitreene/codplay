import { describe, expect, it, vi } from 'vitest'
import { Object3D } from 'three'
import type { AvatarEngine, AvatarGestureOverlay, AvatarTimeline, Rng } from '../src/avatar/avatar-types'
import { AvatarCoordinator } from '../src/avatar/runtime/avatar-coordinator'
import { GestureEngine } from '../src/avatar/gesture/gesture-engine'
import { AvatarPoseComposer } from '../src/avatar/pose/avatar-pose'

describe('AvatarCoordinator pose ownership', () => {
  it('does not write a mood baseline through the mood selector', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(fixture.engine)
    fixture.morphEngine.setBaseline.mockClear()

    coordinator.setMood('sad')

    expect(fixture.morphEngine.setBaseline).not.toHaveBeenCalled()
  })

  it('keeps a gesture entry in transition after the central frame at 6000ms', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setPose('neutral')
    coordinator.attachEngine(fixture.engine)

    coordinator.applyAt(6_000)
    const beforeGesture = fixture.shoulder.quaternion.clone()
    coordinator.applyGestureMotion(gestureFrame('handup'), 0, 6_000, 5_700)
    coordinator.applyAt(6_016)

    expect(fixture.setPose).toHaveBeenCalledTimes(1)
    expect(fixture.shoulder.quaternion.angleTo(beforeGesture)).toBeLessThan(0.2)
  })

  it('starts a gesture release from the pose currently presented', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setPose('neutral')
    coordinator.attachEngine(fixture.engine)

    coordinator.applyAt(6_000)
    coordinator.applyGestureMotion(gestureFrame('handup'), 0, 6_000, 5_700)
    coordinator.applyAt(6_500)
    coordinator.applyAt(7_000)
    const beforeRelease = fixture.shoulder.quaternion.clone()
    coordinator.applyGestureMotion({
      ...gestureFrame(null),
      released: true,
    }, 0, 7_000, 5_700)
    coordinator.applyAt(7_016)

    expect(fixture.shoulder.quaternion.angleTo(beforeRelease)).toBeLessThan(0.2)
  })

  it('updates the native player when only the active motion duration changes', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(fixture.engine)

    coordinator.setAnimation({ name: 'walk', startAt: 0, speed: 1, durationMs: 1_000 })
    coordinator.applyAt(0)
    coordinator.setAnimation({ name: 'walk', startAt: 0, speed: 1, durationMs: 2_000 })
    coordinator.applyAt(1)

    expect(fixture.engine.setAnimation).toHaveBeenCalledTimes(2)
  })

  it('rebuilds when a seek resynchronizes the Avatar at the same time', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(fixture.engine)

    coordinator.setTimeline('mood', createMarkerTimeline('old'))
    coordinator.applyAt(1_000)
    coordinator.setTimeline('mood', createMarkerTimeline('replayed'))
    coordinator.applyAt(1_000)

    expect(fixture.engine.prepareSeek).toHaveBeenCalledTimes(1)
    expect(fixture.engine.commitSeek).toHaveBeenCalledWith(1_000)
    expect(fixture.engine.animate).toHaveBeenCalledTimes(1)
  })
})

/** Creates a feature stream whose replacement models a seek sync at one date. */
function createMarkerTimeline(marker: string): AvatarTimeline {
  return {
    id: `test-${marker}`,
    startAt: 0,
    endAt: Number.POSITIVE_INFINITY,
    sample: (timeMs) => ({
      value: `${marker}:${timeMs}`,
      apply: () => undefined,
    }),
  }
}

/** Creates a minimal real pose pipeline without loading a demo asset. */
function createPoseFixture(): {
  engine: AvatarEngine
  morphEngine: {
    setFixed: ReturnType<typeof vi.fn>
    snapFixed: ReturnType<typeof vi.fn>
    setBaseline: ReturnType<typeof vi.fn>
    snapAmbient: ReturnType<typeof vi.fn>
  }
  shoulder: Object3D
  setPose: ReturnType<typeof vi.fn>
} {
  const shoulder = new Object3D()
  const arm = new Object3D()
  const foreArm = new Object3D()
  const bones = new Map([
    ['LeftShoulder', shoulder],
    ['LeftArm', arm],
    ['LeftForeArm', foreArm],
  ])
  const semantic = new GestureEngine(bones)
  const composer = new AvatarPoseComposer(bones)
  const morphEngine = {
    setFixed: vi.fn(),
    snapFixed: vi.fn(),
    setBaseline: vi.fn(),
    snapAmbient: vi.fn(),
  }
  const setPose = vi.fn((name: string, startAt = 0) => semantic.setBodyPose(name, startAt))
  const engine = {
    morphEngine,
    setBlinkScheduleFn: vi.fn(),
    setGazeCamera: vi.fn(),
    setGazeContact: vi.fn(),
    setGazeHeadMove: vi.fn(),
    setGazeTarget: vi.fn(),
    setGazeLookAhead: vi.fn(),
    setGazeEnabled: vi.fn(),
    setGestureOverlay: vi.fn((overlay: AvatarGestureOverlay | null) => semantic.setOverlay(overlay)),
    setExplicitHandTargets: vi.fn(),
    setTalkingHands: vi.fn(),
    setAnimation: vi.fn(),
    setMood: vi.fn(),
    setPose,
    playGesture: vi.fn((name: string, rng: Rng, mirror = false, startAt = 0) => (
      semantic.applyGesture(name, rng, mirror, startAt)
    )),
    releaseGesture: vi.fn((startAt = 0) => semantic.releaseGesture(startAt)),
    animate: vi.fn(),
    prepareSeek: vi.fn(),
    commitSeek: vi.fn(),
    applyAnimationAt: vi.fn((timeMs: number) => {
      composer.apply(semantic.sampleAt(timeMs))
      return { x: 0, y: 0, z: 0 }
    }),
  } as unknown as AvatarEngine
  return { engine, morphEngine, shoulder, setPose }
}

/** Builds one ordinary Avatar gesture frame for the coordinator fixture. */
function gestureFrame(gesture: string | null) {
  return {
    morphs: {},
    gesture,
    gestureStartMs: 0,
    mirror: false,
    overlay: null,
    handTargets: [],
    gazeTarget: undefined,
    gazeTransitionMs: undefined,
    released: false,
  } as const
}
