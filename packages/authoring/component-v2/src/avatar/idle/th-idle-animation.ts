/**
 * Deterministic adaptation of TalkingHead's mood animation layer.
 *
 * TalkingHead keeps breathing, pose changes, head movement, eye movement and
 * facial micro-movements in `animMoods`. Avatar V2 samples those templates
 * from the CodPlay clock so Play and Seek use the same generated values.
 */
import type {
  AvatarBody,
  AvatarGestureOverlay,
  AvatarView,
  RandomSource,
  ThIdleFrame,
  ThIdleMorphs,
  ThIdleOptions,
  ThAnimationTemplate,
  ThMoodTemplateSet,
  ThNativeMood,
  ThPoseChoice,
} from '../avatar-types.js'
import { sampleTalkingHeadEasing } from '../avatar-easing.js'
import {
  createRandomSource,
  sampleLoopedAlternatives,
  sampleLoopedTemplate,
  sampleTemplateNumber,
} from './th-animation-template.js'
import {
  getThPoseChoices,
  resolveThPoseChoice,
  TH_MOOD_TEMPLATES,
} from './th-mood-data.js'

/** Facial channels TH jitters in close views to avoid a frozen expression. */
const TH_RANDOMIZED_MORPHS = [
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthLeft', 'mouthPressLeft',
  'mouthPressRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthShrugLower', 'mouthShrugUpper', 'noseSneerLeft', 'noseSneerRight',
  'mouthRollLower', 'mouthRollUpper', 'browDownLeft', 'browDownRight',
  'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff',
  'cheekSquintLeft', 'cheekSquintRight',
] as const

/** Samples the automatic TH animation channels for one absolute time. */
export function sampleThIdle(
  mood: string,
  elapsedMs: number,
  options: ThIdleOptions,
  baseline: Readonly<Record<string, number>> = {},
): ThIdleFrame {
  if (!options.enabled || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return { morphs: {}, overlay: null }
  }

  const templates = resolveTemplates(mood, options.speaking === true)
  const templateBaseline = resolveTemplateBaseline(baseline)
  const eyeContactProbability = resolveProbability(
    options.eyeContactProbability,
    options.speaking === true ? 0.5 : 0.2,
  )
  const headMoveProbability = resolveProbability(options.headMoveProbability, 0.5)
  const morphs: Record<string, number> = {}
  let eyeContact: number | undefined
  let headMove: number | undefined

  if (options.breathe) {
    mergeTemplate(morphs, templates.breathing, elapsedMs, options.seed, 'breathing', templateBaseline)
  }
  if (options.headMove) {
    const head = options.speaking === true ? templates.speakingHead : templates.head
    mergeTemplate(morphs, head, elapsedMs, options.seed, 'head', templateBaseline)
    const eyes = sampleLoopedAlternatives(
      setEyeContactProbability(
        options.speaking === true ? templates.speakingEyes : templates.eyes,
        eyeContactProbability,
      ),
      elapsedMs,
      stableSeed(`${options.seed}:eyes:${options.speaking === true}`),
      templateBaseline,
    )
    const resolvedEyes = setHeadMoveProbability(eyes, headMoveProbability)
    mergeEyes(morphs, resolvedEyes)
    if (typeof resolvedEyes.eyeContact === 'number') eyeContact = resolvedEyes.eyeContact
    if (typeof resolvedEyes.headMove === 'number') headMove = resolvedEyes.headMove
    if (typeof headMove === 'number' && headMove > 0) {
      const headMoveFrame = sampleNativeHeadMove(
        elapsedMs,
        options.seed,
        headMove,
        eyeContact === 1,
        morphs.bodyRotateY ?? templateBaseline.bodyRotateY ?? 0,
        (morphs.eyeLookInLeft ?? 0) - (morphs.eyeLookOutLeft ?? 0),
      )
      Object.assign(morphs, headMoveFrame.morphs)
      if (headMoveFrame.eyeContact !== undefined) eyeContact = headMoveFrame.eyeContact
    }
  }

  mergeTemplate(morphs, templates.mouth, elapsedMs, options.seed, 'mouth', templateBaseline)
  mergeTemplate(morphs, templates.misc, elapsedMs, options.seed, 'misc', templateBaseline)
  if (options.view !== undefined && options.view !== 'full') {
    mergeCloseViewVariation(morphs, templateBaseline, elapsedMs, options.seed)
  }

  const frame: {
    morphs: ThIdleMorphs
    overlay: AvatarGestureOverlay | null
    eyeContact?: number
    headMove?: number
    pose?: string
    poseStartAt?: number
  } = {
    morphs,
    overlay: null,
    ...(eyeContact === undefined ? {} : { eyeContact }),
    ...(headMove === undefined ? {} : { headMove }),
  }
  if (options.poseChanges === true) {
    const pose = samplePoseChange(
      mood,
      elapsedMs,
      options.seed,
      options.speaking === true,
      options.body,
      options.view,
    )
    if (pose !== undefined) {
      frame.pose = pose.name
      frame.poseStartAt = pose.startAt
    }
  }
  return frame
}

