import { describe, expect, it } from 'vitest'
import { MorphEngine } from '@codplay/avatar-engine'
import { createBlinkScheduleFn, createBreathTriggerFn, createHeadDriftFn, resolveContinuousEndMs } from '../src/avatar3d-component'
import { BUILTIN_AVATAR3D_MOTIONS, listBuiltinAvatar3DMotionNames, resolveAvatar3DMotionSupport, resolveBuiltinAvatar3DMotionSupport } from '../src/semantic-motion/avatar3d-motion-catalog'
import { Avatar3DMotionPlayer } from '../src/semantic-motion/avatar3d-motion-player'
import { resolveMotionDurationMs, sampleMotionChannel } from '../src/semantic-motion/avatar3d-motion-utils'
import { Avatar3DMoodPlayer, easeMoodProgress, interpolateMoodValue, isAvatar3DMoodName } from '../src/semantic-motion/avatar3d-mood-player'
import { AvatarSpeechController } from '../src/semantic-runtime/avatar-speech-controller'
import { Avatar3DSemanticRuntime } from '../src/semantic-runtime/avatar3d-semantic-runtime'
import { AvatarAutoMotionController } from '../src/semantic-runtime/avatar-auto-motion-controller'
import { AvatarPoseApplier } from '../src/semantic-runtime/avatar-pose-applier'

const MOTION_ENGINE_REMOTE_MOTION_NAMES = [
  'neutral',
  'happy',
  'sleep',
  'wave_right',
  'wave_left',
  'thumbup_right',
  'thumbdown_right',
  'point',
  'ok_wink',
  'shrug_confused',
  'namaste_bow',
  'nod_yes',
  'shake_no',
  'look_up',
  'look_down',
  'bow',
  'jump',
  'celebrate',
  'turn_around',
  'thinking',
  'surprised',
  'wink',
  'angry',
  'sad',
  'laugh',
  'yawn',
  'nervous',
  'applause',
  'dance',
  'shy',
  'facepalm',
  'listen',
  'excited',
  'dismiss',
  'tongueout',
  'kiss',
  'eyeroll',
  'smirk',
  'grimace',
  'pleading',
  'sleeping',
  'sigh',
  'raise_eyebrows',
  'frown',
  'open_mouth',
  'cheek_puff',
  'close_eyes',
  'squint',
  'look_left',
  'look_right',
  'head_circles',
  'shiver',
  'chew',
  'deep_breath',
  'vibrate',
  'curious',
  'disgust',
  'neutral_face',
  'smug',
  'slight_smile',
  'warm_smile',
  'grin',
  'open_grin',
  'squint_smile',
  'beam',
  'laugh_closed',
  'tongue_out',
  'crying_laugh',
  'wink_smile',
  'sobbing',
  'puppy_eyes',
  'disappointed',
  'pensive',
  'flushed',
  'sad_frown',
  'kiss_eyes_closed',
  'blow_kiss',
  'adoring',
  'heart_eyes',
  'rage',
  'unamused',
  'scream',
  'grimace_teeth',
  'thinking_face',
  'side_glance',
  'zzz',
  'hand_raise',
  'hand_raise_left',
  'thumbs_up',
  'thumbs_down',
  'ok_sign',
  'shrug_both',
  'pray',
  'nod',
  'head_shake',
  'fear',
  'love',
  'surprise',
] as const

describe('resolveContinuousEndMs', () => {
  it('prioritizes absolute endMs over durationMs', () => {
    expect(resolveContinuousEndMs({ endMs: 340, durationMs: 50 }, 100)).toBe(340)
  })

  it('derives end time from durationMs when endMs is absent', () => {
    expect(resolveContinuousEndMs({ durationMs: 80 }, 120)).toBe(200)
  })

  it('returns null when no continuous timing is present', () => {
    expect(resolveContinuousEndMs({}, 120)).toBeNull()
  })
})

describe('semantic motion sampling', () => {
  it('sums positive dt values as motion duration', () => {
    expect(resolveMotionDurationMs([300, 1200, 300])).toBe(1800)
  })

  it('interpolates classic keyframe channels when dt is one shorter than values', () => {
    expect(sampleMotionChannel([0, 1], [1000], 500)).toBeCloseTo(0.5, 5)
  })

  it('supports segment-target channels when dt and values have the same length', () => {
    expect(sampleMotionChannel([0, 0.6, 0], [300, 1200, 300], 900)).toBeCloseTo(0.3, 5)
    expect(sampleMotionChannel([0, 0.6, 0], [300, 1200, 300], 1650)).toBeCloseTo(0.3, 5)
  })

  it('rejects mismatched timing instead of guessing', () => {
    expect(sampleMotionChannel([0, 1, 0], [1000], 500)).toBeNull()
  })
})

