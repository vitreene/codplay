import { describe, expect, it, vi } from 'vitest'
import type { AvatarEngine, AvatarGestureFrame, AvatarTimeline } from '../src/avatar/avatar-types'
import type { ComponentServices } from 'codplay'
import { MorphEngine } from '../src/avatar/morph/morph-engine'
import {
  AVATAR_COMPONENTS,
  AvatarCoordinator,
  AvatarGestureComponent,
  AvatarGazeComponent,
  AvatarIdleComponent,
  AvatarLipSyncComponent,
  AvatarMoodComponent,
  createAvatarBlinkSchedule,
  type AvatarTarget,
} from '../src'

function emptyServices(): ComponentServices {
  return {
    declare: () => undefined,
    get: () => { throw new Error('No service is declared in this test.') },
    apply: () => undefined,
  }
}

describe('Avatar V2 components', () => {
  it('registers one central component and three independent feature components', () => {
    expect(AVATAR_COMPONENTS.map((definition) => definition.type)).toEqual([
      'avatar',
      'avatar-mood',
      'avatar-lip-sync',
      'avatar-gesture',
      'avatar-idle',
      'avatar-gaze',
      'avatar-motion',
    ])
  })

  it('collects mood, lip-sync and gesture contributions before advancing the engine', () => {
    const engine = createEngineProbe()
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(engine.value)
    coordinator.applyMood({ mouthSmile: 0.2 })
    coordinator.setPose('straight')
    coordinator.applyGestureMotion(nativeGestureFrame('handup'), 41, 0, 0)
    coordinator.applyMorphs({ viseme_aa: 0.48, viseme_PP: 0 })
    coordinator.applyAt(0)
    coordinator.applyAt(200)

    expect(engine.morph.setBaseline).toHaveBeenCalledWith('mouthSmile', 0.2)
    expect(engine.setPose).toHaveBeenCalledWith('straight', 0)
    expect(engine.playGesture).toHaveBeenCalledWith(
      'handup',
      expect.objectContaining({ random: expect.any(Function) }),
      false,
      0,
    )
    expect(engine.animate).toHaveBeenLastCalledWith(200)
    expect(engine.morph.setFixed).toHaveBeenCalledWith('viseme_aa', 0.48)
    expect(engine.morph.setFixed).toHaveBeenCalledWith('viseme_PP', 0)

    coordinator.applyAt(50)
    expect(engine.prepareSeek).toHaveBeenCalledTimes(1)
    expect(engine.commitSeek).toHaveBeenCalledWith(50)
    expect(engine.playGesture).toHaveBeenCalledTimes(2)
  })

  it('resolves the idle pose before the first presentation', () => {
    const engine = createEngineProbe()
    const coordinator = new AvatarCoordinator()
    coordinator.setPose('straight')
    coordinator.attachEngine(engine.value)
    coordinator.applyAt(0)

    expect(engine.setPose).toHaveBeenCalledWith('straight', 0)
  })

  it('keeps TalkingHead speaking hands enabled unless the author disables them', () => {
    const setIdleProfile = vi.fn()
    const target = {
      setBlinkSchedule: vi.fn(),
      setIdleProfile,
    } as unknown as AvatarTarget

    new AvatarIdleComponent({
      services: emptyServices(),
      perso: { id: 'idle', storyId: 'main', initial: {} },
    } as never).update({ state: {}, timeMs: 0, target })

    expect(setIdleProfile).toHaveBeenCalledWith(expect.objectContaining({
      speakWithHands: true,
    }))
  })

  it('keeps native emoji camera contact on the forward target when camera contact is ignored', () => {
    const engine = createEngineProbe()
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(engine.value)
    coordinator.setGazeProfiles({ ignoreCamera: true })
    coordinator.applyGestureMotion({
      morphs: {},
      gesture: null,
      gestureStartMs: 0,
      mirror: false,
      overlay: null,
      handTargets: [],
      gazeTarget: 'camera',
      gazeTransitionMs: 500,
      released: false,
    }, 0, 0, 0)
    coordinator.applyAt(0)

    expect(engine.setGazeTarget).toHaveBeenLastCalledWith(
      'ahead',
      expect.objectContaining({ durationMs: 500 }),
    )
  })

  it('replays a gesture selected by a feature after a backward seek', () => {
    const engine = createEngineProbe()
    const coordinator = new AvatarCoordinator()
    coordinator.applyGestureMotion(nativeGestureFrame('handup'), 11, 0, 0)
    coordinator.attachEngine(engine.value)

    coordinator.applyAt(1_200)
    coordinator.applyAt(700)
    coordinator.applyGestureMotion(nativeGestureFrame(null), 11, 700, 0)
    coordinator.applyGestureMotion(nativeGestureFrame('thumbup'), 29, 0, 0)
    coordinator.applyAt(700)

    expect(engine.prepareSeek).toHaveBeenCalledTimes(2)
    expect(engine.commitSeek).toHaveBeenCalledWith(700)
    expect(engine.playGesture).toHaveBeenLastCalledWith(
      'thumbup',
      expect.objectContaining({ random: expect.any(Function) }),
      false,
      0,
    )
  })

  it('lets feature components write only through the Avatar target capability', () => {
    const timelines = new Map<string, AvatarTimeline>()
    const coordinator = {
      setTimeline: vi.fn((slot: string, timeline: AvatarTimeline) => timelines.set(slot, timeline)),
      applyMood: vi.fn(),
      applyMorphs: vi.fn(),
      applyGestureMotion: vi.fn(),
      setBlinkSchedule: vi.fn(),
      setIdleProfile: vi.fn(),
      setGaze: vi.fn(),
      setGazeTarget: vi.fn(),
      setAnimation: vi.fn(),
      releaseAnimation: vi.fn(),
    }
    const target: AvatarTarget = {
      setTimeline: coordinator.setTimeline,
      applyMood: coordinator.applyMood,
      applyMorphs: coordinator.applyMorphs,
      applyGestureMotion: coordinator.applyGestureMotion,
      setBlinkSchedule: coordinator.setBlinkSchedule,
      setIdleProfile: coordinator.setIdleProfile,
      setGaze: coordinator.setGaze,
      setGazeTarget: coordinator.setGazeTarget,
      setAnimation: coordinator.setAnimation,
      releaseAnimation: coordinator.releaseAnimation,
    }
    new AvatarMoodComponent({
      services: emptyServices(),
      perso: { id: 'mood', storyId: 'main', initial: {} },
    } as never).update({
      state: {},
      timeMs: 0,
      activeActions: [{
        name: 'avatar:mood:sad',
        startAt: 0,
        elapsedMs: 0,
        action: { durationMs: 1_000 },
        eventId: 'mood-1',
      }],
      target,
    })
    timelines.get('mood')?.sample(500)?.apply()
    const lipSync = new AvatarLipSyncComponent({
      services: emptyServices(),
      perso: { id: 'lip-sync', storyId: 'main', initial: { durationMs: 100 } },
    } as never)
    lipSync.update({
      state: { viseme: 'O', weight: 1, durationMs: 100 },
      timeMs: 100,
      activeActions: [{
        name: 'avatar:viseme',
        startAt: 100,
        elapsedMs: 0,
        action: { viseme: 'O', durationMs: 100 },
        eventId: 'viseme-1',
      }],
      target,
    })
    new AvatarGestureComponent({
      services: emptyServices(),
      perso: { id: 'gesture', storyId: 'main', initial: {} },
    } as never).update({
      state: {},
      timeMs: 0,
      activeActions: [{
        name: 'avatar:gesture:thumbup',
        startAt: 0,
        elapsedMs: 0,
        action: {},
      eventId: 'gesture-1',
      }],
      target,
    })
    timelines.get('gesture')?.sample(0)?.apply()
    new AvatarIdleComponent({
      services: emptyServices(),
      perso: { id: 'idle', storyId: 'main', initial: { blinkSeed: 41, pose: 'straight', breathe: true } },
    } as never).update({ state: {}, timeMs: 0, target })
    const gaze = new AvatarGazeComponent({
      services: emptyServices(),
      perso: { id: 'gaze', storyId: 'main', initial: { enabled: false, contact: 0.1, durationMs: 1_000 } },
    } as never)
    gaze.update({
      state: { enabled: false, contact: 0.1 },
      timeMs: 0,
      activeActions: [{
        name: 'avatar:gaze:on',
        startAt: 0,
        elapsedMs: 0,
        action: { contact: 0.7, durationMs: 1_000 },
        eventId: 'gaze-1',
      }],
      target,
    })

    const firstGazeTimeline = timelines.get('gaze')
    expect(firstGazeTimeline).toBeDefined()
    firstGazeTimeline?.sample(500)?.apply()
    expect(coordinator.setGaze).toHaveBeenLastCalledWith(true, expect.closeTo(0.35, 5))
    firstGazeTimeline?.sample(1_000)?.apply()

    gaze.update({
      state: { enabled: false, contact: 0.7, durationMs: 1_000 },
      timeMs: 1_000,
      activeActions: [
        {
          name: 'avatar:gaze:on',
          startAt: 0,
          elapsedMs: 1_000,
          action: { contact: 0.7, durationMs: 1_000 },
          eventId: 'gaze-1',
        },
        {
          name: 'avatar:gaze:off',
          startAt: 1_000,
          elapsedMs: 0,
          action: { durationMs: 1_000 },
          eventId: 'gaze-2',
        },
      ],
      target,
    })
    const secondGazeTimeline = timelines.get('gaze')
    secondGazeTimeline?.sample(1_500)?.apply()
    expect(coordinator.setGaze).toHaveBeenLastCalledWith(true, expect.closeTo(0.35, 5))
    secondGazeTimeline?.sample(2_000)?.apply()

    const lipSyncAnimation = timelines.get('lip-sync')
    expect(lipSyncAnimation).toBeDefined()
    lipSyncAnimation?.sample(100)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBeCloseTo(0.4042033065, 8)
    lipSyncAnimation?.sample(150)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBeCloseTo(0.6, 8)
    lipSyncAnimation?.sample(250)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBe(0)

    lipSync.update({
      state: { viseme: null, weight: 1, durationMs: 100 },
      timeMs: 200,
      activeActions: [
        {
          name: 'avatar:viseme',
          startAt: 100,
          elapsedMs: 100,
          action: { viseme: 'O', durationMs: 100 },
          eventId: 'viseme-1',
        },
        {
          name: 'avatar:viseme',
          startAt: 200,
          elapsedMs: 0,
          action: { viseme: null, durationMs: 100 },
          eventId: 'viseme-2',
        },
      ],
      target,
    })
    const releaseAnimation = timelines.get('lip-sync')
    expect(releaseAnimation).toBeDefined()
    releaseAnimation?.sample(350)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBe(0)

    expect(coordinator.applyMood).toHaveBeenCalled()
    expect(lastMorphValue(coordinator.applyMood, 'mouthFrownLeft')).toBeCloseTo(0.4, 5)
    expect(coordinator.applyGestureMotion).toHaveBeenCalledWith(
      expect.objectContaining({ gesture: 'thumbup', released: false }),
      expect.any(Number),
      0,
      0,
    )
    expect(coordinator.setBlinkSchedule).toHaveBeenCalledWith(expect.any(Function))
    expect(coordinator.setIdleProfile).toHaveBeenCalledWith(expect.objectContaining({
      breathe: true,
      headMove: true,
      pose: 'straight',
    }))
    expect(coordinator.setGaze).toHaveBeenCalledWith(true, 0.7)
    expect(coordinator.setGaze).toHaveBeenLastCalledWith(false, 0)
    expect(coordinator.applyMorphs).toHaveBeenCalled()
  })

  it('starts a gesture release at the declared event position', () => {
    const applyGestureMotion = vi.fn()
    let timeline: AvatarTimeline | undefined
    const target = {
      setTimeline: (_slot: 'gesture', value: AvatarTimeline) => { timeline = value },
      applyGestureMotion,
    } as unknown as AvatarTarget
    const component = new AvatarGestureComponent({
      services: emptyServices(),
      perso: { id: 'gesture', storyId: 'main', initial: {} },
    } as never)

    component.update({
      state: {},
      timeMs: 5_420,
      activeActions: [{
        name: 'avatar:gesture:release',
        startAt: 5_400,
        elapsedMs: 20,
        action: {},
        eventId: 'gesture-release',
      }],
      target,
    })

    timeline?.sample(5_420)?.apply()

    expect(applyGestureMotion).toHaveBeenCalledWith(
      expect.objectContaining({ gesture: null, released: true }),
      expect.any(Number),
      5_420,
      5_400,
    )
  })

  it('releases a native gesture from its current presentation time', () => {
    const applyGestureMotion = vi.fn()
    let timeline: AvatarTimeline | undefined
    const target = {
      setTimeline: (_slot: 'gesture', value: AvatarTimeline) => { timeline = value },
      applyGestureMotion,
    } as unknown as AvatarTarget
    const component = new AvatarGestureComponent({
      services: emptyServices(),
      perso: { id: 'gesture', storyId: 'main', initial: {} },
    } as never)

    component.update({
      state: {},
      timeMs: 1_000,
      activeActions: [{
        name: 'avatar:gesture:handup',
        startAt: 1_000,
        elapsedMs: 0,
        action: {},
        eventId: 'gesture-handup',
      }],
      target,
    })

    const animation = timeline
    expect(animation).toBeDefined()
    animation?.sample(1_000)?.apply()
    animation?.sample(4_001)?.apply()

    expect(applyGestureMotion).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ gesture: 'handup', released: false }),
      expect.any(Number),
      1_000,
      1_000,
    )
    expect(applyGestureMotion).toHaveBeenLastCalledWith(
      expect.objectContaining({ gesture: null, released: true }),
      expect.any(Number),
      4_001,
      1_000,
    )
  })

  it('keeps overlapping viseme envelopes independent when optional data is omitted', () => {
    const applyMorphs = vi.fn()
    let timeline: AvatarTimeline | undefined
    const component = new AvatarLipSyncComponent({
      services: emptyServices(),
      perso: { id: 'lip-sync', storyId: 'main', initial: {} },
    } as never)

    component.update({
      state: {},
      timeMs: 0,
      activeActions: [
        {
          name: 'avatar:viseme',
          startAt: 100,
          elapsedMs: 0,
          action: { viseme: 'O' },
          eventId: 'viseme-o',
        },
        {
          name: 'avatar:viseme',
          startAt: 140,
          elapsedMs: 0,
          action: { viseme: 'aa' },
          eventId: 'viseme-aa',
        },
      ],
      target: {
        setTimeline: (_slot: 'lip-sync', value: AvatarTimeline) => { timeline = value },
        applyMorphs,
      } as unknown as AvatarTarget,
    })

    const animation = timeline
    const frame = animation?.sample(175)?.value as Record<string, number> | undefined

    expect(animation?.endAt).toBe(Number.POSITIVE_INFINITY)
    expect(frame?.viseme_O).toBeGreaterThan(0)
    expect(frame?.viseme_aa).toBeGreaterThan(0)
    expect(animation?.sample(400)?.value).toMatchObject({
      viseme_O: 0,
      viseme_aa: 0,
    })
  })

  it('applies look-ahead at the gaze event time', () => {
    const setGazeTarget = vi.fn()
    let timeline: AvatarTimeline | undefined
    const target = {
      setTimeline: (_slot: 'gaze', value: AvatarTimeline) => { timeline = value },
      setGaze: vi.fn(),
      setGazeProfiles: vi.fn(),
      setGazeTarget,
    } as unknown as AvatarTarget
    const component = new AvatarGazeComponent({
      services: emptyServices(),
      perso: { id: 'gaze', storyId: 'main', initial: { enabled: true, durationMs: 500 } },
    } as never)

    component.update({
      state: { enabled: true },
      timeMs: 0,
      activeActions: [{
        name: 'avatar:gaze:look-ahead',
        startAt: 1_000,
        elapsedMs: 0,
        action: {},
        eventId: 'gaze-look-ahead',
      }],
      target,
    })

    expect(setGazeTarget).not.toHaveBeenCalled()
    timeline?.sample(1_000)?.apply()
    expect(setGazeTarget).toHaveBeenCalledWith('ahead', {
      startAt: 1_000,
      durationMs: 500,
    })
  })

  it('produces deterministic random blink windows that survive a backward seek', () => {
    const schedule = createAvatarBlinkSchedule(41)
    const freshSchedule = createAvatarBlinkSchedule(41)
    const elapsedValues = [0, 1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 7_000, 8_000, 9_000, 10_000]
    const forward = elapsedValues.map((elapsed) => schedule({ elapsed })?.eyesClosed ?? 0)
    const replayed = freshSchedule({ elapsed: 6_000 })?.eyesClosed ?? 0

    expect(forward.some((value) => value > 0)).toBe(true)
    expect(replayed).toBe(forward[6])
    expect(schedule({ elapsed: 2_000 })?.eyesClosed ?? 0).toBe(
      freshSchedule({ elapsed: 2_000 })?.eyesClosed ?? 0,
    )
  })

  it('keeps a fixed speech morph above the TH system gaze layer', () => {
    const morphs = new MorphEngine()
    const influences = [0]
    morphs.registerBlendMorph('eyeLookInLeft', { influences, index: 0 })

    morphs.snapSystem('eyeLookInLeft', 0.2)
    expect(influences[0]).toBeCloseTo(0.2)

    morphs.snapFixed('eyeLookInLeft', 0.8)
    morphs.snapSystem('eyeLookInLeft', 0.1)
    expect(influences[0]).toBeCloseTo(0.8)

    morphs.snapFixed('eyeLookInLeft', null)
    expect(influences[0]).toBeCloseTo(0.1)
  })
})