/** Reproduces TH's small random facial baseline variation outside full view. */
function mergeCloseViewVariation(
  morphs: Record<string, number>,
  baseline: Readonly<Record<string, number>>,
  elapsedMs: number,
  seed: number,
): void {
  const periodMs = 100
  const epoch = Math.floor(elapsedMs / periodMs)
  for (const name of TH_RANDOMIZED_MORPHS) {
    const lastEpoch = findLastVariationEpoch(seed, epoch, name)
    if (lastEpoch < 0) continue

    const previousEpoch = findLastVariationEpoch(seed, lastEpoch - 1, name)
    const from = previousEpoch < 0
      ? 0
      : seededUnit(`${seed}:close:value:${name}:${previousEpoch}`) * 0.2
    const to = seededUnit(`${seed}:close:value:${name}:${lastEpoch}`) * 0.2
    const elapsedSinceChange = elapsedMs - lastEpoch * periodMs
    const progress = sampleTalkingHeadEasing(elapsedSinceChange / periodMs)
    const base = baseline[name] ?? 0
    const templateValue = morphs[name] ?? base
    morphs[name] = templateValue + from + (to - from) * progress
  }
}

/** Selects one facial channel per deterministic native variation interval. */
function findLastVariationEpoch(seed: number, epoch: number, name: string): number {
  const index = TH_RANDOMIZED_MORPHS.indexOf(name as typeof TH_RANDOMIZED_MORPHS[number])
  for (let candidate = epoch; candidate >= 0; candidate -= 1) {
    const selected = Math.floor(
      seededUnit(`${seed}:close:index:${candidate}`) * TH_RANDOMIZED_MORPHS.length,
    )
    if (selected === index) return candidate
  }
  return -1
}

/** Resolves the exact recurring template family used by one TH mood. */
function resolveTemplates(mood: string, _speaking: boolean): ThMoodTemplateSet {
  const nativeMood = mood === 'sleeping'
    ? 'sleep'
    : isNativeMood(mood) ? mood : 'neutral'
  return TH_MOOD_TEMPLATES[nativeMood]
}

/** Selects the native eye-contact alternative with the current TH profile. */
function setEyeContactProbability(
  alternatives: readonly { probability?: number; template: ThAnimationTemplate }[],
  probability: number,
): readonly { probability?: number; template: ThAnimationTemplate }[] {
  const first = alternatives[0]
  if (first === undefined) return alternatives
  return [
    { ...first, probability },
    ...alternatives.slice(1),
  ]
}

/** Replaces the native head-move marker by the current TH profile value. */
function setHeadMoveProbability(
  values: Readonly<Record<string, number>>,
  probability: number,
): Readonly<Record<string, number>> {
  if (typeof values.headMove !== 'number' || values.headMove <= 0) return values
  return { ...values, headMove: probability }
}

/** Keeps a dynamic TH probability within the interval used by its alternatives. */
function resolveProbability(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value))
}

/** Converts signed TH eye rotations into the directional morph channels. */
function mergeEyes(
  morphs: Record<string, number>,
  values: Readonly<Record<string, number>>,
): void {
  if (values.eyesRotateX === undefined && values.eyesRotateY === undefined) return
  const horizontal = values.eyesRotateY ?? 0
  const vertical = values.eyesRotateX ?? 0
  morphs.eyesLookDown = Math.max(0, vertical)
  morphs.eyesLookUp = Math.max(0, -vertical)
  morphs.eyeLookOutLeft = Math.max(0, horizontal)
  morphs.eyeLookInLeft = Math.max(0, -horizontal)
  morphs.eyeLookOutRight = Math.max(0, -horizontal)
  morphs.eyeLookInRight = Math.max(0, horizontal)
}

/** Samples the extra head movement task that TH schedules from `headMove`. */
function sampleNativeHeadMove(
  elapsedMs: number,
  seed: number,
  probability: number,
  eyeContact: boolean,
  bodyRotateY: number,
  eyeYaw: number,
): Readonly<{ morphs: Readonly<Record<string, number>>; eyeContact?: number }> {
  const random = createRandomSource(stableSeed(`${seed}:headmove`))
  const chance = Math.max(0, Math.min(1, probability))
  let cursor = 0

  for (let cycle = 0; cycle < 10_000; cycle += 1) {
    // TH creates this task with four dt segments and a leading null value:
    // the first segment is therefore a delay, followed by move, hold and
    // return. The task does not start rotating during that first segment.
    const delayDuration = sampleTemplateNumber([1_000, 2_000], random)
    const moveDuration = sampleTemplateNumber([1_000, 2_000, 1, 2], random)
    const holdDuration = sampleTemplateNumber([1_000, 2_000], random)
    const returnDuration = sampleTemplateNumber([1_000, 2_000, 1, 2], random)
    const startAt = cursor
    const moveStartAt = startAt + delayDuration
    const moveEndAt = moveStartAt + moveDuration
    const holdEndAt = moveEndAt + holdDuration
    const endAt = holdEndAt + returnDuration
    const headRotateX = sampleTemplateNumber([-0.2, 0.2], random)
    const headRotateY = eyeContact ? -bodyRotateY : eyeYaw
    const headRotateZ = -headRotateY / 4
    const selected = random.random() < chance

    if (elapsedMs < startAt) return { morphs: {} }
    if (selected && elapsedMs <= endAt) {
      if (elapsedMs < moveStartAt) return { morphs: {} }
      const morphs = elapsedMs <= moveEndAt
        ? interpolateHeadMove({
          headRotateX: 0,
          headRotateY: 0,
          headRotateZ: 0,
        }, {
          headRotateX,
          headRotateY,
          headRotateZ,
        }, (elapsedMs - moveStartAt) / moveDuration)
        : elapsedMs <= holdEndAt
          ? { headRotateX, headRotateY, headRotateZ }
          : interpolateHeadMove({
          headRotateX,
          headRotateY,
          headRotateZ,
        }, {
          headRotateX: 0,
          headRotateY: 0,
          headRotateZ: 0,
        }, (elapsedMs - holdEndAt) / returnDuration)
      return {
        morphs: {
          ...morphs,
          ...(eyeContact ? {} : {
            eyeLookInLeft: 0,
            eyeLookOutLeft: 0,
            eyeLookInRight: 0,
            eyeLookOutRight: 0,
          }),
        },
        ...(eyeContact ? {} : { eyeContact: 0 }),
      }
    }

    cursor = endAt
  }

  return { morphs: {} }
}