describe('Avatar3DMotionPlayer', () => {
  it('applies and releases supported morph channels from a catalog motion', () => {
    const fixed: Array<{ name: string; value: number | null }> = []
    const snapped: Array<{ name: string; value: number | null }> = []
    const player = new Avatar3DMotionPlayer({
      engine: {
        morphEngine: {
          morphs: new Map([['mouthSmile', {}]]),
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          snapFixed(name: string, value: number | null) {
            snapped.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DMotionPlayer>[0]['engine'],
      catalog: {
        smile: {
          dt: [1000],
          vs: { mouthSmile: [0, 1] },
        },
      },
      report: () => undefined,
    })

    player.trigger('smile', 100, { evaluateImmediately: false })
    player.evaluate(600)
    player.evaluate(1100)

    expect(snapped).toEqual([{ name: 'mouthSmile', value: 0.5 }])
    expect(fixed).toEqual([{ name: 'mouthSmile', value: null }])
  })

  it('accepts MorphEngine alias channels even when they are not raw morph names', () => {
    const snapped: Array<{ name: string; value: number | null }> = []
    const warnings: string[] = []
    const player = new Avatar3DMotionPlayer({
      engine: {
        morphEngine: {
          morphs: new Map(),
          aliases: { mouthSmile: { targets: [] } },
          setFixed: () => undefined,
          snapFixed(name: string, value: number | null) {
            snapped.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DMotionPlayer>[0]['engine'],
      catalog: {
        smile: {
          dt: [1000],
          vs: { mouthSmile: [0, 1] },
        },
      },
      report: (code) => warnings.push(code),
    })

    player.trigger('smile', 0, { evaluateImmediately: false })
    player.evaluate(500)

    expect(warnings).toEqual([])
    expect(snapped).toEqual([{ name: 'mouthSmile', value: 0.5 }])
  })

  it('snaps motion channels when reconstructing seek state', () => {
    const snapped: Array<{ name: string; value: number | null }> = []
    const player = new Avatar3DMotionPlayer({
      engine: {
        morphEngine: {
          morphs: new Map([['mouthSmile', {}]]),
          setFixed: () => undefined,
          snapFixed(name: string, value: number | null) {
            snapped.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DMotionPlayer>[0]['engine'],
      catalog: {
        smile: {
          dt: [1000],
          vs: { mouthSmile: [0, 1] },
        },
      },
      report: () => undefined,
    })

    player.trigger('smile', 0, { evaluateImmediately: false })
    player.evaluate(500, 'seek')
    player.stop('stop', 'seek')

    expect(snapped).toEqual([
      { name: 'mouthSmile', value: 0.5 },
      { name: 'mouthSmile', value: null },
    ])
  })
})

describe('built-in avatar3d motion catalog', () => {
  it('exposes a stable morph-only starter catalog', () => {
    expect(listBuiltinAvatar3DMotionNames()).toContain('slight_smile')
    expect(listBuiltinAvatar3DMotionNames()).toContain('head_shake')
    expect(listBuiltinAvatar3DMotionNames()).toContain('neutral_face')
    expect(listBuiltinAvatar3DMotionNames()).toContain('neutral')
    expect(listBuiltinAvatar3DMotionNames()).toContain('pose_side')
    expect(listBuiltinAvatar3DMotionNames()).toContain('pose_wide')
    expect(listBuiltinAvatar3DMotionNames()).toContain('grin')
    expect(listBuiltinAvatar3DMotionNames()).toContain('jump')
    expect(listBuiltinAvatar3DMotionNames()).toContain('laugh')
    expect(listBuiltinAvatar3DMotionNames()).toContain('surprised')
    expect(listBuiltinAvatar3DMotionNames()).toContain('fear')
    expect(listBuiltinAvatar3DMotionNames()).toContain('love')
    expect(listBuiltinAvatar3DMotionNames()).toContain('angry')
    expect(listBuiltinAvatar3DMotionNames()).toContain('sad')
    expect(listBuiltinAvatar3DMotionNames()).toContain('thinking')
    expect(BUILTIN_AVATAR3D_MOTIONS.slight_smile?.vs?.mouthSmile).toEqual([0, 0.5, 0.5, 0])
    expect(BUILTIN_AVATAR3D_MOTIONS.neutral?._track).toBe('mood')
    expect(BUILTIN_AVATAR3D_MOTIONS.fear?._track).toBe('mood')
    expect(BUILTIN_AVATAR3D_MOTIONS.love?._track).toBe('mood')
    expect(BUILTIN_AVATAR3D_MOTIONS.angry?._track).toBe('mood')
  })

  it('covers every current MotionEngine remote motion name with supported playback', () => {
    const builtInNames = new Set(listBuiltinAvatar3DMotionNames())
    const missingNames = MOTION_ENGINE_REMOTE_MOTION_NAMES.filter((name) => !builtInNames.has(name))
    const unsupportedNames = MOTION_ENGINE_REMOTE_MOTION_NAMES.filter((name) => {
      const support = resolveBuiltinAvatar3DMotionSupport(name)
      return support?.status !== 'supported'
    })

    expect(MOTION_ENGINE_REMOTE_MOTION_NAMES).toHaveLength(98)
    expect(missingNames).toEqual([])
    expect(unsupportedNames).toEqual([])
  })

  it('reports motion support status instead of hiding unsupported channels', () => {
    expect(resolveBuiltinAvatar3DMotionSupport('grin')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('neutral')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('pose_side')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('pose_wide')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('fear')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('love')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('angry')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('thinking')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('jump')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('laugh')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('hand_raise_left')?.status).toBe('supported')
    expect(resolveBuiltinAvatar3DMotionSupport('hand_raise')?.status).toBe('supported')
    expect(resolveAvatar3DMotionSupport({
      dt: [1000],
      vs: { pose: ['side'] },
    })?.status).toBe('supported')
    expect(resolveAvatar3DMotionSupport({
      dt: [1000],
      vs: { eyesRotateY: [0, 1] },
    })?.status).toBe('supported')
    expect(resolveAvatar3DMotionSupport({
      dt: [1000],
      vs: { eyeContact: [0], headMove: [0] },
    })?.status).toBe('supported')
    expect(resolveAvatar3DMotionSupport({
      _overlay: {
        bones: {
          TestBone: { freq: 8, amp: [0, 0, 0.12] },
        },
      },
    })?.status).toBe('supported')
    expect(resolveAvatar3DMotionSupport({
      dt: [1000],
      vs: {
        mouthSmile: [0, 1],
        gesture: [0 as never],
      },
    }, new Set(['mouthSmile']))).toEqual({
      status: 'partial',
      unsupportedChannels: [],
      unsupportedFeatures: ['channel:gesture:invalid_command'],
    })
  })

  it('maps point to a dedicated pointing template instead of the raised index gesture', () => {
    expect(BUILTIN_AVATAR3D_MOTIONS.point?.vs?.gesture?.[0]).toEqual(['point', null, true])
    expect(resolveBuiltinAvatar3DMotionSupport('point')?.status).toBe('supported')
  })

  it('reports unsupported gesture channel features explicitly', () => {
    expect(resolveAvatar3DMotionSupport({
      dt: [1000],
      vs: {
        gesture: [['missing', null], null],
      },
    })).toEqual({
      status: 'unsupported',
      unsupportedChannels: [],
      unsupportedFeatures: ['gesture:missing:unknown'],
    })
  })

  it('reports unsupported pose channel features explicitly', () => {
    expect(resolveAvatar3DMotionSupport({
      dt: [1000],
      vs: {
        pose: ['missing'],
      },
    })).toEqual({
      status: 'unsupported',
      unsupportedChannels: [],
      unsupportedFeatures: ['pose:missing:unknown'],
    })
  })

  it('reports unsupported custom overlay effects explicitly', () => {
    expect(resolveAvatar3DMotionSupport({
      _overlay: {
        bones: {
          Hips: { custom: 'bounce' },
        },
      },
    })).toEqual({
      status: 'unsupported',
      unsupportedChannels: [],
      unsupportedFeatures: ['overlay:Hips:custom:bounce'],
    })
  })
})

describe('Avatar3DMoodPlayer', () => {
  it('interpolates mood baseline values with smooth progress', () => {
    expect(easeMoodProgress(0.5)).toBe(0.5)
    expect(interpolateMoodValue({}, { mouthSmile: 0.2 }, 'mouthSmile', 0.5)).toBeCloseTo(0.1, 5)
  })

  it('validates known mood names', () => {
    expect(isAvatar3DMoodName('happy')).toBe(true)
    expect(isAvatar3DMoodName('thinking')).toBe(false)
  })

  it('applies deterministic interpolated baselines in play', () => {
    const baselines: Array<{ name: string; value: number | null }> = []
    const snaps: Array<{ name: string; value: number | null }> = []
    const moods: string[] = []
    const player = new Avatar3DMoodPlayer({
      engine: {
        setMood(name: string) {
          moods.push(name)
        },
        morphEngine: {
          setBaseline(name: string, value: number | null) {
            baselines.push({ name, value })
          },
          snapFixed(name: string, value: number | null) {
            snaps.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DMoodPlayer>[0]['engine'],
    })

    player.trigger('happy', 100, 1100, { evaluateImmediately: false })
    player.evaluate(600, 'play')
    player.evaluate(1100, 'play')

    expect(baselines).toContainEqual({ name: 'mouthSmile', value: 0.1 })
    expect(snaps).toContainEqual({ name: 'mouthSmile', value: null })
    expect(moods).toContain('happy')
  })

  it('uses the same interpolated mood samples for play and seek reconstruction', () => {
    const playBaselines: Array<{ name: string; value: number | null }> = []
    const seekBaselines: Array<{ name: string; value: number | null }> = []
    const player = new Avatar3DMoodPlayer({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          setBaseline(name: string, value: number | null) {
            playBaselines.push({ name, value })
          },
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DMoodPlayer>[0]['engine'],
    })

    player.trigger('happy', 100, 1100, { evaluateImmediately: false })
    player.evaluate(600, 'play')

    const seekPlayer = new Avatar3DMoodPlayer({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          setBaseline(name: string, value: number | null) {
            seekBaselines.push({ name, value })
          },
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DMoodPlayer>[0]['engine'],
    })
    seekPlayer.trigger('happy', 100, 1100, { evaluateImmediately: false })
    seekPlayer.evaluate(600, 'seek')

    expect(playBaselines).toContainEqual({ name: 'mouthSmile', value: 0.1 })
    expect(seekBaselines).toContainEqual({ name: 'mouthSmile', value: 0.1 })
  })

  it('resets to the initial mood before seek replay', () => {
    const moods: string[] = []
    const player = new Avatar3DMoodPlayer({
      engine: {
        setMood(name: string) {
          moods.push(name)
        },
        morphEngine: {
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DMoodPlayer>[0]['engine'],
      initialMood: 'sad',
    })

    player.setInstant('happy')
    player.prepareSeek()

    expect(moods).toEqual(['happy', 'sad'])
  })
})

describe('AvatarSpeechController', () => {
  it('keeps continuous viseme logic outside the component', () => {
    const controller = new AvatarSpeechController({
      visemeWeight: 1,
    })

    expect(controller.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-viseme',
      eventMs: 100,
      eventSeq: 1,
      action: { viseme: 'aa', endMs: 300 },
    })).toBe(true)
    const activePose = controller.evaluate(200)
    const endedPose = controller.evaluate(400)

    expect(activePose.morphs?.viseme_aa).toBe(0.6)
    expect(endedPose.morphs).toBeUndefined()
  })

  it('uses TalkingHead weights and timing for continuous visemes', () => {
    const controller = new AvatarSpeechController({
      visemeWeight: 1,
    })

    controller.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-viseme',
      eventMs: 100,
      eventSeq: 1,
      action: { viseme: 'aa', endMs: 300 },
    })

    expect(controller.evaluate(100).morphs?.viseme_aa).toBe(0)
    expect(controller.evaluate(150).morphs?.viseme_aa).toBeCloseTo(0.3, 5)
    expect(controller.evaluate(200).morphs?.viseme_aa).toBe(0.6)
    expect(controller.evaluate(300).morphs?.viseme_aa).toBeCloseTo(0.3, 5)
  })

  it('keeps overlapping viseme releases instead of cutting the previous cue', () => {
    const controller = new AvatarSpeechController({
      visemeWeight: 1,
    })

    controller.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-aa',
      eventMs: 100,
      eventSeq: 1,
      action: { viseme: 'aa', endMs: 300 },
    })
    controller.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-pp',
      eventMs: 260,
      eventSeq: 2,
      action: { viseme: 'PP', endMs: 380 },
    })

    const pose = controller.evaluate(300).morphs
    expect(pose?.viseme_aa).toBeCloseTo(0.3, 5)
    expect(pose?.viseme_PP).toBeCloseTo(0.6, 5)
  })
})

describe('Avatar3DSemanticRuntime', () => {
  it('routes semantic actions before legacy component handlers', () => {
    const fixed: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map([['mouthSmile', {}]]),
          aliases: {},
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        smile: {
          dt: [1000],
          vs: { mouthSmile: [0, 1] },
        },
      },
      report: () => undefined,
    })

    expect(runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-motion',
      eventMs: 0,
      eventSeq: 1,
      action: { motion: 'smile' },
    })).toBe(true)
    runtime.evaluate(500, 'play')

    expect(fixed).toContainEqual({ name: 'mouthSmile', value: 0.5 })
  })

  it('lets semantic motion override automatic head drift on the same channel', () => {
    const snapped: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map([['headRotateX', {}]]),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            snapped.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        nod: {
          dt: [1000],
          vs: { headRotateX: [0, 1] },
        },
      },
      report: () => undefined,
    })

    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-head-drift',
      eventMs: 0,
      eventSeq: 1,
      action: { headDrift: () => ({ headRotateX: 0.2 }) },
    })
    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-motion',
      eventMs: 0,
      eventSeq: 2,
      action: { motion: 'nod' },
    })
    runtime.evaluate(500, 'play')

    expect(snapped).toContainEqual({ name: 'headRotateX', value: 0.5 })
  })

  it('applies head-shake bone morphs after the skeletal pose layer', () => {
    const calls: string[] = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose: () => calls.push('skeletal'),
        },
        morphEngine: {
          morphs: new Map([['headRotateY', {}], ['headRotateZ', {}]]),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            if (name === 'headRotateY') calls.push(`${name}:${value}`)
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    runtime.handleUpdate({ persoId: 'avatar', eventId: 'evt-head-shake', eventMs: 0, eventSeq: 1, action: { motion: 'head_shake' } })
    runtime.evaluate(700, 'play')

    expect(calls[0]).toBe('skeletal')
    expect(calls).toContain('headRotateY:0.08')
  })

  it('maps MotionEngine eyesRotateY to ARKit horizontal eye look morphs', () => {
    const snapped: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map([
            ['eyeLookOutLeft', {}],
            ['eyeLookInLeft', {}],
            ['eyeLookInRight', {}],
            ['eyeLookOutRight', {}],
          ]),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            snapped.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        glance: {
          dt: [1000],
          vs: { eyesRotateY: [0, 1] },
        },
      },
      report: () => undefined,
    })

    runtime.handleUpdate({ persoId: 'avatar', eventId: 'evt-glance', eventMs: 0, eventSeq: 1, action: { motion: 'glance' } })
    runtime.evaluate(500, 'play')

    expect(snapped).toContainEqual({ name: 'eyeLookOutLeft', value: 0.5 })
    expect(snapped).toContainEqual({ name: 'eyeLookInRight', value: 0.5 })
    expect(snapped).toContainEqual({ name: 'eyeLookInLeft', value: 0 })
    expect(snapped).toContainEqual({ name: 'eyeLookOutRight', value: 0 })
  })

  it('routes MotionEngine eyeContact channel to the gaze constraint', () => {
    const contacts: Array<number | null> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      gaze: {
        setContact(value: number | null) {
          contacts.push(value)
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['gaze'],
      visemeWeight: 0.75,
      localMotions: {
        glance: {
          dt: [1000],
          vs: { eyeContact: [0, 0] },
        },
      },
      report: () => undefined,
    })

    runtime.handleUpdate({ persoId: 'avatar', eventId: 'evt-glance', eventMs: 0, eventSeq: 1, action: { motion: 'glance' } })
    runtime.evaluate(500, 'play')
    runtime.evaluate(1000, 'play')

    expect(contacts).toContain(0)
    expect(contacts.at(-1)).toBeNull()
  })

  it('keeps MotionEngine mood-track morphs persistent and independent from action motions', () => {
    const snapped: Array<{ name: string; value: number | null }> = []
    const fixed: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map([['mouthSmile', {}], ['jawOpen', {}]]),
          aliases: {},
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            snapped.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        warm: {
          _track: 'mood',
          dt: [1000],
          vs: { mouthSmile: [0, 0.8] },
        },
        open: {
          _track: 'action',
          dt: [1000],
          vs: { jawOpen: [0, 1] },
        },
      },
      report: () => undefined,
    })

    runtime.handleUpdate({ persoId: 'avatar', eventId: 'evt-warm', eventMs: 0, eventSeq: 1, action: { motion: 'warm' } })
    runtime.evaluate(1500, 'play')
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'evt-open', eventMs: 2000, eventSeq: 2, action: { motion: 'open' } })
    runtime.evaluate(2500, 'play')
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'evt-stop-action', eventMs: 2600, eventSeq: 3, action: { motion: null } })
    runtime.evaluate(2700, 'play')

    const lastFixedValue = (name: string) => fixed.filter((entry) => entry.name === name).at(-1)?.value
    expect(lastFixedValue('mouthSmile')).toBeCloseTo(0.8, 5)
    expect(fixed).toContainEqual({ name: 'jawOpen', value: 0.5 })
    expect(fixed).toContainEqual({ name: 'jawOpen', value: null })
  })

  it('clears a persistent MotionEngine mood-track expression with neutral', () => {
    const fixed: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map([['mouthSmile', {}]]),
          aliases: {},
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        warm: {
          _track: 'mood',
          dt: [1000],
          vs: { mouthSmile: [0, 0.8] },
        },
      },
      report: () => undefined,
    })

    runtime.handleUpdate({ persoId: 'avatar', eventId: 'evt-warm', eventMs: 0, eventSeq: 1, action: { motion: 'warm' } })
    runtime.evaluate(1500, 'play')
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'evt-neutral', eventMs: 2000, eventSeq: 2, action: { motion: 'neutral' } })
    runtime.evaluate(2700, 'play')

    expect(fixed.filter((entry) => entry.name === 'mouthSmile').at(-1)).toEqual({ name: 'mouthSmile', value: 0 })
  })

  it('crossfades between persistent MotionEngine mood-track expressions', () => {
    const fixed: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map([['mouthSmile', {}], ['mouthFrownLeft', {}]]),
          aliases: {},
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        warm: {
          _track: 'mood',
          dt: [1000],
          vs: { mouthSmile: [0, 0.8] },
        },
        frown: {
          _track: 'mood',
          dt: [1000],
          vs: { mouthFrownLeft: [0, 1] },
        },
      },
      report: () => undefined,
    })

    runtime.handleUpdate({ persoId: 'avatar', eventId: 'evt-warm', eventMs: 0, eventSeq: 1, action: { motion: 'warm' } })
    runtime.evaluate(1500, 'play')
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'evt-frown', eventMs: 2000, eventSeq: 2, action: { motion: 'frown' } })
    runtime.evaluate(2000, 'play')
    runtime.evaluate(2500, 'play')

    const values = (name: string) => fixed.filter((entry) => entry.name === name).map((entry) => entry.value)
    expect(values('mouthSmile')).toContain(0.8)
    expect(values('mouthSmile').at(-1)).toBeCloseTo(0.4, 5)
    expect(values('mouthFrownLeft').at(-1)).toBeCloseTo(0.5, 5)
  })

  it('reconstructs completed MotionEngine mood-track motions during seek', () => {
    const createRuntime = (fixed: Array<{ name: string; value: number | null }>, snapped: Array<{ name: string; value: number | null }>) => new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map([['mouthSmile', {}]]),
          aliases: {},
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            snapped.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        warm: {
          _track: 'mood',
          dt: [1000],
          vs: { mouthSmile: [0, 0.8] },
        },
      },
      report: () => undefined,
    })
    const playFixed: Array<{ name: string; value: number | null }> = []
    const seekSnapped: Array<{ name: string; value: number | null }> = []
    const update = { persoId: 'avatar', eventId: 'evt-warm', eventMs: 0, eventSeq: 1, action: { motion: 'warm' } }

    const playRuntime = createRuntime(playFixed, [])
    playRuntime.handleUpdate(update)
    playRuntime.evaluate(1500, 'play')

    const seekRuntime = createRuntime([], seekSnapped)
    seekRuntime.prepareSeek()
    seekRuntime.handleUpdate({ ...update, isSeekReplay: true })
    seekRuntime.evaluate(1500, 'seek')

    const playMouthSmile = playFixed.filter((entry) => entry.name === 'mouthSmile').at(-1)
    const seekMouthSmile = seekSnapped.filter((entry) => entry.name === 'mouthSmile').at(-1)
    expect(seekMouthSmile).toEqual(playMouthSmile)
    expect(seekMouthSmile).toEqual({ name: 'mouthSmile', value: 0.8 })
  })

  it('applies a visible sleep mood eyelid sample from a timeline mood event', () => {
    const fixed: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    expect(runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-sleep',
      eventMs: 2000,
      eventSeq: 1,
      action: { mood: 'sleep', durationMs: 3000 },
    })).toBe(true)
    runtime.evaluate(3500, 'play')

    expect(fixed).toContainEqual({ name: 'eyeBlinkLeft', value: 0.5 })
    expect(fixed).toContainEqual({ name: 'eyeBlinkRight', value: 0.5 })
  })

  it('applies progressive mood samples across successive play frames', () => {
    const fixed: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-sleep',
      eventMs: 6000,
      eventSeq: 1,
      action: { mood: 'sleep', durationMs: 4000 },
    })

    runtime.evaluate(7000, 'play')
    runtime.evaluate(8000, 'play')
    runtime.evaluate(9000, 'play')

    const eyeBlinkLeftSamples = fixed
      .filter((entry) => entry.name === 'eyeBlinkLeft')
      .map((entry) => entry.value)

    expect(eyeBlinkLeftSamples).toEqual([0.15625, 0.5, 0.84375])
  })

  it('writes progressive mood samples through MorphEngine aliases to real slots', () => {
    const morphEngine = new MorphEngine()
    const leftInfluences = [0]
    const rightInfluences = [0]
    morphEngine.registerBlendMorph('eyeBlinkLeft', { influences: leftInfluences, index: 0 })
    morphEngine.registerBlendMorph('eyeBlinkRight', { influences: rightInfluences, index: 0 })
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine,
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-sleep',
      eventMs: 6000,
      eventSeq: 1,
      action: { mood: 'sleep', durationMs: 4000 },
    })

    runtime.evaluate(7000, 'play')
    expect(morphEngine.morphs.get('eyeBlinkLeft')?.fixed).toBeCloseTo(0.15625, 5)
    expect(morphEngine.morphs.get('eyeBlinkRight')?.fixed).toBeCloseTo(0.15625, 5)

    runtime.evaluate(8000, 'play')
    expect(morphEngine.morphs.get('eyeBlinkLeft')?.fixed).toBeCloseTo(0.5, 5)
    expect(morphEngine.morphs.get('eyeBlinkRight')?.fixed).toBeCloseTo(0.5, 5)

    runtime.evaluate(9000, 'play')
    expect(morphEngine.morphs.get('eyeBlinkLeft')?.fixed).toBeCloseTo(0.84375, 5)
    expect(morphEngine.morphs.get('eyeBlinkRight')?.fixed).toBeCloseTo(0.84375, 5)
  })

  it('applies continuous direct morph samples from durationMs', () => {
    const fixed: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map([['jawOpen', {}]]),
          aliases: {},
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    expect(runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-jaw',
      eventMs: 1000,
      eventSeq: 1,
      action: { name: 'jawOpen', value: 0.75, durationMs: 1000 },
    })).toBe(true)

    runtime.evaluate(1250, 'play')
    runtime.evaluate(1500, 'play')
    runtime.evaluate(1750, 'play')

    const jawSamples = fixed
      .filter((entry) => entry.name === 'jawOpen')
      .map((entry) => entry.value)

    expect(jawSamples).toEqual([0.1171875, 0.375, 0.6328125])
  })

  it('writes continuous direct morph samples through MorphEngine to real slots', () => {
    const morphEngine = new MorphEngine()
    const influences = [0]
    morphEngine.registerBlendMorph('jawOpen', { influences, index: 0 })
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine,
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-jaw',
      eventMs: 1000,
      eventSeq: 1,
      action: { name: 'jawOpen', value: 0.75, durationMs: 1000 },
    })

    runtime.evaluate(1250, 'play')
    expect(morphEngine.morphs.get('jawOpen')?.fixed).toBeCloseTo(0.1171875, 5)

    runtime.evaluate(1500, 'play')
    expect(morphEngine.morphs.get('jawOpen')?.fixed).toBeCloseTo(0.375, 5)
  })

  it('prioritizes direct morph endMs over durationMs', () => {
    const fixed: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map([['jawOpen', {}]]),
          aliases: {},
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-jaw',
      eventMs: 1000,
      eventSeq: 1,
      action: { name: 'jawOpen', value: 1, durationMs: 1000, endMs: 2000 },
    })
    runtime.evaluate(1500, 'play')

    expect(fixed).toContainEqual({ name: 'jawOpen', value: 0.5 })
  })

  it('lets an instant direct morph update replace an existing continuous state', () => {
    const snapped: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        morphEngine: {
          morphs: new Map([['jawOpen', {}]]),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            snapped.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-open',
      eventMs: 1000,
      eventSeq: 1,
      action: { name: 'jawOpen', value: 1, durationMs: 1000 },
    })
    runtime.evaluate(1500, 'play')
    expect(runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-close',
      eventMs: 1600,
      eventSeq: 2,
      action: { name: 'jawOpen', value: 0 },
    })).toBe(true)
    runtime.evaluate(1700, 'play')

    expect(snapped.at(-1)).toEqual({ name: 'jawOpen', value: 0 })
  })

  it('keeps end-scene mood transitions visible after pose and gesture motions', () => {
    const fixed: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose: () => undefined,
        },
        morphEngine: {
          morphs: new Map([['mouthSmileLeft', {}], ['mouthSmileRight', {}]]),
          aliases: {
            mouthSmile: {
              targets: [
                { name: 'mouthSmileLeft', weight: 1 },
                { name: 'mouthSmileRight', weight: 1 },
              ],
            },
          },
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    runtime.handleUpdate({ persoId: 'avatar', eventId: 'pose-side', eventMs: 0, eventSeq: 1, action: { motion: 'pose_side' } })
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'thumbs', eventMs: 11200, eventSeq: 2, action: { motion: 'thumbs_up' } })
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'pose-turn', eventMs: 13600, eventSeq: 3, action: { motion: 'pose_turn' } })
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'ok', eventMs: 14000, eventSeq: 4, action: { motion: 'ok_sign' } })
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'happy', eventMs: 18450, eventSeq: 5, action: { mood: 'happy', durationMs: 900 } })

    runtime.evaluate(18900, 'play')

    expect(fixed).toContainEqual({ name: 'mouthSmile', value: 0.1 })

    runtime.handleUpdate({ persoId: 'avatar', eventId: 'neutral', eventMs: 24900, eventSeq: 6, action: { mood: 'neutral', durationMs: 900 } })
    runtime.evaluate(25800, 'play')

    expect(fixed).toContainEqual({ name: 'mouthSmile', value: 0 })
  })

  it('writes end-scene mood transitions through MorphEngine aliases to real smile slots', () => {
    const morphEngine = new MorphEngine()
    const leftInfluences = [0]
    const rightInfluences = [0]
    morphEngine.registerBlendMorph('mouthSmileLeft', { influences: leftInfluences, index: 0 })
    morphEngine.registerBlendMorph('mouthSmileRight', { influences: rightInfluences, index: 0 })
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose: () => undefined,
        },
        morphEngine,
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    runtime.handleUpdate({ persoId: 'avatar', eventId: 'pose-side', eventMs: 0, eventSeq: 1, action: { motion: 'pose_side' } })
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'ok', eventMs: 14000, eventSeq: 4, action: { motion: 'ok_sign' } })
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'happy', eventMs: 18450, eventSeq: 5, action: { mood: 'happy', durationMs: 900 } })
    runtime.evaluate(18900, 'play')

    expect(morphEngine.morphs.get('mouthSmileLeft')?.fixed).toBeCloseTo(0.08, 5)
    expect(morphEngine.morphs.get('mouthSmileRight')?.fixed).toBeCloseTo(0.08, 5)
  })

  it('routes direct gesture events through deterministic skeletal output', () => {
    const applied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    expect(runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-gesture',
      eventMs: 1000,
      eventSeq: 7,
      action: { gesture: 'thumbup' },
    })).toBe(true)
    runtime.evaluate(1250, 'play')
    expect(runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-gesture-release',
      eventMs: 1500,
      eventSeq: 8,
      action: { gesture: null },
    })).toBe(true)
    runtime.evaluate(1750, 'play')

    expect(applied.length).toBe(2)
    expect(applied[0]?.get('LeftShoulder')?.z).not.toBe(applied[1]?.get('LeftShoulder')?.z)
  })

  it('installs a TH body pose baseline and routes direct pose events', () => {
    const applied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    expect(runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-pose',
      eventMs: 1000,
      eventSeq: 7,
      isSeekReplay: true,
      action: { pose: 'straight' },
    })).toBe(true)
    runtime.evaluate(3000, 'seek')

    expect(applied.at(-1)?.get('LeftShoulder')?.z).toBeCloseTo(-1.605, 2)
  })

  it('does not let body pose_turn claim head and neck axes around the demo 14250ms frame', () => {
    const applied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      report: () => undefined,
    })

    runtime.handleUpdate({ persoId: 'avatar', eventId: 'pose-turn', eventMs: 13600, eventSeq: 3, action: { motion: 'pose_turn' } })
    runtime.handleUpdate({ persoId: 'avatar', eventId: 'ok', eventMs: 14000, eventSeq: 4, action: { motion: 'ok_sign' } })
    runtime.evaluate(14250, 'play')

    const pose = applied.at(-1)
    expect(pose?.get('Head')).toBeUndefined()
    expect(pose?.get('Neck')).toBeUndefined()
  })

  it('plays a MotionEngine gesture channel alongside morph channels', () => {
    const applied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const fixed: Array<{ name: string; value: number | null }> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map([['mouthSmile', {}]]),
          aliases: {},
          setFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
          setBaseline: () => undefined,
          snapFixed(name: string, value: number | null) {
            fixed.push({ name, value })
          },
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        thumbs: {
          dt: [1000],
          vs: {
            mouthSmile: [0, 1],
            gesture: [['thumbup', null], null],
          },
        },
      },
      report: () => undefined,
    })

    expect(runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-motion',
      eventMs: 1000,
      eventSeq: 9,
      action: { motion: 'thumbs' },
    })).toBe(true)
    runtime.evaluate(1500, 'play')

    expect(applied.at(-1)?.get('LeftShoulder')).toBeDefined()
    expect(fixed).toContainEqual({ name: 'mouthSmile', value: 0.5 })
  })

  it('uses the same deterministic MotionEngine gesture sample for play and seek', () => {
    const playApplied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const seekApplied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const createRuntime = (applied: Array<Map<string, { x: number; y: number; z: number }>>) => new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        thumbs: {
          dt: [1000],
          vs: { gesture: [['thumbup', null], null] },
        },
      },
      report: () => undefined,
    })

    const playRuntime = createRuntime(playApplied)
    const seekRuntime = createRuntime(seekApplied)
    const update = {
      persoId: 'avatar',
      eventId: 'evt-motion',
      eventMs: 1000,
      eventSeq: 9,
      action: { motion: 'thumbs' },
    }
    playRuntime.handleUpdate(update)
    playRuntime.evaluate(1250, 'play')
    seekRuntime.prepareSeek()
    seekRuntime.handleUpdate({ ...update, isSeekReplay: true })
    seekRuntime.evaluate(1250, 'seek')

    expect(seekApplied.at(-1)?.get('LeftShoulder')?.z).toBeCloseTo(playApplied.at(-1)?.get('LeftShoulder')?.z ?? 0, 5)
  })

  it('samples MotionEngine rotation overlays deterministically in play and seek', () => {
    const createRuntime = (applied: Array<Map<string, { x: number; y: number; z: number }>>) => new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        wave: {
          dt: [1000],
          _overlay: {
            bones: {
              TestBone: { freq: 8, amp: [0, 0, 0.12] },
            },
            duration: 1000,
          },
          vs: {},
        },
      },
      report: () => undefined,
    })
    const update = { persoId: 'avatar', eventId: 'evt-wave', eventMs: 1000, eventSeq: 9, action: { motion: 'wave' } }
    const playApplied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const seekApplied: Array<Map<string, { x: number; y: number; z: number }>> = []

    const playRuntime = createRuntime(playApplied)
    playRuntime.handleUpdate(update)
    playRuntime.evaluate(1250, 'play')

    const seekRuntime = createRuntime(seekApplied)
    seekRuntime.prepareSeek()
    seekRuntime.handleUpdate({ ...update, isSeekReplay: true })
    seekRuntime.evaluate(1250, 'seek')

    const expectedZ = Math.sin(2) * 0.12 * (250 / 300)
    expect(playApplied.at(-1)?.get('TestBone')?.z).toBeCloseTo(expectedZ, 5)
    expect(seekApplied.at(-1)?.get('TestBone')?.z).toBeCloseTo(expectedZ, 5)
  })

  it('samples MotionEngine custom jump overlays deterministically in play and seek', () => {
    const createRuntime = (applied: Array<Map<string, { x: number; y: number; z: number; py?: number }>>) => new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number; py?: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        jump: {
          dt: [1200],
          _overlay: {
            bones: {
              Hips: { custom: 'jump' },
            },
            duration: 1200,
          },
          vs: {},
        },
      },
      report: () => undefined,
    })
    const update = { persoId: 'avatar', eventId: 'evt-jump', eventMs: 1000, eventSeq: 9, action: { motion: 'jump' } }
    const playApplied: Array<Map<string, { x: number; y: number; z: number; py?: number }>> = []
    const seekApplied: Array<Map<string, { x: number; y: number; z: number; py?: number }>> = []

    const playRuntime = createRuntime(playApplied)
    playRuntime.handleUpdate(update)
    playRuntime.evaluate(1600, 'play')

    const seekRuntime = createRuntime(seekApplied)
    seekRuntime.prepareSeek()
    seekRuntime.handleUpdate({ ...update, isSeekReplay: true })
    seekRuntime.evaluate(1600, 'seek')

    expect(playApplied.at(-1)?.get('Hips')?.py).toBeCloseTo(0.12, 5)
    expect(seekApplied.at(-1)?.get('Hips')?.py).toBeCloseTo(0.12, 5)
  })

  it('plays a MotionEngine pose channel before gesture effects', () => {
    const applied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        posedThumb: {
          dt: [1000],
          vs: {
            pose: ['straight'],
            gesture: [['thumbup', null], null],
          },
        },
      },
      report: () => undefined,
    })

    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-motion',
      eventMs: 1000,
      eventSeq: 9,
      action: { motion: 'posedThumb' },
    })
    runtime.evaluate(1500, 'play')

    expect(applied.at(-1)?.get('LeftShoulder')).toBeDefined()
  })

  it('keeps MotionEngine pose commands persistent across seek past their dt window', () => {
    const applied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        poseStraight: {
          dt: [1000],
          vs: { pose: ['straight'] },
        },
      },
      report: () => undefined,
    })

    runtime.prepareSeek()
    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-pose-motion',
      eventMs: 0,
      eventSeq: 9,
      isSeekReplay: true,
      action: { motion: 'poseStraight' },
    })
    runtime.evaluate(5000, 'seek')

    expect(applied.at(-1)?.get('LeftShoulder')?.z).toBeCloseTo(-1.605, 2)
  })

  it('releases a MotionEngine gesture deterministically when its motion expires', () => {
    const applied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        thumbs: {
          dt: [1000],
          vs: { gesture: [['thumbup', null], null] },
        },
      },
      report: () => undefined,
    })

    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-motion',
      eventMs: 1000,
      eventSeq: 12,
      action: { motion: 'thumbs' },
    })
    runtime.evaluate(1200, 'play')
    runtime.evaluate(2000, 'play')

    expect(applied[0]?.get('LeftShoulder')?.z).not.toBe(applied[1]?.get('LeftShoulder')?.z)
  })

  it('plays mirrored MotionEngine gesture commands deterministically', () => {
    const warnings: string[] = []
    const applied: Array<Map<string, { x: number; y: number; z: number }>> = []
    const runtime = new Avatar3DSemanticRuntime({
      engine: {
        setMood: () => undefined,
        gestureEngine: {
          applyResolvedSemanticPose(pose: Map<string, { x: number; y: number; z: number }>) {
            applied.push(pose)
          },
        },
        morphEngine: {
          morphs: new Map(),
          aliases: {},
          setFixed: () => undefined,
          setBaseline: () => undefined,
          snapFixed: () => undefined,
        },
      } as unknown as ConstructorParameters<typeof Avatar3DSemanticRuntime>[0]['engine'],
      visemeWeight: 0.75,
      localMotions: {
        mirrored: {
          dt: [1000],
          vs: { gesture: [['handup', null, true], null] },
        },
      },
      report: (code) => warnings.push(code),
    })

    runtime.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-motion',
      eventMs: 1000,
      eventSeq: 13,
      action: { motion: 'mirrored' },
    })
    runtime.evaluate(1200, 'play')

    expect(warnings).toEqual([])
    expect(applied.at(-1)?.get('RightHandThumb1')).toBeDefined()
  })
})