/** Reads the last fixed morph value recorded for one named target. */
function lastMorphValue(
  applyMorphs: ReturnType<typeof vi.fn>,
  name: string,
): number | undefined {
  const calls = [...applyMorphs.mock.calls].reverse()
  const morphs = calls.find(([value]) => typeof value === 'object' && value !== null)?.[0] as Record<string, number> | undefined
  return morphs?.[name]
}

/** Builds the minimal native gesture frame used by coordinator tests. */
function nativeGestureFrame(name: string | null): AvatarGestureFrame {
  return {
    morphs: {},
    gesture: name,
    gestureStartMs: 0,
    mirror: false,
    overlay: null,
    handTargets: [],
    released: name === null,
  }
}

/** Builds an engine-shaped probe without loading a model or a demo asset. */
function createEngineProbe(): {
  value: AvatarEngine
  morph: {
    setFixed: ReturnType<typeof vi.fn>
    snapFixed: ReturnType<typeof vi.fn>
    setBaseline: ReturnType<typeof vi.fn>
  }
  playGesture: ReturnType<typeof vi.fn>
  setPose: ReturnType<typeof vi.fn>
  animate: ReturnType<typeof vi.fn>
  prepareSeek: ReturnType<typeof vi.fn>
  commitSeek: ReturnType<typeof vi.fn>
  applyAnimationAt: ReturnType<typeof vi.fn>
  setGazeTarget: ReturnType<typeof vi.fn>
} {
  const morph = { setFixed: vi.fn(), snapFixed: vi.fn(), setBaseline: vi.fn() }
  const playGesture = vi.fn()
  const setPose = vi.fn()
  const animate = vi.fn()
  const prepareSeek = vi.fn()
  const commitSeek = vi.fn()
  const applyAnimationAt = vi.fn()
  const setGazeTarget = vi.fn()
  const setGazeLookAhead = vi.fn()
  const value = {
    morphEngine: morph,
    playGesture,
    setPose,
    animate,
    prepareSeek,
    commitSeek,
    applyAnimationAt,
    releaseGesture: vi.fn(),
    setBlinkScheduleFn: vi.fn(),
    setGazeCamera: vi.fn(),
    setGazeContact: vi.fn(),
    setGazeHeadMove: vi.fn(),
    setGazeTarget,
    setGazeLookAhead,
    setGazeEnabled: vi.fn(),
    setGestureOverlay: vi.fn(),
    setExplicitHandTargets: vi.fn(),
    setTalkingHands: vi.fn(),
    setMood: vi.fn(),
    setAnimation: vi.fn(),
  } as unknown as AvatarEngine
  return {
    value,
    morph,
    playGesture,
    setPose,
    animate,
    prepareSeek,
    commitSeek,
    applyAnimationAt,
    setGazeTarget,
  }
}
