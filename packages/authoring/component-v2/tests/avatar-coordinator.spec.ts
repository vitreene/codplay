import { describe, expect, it, vi } from 'vitest'
import { Object3D } from 'three'
import type { AvatarEngine, AvatarGestureOverlay, AvatarTimeline, Rng } from '../src/avatar/avatar-types'
import { AvatarCoordinator } from '../src/avatar/runtime/avatar-coordinator'
import { GestureEngine } from '../src/avatar/gesture/gesture-engine'
import { AvatarPoseComposer } from '../src/avatar/pose/avatar-pose'
import { MorphEngine } from '../src/avatar/morph/morph-engine'
import { createAvatarEngine } from '../src/avatar/runtime/avatar-engine'
import { sampleThIdle } from '../src/avatar/idle/th-idle-animation'
import * as thIdleAnimation from '../src/avatar/idle/th-idle-animation'
import { AvatarGestureComponent } from '../src/avatar/components/avatar-gesture-component'
import { AvatarLipSyncComponent } from '../src/avatar/components/avatar-lip-sync-component'

describe('AvatarCoordinator pose ownership', () => {
  it('does not write a mood baseline through the mood selector', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(fixture.engine)
    fixture.morphEngine.snapBaseline.mockClear()

    coordinator.setMood('sad')

    expect(fixture.morphEngine.snapBaseline).not.toHaveBeenCalled()
  })

  it('samples spontaneous mood motion from the persona baseline in Play and Seek', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setIdleProfile({
      enabled: true,
      breathe: false,
      headMove: false,
      seed: 17,
      speaking: false,
      speakWithHands: false,
      poseChanges: false,
    })
    coordinator.setMoodHistory([{
      mood: 'happy',
      startAt: 0,
      baseline: { mouthSmile: 0.5, eyesLookDown: 0.1 },
    }])
    coordinator.attachEngine(fixture.engine)
    coordinator.applyAt(0)
    expect(lastAmbientValue(fixture.morphEngine.snapAmbient, 'mouthSmile')).toBeCloseTo(0.5)

    coordinator.applyAt(1_200)
    const playSmile = lastAmbientValue(fixture.morphEngine.snapAmbient, 'mouthSmile')
    expect(playSmile).toBeGreaterThanOrEqual(0.5)

    coordinator.applyAt(0)
    coordinator.applyAt(1_200)
    expect(lastAmbientValue(fixture.morphEngine.snapAmbient, 'mouthSmile')).toBeCloseTo(playSmile ?? 0)
  })

  it('samples only the active mood after its received handoff in Play', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setIdleProfile({
      enabled: true, breathe: false, headMove: false, poseChanges: false,
      seed: 17, speaking: false, speakWithHands: false,
    })
    coordinator.setMoodHistory([
      { mood: 'neutral', startAt: 0 },
      { mood: 'happy', startAt: 1_000 },
    ])
    coordinator.attachEngine(fixture.engine)
    coordinator.applyAt(1_500)
    const sample = vi.spyOn(thIdleAnimation, 'sampleThIdle')
    try {
      coordinator.applyAt(1_516)
      expect(sample).toHaveBeenCalledTimes(1)
      expect(sample.mock.calls[0]?.[0]).toBe('happy')
    } finally {
      sample.mockRestore()
    }
  })

  it('presents the authored rest pose on the first frame and after Seek to zero', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setIdleProfile({
      enabled: true,
      breathe: false,
      headMove: false,
      seed: 1,
      speaking: false,
      speakWithHands: false,
      poseChanges: false,
      pose: 'neutral',
    })
    coordinator.attachEngine(fixture.engine)
    coordinator.applyAt(0)

    expect(fixture.setPose).toHaveBeenCalledWith('neutral', 0, 0)
    const initialPose = fixture.shoulder.quaternion.clone()
    expect(initialPose.angleTo(new Object3D().quaternion)).toBeGreaterThan(0.1)

    coordinator.applyAt(1_000)
    coordinator.applyAt(0)
    expect(fixture.shoulder.quaternion.angleTo(initialPose)).toBeLessThan(1e-6)
  })

  it('reconstructs the same spontaneous pose after a direct Seek as continuous Play', () => {
    const moodHistory = [
      { mood: 'neutral' as const, startAt: 0 },
      { mood: 'happy' as const, startAt: 4_600 },
    ]
    const profile = {
      enabled: true,
      breathe: false,
      headMove: false,
      seed: 41,
      speaking: false,
      speakWithHands: false,
      poseChanges: true,
      pose: 'neutral',
    } as const
    const playback = createPoseFixture()
    const playbackCoordinator = new AvatarCoordinator()
    playbackCoordinator.setIdleProfile(profile)
    playbackCoordinator.attachEngine(playback.engine)
    for (let timeMs = 0; timeMs <= 6_000; timeMs += 16) {
      playbackCoordinator.setMoodHistory(timeMs < 4_600
        ? moodHistory.slice(0, 1)
        : moodHistory)
      playbackCoordinator.applyAt(timeMs)
    }

    const seeking = createPoseFixture()
    const seekCoordinator = new AvatarCoordinator()
    seekCoordinator.setIdleProfile(profile)
    seekCoordinator.setMoodHistory(moodHistory)
    seekCoordinator.attachEngine(seeking.engine)
    seekCoordinator.applyAt(6_000)

    expect(seeking.shoulder.quaternion.angleTo(playback.shoulder.quaternion)).toBeLessThan(1e-6)
  })

  it('keeps existing skeletal selections when a new mood arrives during Play', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setIdleProfile({
      enabled: true,
      breathe: false,
      headMove: false,
      poseChanges: true,
      seed: 41,
      pose: 'neutral',
    })
    coordinator.setMoodHistory([{ mood: 'neutral', startAt: 0 }])
    coordinator.setGestureHistory([{
      kind: 'gesture', name: 'handup', startAt: 1_000, seed: 31, mirror: false,
    }])
    coordinator.attachEngine(fixture.engine)
    coordinator.applyAt(0)
    coordinator.applyAt(1_000)
    coordinator.setMoodHistory([
      { mood: 'neutral', startAt: 0 },
      { mood: 'happy', startAt: 4_600 },
    ])
    coordinator.applyAt(4_600)
    coordinator.applyAt(4_616)

    expect(fixture.engine.resetSemantic).toHaveBeenCalledTimes(1)
    expect(fixture.engine.playGesture).toHaveBeenCalledTimes(1)
  })

  it('reapplies a repeated pose name when its spontaneous occurrence changes', () => {
    const seed = findRepeatedNeutralPoseSeed()
    const options = {
      enabled: true,
      breathe: false,
      headMove: false,
      seed,
      poseChanges: true,
    } as const
    const events = sampleThIdle('neutral', 30_000, options).poseHistory ?? []
    const repeated = events.find((event, index) => (
      events.slice(0, index).some((previous) => previous.name === event.name)
    ))
    expect(repeated).toBeDefined()
    if (repeated === undefined) return

    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setIdleProfile({ ...options, speaking: false, speakWithHands: false, pose: 'neutral' })
    coordinator.attachEngine(fixture.engine)
    const earlierSamePose = events.find((event) => event.name === repeated.name)!
    coordinator.applyAt(earlierSamePose.startAt)
    fixture.setPose.mockClear()
    coordinator.applyAt(repeated.startAt)

    expect(fixture.setPose).toHaveBeenCalledWith(repeated.name, repeated.startAt, undefined)
  })

  it('reconstructs a native gesture release at the same pose in Play and Seek', () => {
    const history = [
      { kind: 'gesture', name: 'handup', startAt: 1_000, seed: 31, mirror: false },
      { kind: 'gesture', name: null, startAt: 2_000, seed: 31, mirror: false },
    ] as const
    const playback = createPoseFixture()
    const playbackCoordinator = new AvatarCoordinator()
    playbackCoordinator.attachEngine(playback.engine)
    playbackCoordinator.setGestureHistory(history)
    playbackCoordinator.applyAt(0)
    playbackCoordinator.applyGestureMotion(gestureFrame('handup'), 31, 1_000, 1_000)
    playbackCoordinator.applyAt(1_000)
    playbackCoordinator.applyGestureMotion({ ...gestureFrame(null), released: true }, 31, 2_000, 2_000)
    playbackCoordinator.applyAt(2_000)
    playbackCoordinator.applyAt(2_100)

    const seeking = createPoseFixture()
    const seekCoordinator = new AvatarCoordinator()
    seekCoordinator.attachEngine(seeking.engine)
    seekCoordinator.setGestureHistory(history)
    seekCoordinator.applyAt(0)
    seekCoordinator.applyGestureMotion({ ...gestureFrame(null), released: true }, 31, 2_000, 2_000)
    seekCoordinator.applyAt(2_100)

    expect(seeking.shoulder.quaternion.angleTo(playback.shoulder.quaternion)).toBeLessThan(1e-6)
  })

  it('samples the blink schedule from the selected mood occurrence in Play and Seek', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    const schedule = vi.fn(({ elapsed }: { elapsed: number }) => ({ eyesClosed: elapsed / 1_000 }))
    coordinator.setBlinkSchedule(schedule)
    coordinator.attachEngine(fixture.engine)
    coordinator.setMood('happy', 4_600)
    coordinator.applyAt(4_750)

    const installed = vi.mocked(fixture.engine.setBlinkScheduleFn).mock.lastCall?.[0]
    expect(installed?.({ elapsed: 4_750, mood: 'happy' })).toEqual({ eyesClosed: 0.15 })
    coordinator.applyAt(4_600)
    const replayed = vi.mocked(fixture.engine.setBlinkScheduleFn).mock.lastCall?.[0]
    expect(replayed?.({ elapsed: 4_600, mood: 'happy' })).toEqual({ eyesClosed: 0 })

    coordinator.setMood('happy', 8_000)
    coordinator.applyAt(8_150)
    const repeated = vi.mocked(fixture.engine.setBlinkScheduleFn).mock.lastCall?.[0]
    expect(repeated?.({ elapsed: 8_150, mood: 'happy' })).toEqual({ eyesClosed: 0.15 })
  })

  it('restarts a repeated mood template from the value already presented', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setIdleProfile({
      enabled: true,
      breathe: true,
      headMove: true,
      seed: 41,
      speaking: false,
      speakWithHands: false,
      poseChanges: false,
      pose: 'neutral',
    })
    coordinator.attachEngine(fixture.engine)
    coordinator.setMood('happy', 4_600)
    coordinator.applyAt(7_999)
    const before = lastAmbientValue(fixture.morphEngine.snapAmbient, 'bodyRotateY')
    coordinator.setMood('happy', 8_000)
    coordinator.applyAt(8_000)
    const after = lastAmbientValue(fixture.morphEngine.snapAmbient, 'bodyRotateY')

    expect(before).toBeDefined()
    expect(after).toBeDefined()
    expect(Math.abs((after ?? 0) - (before ?? 0))).toBeLessThan(0.005)
  })

  it('lets an active TH head task finish across a mood change in Play and Seek', () => {
    const profile = {
      enabled: true,
      breathe: false,
      headMove: true,
      seed: 27,
      speaking: false,
      speakWithHands: false,
      poseChanges: false,
      pose: 'neutral',
    } as const
    const playback = createPoseFixture()
    const playbackCoordinator = new AvatarCoordinator()
    playbackCoordinator.setIdleProfile(profile)
    playbackCoordinator.attachEngine(playback.engine)
    playbackCoordinator.applyAt(4_999)
    const before = lastAmbientValue(playback.morphEngine.snapAmbient, 'headRotateX')
    expect(Math.abs(before ?? 0)).toBeGreaterThan(0.05)

    playbackCoordinator.setMood('happy', 5_000)
    playbackCoordinator.applyAt(5_000)
    const atChange = lastAmbientValue(playback.morphEngine.snapAmbient, 'headRotateX')
    expect(Math.abs((atChange ?? 0) - (before ?? 0))).toBeLessThan(0.005)
    playbackCoordinator.applyAt(5_500)

    const seeking = createPoseFixture()
    const seekCoordinator = new AvatarCoordinator()
    seekCoordinator.setIdleProfile(profile)
    seekCoordinator.setMoodHistory([
      { mood: 'neutral', startAt: 0 },
      { mood: 'happy', startAt: 5_000 },
    ])
    seekCoordinator.attachEngine(seeking.engine)
    seekCoordinator.applyAt(5_500)

    for (const name of ['headRotateX', 'bodyRotateY', 'eyesLookDown']) {
      expect(lastAmbientValue(seeking.morphEngine.snapAmbient, name)).toBeCloseTo(
        lastAmbientValue(playback.morphEngine.snapAmbient, name) ?? 0,
        8,
      )
    }
  })

  it('starts a new mood head task from a head task inherited from an earlier mood', () => {
    const history = [
      { mood: 'neutral' as const, startAt: 0 },
      { mood: 'happy' as const, startAt: 5_000 },
      { mood: 'neutral' as const, startAt: 9_000 },
    ]
    const profile = {
      enabled: true,
      breathe: true,
      headMove: true,
      seed: 21,
      speaking: false,
      speakWithHands: false,
      poseChanges: false,
      pose: 'neutral',
    } as const
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setIdleProfile(profile)
    coordinator.setMoodHistory(history)
    coordinator.attachEngine(fixture.engine)
    coordinator.applyAt(12_623)
    const before = lastAmbientValue(fixture.morphEngine.snapAmbient, 'headRotateY')
    coordinator.applyAt(12_624)
    const after = lastAmbientValue(fixture.morphEngine.snapAmbient, 'headRotateY')

    expect(Math.abs(before ?? 0)).toBeGreaterThan(0.05)
    expect(Math.abs((after ?? 0) - (before ?? 0))).toBeLessThan(0.005)

    const seeking = createPoseFixture()
    const seekCoordinator = new AvatarCoordinator()
    seekCoordinator.setIdleProfile(profile)
    seekCoordinator.setMoodHistory(history)
    seekCoordinator.attachEngine(seeking.engine)
    seekCoordinator.applyAt(12_624)
    expect(lastAmbientValue(seeking.morphEngine.snapAmbient, 'headRotateY')).toBeCloseTo(after ?? 0, 8)
  })

  it('passes absolute CodPlay time to the native blink schedule in Play', () => {
    const engine = createAvatarEngine()
    const schedule = vi.fn(() => ({ eyesClosed: 0 }))
    engine.setBlinkScheduleFn(schedule)
    engine.animate(16, 4_616)
    expect(schedule).toHaveBeenCalledWith({ elapsed: 4_616, mood: 'neutral' })
  })

  it('clears an obsolete mood baseline when seeking before its action', () => {
    const fixture = createPoseFixture()
    const morphEngine = new MorphEngine()
    const smileInfluence = [0]
    morphEngine.registerBlendMorph('mouthSmileLeft', { influences: smileInfluence, index: 0 })
    Object.assign(fixture.engine, {
      morphEngine,
      animate: (deltaMs: number) => morphEngine.update(deltaMs),
      prepareSeek: () => morphEngine.resetToBaselines(),
      commitSeek: () => morphEngine.snapAll(),
    })
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(fixture.engine)

    coordinator.applyMood({ mouthSmile: 0.2 })
    coordinator.applyAt(1_000)
    expect(morphEngine.getBaseline('mouthSmileLeft')).toBeCloseTo(0.16)
    expect(smileInfluence[0]).toBeCloseTo(0.16)

    coordinator.applyMood({ eyesLookDown: 0.1 })
    coordinator.applyAt(100)
    expect(morphEngine.getBaseline('mouthSmileLeft')).toBe(0)
    expect(smileInfluence[0]).toBe(0)
  })

  it('keeps a happy smile while a viseme closes', () => {
    const fixture = createPoseFixture()
    const morphEngine = new MorphEngine()
    const smileInfluence = [0]
    const visemeInfluence = [0]
    morphEngine.registerBlendMorph('mouthSmileLeft', { influences: smileInfluence, index: 0 })
    morphEngine.registerBlendMorph('viseme_O', { influences: visemeInfluence, index: 0 })
    Object.assign(fixture.engine, {
      morphEngine,
      animate: (deltaMs: number) => morphEngine.update(deltaMs),
      prepareSeek: () => morphEngine.resetToBaselines(),
      commitSeek: () => morphEngine.snapAll(),
    })
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(fixture.engine)
    coordinator.applyMood({ mouthSmile: 0.2 })
    coordinator.applyMorphs({ viseme_O: 0.6 })
    coordinator.applyAt(100)
    coordinator.applyMorphs({ viseme_O: 0 })
    coordinator.applyAt(200)

    expect(visemeInfluence[0]).toBe(0)
    expect(smileInfluence[0]).toBeCloseTo(0.16)
  })

  it('lets lip-sync close a gesturing mouth while retaining its smile in Play and Seek', () => {
    const fixture = createPoseFixture()
    const morphEngine = new MorphEngine()
    const jaw = [0]
    const mouth = [0]
    const smile = [0]
    const viseme = [0]
    morphEngine.registerBlendMorph('jawOpen', { influences: jaw, index: 0 })
    morphEngine.registerBlendMorph('mouthOpen', { influences: mouth, index: 0 })
    morphEngine.registerBlendMorph('mouthSmileLeft', { influences: smile, index: 0 })
    morphEngine.registerBlendMorph('viseme_O', { influences: viseme, index: 0 })
    Object.assign(fixture.engine, {
      morphEngine,
      animate: (deltaMs: number) => morphEngine.update(deltaMs),
      prepareSeek: () => morphEngine.resetToBaselines(),
      commitSeek: () => morphEngine.snapAll(),
    })
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(fixture.engine)
    coordinator.applyGestureMotion({
      ...gestureFrame(null),
      morphs: { jawOpen: 0.2, mouthOpen: 0.3, mouthSmile: 0.5 },
    })
    const lipSync = new AvatarLipSyncComponent({
      services: { declare: () => undefined, get: () => undefined, apply: () => undefined },
      perso: { id: 'viseme', storyId: 'main', initial: { viseme: null } },
    } as never)
    const actions = [
      { name: 'avatar:viseme', startAt: 100, action: { viseme: 'O', durationMs: 100 }, eventId: 'open' },
      { name: 'avatar:viseme', startAt: 200, action: { viseme: null }, eventId: 'silence' },
    ]

    /** Presents one authored date through the lip-sync track and common morph composition. */
    function present(timeMs: number) {
      lipSync.update({
        state: {}, timeMs,
        activeActions: actions.filter((action) => action.startAt <= timeMs).map((action) => ({
          ...action, elapsedMs: timeMs - action.startAt,
        })),
        target: coordinator,
      } as never)
      coordinator.applyAt(timeMs)
      return { jaw: jaw[0], mouth: mouth[0], smile: smile[0], viseme: viseme[0] }
    }

    expect(present(0)).toMatchObject({ jaw: 0, mouth: 0, smile: 0.4, viseme: 0 })
    const speaking = present(160)
    expect(speaking.jaw).toBe(0)
    expect(speaking.mouth).toBe(0)
    expect(speaking.smile).toBeCloseTo(0.4)
    expect(speaking.viseme).toBeGreaterThan(0)
    expect(present(300)).toMatchObject({ jaw: 0, mouth: 0, smile: 0.4, viseme: 0 })
    expect(present(160)).toEqual(speaking)
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

  it('applies a received gesture once in Play and reconstructs the same pose after Seek', () => {
    const history = [
      { kind: 'gesture', name: 'handup', startAt: 1_000, seed: 31, mirror: false },
    ] as const
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(fixture.engine)
    coordinator.setGestureHistory(history)
    coordinator.applyAt(0)
    coordinator.applyAt(1_000)
    coordinator.applyAt(1_016)
    const playPose = fixture.shoulder.quaternion.clone()

    expect(fixture.engine.playGesture).toHaveBeenCalledTimes(1)
    expect(fixture.engine.resetSemantic).toHaveBeenCalledTimes(1)

    coordinator.applyAt(2_000)
    coordinator.applyAt(1_016)

    expect(fixture.engine.playGesture).toHaveBeenCalledTimes(2)
    expect(fixture.shoulder.quaternion.angleTo(playPose)).toBeLessThan(1e-6)
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

  it('presents sampled speech and gesture values on the same absolute frame', () => {
    const fixture = createPoseFixture()
    const morphEngine = new MorphEngine()
    const mouthInfluence = [0]
    const headInfluence = [0]
    morphEngine.registerBlendMorph('viseme_O', { influences: mouthInfluence, index: 0 })
    morphEngine.registerBlendMorph('headRotateX', { influences: headInfluence, index: 0 })
    Object.assign(fixture.engine, {
      morphEngine,
      animate: (deltaMs: number) => morphEngine.update(deltaMs),
      prepareSeek: () => morphEngine.resetToBaselines(),
      commitSeek: () => morphEngine.snapAll(),
    })
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(fixture.engine)

    coordinator.applyMorphs({ viseme_O: 0.6 })
    coordinator.applyAt(0)
    expect(mouthInfluence[0]).toBe(0.6)

    coordinator.applyGestureMotion({ ...gestureFrame(null), morphs: { headRotateX: 0.5 } })
    coordinator.applyMorphs({ viseme_O: 0.2 })
    coordinator.applyAt(16)
    expect(mouthInfluence[0]).toBe(0.2)
    expect(headInfluence[0]).toBe(0.5)

    coordinator.applyMorphs({})
    coordinator.applyAt(32)
    expect(mouthInfluence[0]).toBe(0)

    coordinator.applyMorphs({ viseme_O: 0.4 })
    coordinator.applyAt(8)
    expect(mouthInfluence[0]).toBe(0.4)
  })

  it('lets speech override a shared gesture morph and restores its sampled value', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(fixture.engine)
    coordinator.applyGestureMotion({ ...gestureFrame(null), morphs: { viseme_O: 0.2 } })
    coordinator.applyMorphs({ viseme_O: 0.6 })

    coordinator.applyAt(0)
    expect(fixture.morphEngine.snapFixed).toHaveBeenCalledWith('viseme_O', 0.6)
    expect(fixture.morphEngine.setFixed).not.toHaveBeenCalledWith('viseme_O', 0.2)

    coordinator.applyMorphs({ viseme_O: 0.2 })
    coordinator.applyAt(8)
    coordinator.applyMorphs({})
    coordinator.applyAt(16)
    expect(fixture.morphEngine.snapFixed).toHaveBeenCalledWith('viseme_O', 0.2)
  })

  it('blends a releasing gesture toward the sampled ambient head pose', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setIdleProfile({
      enabled: true,
      breathe: false,
      headMove: true,
      seed: 27,
      speaking: false,
      speakWithHands: false,
      poseChanges: false,
      pose: 'neutral',
    })
    coordinator.attachEngine(fixture.engine)
    coordinator.applyGestureMotion({
      ...gestureFrame(null),
      morphs: { headRotateX: 0.2 },
      morphWeight: 0.5,
    })
    coordinator.applyAt(4_999)

    const ambient = lastAmbientValue(fixture.morphEngine.snapAmbient, 'headRotateX') ?? 0
    expect(Math.abs(ambient)).toBeGreaterThan(0.05)
    expect(fixture.morphEngine.snapFixed).toHaveBeenCalledWith(
      'headRotateX',
      0.2 + ambient * 0.5,
    )

    coordinator.applyGestureMotion({ ...gestureFrame(null), released: true })
    coordinator.applyAt(5_249)
    expect(fixture.morphEngine.snapFixed).toHaveBeenLastCalledWith('headRotateX', null)
  })

  it('keeps the current ambient head value when the first gesture takes ownership', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    const profile = {
      enabled: true,
      breathe: false,
      headMove: true,
      seed: 27,
      speaking: false,
      speakWithHands: false,
      poseChanges: false,
      pose: 'neutral',
    } as const
    coordinator.setIdleProfile(profile)
    coordinator.attachEngine(fixture.engine)
    const gesture = new AvatarGestureComponent({
      services: { declare: () => undefined, get: () => undefined, apply: () => undefined },
      perso: { id: 'gesture', storyId: 'main', initial: { gesture: null } },
    } as never)
    const startAt = 5_000
    const occurrence = {
      name: 'avatar:gesture:nod_yes', startAt, elapsedMs: 0,
      action: { durationMs: 1_200 }, eventId: 'first-nod',
    }

    gesture.update({ state: {}, timeMs: startAt - 1, activeActions: [], target: coordinator })
    coordinator.applyAt(startAt - 1)
    gesture.update({ state: {}, timeMs: startAt, activeActions: [occurrence], target: coordinator })
    coordinator.applyAt(startAt)

    const ambient = sampleThIdle('neutral', startAt, profile).morphs.headRotateX ?? 0
    expect(Math.abs(ambient)).toBeGreaterThan(0.05)
    expect(lastAmbientValue(fixture.morphEngine.snapFixed, 'headRotateX')).toBeCloseTo(ambient, 6)

    gesture.update({ state: {}, timeMs: startAt + 125, activeActions: [occurrence], target: coordinator })
    coordinator.applyAt(startAt + 125)
    const played = lastAmbientValue(fixture.morphEngine.snapFixed, 'headRotateX')
    expect(played).toBeDefined()

    gesture.update({ state: {}, timeMs: startAt - 1, activeActions: [], target: coordinator })
    coordinator.applyAt(startAt - 1)
    gesture.update({ state: {}, timeMs: startAt + 125, activeActions: [occurrence], target: coordinator })
    coordinator.applyAt(startAt + 125)
    expect(lastAmbientValue(fixture.morphEngine.snapFixed, 'headRotateX')).toBeCloseTo(played ?? 0, 8)
  })

  it('keeps authored camera contact through TH idle gaps and gesture markers', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    const profile = {
      enabled: true,
      breathe: false,
      headMove: true,
      seed: 27,
      speaking: false,
      speakWithHands: false,
      poseChanges: false,
      pose: 'neutral',
    } as const
    expect(sampleThIdle('neutral', 5_000, profile).eyeContact ?? 0).toBe(0)
    coordinator.setIdleProfile(profile)
    coordinator.setGazeProfiles({ idle: 0, speaking: 0, listening: 0 })
    coordinator.attachEngine(fixture.engine)
    coordinator.setGaze(true, 0.8)
    coordinator.applyGestureMotion({ ...gestureFrame(null), eyeContact: 0 })
    coordinator.applyAt(5_000)
    expect(fixture.engine.setGazeContact).toHaveBeenLastCalledWith(0.8)
    expect(fixture.engine.setGazeEnabled).toHaveBeenLastCalledWith(true)

    coordinator.setGaze(false, 0)
    coordinator.applyAt(5_100)
    expect(fixture.engine.setGazeContact).toHaveBeenLastCalledWith(0)
    expect(fixture.engine.setGazeEnabled).toHaveBeenLastCalledWith(false)

    coordinator.setGaze(true, 0.8)
    coordinator.applyAt(5_000)
    expect(fixture.engine.setGazeContact).toHaveBeenLastCalledWith(0.8)
    expect(fixture.engine.setGazeEnabled).toHaveBeenLastCalledWith(true)
  })

  it('keeps gaze head strength owned by the gaze component during gestures', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setGaze(true, 0.8, 0.7)
    coordinator.setGazeTarget('camera')
    coordinator.attachEngine(fixture.engine)
    coordinator.applyGestureMotion({
      ...gestureFrame(null), headMove: 0,
    }, 17, 1_000, 1_000)
    coordinator.applyAt(1_000)

    expect(fixture.engine.setGazeContact).toHaveBeenLastCalledWith(0.8)
    expect(fixture.engine.setGazeHeadMove).toHaveBeenLastCalledWith(0.7)
    expect(fixture.engine.setGazeTarget).toHaveBeenLastCalledWith('camera', undefined)
  })

  it('keeps camera head tracking when mood disables spontaneous head movement', () => {
    const fixture = createPoseFixture()
    const coordinator = new AvatarCoordinator()
    coordinator.setIdleProfile({
      enabled: true,
      breathe: false,
      headMove: false,
      seed: 27,
      speaking: false,
      speakWithHands: false,
      poseChanges: false,
      pose: 'neutral',
    })
    coordinator.setGazeProfiles({ idleHeadMove: 0 })
    coordinator.attachEngine(fixture.engine)
    coordinator.setGaze(true, 1)
    coordinator.applyAt(630)

    expect(fixture.engine.setGazeHeadMove).toHaveBeenLastCalledWith(1)

    coordinator.setGaze(true, 1, 0.3)
    coordinator.applyAt(650)
    expect(fixture.engine.setGazeHeadMove).toHaveBeenLastCalledWith(0.3)
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

/** Reads the most recent ambient command for one morph in an engine probe. */
function lastAmbientValue(snapAmbient: ReturnType<typeof vi.fn>, name: string): number | undefined {
  const call = [...snapAmbient.mock.calls].reverse().find(([morph]) => morph === name)
  return call?.[1] as number | undefined
}

/** Finds deterministic TH pose choices that repeat a previously used name. */
function findRepeatedNeutralPoseSeed(): number {
  for (let seed = 0; seed < 100; seed += 1) {
    const events = sampleThIdle('neutral', 30_000, {
      enabled: true,
      breathe: false,
      headMove: false,
      seed,
      poseChanges: true,
    }).poseHistory ?? []
    if (events.some((event, index) => (
      events.slice(0, index).some((previous) => previous.name === event.name)
    ))) return seed
  }
  throw new Error('Expected deterministic neutral pose choices to repeat.')
}

/** Creates a minimal real pose pipeline without loading a demo asset. */
function createPoseFixture(): {
  engine: AvatarEngine
  morphEngine: {
    setFixed: ReturnType<typeof vi.fn>
    snapFixed: ReturnType<typeof vi.fn>
    setBaseline: ReturnType<typeof vi.fn>
    snapBaseline: ReturnType<typeof vi.fn>
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
    snapBaseline: vi.fn(),
    snapAmbient: vi.fn(),
  }
  const setPose = vi.fn((name: string, startAt = 0, durationMs?: number) => semantic.setBodyPose(name, startAt, durationMs))
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
    resetSemantic: vi.fn(() => semantic.reset()),
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