describe('AvatarAutoMotionController', () => {
  it('evaluates head drift and blink as a pure layer', () => {
    const controller = new AvatarAutoMotionController()

    controller.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-head-drift',
      eventMs: 100,
      eventSeq: 1,
      action: { headDrift: ({ elapsed }: { elapsed: number }) => ({ headRotateX: elapsed / 1000 }) },
    })
    controller.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-blink',
      eventMs: 100,
      eventSeq: 2,
      action: { blink: () => ({ eyesClosed: 0.4 }) },
    })

    expect(controller.evaluate(600).morphs).toMatchObject({
      headRotateX: 0.5,
      eyesClosed: 0.4,
    })
  })

  it('does not emit zero blink values that would force mood eyelids open', () => {
    const controller = new AvatarAutoMotionController()

    controller.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-blink',
      eventMs: 100,
      eventSeq: 1,
      action: { blink: () => ({ eyesClosed: 0 }) },
    })

    expect(controller.evaluate(600).morphs).toBeUndefined()
  })

  it('allows MotionEngine headMove to suppress automatic head drift', () => {
    const controller = new AvatarAutoMotionController()

    controller.handleUpdate({
      persoId: 'avatar',
      eventId: 'evt-head-drift',
      eventMs: 100,
      eventSeq: 1,
      action: { headDrift: ({ elapsed }: { elapsed: number }) => ({ headRotateX: elapsed / 1000 }) },
    })
    controller.setHeadMoveEnabled(false)

    expect(controller.evaluate(600).morphs).toBeUndefined()

    controller.setHeadMoveEnabled(true)

    expect(controller.evaluate(600).morphs?.headRotateX).toBe(0.5)
  })
})

