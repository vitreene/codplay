/**
 * Static TalkingHead mood data used by the Avatar idle sampler.
 *
 * Keeping these values in one module prevents the expression baseline and the
 * autonomous animation layer from drifting apart. The data is intentionally
 * model-independent: a model only needs to expose the corresponding morphs
 * and the Avatar morph layer ignores channels it does not provide.
 */
import type {
  ThAnimationTemplate,
  ThMoodTemplateSet,
  ThNativeMood,
  ThPoseChoice,
  ThTemplateAlternative,
  ThTemplateChannel,
  ThTemplateNumber,
} from '../avatar-types.js'

/** Exact native facial baseline values copied from TalkingHead.animMoods. */
export const TH_MOOD_BASELINES: Readonly<Record<ThNativeMood, Readonly<Record<string, number>>>> = {
  neutral: { eyesLookDown: 0.1 },
  happy: { mouthSmile: 0.2, eyesLookDown: 0.1 },
  angry: {
    eyesLookDown: 0.1,
    browDownLeft: 0.6,
    browDownRight: 0.6,
    jawForward: 0.3,
    mouthFrownLeft: 0.7,
    mouthFrownRight: 0.7,
    mouthRollLower: 0.2,
    mouthShrugLower: 0.3,
    handFistLeft: 1,
    handFistRight: 1,
  },
  sad: {
    eyesLookDown: 0.2,
    browDownRight: 0.1,
    browInnerUp: 0.6,
    browOuterUpRight: 0.2,
    eyeSquintLeft: 0.7,
    eyeSquintRight: 0.7,
    mouthFrownLeft: 0.8,
    mouthFrownRight: 0.8,
    mouthLeft: 0.2,
    mouthPucker: 0.5,
    mouthRollLower: 0.2,
    mouthRollUpper: 0.2,
    mouthShrugLower: 0.2,
    mouthShrugUpper: 0.2,
    mouthStretchLeft: 0.4,
  },
  fear: {
    browInnerUp: 0.7,
    eyeSquintLeft: 0.5,
    eyeSquintRight: 0.5,
    eyeWideLeft: 0.6,
    eyeWideRight: 0.6,
    mouthClose: 0.1,
    mouthFunnel: 0.3,
    mouthShrugLower: 0.5,
    mouthShrugUpper: 0.5,
  },
  disgust: {
    browDownLeft: 0.7,
    browDownRight: 0.1,
    browInnerUp: 0.3,
    eyeSquintLeft: 1,
    eyeSquintRight: 1,
    eyeWideLeft: 0.5,
    eyeWideRight: 0.5,
    eyesRotateX: 0.05,
    mouthLeft: 0.4,
    mouthPressLeft: 0.3,
    mouthRollLower: 0.3,
    mouthShrugLower: 0.3,
    mouthShrugUpper: 0.8,
    mouthUpperUpLeft: 0.3,
    noseSneerLeft: 1,
    noseSneerRight: 0.7,
  },
  love: {
    browInnerUp: 0.4,
    browOuterUpLeft: 0.2,
    browOuterUpRight: 0.2,
    mouthSmile: 0.2,
    eyeBlinkLeft: 0.6,
    eyeBlinkRight: 0.6,
    eyeWideLeft: 0.7,
    eyeWideRight: 0.7,
    bodyRotateX: 0.1,
    mouthDimpleLeft: 0.1,
    mouthDimpleRight: 0.1,
    mouthPressLeft: 0.2,
    mouthShrugUpper: 0.2,
    mouthUpperUpLeft: 0.1,
    mouthUpperUpRight: 0.1,
  },
  sleep: { eyeBlinkLeft: 1, eyeBlinkRight: 1, eyesClosed: 0.6 },
}

/** Native blink alternatives, including the 85% single-blink probability. */
export const TH_BLINK_TEMPLATES: readonly ThTemplateAlternative[] = [
  {
    probability: 0.85,
    template: createTemplate([1000, 8000, 1, 2], [50, [100, 300], 100], {
      eyeBlinkLeft: values(1, 1, 0),
      eyeBlinkRight: values(1, 1, 0),
    }),
  },
  {
    template: createTemplate([1000, 4000, 1, 2], [
      50, [100, 200], 100, [10, 400, 0], 50, [100, 200], 100,
    ], {
      eyeBlinkLeft: values(1, 1, 0, 0, 1, 1, 0),
      eyeBlinkRight: values(1, 1, 0, 0, 1, 1, 0),
    }),
  },
]

