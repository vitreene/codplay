import { describe, expect, it, vi } from 'vitest'
import type { ComponentAnimation, ComponentServices } from 'codplay'
import {
  AVATAR_GESTURE_MOTION_NAMES,
  AVATAR_MOOD_MOTION_NAMES,
  AvatarGestureComponent,
  AvatarMotionComponent,
} from '../src'
import {
  AVATAR_MOTION_CATALOG,
  getAvatarActionMotion,
  getAvatarMoodBaseline,
} from '../src/avatar/gesture/motion-catalog'

function emptyServices(): ComponentServices {
  return {
    declare: () => undefined,
    get: () => { throw new Error('No service is declared in this test.') },
    apply: () => undefined,
  }
}

describe('Avatar semantic motion catalogue', () => {
  it('keeps action and mood names on separate component tracks', () => {
    expect(AVATAR_GESTURE_MOTION_NAMES).toHaveLength(78)
    expect(AVATAR_GESTURE_MOTION_NAMES).toContain('wave_right')
    expect(AVATAR_GESTURE_MOTION_NAMES).toContain('thinking_face')
    expect(AVATAR_MOOD_MOTION_NAMES).toHaveLength(19)
    expect(AVATAR_MOOD_MOTION_NAMES).toContain('thinking')
    expect(AVATAR_MOOD_MOTION_NAMES).not.toContain('surprise')
    expect(AVATAR_MOTION_CATALOG.wave_right?.track).toBe('action')
    expect(AVATAR_MOTION_CATALOG.thinking?.track).toBe('mood')
  })

  it('samples a semantic action, native gesture marker and overlay deterministically', () => {
    const first = getAvatarActionMotion('wave_right', 41)
    const replayed = getAvatarActionMotion('wave_right', 41)

    expect(first).toBeDefined()
    expect(first?.sample(1_000)).toEqual(replayed?.sample(1_000))
    expect(first?.sample(1_000).gesture).toBe('handup')
    expect(first?.sample(1_000).mirror).toBe(true)
    expect(first?.sample(1_000).overlay).not.toBeNull()
    expect(first?.sample(first?.durationMs ?? 0).gesture).toBeNull()
    expect(first?.sample(first?.durationMs ?? 0).morphs.mouthSmile).toBe(0)
  })

  it('keeps reserved channels out of gesture ownership', () => {
    const motion = getAvatarActionMotion('kiss', 41)
    const frame = motion?.sample(800)

    expect(frame?.morphs.viseme_U).toBeUndefined()
    expect(frame?.morphs.headMove).toBeUndefined()
    expect(frame?.morphs.eyeContact).toBeUndefined()
  })

  it('supports deterministic duration overrides and external mood baselines', () => {
    const normal = getAvatarActionMotion('nod_yes', 41)
    const extended = getAvatarActionMotion('nod_yes', 41, 4_000)
    const baseline = getAvatarMoodBaseline('thinking')

    expect(extended?.durationMs).toBeGreaterThan(normal?.durationMs ?? 0)
    expect(extended?.sample(1_500)).toEqual(getAvatarActionMotion('nod_yes', 41, 4_000)?.sample(1_500))
    expect(baseline?.browDownLeft).toBeDefined()
  })

  it('uses rescale as a motion envelope without changing the source timeline', () => {
    const bow = getAvatarActionMotion('bow', 41)

    expect(bow?.durationMs).toBe(2_750)
    expect(bow?.sample(600).morphs.bodyRotateX).toBe(0)
    expect(bow?.sample(1_300).morphs.bodyRotateX).toBeCloseTo(0.125)
    expect(bow?.sample(1_700).morphs.bodyRotateX).toBeCloseTo(0.25)
    expect(bow?.sample(2_500).morphs.bodyRotateX).toBe(0)
  })

  it('lets avatar-gesture register a simple named action without exposing frames', () => {
    const applyGestureMotion = vi.fn()
    const setGesture = vi.fn()
    const target = {
      applyMood: vi.fn(),
      applyMorphs: vi.fn(),
      applyGestureMotion,
      setGesture,
      setPose: vi.fn(),
      setBlinkSchedule: vi.fn(),
      setBreathTrigger: vi.fn(),
      setHeadDrift: vi.fn(),
      setGaze: vi.fn(),
      getAnimation: vi.fn(() => 'animation' as const),
      setAnimation: vi.fn(),
      releaseAnimation: vi.fn(),
    }
    const animations: ComponentAnimation[] = []
    const component = new AvatarGestureComponent({
      services: emptyServices(),
      perso: { id: 'gesture', storyId: 'main', initial: {} },
    } as never)

    component.update({
      state: {},
      timeMs: 1_000,
      activeActions: [{
        name: 'avatar:gesture:wave_right',
        startAt: 1_000,
        elapsedMs: 0,
        action: {},
        eventId: 'motion-1',
      }],
      target,
      registerAnimation: (animation) => animations.push(animation),
    })

    expect(setGesture).not.toHaveBeenCalled()
    expect(animations).toHaveLength(1)
    animations[0]?.sample(1_500)?.apply()
    expect(applyGestureMotion).toHaveBeenCalled()
    expect(applyGestureMotion.mock.calls[0]?.[0]).toMatchObject({ gesture: 'handup', mirror: true })
  })

  it('lets avatar-motion play a registered resource without exposing Three.js', () => {
    const setAnimation = vi.fn()
    const releaseAnimation = vi.fn()
    const target = {
      applyMood: vi.fn(),
      applyMorphs: vi.fn(),
      applyGestureMotion: vi.fn(),
      setGesture: vi.fn(),
      setPose: vi.fn(),
      setBlinkSchedule: vi.fn(),
      setBreathTrigger: vi.fn(),
      setHeadDrift: vi.fn(),
      setGaze: vi.fn(),
      setAnimation,
      releaseAnimation,
    }
    const component = new AvatarMotionComponent({
      services: emptyServices(),
      perso: { id: 'motion', storyId: 'main', initial: { speed: 1, loop: false } },
    } as never)

    component.update({
      state: {},
      timeMs: 1_000,
      activeActions: [{
        name: 'avatar:motion:walk',
        startAt: 1_000,
        elapsedMs: 0,
        action: { speed: 1.5, loop: true },
        eventId: 'motion-1',
      }],
      target,
    })

    expect(setAnimation).toHaveBeenCalledWith({
      name: 'walk',
      startAt: 1_000,
      speed: 1.5,
      loop: true,
    })

    component.update({
      state: {},
      timeMs: 2_000,
      activeActions: [{
        name: 'avatar:motion:walk',
        startAt: 2_000,
        elapsedMs: 0,
        action: {},
        eventId: 'motion-3',
      }],
      target,
    })
    expect(setAnimation).toHaveBeenLastCalledWith({
      name: 'walk',
      startAt: 2_000,
      speed: 1,
      loop: false,
    })

    component.update({
      state: {},
      timeMs: 2_000,
      activeActions: [{
        name: 'avatar:motion:release',
        startAt: 2_000,
        elapsedMs: 0,
        action: {},
        eventId: 'motion-2',
      }, {
        name: 'avatar:motion:walk',
        startAt: 0,
        elapsedMs: 2_000,
        action: { speed: 1.5, loop: true },
        eventId: 'motion-1',
      }],
      target,
    })
    expect(setAnimation).toHaveBeenLastCalledWith({
      name: 'walk',
      startAt: 0,
      speed: 1.5,
      loop: true,
      releaseAt: 2_000,
      transitionMs: 400,
    })
    expect(releaseAnimation).not.toHaveBeenCalled()
  })

  it('accepts a release transition duration as occurrence data', () => {
    const setAnimation = vi.fn()
    const target = {
      setAnimation,
    }
    const component = new AvatarMotionComponent({
      services: emptyServices(),
      perso: { id: 'motion', storyId: 'main', initial: {} },
    } as never)

    component.update({
      state: {},
      timeMs: 2_500,
      activeActions: [
        {
          name: 'avatar:motion:walk',
          startAt: 0,
          elapsedMs: 2_500,
          action: { speed: 0.75, loop: false },
        },
        {
          name: 'avatar:motion:release',
          startAt: 2_000,
          elapsedMs: 500,
          action: { durationMs: 650 },
        },
      ],
      target,
    })

    expect(setAnimation).toHaveBeenCalledWith({
      name: 'walk',
      startAt: 0,
      speed: 0.75,
      loop: false,
      releaseAt: 2_000,
      transitionMs: 650,
    })
  })

  it('uses the initial motion when a replay starts before its first event boundary', () => {
    const setAnimation = vi.fn()
    const target = {
      setAnimation,
      releaseAnimation: vi.fn(),
    }
    const component = new AvatarMotionComponent({
      services: emptyServices(),
      perso: {
        id: 'motion',
        storyId: 'main',
        initial: { motion: 'walk', speed: 0.75, loop: false },
      },
    } as never)

    component.update({
      state: { motion: 'walk', speed: 0.75, loop: false },
      timeMs: 0,
      activeActions: [],
      target,
    })

    expect(setAnimation).toHaveBeenCalledWith({
      name: 'walk',
      startAt: 0,
      speed: 0.75,
      loop: false,
    })
  })
})