describe('AvatarPoseApplier', () => {
  it('releases stale morphs smoothly in play and by snap in seek', () => {
    const fixed: Array<{ name: string; value: number | null }> = []
    const snapped: Array<{ name: string; value: number | null }> = []
    const applier = new AvatarPoseApplier({
      morphEngine: {
        setFixed(name: string, value: number | null) {
          fixed.push({ name, value })
        },
        snapFixed(name: string, value: number | null) {
          snapped.push({ name, value })
        },
      },
    } as unknown as ConstructorParameters<typeof AvatarPoseApplier>[0])

    applier.apply({ morphs: { mouthSmile: 0.5 } }, 'play')
    applier.apply({ morphs: {} }, 'play')
    applier.apply({ morphs: { mouthSmile: 0.5 } }, 'seek')
    applier.apply({ morphs: {} }, 'seek')

    expect(fixed).toContainEqual({ name: 'mouthSmile', value: null })
    expect(snapped).toContainEqual({ name: 'mouthSmile', value: 0.5 })
    expect(snapped).toContainEqual({ name: 'mouthSmile', value: null })
  })
})

describe('createHeadDriftFn — pure function of elapsed', () => {
  it('returns the identical pose for the same elapsed regardless of call history', () => {
    const fn = createHeadDriftFn()
    fn({ elapsed: 1000 })
    fn({ elapsed: 2000 })
    const afterHistory = fn({ elapsed: 5000 })

    const fresh = createHeadDriftFn()
    const direct = fresh({ elapsed: 5000 })

    expect(afterHistory).toEqual(direct)
  })

  it('produces the same pose for a forward jump as for the equivalent incremental walk', () => {
    const incremental = createHeadDriftFn()
    for (let elapsed = 0; elapsed < 5000; elapsed += 16) {
      incremental({ elapsed })
    }
    const viaWalk = incremental({ elapsed: 5000 })
    const direct = createHeadDriftFn()({ elapsed: 5000 })
    expect(direct).toEqual(viaWalk)
  })
})