/** Native idle animation templates, keyed by mood. */
export const TH_MOOD_TEMPLATES: Readonly<Record<ThNativeMood, ThMoodTemplateSet>> = {
  neutral: createMoodTemplates({
    breathing: createBreathing(1500, [1200, 500, 1000], 0.5),
    head: createHead([0, 1000], [200, 5000], [-0.04, 0.1], [-0.3, 0.3], [-0.08, 0.08]),
    speakingHead: createSpeakingHead(),
    mouth: createMouth(),
    misc: createMisc(),
  }),
  happy: createMoodTemplates({
    breathing: createBreathing(1500, [1200, 500, 1000], 0.5),
    head: createHead(undefined, [1000, 5000], [-0.04, 0.1], [-0.3, 0.3], [-0.08, 0.08]),
    speakingHead: createSpeakingHead(),
    mouth: createMouth({ mouthLeft: [[0, 0.3, 2]], mouthSmile: [[0, 0.2, 3]] }),
    misc: createMisc(),
  }),
  angry: createMoodTemplates({
    breathing: createBreathing(500, [1000, 500, 1000], 0.7),
    head: createHead([100, 500], [200, 5000], [-0.04, 0.1], [-0.2, 0.2], [-0.08, 0.08]),
    speakingHead: createSpeakingHead(),
    mouth: createMouth(),
    misc: createMisc(),
  }),
  sad: createMoodTemplates({
    breathing: createBreathing(1500, [1000, 500, 1000], 0.3),
    head: createHead([100, 500], [200, 5000], [-0.04, 0.1], [-0.2, 0.2], [-0.08, 0.08]),
    speakingHead: createSpeakingHead(),
    mouth: createMouth(),
    misc: createMisc(),
  }),
  fear: createMoodTemplates({
    breathing: createBreathing(500, [1000, 500, 1000], 0.7),
    head: createHead([100, 500], [200, 3000], [-0.06, 0.12], [-0.7, 0.7], [-0.1, 0.1]),
    speakingHead: createSpeakingHead(),
    mouth: createMouth(),
    misc: createMisc(),
  }),
  disgust: createMoodTemplates({
    breathing: createBreathing(1500, [1000, 500, 1000], 0.5),
    head: createHead([100, 500], [200, 5000], [-0.04, 0.1], [-0.2, 0.2], [-0.08, 0.08]),
    speakingHead: createSpeakingHead(),
    mouth: createMouth(),
    misc: createMisc(),
  }),
  love: createMoodTemplates({
    breathing: createBreathing(1500, [1500, 500, 1500], 0.8),
    head: createHead(undefined, [1000, 5000], [-0.04, 0.1], [-0.3, 0.3], [-0.08, 0.08]),
    speakingHead: createSpeakingHead(),
    blink: createBlinkAfter(2000),
    mouth: createMouth({ mouthLeft: [[0, 0.3, 2]] }),
    misc: createMisc({
      firstDuration: [500, 1000],
      browInnerUp: [[0.3, 0.6, 2]],
      browOuterUpLeft: [[0.1, 0.3, 2]],
      browOuterUpRight: [[0.1, 0.3, 2]],
    }),
  }),
  sleep: createMoodTemplates({
    breathing: createBreathing(1500, [1000, 500, 1000], 0.6),
    head: createHead([1000, 5000], [2000, 10000], [0, 0.4], [-0.1, 0.1], [-0.04, 0.04]),
    speakingHead: createSpeakingHead(),
    eyes: [{ template: createDisabled(10010) }],
    speakingEyes: [{ template: createDisabled(10010) }],
    blink: [{ template: createDisabled(10020) }],
    mouth: createDisabled(10030),
    misc: createDisabled(10040),
  }),
}

/** Native eye templates shared by every mood. */
export const TH_EYE_TEMPLATES: Readonly<{
  idle: readonly ThTemplateAlternative[]
  speaking: readonly ThTemplateAlternative[]
}> = createEyeTemplates()

/** Returns the exact native template set, including shared eyes and blink data. */
function createMoodTemplates(input: Partial<ThMoodTemplateSet>): ThMoodTemplateSet {
  return {
    breathing: input.breathing ?? createDisabled(0),
    head: input.head ?? createDisabled(0),
    speakingHead: input.speakingHead ?? createSpeakingHead(),
    eyes: input.eyes ?? createEyeTemplates().idle,
    speakingEyes: input.speakingEyes ?? createEyeTemplates().speaking,
    blink: input.blink ?? TH_BLINK_TEMPLATES,
    mouth: input.mouth ?? createMouth(),
    misc: input.misc ?? createMisc(),
  }
}