/** Interpolates one native head-move segment with the TH easing curve. */
function interpolateHeadMove(
  from: Readonly<Record<string, number>>,
  to: Readonly<Record<string, number>>,
  progress: number,
): Readonly<Record<string, number>> {
  const eased = sampleTalkingHeadEasing(progress)
  return {
    headRotateX: from.headRotateX + (to.headRotateX - from.headRotateX) * eased,
    headRotateY: from.headRotateY + (to.headRotateY - from.headRotateY) * eased,
    headRotateZ: from.headRotateZ + (to.headRotateZ - from.headRotateZ) * eased,
  }
}

/** Samples one recurring template and merges its concrete values. */
function mergeTemplate(
  morphs: Record<string, number>,
  template: ThAnimationTemplate,
  elapsedMs: number,
  seed: number,
  channel: string,
  baseline: Readonly<Record<string, number>>,
): void {
  const values = sampleLoopedTemplate(template, elapsedMs, stableSeed(`${seed}:${channel}`), baseline)
  for (const [name, value] of Object.entries(values)) {
    if (name === 'headMove' || name === 'eyeContact' || name === 'pose' || name === 'gesture') continue
    morphs[name] = value
  }
}

/** Resolves delayed pose changes from the native mood alternatives. */
function samplePoseChange(
  mood: string,
  elapsedMs: number,
  seed: number,
  speaking: boolean,
  body: AvatarBody | undefined,
  view: AvatarView | undefined,
): Readonly<{ name: string; startAt: number }> | undefined {
  const choices = getThPoseChoices(mood, speaking)
    .map((choice) => resolveThPoseChoice(choice, body, view))
  if (choices.length === 0) return undefined
  const random = createRandomSource(stableSeed(`${seed}:poses`))
  let cursor = 0
  let current: string | undefined
  for (let cycle = 0; cycle < 10_000; cycle += 1) {
    const choice = choosePose(choices, random)
    const delay = sampleTemplateNumber(choice.delay, random)
    const eventAt = cursor + delay
    if (elapsedMs < eventAt) return current === undefined ? undefined : { name: current, startAt: cursor }
    current = choice.name
    cursor = eventAt
  }
  return current === undefined ? undefined : { name: current, startAt: cursor }
}

/** Chooses a native mood pose according to its declared alternatives. */
function choosePose(choices: readonly ThPoseChoice[], random: RandomSource): ThPoseChoice {
  const coin = random.random()
  let cumulative = 0
  const unspecified = choices.filter((choice) => choice.probability === undefined).length
  const remaining = Math.max(0, 1 - choices.reduce((sum, choice) => sum + (choice.probability ?? 0), 0))
  for (const choice of choices) {
    const weight = choice.probability ?? (unspecified === 0 ? 0 : remaining / unspecified)
    cumulative += weight
    if (coin < cumulative) return choice
  }
  return choices[choices.length - 1]!
}

/** Converts a mood baseline into the pseudo eye channels used by TH templates. */
function resolveTemplateBaseline(baseline: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  return {
    ...baseline,
    eyesRotateX: (baseline.eyesLookDown ?? 0) - (baseline.eyesLookUp ?? 0),
    eyesRotateY: (baseline.eyeLookOutLeft ?? 0) - (baseline.eyeLookInLeft ?? 0),
  }
}

/** Creates a stable hash for one template stream. */
function stableSeed(value: string): number {
  let hash = 2_166_136_261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return hash | 0
}

/** Converts one stable string seed into a deterministic unit interval. */
function seededUnit(value: string): number {
  const hash = stableSeed(value) >>> 0
  return hash / 4_294_967_295
}

/** Identifies one of the native TalkingHead mood records. */
function isNativeMood(value: string): value is ThNativeMood {
  return value in TH_MOOD_TEMPLATES
}
