import { describe, expect, it, vi } from 'vitest'
import type { AvatarEngine } from '@codplay/avatar-engine'
import type { ComponentAnimation, ComponentServices } from 'codplay'
import {
  AVATAR_COMPONENTS,
  AvatarCoordinator,
  AvatarGestureComponent,
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
    ])
  })

  it('collects mood, lip-sync and gesture contributions before advancing the engine', () => {
    const engine = createEngineProbe()
    const coordinator = new AvatarCoordinator()
    coordinator.attachEngine(engine.value)
    coordinator.applyMood({ mouthSmile: 0.2 })
    coordinator.setGesture('wave_right', 41)
    coordinator.applyMorphs({ viseme_aa: 0.48, viseme_PP: 0 })
    coordinator.applyAt(0)
    coordinator.applyAt(200)

    expect(engine.morph.setBaseline).toHaveBeenCalledWith('mouthSmile', 0.2)
    expect(engine.playGesture).toHaveBeenCalledWith('wave_right', expect.objectContaining({ random: expect.any(Function) }))
    expect(engine.animate).toHaveBeenLastCalledWith(200)
    expect(engine.morph.snapFixed).toHaveBeenCalledWith('viseme_aa', 0.48)
    expect(engine.morph.snapFixed).toHaveBeenCalledWith('viseme_PP', 0)

    coordinator.applyAt(50)
    expect(engine.prepareSeek).toHaveBeenCalledTimes(1)
    expect(engine.commitSeek).toHaveBeenCalledWith(50)
    expect(engine.playGesture).toHaveBeenCalledTimes(2)
  })

  it('lets feature components write only through the Avatar target capability', () => {
    const coordinator = {
      applyMood: vi.fn(),
      applyMorphs: vi.fn(),
      setGesture: vi.fn(),
      setBlinkSchedule: vi.fn(),
    }
    const target: AvatarTarget = {
      applyMood: coordinator.applyMood,
      applyMorphs: coordinator.applyMorphs,
      setGesture: coordinator.setGesture,
      setBlinkSchedule: coordinator.setBlinkSchedule,
    }
    const animations: ComponentAnimation[] = []
    const moodAnimations: ComponentAnimation[] = []

    new AvatarMoodComponent({
      services: emptyServices(),
      perso: { id: 'mood', storyId: 'main', initial: {} },
    } as never).update({
      state: { mood: 'sad' },
      timeMs: 0,
      activeActions: [{
        name: 'avatar:mood',
        startAt: 0,
        elapsedMs: 0,
        action: { mood: 'sad', durationMs: 1_000 },
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
    } as never).update({ state: { gesture: 'thumbup_right' }, timeMs: 0, target })
    new AvatarIdleComponent({
      services: emptyServices(),
      perso: { id: 'idle', storyId: 'main', initial: { blinkSeed: 41 } },
    } as never).update({ state: {}, timeMs: 0, target })

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
    expect(coordinator.setGesture).toHaveBeenCalledWith('thumbup_right', expect.any(Number))
    expect(coordinator.setBlinkSchedule).toHaveBeenCalledWith(expect.any(Function))
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
  animate: ReturnType<typeof vi.fn>
  prepareSeek: ReturnType<typeof vi.fn>
  commitSeek: ReturnType<typeof vi.fn>
} {
  const morph = { snapFixed: vi.fn(), setBaseline: vi.fn() }
  const playGesture = vi.fn()
  const animate = vi.fn()
  const prepareSeek = vi.fn()
  const commitSeek = vi.fn()
  const value = {
    morphEngine: morph,
    playGesture,
    animate,
    prepareSeek,
    commitSeek,
    releaseGesture: vi.fn(),
    setBlinkScheduleFn: vi.fn(),
  } as unknown as AvatarEngine
  return { value, morph, playGesture, animate, prepareSeek, commitSeek }
}