/** Builds the two state-dependent eye template alternatives used by TH. */
function createEyeTemplates(): Readonly<{
  idle: readonly ThTemplateAlternative[]
  speaking: readonly ThTemplateAlternative[]
}> {
  return {
    idle: [
      {
        probability: 0.2,
        template: createTemplate([200, 5000], [200, [2000, 5000], [3000, 10000, 1, 2]], {
          headMove: values(0.5),
          eyesRotateY: values([-0.6, 0.6]),
          eyesRotateX: values([-0.2, 0.6]),
          eyeContact: values(null, 1),
        }),
      },
      {
        template: createTemplate([200, 5000], [200, [2000, 5000, 1, 2]], {
          headMove: values(0.5),
          eyesRotateY: values([-0.6, 0.6]),
          eyesRotateX: values([-0.2, 0.6]),
        }),
      },
    ],
    speaking: [
      {
        probability: 0.5,
        template: createTemplate([200, 5000], [0, [3000, 10000, 1, 2], [2000, 5000]], {
          eyeContact: values(1, null),
          headMove: values(null, 0.5, null),
          eyesRotateY: values(null, [-0.6, 0.6]),
          eyesRotateX: values(null, [-0.2, 0.6]),
        }),
      },
      {
        template: createTemplate([200, 5000], [200, [2000, 5000, 1, 2]], {
          headMove: values(0.5, null),
          eyesRotateY: values([-0.6, 0.6]),
          eyesRotateX: values([-0.2, 0.6]),
        }),
      },
    ],
  }
}

/** Creates one native breathing template. */
function createBreathing(
  delay: ThTemplateNumber,
  durations: readonly ThTemplateNumber[],
  peak: number,
): ThAnimationTemplate {
  return createTemplate(delay, durations, { chestInhale: values(peak, peak, 0) })
}

/** Creates one native idle head template. */
function createHead(
  delay: ThTemplateNumber | undefined,
  duration: ThTemplateNumber,
  x: ThTemplateNumber,
  y: ThTemplateNumber,
  z: ThTemplateNumber,
): ThAnimationTemplate {
  return createTemplate(delay, [duration], {
    bodyRotateX: values(x),
    bodyRotateY: values(y),
    bodyRotateZ: values(z),
  })
}

/** Creates the native speaking-head template shared by all moods. */
function createSpeakingHead(): ThAnimationTemplate {
  return createTemplate(undefined, [[0, 1000, 0]], {
    bodyRotateX: values([-0.05, 0.15, 1, 2]),
    bodyRotateY: values([-0.1, 0.1]),
    bodyRotateZ: values([-0.1, 0.1]),
  })
}

/** Creates the common native mouth micro-animation with mood additions. */
function createMouth(extra: Readonly<Record<string, ThTemplateChannel>> = {}): ThAnimationTemplate {
  return createTemplate([1000, 5000], [[100, 500], [100, 5000, 2]], {
    mouthRollLower: values([0, 0.3, 2]),
    mouthRollUpper: values([0, 0.3, 2]),
    mouthStretchLeft: values([0, 0.3]),
    mouthStretchRight: values([0, 0.3]),
    mouthPucker: values([0, 0.3]),
    ...extra,
  })
}

/** Creates the common native brow and squint micro-animation. */
function createMisc(options: Readonly<{
  firstDuration?: ThTemplateNumber
  browInnerUp?: ThTemplateChannel
  browOuterUpLeft?: ThTemplateChannel
  browOuterUpRight?: ThTemplateChannel
}> = {}): ThAnimationTemplate {
  return createTemplate([100, 5000], [
    options.firstDuration ?? [100, 500],
    [1000, 5000, 2],
  ], {
    eyeSquintLeft: values([0, 0.3, 2]),
    eyeSquintRight: values([0, 0.3, 2]),
    browInnerUp: options.browInnerUp ?? values([0, 0.3, 2]),
    browOuterUpLeft: options.browOuterUpLeft ?? values([0, 0.3, 2]),
    browOuterUpRight: options.browOuterUpRight ?? values([0, 0.3, 2]),
  })
}

/** Creates a native blink template with a mood-specific first delay. */
function createBlinkAfter(delay: number): readonly ThTemplateAlternative[] {
  return TH_BLINK_TEMPLATES.map(({ probability, template }) => ({
    ...(probability === undefined ? {} : { probability }),
    template: { ...template, delay: replaceFirstRange(template.delay, delay) },
  }))
}

/** Creates an empty delayed template used by the native sleeping mood. */
function createDisabled(delay: number): ThAnimationTemplate {
  return { delay, dt: [], vs: {} }
}