describe('createBlinkScheduleFn — resync-safe (no in-progress state to misread)', () => {
  it('reaches a mid-blink frame (eyesClosed strictly between 0 and 1) within one period', () => {
    const fn = createBlinkScheduleFn()
    const samples: { elapsed: number; eyesClosed: number }[] = []
    for (let elapsed = 0; elapsed <= 4500; elapsed += 16) {
      const r = fn({ elapsed })
      samples.push({ elapsed, eyesClosed: r ? r.eyesClosed : 0 })
    }
    const midBlink = samples.find((s) => s.eyesClosed > 0 && s.eyesClosed < 1)
    expect(midBlink).toBeDefined()
  })

  it('gives the same eyesClosed value for a direct jump as for the incremental walk to the same elapsed', () => {
    const incremental = createBlinkScheduleFn()
    const samples: { elapsed: number; eyesClosed: number }[] = []
    for (let elapsed = 0; elapsed <= 4500; elapsed += 16) {
      const r = incremental({ elapsed })
      samples.push({ elapsed, eyesClosed: r ? r.eyesClosed : 0 })
    }
    const midBlink = samples.find((s) => s.eyesClosed > 0 && s.eyesClosed < 1)!

    // A fresh instance, called once directly at the mid-blink elapsed — this is
    // exactly what AvatarEngine.commitSeek() does after a seek: no incremental
    // history, just one direct call at the target position.
    const direct = createBlinkScheduleFn()
    const r = direct({ elapsed: midBlink.elapsed })

    expect(r?.eyesClosed ?? 0).toBeCloseTo(midBlink.eyesClosed, 5)
  })

  it('gives the correct (closed) value immediately after a backward jump (seek to an earlier position)', () => {
    const fn = createBlinkScheduleFn()
    const incremental = createBlinkScheduleFn()
    const samples: { elapsed: number; eyesClosed: number }[] = []
    for (let elapsed = 0; elapsed <= 4500; elapsed += 16) {
      const r = incremental({ elapsed })
      samples.push({ elapsed, eyesClosed: r ? r.eyesClosed : 0 })
    }
    const midBlink = samples.find((s) => s.eyesClosed > 0 && s.eyesClosed < 1)!

    fn({ elapsed: 4500 })
    const r = fn({ elapsed: midBlink.elapsed }) // jump backward, no crash, correct value
    expect(r?.eyesClosed ?? 0).toBeCloseTo(midBlink.eyesClosed, 5)
  })

  it('returns eyesClosed: 0 well outside any blink window', () => {
    const fn = createBlinkScheduleFn()
    const r = fn({ elapsed: 0 })
    expect(r?.eyesClosed).toBe(0)
  })
})

describe('createBreathTriggerFn — one-shot trigger, not resynced directly on seek', () => {
  it('fires triggerBreath at most once per period during continuous incremental ticking', () => {
    const fn = createBreathTriggerFn()
    let triggerCount = 0
    for (let elapsed = 0; elapsed <= 4000; elapsed += 16) {
      const r = fn({ elapsed })
      if (r?.triggerBreath) triggerCount++
    }
    expect(triggerCount).toBe(1)
  })

  it('recovers correctly after a backward jump (elapsed < previous elapsed resets epoch tracking)', () => {
    const fn = createBreathTriggerFn()
    for (let elapsed = 0; elapsed <= 4000; elapsed += 16) fn({ elapsed })

    let triggerCount = 0
    for (let elapsed = 0; elapsed <= 4000; elapsed += 16) {
      const r = fn({ elapsed })
      if (r?.triggerBreath) triggerCount++
    }
    expect(triggerCount).toBe(1)
  })
})
