import { describe, expect, it, vi } from 'vitest'
import type { AvatarEngine, AvatarGestureFrame, AvatarTimeline } from '../src/avatar/avatar-types'
import type { ComponentServices } from 'codplay'
import { MorphEngine } from '../src/avatar/morph/morph-engine'
import {
  AVATAR_COMPONENTS,
  AvatarCoordinator,
  AvatarGestureComponent,
  AvatarGazeComponent,
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
  it('registers the fused mood feature without a separate idle perso', () => {
    expect(AVATAR_COMPONENTS.map((definition) => definition.type)).toEqual([
      'avatar',
      'avatar-mood',
      'avatar-lip-sync',
      'avatar-gesture',
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

    expect(engine.morph.snapBaseline).toHaveBeenCalledWith('mouthSmile', 0.2)
    expect(engine.setPose).toHaveBeenCalledWith('straight', 0, 0)
    expect(engine.playGesture).toHaveBeenCalledWith(
      'handup',
      expect.objectContaining({ random: expect.any(Function) }),
      false,
      0,
    )
    expect(engine.animate).toHaveBeenLastCalledWith(200, 200)
    expect(engine.morph.snapFixed).toHaveBeenCalledWith('viseme_aa', 0.48)
    expect(engine.morph.snapFixed).toHaveBeenCalledWith('viseme_PP', 0)

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

    expect(engine.setPose).toHaveBeenCalledWith('straight', 0, 0)
  })

  it('keeps TalkingHead speaking hands enabled unless the author disables them', () => {
    const setIdleProfile = vi.fn()
    const target = {
      setTimeline: vi.fn(),
      setBlinkSchedule: vi.fn(),
      setIdleProfile,
    } as unknown as AvatarTarget

    new AvatarMoodComponent({
      services: emptyServices(),
      perso: { id: 'mood', storyId: 'main', initial: {} },
    } as never).update({ state: {}, timeMs: 0, target })

    expect(setIdleProfile).toHaveBeenCalledWith(expect.objectContaining({
      speakWithHands: true,
    }))
  })

  it('lets a null viseme close the mouth without changing any body mode', () => {
    const setTimeline = vi.fn()
    const setGazeMode = vi.fn()
    const target = {
      setTimeline,
      setGazeMode,
    } as unknown as AvatarTarget
    const lipSync = new AvatarLipSyncComponent({
      services: emptyServices(),
      perso: { id: 'viseme', storyId: 'main', initial: {} },
    } as never)
    const spoken = {
      name: 'avatar:viseme', startAt: 100, elapsedMs: 0,
      action: { viseme: 'O', durationMs: 100 }, eventId: 'spoken',
    }
    const silence = {
      name: 'avatar:viseme', startAt: 200, elapsedMs: 0,
      action: { viseme: null, durationMs: 100 }, eventId: 'silence',
    }

    lipSync.update({ state: {}, timeMs: 100, activeActions: [spoken], target })
    lipSync.update({ state: {}, timeMs: 200, activeActions: [spoken, silence], target })

    expect(setGazeMode).not.toHaveBeenCalled()
    const timeline = setTimeline.mock.lastCall?.[1] as AvatarTimeline
    expect(timeline?.sample(300)?.value).toEqual(expect.objectContaining({
      viseme_O: 0,
      jawOpen: 0,
      mouthOpen: 0,
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
      perso: { id: 'mood', storyId: 'main', initial: { blinkSeed: 41, pose: 'straight', breathe: true } },
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
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBe(0)
    lipSyncAnimation?.sample(130)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBeCloseTo(0.3, 8)
    lipSyncAnimation?.sample(160)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBeCloseTo(0.6, 8)
    lipSyncAnimation?.sample(260)?.apply()
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

  it('enables continuous camera contact by default through avatar-gaze', () => {
    const setGaze = vi.fn()
    const setGazeTarget = vi.fn()
    let timeline: AvatarTimeline | undefined
    const target = {
      setTimeline: (_slot: 'gaze', value: AvatarTimeline) => { timeline = value },
      setGaze,
      setGazeTarget,
    } as unknown as AvatarTarget
    const component = new AvatarGazeComponent({
      services: emptyServices(),
      perso: { id: 'gaze', storyId: 'main', initial: {} },
    } as never)
    component.update({ state: {}, timeMs: 0, activeActions: [], target })

    timeline?.sample(0)?.apply()
    expect(setGaze).toHaveBeenCalledWith(true, 1)
    expect(setGazeTarget).toHaveBeenCalledWith('camera', expect.any(Object))
  })

  it('presents gaze on and off actions through the central Avatar timeline', () => {
    const engine = createEngineProbe()
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(engine.value)
    const component = new AvatarGazeComponent({
      services: emptyServices(),
      perso: { id: 'gaze', storyId: 'main', initial: {} },
    } as never)
    const off = {
      name: 'avatar:gaze:off', startAt: 1_000, elapsedMs: 0,
      action: { durationMs: 250 }, eventId: 'contact-off',
    }
    const on = {
      name: 'avatar:gaze:on', startAt: 2_000, elapsedMs: 0,
      action: { durationMs: 250 }, eventId: 'contact-on',
    }
    const contact = engine.value.setGazeContact as ReturnType<typeof vi.fn>
    const enabled = engine.value.setGazeEnabled as ReturnType<typeof vi.fn>

    component.update({ state: {}, timeMs: 0, activeActions: [], target: coordinator })
    coordinator.applyAt(0)
    expect(contact).toHaveBeenLastCalledWith(1)
    expect(enabled).toHaveBeenLastCalledWith(true)

    component.update({ state: {}, timeMs: 1_250, activeActions: [off], target: coordinator })
    coordinator.applyAt(1_125)
    expect(contact.mock.lastCall?.[0]).toBeGreaterThan(0)
    expect(contact.mock.lastCall?.[0]).toBeLessThan(1)
    coordinator.applyAt(1_250)
    expect(contact).toHaveBeenLastCalledWith(0)
    expect(enabled).toHaveBeenLastCalledWith(false)

    component.update({ state: {}, timeMs: 2_250, activeActions: [off, on], target: coordinator })
    coordinator.applyAt(2_250)
    expect(contact).toHaveBeenLastCalledWith(1)
    expect(enabled).toHaveBeenLastCalledWith(true)
    coordinator.applyAt(1_125)
    expect(contact.mock.lastCall?.[0]).toBeGreaterThan(0)
    expect(contact.mock.lastCall?.[0]).toBeLessThan(1)
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
      5_400,
      5_400,
    )
  })

  it('retains an authored initial gesture when the first action arrives', () => {
    const setGestureHistory = vi.fn()
    const target = {
      setGestureHistory,
      setTimeline: vi.fn(),
    } as unknown as AvatarTarget
    const component = new AvatarGestureComponent({
      services: emptyServices(),
      perso: { id: 'gesture', storyId: 'main', initial: { gesture: 'handup' } },
    } as never)

    component.update({
      state: {}, timeMs: 1_000,
      activeActions: [{
        name: 'avatar:gesture:wave_left', startAt: 1_000, elapsedMs: 0,
        action: { durationMs: 1_000 }, eventId: 'first-wave',
      }],
      target,
    })

    expect(setGestureHistory).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ kind: 'gesture', name: 'handup', startAt: 0 }),
      expect.objectContaining({ kind: 'gesture', name: null, startAt: 1_000 }),
    ]))
  })

  it('reconstructs an interrupted bow from authored gesture history', () => {
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
    const bow = {
      name: 'avatar:gesture:bow',
      startAt: 0,
      elapsedMs: 0,
      action: {},
      eventId: 'bow-event',
    }
    const release = {
      name: 'avatar:gesture:release',
      startAt: 1_000,
      elapsedMs: 0,
      action: {},
      eventId: 'release-event',
    }
    component.update({ state: {}, timeMs: 1_000, activeActions: [bow, release], target })

    const sample = (timeMs: number): AvatarGestureFrame => {
      timeline?.sample(timeMs)?.apply()
      return applyGestureMotion.mock.lastCall?.[0] as AvatarGestureFrame
    }
    const atRelease = sample(1_000)
    const inRelease = sample(1_125)
    const afterRelease = sample(1_250)

    expect(atRelease.morphs.bodyRotateX).toBeGreaterThan(0)
    expect(inRelease.morphs.bodyRotateX).toBeGreaterThan(0)
    expect(inRelease.morphs.bodyRotateX).toBeLessThan(atRelease.morphs.bodyRotateX ?? 0)
    expect(afterRelease.released).toBe(true)

    component.update({ state: {}, timeMs: 1_125, activeActions: [bow, release], target })
    expect(sample(1_125)).toEqual(inRelease)
  })

  it('preserves two nested gesture handoffs in Play and Seek', () => {
    let timeline: AvatarTimeline | undefined
    const target = {
      setTimeline: (_slot: 'gesture', value: AvatarTimeline) => { timeline = value },
    } as unknown as AvatarTarget
    const component = new AvatarGestureComponent({
      services: emptyServices(),
      perso: { id: 'gesture', storyId: 'main', initial: {} },
    } as never)
    const bow = {
      name: 'avatar:gesture:bow', startAt: 500, elapsedMs: 0,
      action: {}, eventId: 'first-bow',
    }
    const release = {
      name: 'avatar:gesture:release', startAt: 550, elapsedMs: 0,
      action: {}, eventId: 'release',
    }
    const secondBow = {
      name: 'avatar:gesture:bow', startAt: 600, elapsedMs: 0,
      action: {}, eventId: 'second-bow',
    }
    component.update({ state: {}, timeMs: 500, activeActions: [bow], target })
    component.update({ state: {}, timeMs: 550, activeActions: [bow, release], target })
    const beforeSecond = timeline?.sample(600)?.value as AvatarGestureFrame
    component.update({ state: {}, timeMs: 600, activeActions: [bow, release, secondBow], target })
    const atSecond = timeline?.sample(600)?.value as AvatarGestureFrame
    const playAt725 = timeline?.sample(725)?.value

    expect(atSecond.morphs.bodyRotateX).toBeCloseTo(beforeSecond.morphs.bodyRotateX ?? 0, 10)
    component.update({ state: {}, timeMs: 500, activeActions: [bow], target })
    component.update({ state: {}, timeMs: 600, activeActions: [bow, release, secondBow], target })
    expect(timeline?.sample(725)?.value).toEqual(playAt725)
  })

  it('keeps a completed gesture released when a later release instruction arrives', () => {
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
    const gesture = {
      name: 'avatar:gesture:nod_yes', startAt: 0, elapsedMs: 0,
      action: { durationMs: 1_000 }, eventId: 'completed-nod',
    }
    const release = {
      name: 'avatar:gesture:release', startAt: 2_000, elapsedMs: 0,
      action: {}, eventId: 'later-release',
    }
    component.update({ state: {}, timeMs: 2_000, activeActions: [gesture, release], target })

    timeline?.sample(1_125)?.apply()
    const naturalExit = applyGestureMotion.mock.lastCall?.[0] as AvatarGestureFrame
    expect(naturalExit.released).toBe(false)
    expect(naturalExit.morphWeight).toBeCloseTo(0.5)

    for (const timeMs of [2_000, 2_125, 2_249]) {
      timeline?.sample(timeMs)?.apply()
      const frame = applyGestureMotion.mock.lastCall?.[0] as AvatarGestureFrame
      expect(frame.released).toBe(true)
      expect(frame.morphs).toEqual({})
    }
  })

  it('presents the same bow release morph in Play and Seek through the coordinator', () => {
    const engine = createEngineProbe()
    const morphEngine = new MorphEngine()
    const bodyRotation = [0]
    morphEngine.registerBlendMorph('bodyRotateX', { influences: bodyRotation, index: 0 })
    Object.assign(engine.value, {
      morphEngine,
      animate: (deltaMs: number) => morphEngine.update(deltaMs),
      prepareSeek: () => morphEngine.resetToBaselines(),
      commitSeek: () => morphEngine.snapAll(),
    })
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(engine.value)
    const component = new AvatarGestureComponent({
      services: emptyServices(),
      perso: { id: 'gesture', storyId: 'main', initial: {} },
    } as never)
    const bow = {
      name: 'avatar:gesture:bow',
      startAt: 0,
      elapsedMs: 0,
      action: {},
      eventId: 'bow-event',
    }
    const release = {
      name: 'avatar:gesture:release',
      startAt: 1_000,
      elapsedMs: 0,
      action: {},
      eventId: 'release-event',
    }
    component.update({ state: {}, timeMs: 0, activeActions: [bow], target: coordinator })
    coordinator.applyAt(0)
    coordinator.applyAt(999)
    component.update({ state: {}, timeMs: 1_000, activeActions: [bow, release], target: coordinator })
    coordinator.applyAt(1_000)
    const start = bodyRotation[0]!
    coordinator.applyAt(1_125)
    const play = bodyRotation[0]!
    coordinator.applyAt(1_250)
    coordinator.applyAt(1_125)

    expect(play).toBeGreaterThan(0)
    expect(play).toBeLessThan(start)
    expect(bodyRotation[0]).toBeCloseTo(play)
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
      4_000,
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

  it('starts an interrupted mood from its presented value and reconstructs it after seek', () => {
    let timeline: AvatarTimeline | undefined
    const applyMood = vi.fn()
    const target = {
      setTimeline: (_slot: 'mood', value: AvatarTimeline) => { timeline = value },
      setMood: vi.fn(),
      setMoodHistory: vi.fn(),
      setBlinkSchedule: vi.fn(),
      setIdleProfile: vi.fn(),
      applyMood,
    } as unknown as AvatarTarget
    const component = new AvatarMoodComponent({
      services: emptyServices(),
      perso: { id: 'mood', storyId: 'main', initial: { mood: 'neutral' } },
    } as never)
    const happy = {
      name: 'avatar:mood:happy',
      startAt: 100,
      elapsedMs: 0,
      action: { durationMs: 1_000 },
      eventId: 'happy',
    }
    const sad = {
      name: 'avatar:mood:sad',
      startAt: 600,
      elapsedMs: 0,
      action: { durationMs: 1_000 },
      eventId: 'sad',
    }

    component.update({ state: {}, timeMs: 100, activeActions: [happy], target })
    expect((timeline?.sample(350)?.value as Record<string, number>).mouthSmile).toBeCloseTo(0.0140207433)
    const smileAtInterruption = (timeline?.sample(600)?.value as Record<string, number>).mouthSmile
    expect(smileAtInterruption).toBeCloseTo(0.1)

    component.update({ state: {}, timeMs: 600, activeActions: [happy, sad], target })
    expect(target.setMood).not.toHaveBeenCalled()
    expect(target.setMoodHistory).toHaveBeenLastCalledWith([
      { mood: 'neutral', startAt: 0 },
      { mood: 'happy', startAt: 100 },
      { mood: 'sad', startAt: 600 },
    ])
    expect((timeline?.sample(600)?.value as Record<string, number>).mouthSmile).toBeCloseTo(smileAtInterruption)
    expect((timeline?.sample(600)?.value as Record<string, number>).mouthFrownLeft).toBeCloseTo(0)
    timeline?.sample(1_100)?.apply()
    expect(lastMorphValue(applyMood, 'mouthSmile')).toBeCloseTo(0.05)
    expect(lastMorphValue(applyMood, 'mouthFrownLeft')).toBeCloseTo(0.4)

    component.update({ state: {}, timeMs: 350, activeActions: [happy], target })
    expect((timeline?.sample(350)?.value as Record<string, number>).mouthSmile).toBeCloseTo(0.0140207433)
    component.update({ state: {}, timeMs: 600, activeActions: [happy, sad], target })
    expect((timeline?.sample(600)?.value as Record<string, number>).mouthSmile).toBeCloseTo(0.1)

    component.update({
      state: {},
      timeMs: 1_700,
      activeActions: [happy, sad, {
        name: 'avatar:mood:neutral',
        startAt: 1_700,
        elapsedMs: 0,
        action: {},
        eventId: 'neutral',
      }],
      target,
    })
    expect((timeline?.sample(1_700)?.value as Record<string, number>).mouthFrownLeft).toBe(0)
  })

  it('keeps one live mood transition between actions and reproduces it after seek', () => {
    const setTimeline = vi.fn()
    const target = {
      setTimeline,
      setMoodHistory: vi.fn(),
      setBlinkSchedule: vi.fn(),
      setIdleProfile: vi.fn(),
    } as unknown as AvatarTarget
    const component = new AvatarMoodComponent({
      services: emptyServices(),
      perso: { id: 'mood', storyId: 'main', initial: { mood: 'neutral' } },
    } as never)
    const happy = {
      name: 'avatar:mood:happy', startAt: 100, elapsedMs: 0,
      action: { durationMs: 1_000 }, eventId: 'happy',
    }
    const sad = {
      name: 'avatar:mood:sad', startAt: 600, elapsedMs: 0,
      action: { durationMs: 1_000 }, eventId: 'sad',
    }

    component.update({ state: {}, timeMs: 100, activeActions: [happy], target })
    const firstTimeline = setTimeline.mock.lastCall?.[1] as AvatarTimeline
    const beforeInterruption = firstTimeline.sample(600)?.value as Record<string, number>
    component.update({ state: {}, timeMs: 350, activeActions: [happy], target })
    expect(setTimeline).toHaveBeenCalledTimes(1)
    component.update({ state: {}, timeMs: 600, activeActions: [happy, sad], target })
    const playTimeline = setTimeline.mock.lastCall?.[1] as AvatarTimeline
    const atInterruption = playTimeline.sample(600)?.value as Record<string, number>
    for (const name of Object.keys(beforeInterruption)) {
      expect(atInterruption[name]).toBeCloseTo(beforeInterruption[name]!, 10)
    }
    const playAt800 = playTimeline.sample(800)?.value

    component.update({ state: {}, timeMs: 350, activeActions: [happy], target })
    component.update({ state: {}, timeMs: 600, activeActions: [happy, sad], target })
    const seekTimeline = setTimeline.mock.lastCall?.[1] as AvatarTimeline
    expect(seekTimeline.sample(800)?.value).toEqual(playAt800)
  })

  it('starts an interactive mood action from the value at a paused time', () => {
    const setTimeline = vi.fn()
    const target = {
      setTimeline,
      setMoodHistory: vi.fn(),
      setBlinkSchedule: vi.fn(),
      setIdleProfile: vi.fn(),
    } as unknown as AvatarTarget
    const component = new AvatarMoodComponent({
      services: emptyServices(),
      perso: { id: 'mood', storyId: 'main', initial: { mood: 'neutral' } },
    } as never)
    const happy = {
      name: 'avatar:mood:happy', startAt: 100, elapsedMs: 250,
      action: { durationMs: 1_000 }, eventId: 'happy',
    }
    component.update({ state: {}, timeMs: 350, activeActions: [happy], target })
    const before = (setTimeline.mock.lastCall?.[1] as AvatarTimeline)
      .sample(350)?.value as Record<string, number>
    const sad = {
      name: 'avatar:mood:sad', startAt: 350, elapsedMs: 0,
      action: { durationMs: 1_000 }, eventId: 'interactive-sad',
    }

    component.update({ state: {}, timeMs: 350, activeActions: [happy, sad], target })
    const after = (setTimeline.mock.lastCall?.[1] as AvatarTimeline)
      .sample(350)?.value as Record<string, number>

    expect(after.mouthSmile).toBeCloseTo(before.mouthSmile!, 10)
    expect(after.mouthFrownLeft).toBeCloseTo(before.mouthFrownLeft ?? 0, 10)
    expect(setTimeline).toHaveBeenCalledTimes(2)
  })

  it('accepts an initial happy mood with persona-specific morph values', () => {
    let timeline: AvatarTimeline | undefined
    const setMoodHistory = vi.fn()
    const target = {
      setTimeline: (_slot: 'mood', value: AvatarTimeline) => { timeline = value },
      setMoodHistory,
      setBlinkSchedule: vi.fn(),
      setIdleProfile: vi.fn(),
    } as unknown as AvatarTarget
    const component = new AvatarMoodComponent({
      services: emptyServices(),
      perso: {
        id: 'mood',
        storyId: 'main',
        initial: { mood: 'happy', moods: { happy: { mouthSmile: 0.5 } } },
      },
    } as never)

    component.update({ state: {}, timeMs: 0, target })

    expect(timeline?.sample(0)?.value).toMatchObject({ mouthSmile: 0.5, eyesLookDown: 0.1 })
    expect(setMoodHistory).toHaveBeenLastCalledWith([
      { mood: 'happy', startAt: 0, baseline: { mouthSmile: 0.5, eyesLookDown: 0.1 } },
    ])
  })

  it('uses persona-specific values for a later happy action', () => {
    let timeline: AvatarTimeline | undefined
    const setMoodHistory = vi.fn()
    const target = {
      setTimeline: (_slot: 'mood', value: AvatarTimeline) => { timeline = value },
      setMoodHistory,
      setBlinkSchedule: vi.fn(),
      setIdleProfile: vi.fn(),
    } as unknown as AvatarTarget
    const component = new AvatarMoodComponent({
      services: emptyServices(),
      perso: {
        id: 'mood',
        storyId: 'main',
        initial: { mood: 'neutral', moods: { happy: { mouthSmile: 0.5 } } },
      },
    } as never)
    const happy = {
      name: 'avatar:mood:happy',
      startAt: 1_000,
      elapsedMs: 0,
      action: {},
      eventId: 'happy',
    }

    component.update({ state: {}, timeMs: 1_000, activeActions: [happy], target })

    expect(timeline?.sample(1_000)?.value).toMatchObject({ mouthSmile: 0.5 })
    expect(setMoodHistory).toHaveBeenLastCalledWith([
      { mood: 'neutral', startAt: 0 },
      { mood: 'happy', startAt: 1_000, baseline: { mouthSmile: 0.5, eyesLookDown: 0.1 } },
    ])
  })

  it('opens a short viseme smoothly and carries its release into a repeated cue', () => {
    let timeline: AvatarTimeline | undefined
    const component = new AvatarLipSyncComponent({
      services: emptyServices(),
      perso: { id: 'lip-sync', storyId: 'main', initial: {} },
    } as never)
    const target = {
      setTimeline: (_slot: 'lip-sync', value: AvatarTimeline) => { timeline = value },
      applyMorphs: vi.fn(),
    } as unknown as AvatarTarget
    const first = {
      name: 'avatar:viseme',
      startAt: 100,
      elapsedMs: 0,
      action: { viseme: 'O', durationMs: 80 },
      eventId: 'first-o',
    }

    component.update({ state: {}, timeMs: 100, activeActions: [first], target })
    expect((timeline?.sample(100)?.value as Record<string, number>).viseme_O).toBe(0)
    expect((timeline?.sample(130)?.value as Record<string, number>).viseme_O).toBeCloseTo(0.3)
    expect((timeline?.sample(160)?.value as Record<string, number>).viseme_O).toBeCloseTo(0.6)
    const beforeSecond = (timeline?.sample(179)?.value as Record<string, number>).viseme_O

    component.update({
      state: {},
      timeMs: 180,
      activeActions: [first, {
        name: 'avatar:viseme',
        startAt: 180,
        elapsedMs: 0,
        action: { viseme: 'O', durationMs: 80 },
        eventId: 'second-o',
      }],
      target,
    })
    const atSecond = (timeline?.sample(180)?.value as Record<string, number>).viseme_O
    expect(Math.abs(atSecond - beforeSecond)).toBeLessThan(0.05)
    expect((timeline?.sample(240)?.value as Record<string, number>).viseme_O).toBeCloseTo(0.6)
    expect((timeline?.sample(280)?.value as Record<string, number>).viseme_O).toBeCloseTo(0.3)
    expect((timeline?.sample(320)?.value as Record<string, number>).viseme_O).toBe(0)
  })

  it('reconstructs overlapping visemes after expired cues and a backward Seek', () => {
    let timeline: AvatarTimeline | undefined
    const target = {
      setTimeline: (_slot: 'lip-sync', value: AvatarTimeline) => { timeline = value },
    } as unknown as AvatarTarget
    const component = new AvatarLipSyncComponent({
      services: emptyServices(),
      perso: { id: 'viseme', storyId: 'main', initial: {} },
    } as never)
    const cues = [
      { name: 'avatar:viseme', startAt: 100, elapsedMs: 0, action: { viseme: 'O', durationMs: 100 }, eventId: 'old' },
      { name: 'avatar:viseme', startAt: 1_000, elapsedMs: 0, action: { viseme: 'O', durationMs: 200 }, eventId: 'first' },
      { name: 'avatar:viseme', startAt: 1_100, elapsedMs: 0, action: { viseme: 'O', durationMs: 200 }, eventId: 'second' },
    ]
    component.update({ state: {}, timeMs: 1_100, activeActions: cues, target })
    const playback = timeline
    const at1150 = playback?.sample(1_150)?.value
    playback?.sample(1_300)
    playback?.sample(100)
    expect(playback?.sample(1_150)?.value).toEqual(at1150)
    expect((playback?.sample(500)?.value as Record<string, number>).viseme_O).toBe(0)
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
      from: 'camera',
    })
  })

  it('continues interrupted gaze changes from the value at each authored boundary', () => {
    let timeline: AvatarTimeline | undefined
    const target = {
      setTimeline: (_slot: 'gaze', value: AvatarTimeline) => { timeline = value },
      setGaze: vi.fn(),
      setGazeProfiles: vi.fn(),
      setGazeTarget: vi.fn(),
    } as unknown as AvatarTarget
    const component = new AvatarGazeComponent({
      services: emptyServices(),
      perso: { id: 'gaze', storyId: 'main', initial: { enabled: false, contact: 1 } },
    } as never)
    const first = {
      name: 'avatar:gaze:on', startAt: 1_000, elapsedMs: 0,
      action: { durationMs: 1_000, contact: 1 }, eventId: 'contact-on',
    }
    const second = {
      name: 'avatar:gaze:off', startAt: 1_500, elapsedMs: 0,
      action: { durationMs: 1_000 }, eventId: 'contact-off',
    }
    component.update({ state: {}, timeMs: 1_500, activeActions: [first, second], target })

    const contactAt = (timeMs: number): number => (
      (timeline?.sample(timeMs)?.value as { contact: number }).contact
    )
    expect(contactAt(1_499)).toBeCloseTo(0.5, 2)
    expect(contactAt(1_500)).toBeCloseTo(0.5, 2)
    expect(contactAt(2_000)).toBeCloseTo(0.25, 2)

    component.update({ state: {}, timeMs: 2_000, activeActions: [first, second], target })
    expect(contactAt(2_000)).toBeCloseTo(0.25, 2)
  })

  it('keeps the gaze transition in Play and reconstructs an interruption after Seek', () => {
    const setTimeline = vi.fn()
    const target = {
      setTimeline,
      setGazeProfiles: vi.fn(),
      setGazeMode: vi.fn(),
    } as unknown as AvatarTarget
    const component = new AvatarGazeComponent({
      services: emptyServices(),
      perso: { id: 'gaze', storyId: 'main', initial: { enabled: false, contact: 1 } },
    } as never)
    const on = {
      name: 'avatar:gaze:on', startAt: 100, elapsedMs: 0,
      action: { durationMs: 1_000 }, eventId: 'on',
    }
    const off = {
      name: 'avatar:gaze:off', startAt: 600, elapsedMs: 0,
      action: { durationMs: 1_000 }, eventId: 'off',
    }

    component.update({ state: {}, timeMs: 100, activeActions: [on], target })
    const first = setTimeline.mock.lastCall?.[1] as AvatarTimeline
    component.update({ state: {}, timeMs: 350, activeActions: [on], target })
    expect(setTimeline).toHaveBeenCalledTimes(1)
    const beforeInterruption = first.sample(600)?.value as { contact: number }
    component.update({ state: {}, timeMs: 600, activeActions: [on, off], target })
    const play = setTimeline.mock.lastCall?.[1] as AvatarTimeline
    expect((play.sample(600)?.value as { contact: number }).contact)
      .toBeCloseTo(beforeInterruption.contact, 10)
    const playAt800 = play.sample(800)?.value

    component.update({ state: {}, timeMs: 350, activeActions: [on], target })
    component.update({ state: {}, timeMs: 600, activeActions: [on, off], target })
    const replay = setTimeline.mock.lastCall?.[1] as AvatarTimeline
    expect(replay.sample(800)?.value).toEqual(playAt800)
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
    snapBaseline: ReturnType<typeof vi.fn>
  }
  playGesture: ReturnType<typeof vi.fn>
  setPose: ReturnType<typeof vi.fn>
  animate: ReturnType<typeof vi.fn>
  prepareSeek: ReturnType<typeof vi.fn>
  commitSeek: ReturnType<typeof vi.fn>
  applyAnimationAt: ReturnType<typeof vi.fn>
  setGazeTarget: ReturnType<typeof vi.fn>
} {
  const morph = { setFixed: vi.fn(), snapFixed: vi.fn(), setBaseline: vi.fn(), snapBaseline: vi.fn() }
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