/** Creates a typed native template while omitting absent delay and duration fields. */
function createTemplate(
  delay: ThTemplateNumber | undefined,
  dt: readonly ThTemplateNumber[] | undefined,
  vs: Readonly<Record<string, ThTemplateChannel>>,
): ThAnimationTemplate {
  return {
    ...(delay === undefined ? {} : { delay }),
    ...(dt === undefined ? {} : { dt }),
    vs,
  }
}

/** Creates one-value or multi-value channel data without repeating tuple casts. */
function values(...items: readonly (ThTemplateNumber | null)[]): ThTemplateChannel {
  return items
}

/** Replaces only the first lower bound of a native delay range. */
function replaceFirstRange(
  value: ThTemplateNumber | undefined,
  delay: number,
): ThTemplateNumber | undefined {
  if (value === undefined || typeof value === 'number') return delay
  return [delay, value[1] ?? delay, value[2] ?? 1, value[3] ?? 5]
}

/** Returns the probability-free native choices for one mood. */
export function getThPoseChoices(mood: string, speaking: boolean): readonly ThPoseChoice[] {
  const longDelay: ThTemplateNumber = [5000, 30000]
  if (mood === 'happy') {
    if (speaking) {
      return [
        { name: 'side', probability: 0.4, delay: longDelay },
        { name: 'straight', probability: 0.4, delay: longDelay },
        { name: 'hip', delay: [5000, 20000], body: { M: { name: 'wide', delay: longDelay } } },
      ]
    }
    return [
      { name: 'side', probability: 0.6, delay: longDelay },
      { name: 'hip', probability: 0.2, delay: longDelay, body: { M: { name: 'side' } } },
      { name: 'straight', probability: 0.1, delay: longDelay },
      { name: 'wide', delay: [5000, 10000] },
      { name: 'turn', delay: [1000, 3000] },
    ]
  }
  if (mood === 'angry') {
    return [
      { name: 'side', probability: 0.4, delay: longDelay },
      { name: 'straight', probability: 0.4, delay: longDelay },
      { name: 'hip', delay: longDelay, body: { M: { name: 'wide' } } },
    ]
  }
  if (mood === 'sad') {
    return [
      { name: 'side', probability: 0.4, delay: longDelay },
      { name: 'straight', probability: 0.4, delay: longDelay },
      { name: 'side', delay: [5000, 20000], view: { full: { name: 'oneknee' } } },
    ]
  }
  if (mood === 'fear') {
    return [
      { name: 'side', probability: 0.8, delay: longDelay },
      { name: 'straight', delay: longDelay },
      { name: 'wide', delay: longDelay },
      { name: 'side', delay: [5000, 20000], view: { full: { name: 'oneknee' } } },
    ]
  }
  if (mood === 'disgust' || mood === 'sleep') {
    return [{ name: 'side', delay: [5000, 20000] }]
  }
  if (mood === 'love') {
    return [
      { name: 'side', probability: 0.4, delay: longDelay },
      { name: 'straight', probability: 0.2, delay: longDelay },
      { name: 'hip', probability: 0.2, delay: longDelay, body: { M: { name: 'side' } } },
      { name: 'side', delay: [5000, 10000], view: { full: { name: 'kneel' } } },
      { name: 'turn', delay: [1000, 3000], body: { M: { name: 'wide' } } },
      { name: 'back', delay: [1000, 3000], body: { M: { name: 'wide' } } },
      { name: 'side', delay: [5000, 20000], body: { M: { name: 'side' } }, view: { full: { name: 'bend' } } },
      { name: 'side', delay: [1000, 3000], view: { full: { name: 'oneknee', delay: [5000, 10000] } } },
    ]
  }
  return [
    { name: 'side', probability: 0.5, delay: longDelay },
    { name: 'hip', probability: 0.3, delay: longDelay, body: { M: { name: 'wide' } } },
    { name: 'straight', delay: longDelay },
  ]
}

/** Resolves one native choice with TalkingHead's view-before-body precedence. */
export function resolveThPoseChoice(
  choice: ThPoseChoice,
  body: 'M' | 'F' | undefined,
  view: 'full' | 'mid' | 'upper' | 'head' | undefined,
): ThPoseChoice {
  const variant = (view === undefined ? undefined : choice.view?.[view])
    ?? (body === undefined ? undefined : choice.body?.[body])
  if (variant === undefined) return choice
  return {
    ...choice,
    name: variant.name,
    ...(variant.delay === undefined ? {} : { delay: variant.delay }),
  }
}
