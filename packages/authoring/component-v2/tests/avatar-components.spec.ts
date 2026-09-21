import { describe, expect, it, vi } from 'vitest'
import type { AvatarEngine } from '../src/avatar/runtime/avatar-engine'
import type { ComponentAnimation, ComponentServices } from 'codplay'
import { MorphEngine } from '../src/avatar/morph/morph-engine'
import { BreathAnimator } from '../src/avatar/idle/breath-animator'
import {
  AVATAR_COMPONENTS,
  AvatarCoordinator,
  AvatarGestureComponent,
  AvatarGazeComponent,
  AvatarIdleComponent,
  AvatarLipSyncComponent,
  AvatarMoodComponent,
  createAvatarBlinkSchedule,
  createAvatarBreathTrigger,
  createAvatarHeadDrift,
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
    const drift = createAvatarHeadDrift()
    coordinator.setHeadDrift(drift)
    coordinator.setGesture('handup', 41)
    coordinator.applyMorphs({ viseme_aa: 0.48, viseme_PP: 0 })
    coordinator.applyAt(0)
    coordinator.applyAt(200)

    expect(engine.morph.setBaseline).toHaveBeenCalledWith('mouthSmile', 0.2)
    expect(engine.setPose).toHaveBeenCalledWith('straight')
    expect(engine.setHeadDriftFn).toHaveBeenCalledWith(drift)
    expect(engine.playGesture).toHaveBeenCalledWith(
      'handup',
      expect.objectContaining({ random: expect.any(Function) }),
      false,
    )
    expect(engine.animate).toHaveBeenLastCalledWith(200)
    expect(engine.morph.snapFixed).toHaveBeenCalledWith('viseme_aa', 0.48)
    expect(engine.morph.snapFixed).toHaveBeenCalledWith('viseme_PP', 0)

    coordinator.applyAt(50)
    expect(engine.prepareSeek).toHaveBeenCalledTimes(1)
    expect(engine.commitSeek).toHaveBeenCalledWith(50)
    expect(engine.playGesture).toHaveBeenCalledTimes(2)
  })

  it('snaps the idle pose before the first presentation', () => {
    const engine = createEngineProbe()
    const coordinator = new AvatarCoordinator()
    coordinator.setPose('straight')
    coordinator.attachEngine(engine.value)

    expect(engine.setPose).toHaveBeenCalledWith('straight')
    expect(engine.commitSeek).toHaveBeenCalledWith(0)
  })

  it('snaps a gesture selected by a feature after a backward seek', () => {
    const engine = createEngineProbe()
    const coordinator = new AvatarCoordinator()
    coordinator.setGesture('handup', 11)
    coordinator.attachEngine(engine.value)

    coordinator.applyAt(1_200)
    coordinator.applyAt(700)
    coordinator.setGesture(null)
    coordinator.setGesture('thumbup', 29)

    expect(engine.prepareSeek).toHaveBeenCalledTimes(1)
    expect(engine.commitSeek).toHaveBeenCalledWith(700)
    expect(engine.playGesture).toHaveBeenLastCalledWith(
      'thumbup',
      expect.objectContaining({ random: expect.any(Function) }),
      false,
    )
    expect(engine.snapGesture).toHaveBeenCalledTimes(1)
  })

  it('lets feature components write only through the Avatar target capability', () => {
    const coordinator = {
      applyMood: vi.fn(),
      applyMorphs: vi.fn(),
      applyGestureMotion: vi.fn(),
      setGesture: vi.fn(),
      setPose: vi.fn(),
      setBlinkSchedule: vi.fn(),
      setBreathTrigger: vi.fn(),
      setHeadDrift: vi.fn(),
      setGaze: vi.fn(),
      getAnimation: vi.fn(),
      setAnimation: vi.fn(),
      releaseAnimation: vi.fn(),
    }
    const target: AvatarTarget = {
      applyMood: coordinator.applyMood,
      applyMorphs: coordinator.applyMorphs,
      applyGestureMotion: coordinator.applyGestureMotion,
      setGesture: coordinator.setGesture,
      setPose: coordinator.setPose,
      setBlinkSchedule: coordinator.setBlinkSchedule,
      setBreathTrigger: coordinator.setBreathTrigger,
      setHeadDrift: coordinator.setHeadDrift,
      setGaze: coordinator.setGaze,
      getAnimation: coordinator.getAnimation,
      setAnimation: coordinator.setAnimation,
      releaseAnimation: coordinator.releaseAnimation,
    }
    const animations: ComponentAnimation[] = []
    const moodAnimations: ComponentAnimation[] = []
    const gazeAnimations: ComponentAnimation[] = []

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
      registerAnimation: (animation) => moodAnimations.push(animation),
    })
    moodAnimations[0]?.sample(500)?.apply()
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
      registerAnimation: (animation) => animations.push(animation),
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
      registerAnimation: (animation) => gazeAnimations.push(animation),
    })

    expect(gazeAnimations).toHaveLength(1)
    gazeAnimations[0]?.sample(500)?.apply()
    expect(coordinator.setGaze).toHaveBeenLastCalledWith(true, expect.closeTo(0.6125, 5))
    gazeAnimations[0]?.sample(1_000)?.apply()

    gazeAnimations.length = 0
    gaze.update({
      state: { enabled: false, contact: 0.7, durationMs: 1_000 },
      timeMs: 1_000,
      activeActions: [{
        name: 'avatar:gaze:off',
        startAt: 1_000,
        elapsedMs: 0,
        action: { durationMs: 1_000 },
        eventId: 'gaze-2',
      }],
      target,
      registerAnimation: (animation) => gazeAnimations.push(animation),
    })
    gazeAnimations[0]?.sample(1_500)?.apply()
    expect(coordinator.setGaze).toHaveBeenLastCalledWith(true, expect.closeTo(0.0875, 5))
    gazeAnimations[0]?.sample(2_000)?.apply()

    const lipSyncAnimation = animations[0]
    expect(lipSyncAnimation).toBeDefined()
    lipSyncAnimation?.sample(100)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBe(0)
    lipSyncAnimation?.sample(150)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBe(0.3)
    lipSyncAnimation?.sample(200)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBe(0.6)

    animations.length = 0
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
      registerAnimation: (animation) => animations.push(animation),
    })
    const releaseAnimation = animations[0]
    expect(releaseAnimation).toBeDefined()
    releaseAnimation?.sample(250)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBe(0.3)
    releaseAnimation?.sample(300)?.apply()
    expect(lastMorphValue(coordinator.applyMorphs, 'viseme_O')).toBe(0)

    expect(coordinator.applyMood).toHaveBeenCalled()
    expect(lastMorphValue(coordinator.applyMood, 'mouthFrownLeft')).toBeCloseTo(0.4, 5)
    expect(coordinator.setGesture).toHaveBeenCalledWith('thumbup', expect.any(Number))
    expect(coordinator.setPose).toHaveBeenCalledWith('straight')
    expect(coordinator.setBlinkSchedule).toHaveBeenCalledWith(expect.any(Function))
    expect(coordinator.setBreathTrigger).toHaveBeenCalledWith(expect.any(Function))
    expect(coordinator.setHeadDrift).toHaveBeenCalledWith(expect.any(Function))
    expect(coordinator.setGaze).toHaveBeenCalledWith(true, 0.7)
    expect(coordinator.setGaze).toHaveBeenLastCalledWith(false, 0)
    expect(coordinator.applyMorphs).toHaveBeenCalled()
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

  it('produces deterministic idle drift from absolute time', () => {
    const drift = createAvatarHeadDrift()
    const replayed = createAvatarHeadDrift()

    expect(drift({ elapsed: 0 })).toEqual({
      bodyRotateX: 0,
      bodyRotateY: 0,
      bodyRotateZ: 0,
      headRotateX: 0,
      headRotateY: 0,
    })
    expect(replayed({ elapsed: 3_000 })).toEqual(drift({ elapsed: 3_000 }))
    expect(Math.abs(drift({ elapsed: 3_000 })?.bodyRotateY ?? 0)).toBeLessThan(0.1)
  })

  it('produces one deterministic breath trigger per epoch and replays after a seek', () => {
    const trigger = createAvatarBreathTrigger(41)
    const replayed = createAvatarBreathTrigger(41)
    const samples = [0, 500, 1_000, 1_500, 2_000, 2_500, 3_000, 3_500]
    const results = samples.map((elapsed) => trigger({ elapsed }))
    const firstTriggerIndex = results.findIndex((value) => value?.triggerBreath)

    expect(results.filter((value) => value?.triggerBreath)).toHaveLength(1)
    expect(firstTriggerIndex).toBeGreaterThanOrEqual(0)
    const triggerTime = samples[firstTriggerIndex]!
    expect(replayed({ elapsed: triggerTime })).toEqual(results[firstTriggerIndex])
  })

  it('drives the torso as well as the face during an idle breath', () => {
    const morphs = new MorphEngine()
    const boneValues = new Map<string, number>()
    morphs.registerBoneMorphs((name, value) => boneValues.set(name, value))
    const mouthInfluences = [0]
    morphs.registerBlendMorph('mouthShrugLower', { influences: mouthInfluences, index: 0 })

    const breath = new BreathAnimator(morphs)
    breath.trigger()
    breath.update(500)

    expect(boneValues.get('chestInhale')).toBeGreaterThan(0)
    expect(mouthInfluences[0]).toBeGreaterThan(0)

    breath.update(1_000)
    expect(boneValues.get('chestInhale')).toBe(0)
    expect(mouthInfluences[0]).toBe(0)
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

/** Builds an engine-shaped probe without loading a model or a demo asset. */
function createEngineProbe(): {
  value: AvatarEngine
  morph: { snapFixed: ReturnType<typeof vi.fn>; setBaseline: ReturnType<typeof vi.fn> }
  playGesture: ReturnType<typeof vi.fn>
  setPose: ReturnType<typeof vi.fn>
  setHeadDriftFn: ReturnType<typeof vi.fn>
  setBreathTriggerFn: ReturnType<typeof vi.fn>
  animate: ReturnType<typeof vi.fn>
  prepareSeek: ReturnType<typeof vi.fn>
  commitSeek: ReturnType<typeof vi.fn>
  snapGesture: ReturnType<typeof vi.fn>
  applyAnimationAt: ReturnType<typeof vi.fn>
} {
  const morph = { snapFixed: vi.fn(), setBaseline: vi.fn() }
  const playGesture = vi.fn()
  const setPose = vi.fn()
  const setHeadDriftFn = vi.fn()
  const setBreathTriggerFn = vi.fn()
  const animate = vi.fn()
  const prepareSeek = vi.fn()
  const commitSeek = vi.fn()
  const snapGesture = vi.fn()
  const applyAnimationAt = vi.fn()
  const value = {
    morphEngine: morph,
    playGesture,
    setPose,
    setHeadDriftFn,
    setBreathTriggerFn,
    animate,
    prepareSeek,
    commitSeek,
    snapGesture,
    applyAnimationAt,
    releaseGesture: vi.fn(),
    setBlinkScheduleFn: vi.fn(),
    setGazeCamera: vi.fn(),
    setGazeContact: vi.fn(),
    setGazeEnabled: vi.fn(),
    setGestureOverlay: vi.fn(),
  } as unknown as AvatarEngine
  return {
    value,
    morph,
    playGesture,
    setPose,
    setHeadDriftFn,
    setBreathTriggerFn,
    animate,
    prepareSeek,
    commitSeek,
    snapGesture,
    applyAnimationAt,
  }
}
