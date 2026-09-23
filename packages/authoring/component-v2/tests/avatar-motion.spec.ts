import { describe, expect, it, vi } from 'vitest'
import type { ComponentServices } from 'codplay'
import { AvatarGestureComponent } from '../src/avatar/components/avatar-gesture-component'
import { AvatarMotionComponent } from '../src/avatar/components/avatar-motion-component'
import {
  AVATAR_GESTURE_MOTION_NAMES,
  AVATAR_MOOD_MOTION_NAMES,
  AVATAR_MOTION_CATALOG,
  getAvatarActionMotion,
  getAvatarEmojiMotion,
  getAvatarMoodBaseline,
} from '../src/avatar/gesture/motion-catalog'
import type { AvatarTimeline } from '../src/avatar/avatar-types'

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
    expect(first?.sample(0).gesture).toBe('handup')
    expect(first?.sample(1_000).gesture).toBe('handup')
    expect(first?.sample(1_000).mirror).toBe(true)
    expect(first?.sample(1_000).overlay).not.toBeNull()
    expect(first?.sample(1_000).morphs.mouthSmile).toBeCloseTo(0.6)
    expect(first?.sample(first?.durationMs ?? 0).gesture).toBeNull()
    expect(first?.sample(first?.durationMs ?? 0).morphs.mouthSmile).toBe(0)
  })

  it('keeps control channels out while retaining expressive mouth channels', () => {
    const motion = getAvatarActionMotion('kiss', 41)
    const frame = motion?.sample(800)

    expect(frame?.morphs.viseme_U).toBeDefined()
    expect(frame?.morphs.viseme_U).toBeGreaterThan(0)
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

  it('keeps the native TalkingHead emoji template tasks', () => {
    const neutral = getAvatarEmojiMotion('😐', 41)
    const thinking = getAvatarEmojiMotion('🤔', 41)
    const waving = getAvatarEmojiMotion('✋', 41)

    expect(neutral?.sample(300).pose).toBe('straight')
    expect(thinking?.sample(500).handTargets).toMatchObject([{
      side: 'Right',
      position: { x: 0.1, y: 0.1, z: 0.1 },
      release: false,
      durationMs: 1_000,
    }])
    expect(thinking?.sample(2_000).handTargets).toMatchObject([{
      side: 'Right',
      release: true,
      durationMs: 1_000,
    }])
    expect(waving?.sample(300)).toMatchObject({ gesture: 'handup', mirror: true })
  })

  it('recreates TalkingHead camera contact around an emoji gesture', () => {
    const smile = getAvatarEmojiMotion('🙂', 41)

    expect(smile?.sample(0).gazeTarget).toBe('camera')
    expect(smile?.sample(500).gazeTarget).toBe('camera')
    expect(smile?.sample(501).gazeTarget).toBeNull()
  })

  it('uses rescale only to allocate extra presentation time', () => {
    const bow = getAvatarActionMotion('bow', 41)
    const extended = getAvatarActionMotion('bow', 41, 4_000)

    expect(bow?.durationMs).toBe(2_750)
    expect(bow?.sample(600).morphs.bodyRotateX).toBeCloseTo(0.2)
    expect(bow?.sample(1_300).morphs.bodyRotateX).toBeCloseTo(0.25)
    expect(bow?.sample(1_700).morphs.bodyRotateX).toBeCloseTo(0.25)
    expect(bow?.sample(2_500).morphs.bodyRotateX).toBe(0)
    expect(extended?.durationMs).toBe(4_250)
    expect(extended?.sample(1_300).morphs.bodyRotateX).toBeCloseTo(0.25)
    expect(extended?.sample(3_600).morphs.bodyRotateX).toBeCloseTo(0.125)
  })

  it('lets avatar-gesture register a simple named action without exposing frames', () => {
    const applyGestureMotion = vi.fn()
    let timeline: AvatarTimeline | undefined
    const target = {
      setTimeline: (_slot: 'gesture', value: AvatarTimeline) => { timeline = value },
      applyMood: vi.fn(),
      applyMorphs: vi.fn(),
      applyGestureMotion,
      setBlinkSchedule: vi.fn(),
      setGaze: vi.fn(),
      setAnimation: vi.fn(),
      releaseAnimation: vi.fn(),
    }
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
    })

    expect(timeline).toBeDefined()
    timeline?.sample(1_500)?.apply()
    expect(applyGestureMotion).toHaveBeenCalled()
    expect(applyGestureMotion.mock.calls[0]?.[0]).toMatchObject({ gesture: 'handup', mirror: true })
    expect(applyGestureMotion.mock.calls[0]?.[2]).toBe(1_000)
    expect(applyGestureMotion.mock.calls[0]?.[3]).toBe(1_000)
  })

  it('lets avatar-motion play a registered resource without exposing Three.js', () => {
    const setAnimation = vi.fn()
    const releaseAnimation = vi.fn()
    const target = {
      applyMood: vi.fn(),
      applyMorphs: vi.fn(),
      applyGestureMotion: vi.fn(),
      setBlinkSchedule: vi.fn(),
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
      timeMs: 1_000,
      activeActions: [{
        name: 'avatar:motion:walk',
        startAt: 1_000,
        elapsedMs: 0,
        action: { durationMs: 2_400 },
        eventId: 'motion-duration',
      }],
      target,
    })
    expect(setAnimation).toHaveBeenLastCalledWith({
      name: 'walk',
      startAt: 1_000,
      speed: 1,
      loop: false,
      durationMs: 2_400,
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

  it('uses the initial duration when no motion action overrides it', () => {
    const setAnimation = vi.fn()
    const target = { setAnimation, releaseAnimation: vi.fn() }
    const component = new AvatarMotionComponent({
      services: emptyServices(),
      perso: {
        id: 'motion',
        storyId: 'main',
        initial: { motion: 'walk', durationMs: 3_200 },
      },
    } as never)

    component.update({
      state: {},
      timeMs: 0,
      activeActions: [],
      target,
    })

    expect(setAnimation).toHaveBeenCalledWith({
      name: 'walk',
      startAt: 0,
      speed: 1,
      durationMs: 3_200,
    })
  })
})
