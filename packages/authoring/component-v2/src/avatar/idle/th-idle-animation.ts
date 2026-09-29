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
  createThTemplateCursor,
  createRandomSource,
  sampleLoopedAlternativeMarkers,
  sampleLoopedAlternatives,
  sampleLoopedTemplate,
  sampleTemplateNumber,
  type ThTemplateCursor,
} from './th-animation-template.js'

/** Retains only the live loop cursors belonging to one mood occurrence. */
export type ThIdleSamplingState = {
  readonly loops: Map<string, ThTemplateCursor>
  pose: ThPoseCursor | undefined
  headTasks: ThHeadTaskCursor | undefined
}

type ThPoseCursor = {
  lastElapsedMs: number
  random: RandomSource
  changes: { name: string; startAt: number }[]
  next: { name: string; startAt: number } | undefined
}

type NativeHeadTaskRecord = Readonly<{ order: number; task: NativeHeadTask }>

type ThHeadTaskCursor = {
  lastElapsedMs: number
  random: RandomSource
  markerCount: number
  tasks: NativeHeadTaskRecord[]
  nextTaskOrder: number
  activeTask: NativeHeadTaskRecord | undefined
  lastStartedAt: number | undefined
  pendingStarts: { record: NativeHeadTaskRecord; startAt: number }[]
  eyeInterruptions: { channel: string; at: number; value: number }[]
  maxEndAt: number
}

/** Creates the private Play state for one received mood occurrence. */
export function createThIdleSamplingState(): ThIdleSamplingState {
  return { loops: new Map(), pose: undefined, headTasks: undefined }
}

/** Returns a loop cursor without changing the pure Seek sampling path. */
function liveCursor(state: ThIdleSamplingState | undefined, name: string): ThTemplateCursor | undefined {
  if (state === undefined) return undefined
  let cursor = state.loops.get(name)
  if (cursor === undefined) {
    cursor = createThTemplateCursor()
    state.loops.set(name, cursor)
  }
  return cursor
}
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
  initialMorphs: Readonly<Record<string, number>> = {},
  headMarkerCutoffAt = Number.POSITIVE_INFINITY,
  resolveHeadSourceAt?: (elapsedMs: number) => Readonly<Record<string, number>>,
  samplingState?: ThIdleSamplingState,
): ThIdleFrame {
  if (!options.enabled || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return { morphs: {}, overlay: null }
  }

  const templates = resolveTemplates(mood, options.speaking === true)
  const templateBaseline = resolveTemplateBaseline(baseline)
  const templateInitial = Object.keys(initialMorphs).length === 0
    ? {}
    : resolveTemplateBaseline(initialMorphs)
  const eyeContactProbability = resolveProbability(
    options.eyeContactProbability,
    options.speaking === true ? 0.5 : 0.2,
  )
  const headMoveProbability = resolveProbability(options.headMoveProbability, 0.5)
  const morphs: Record<string, number> = {}
  let eyeContact: number | undefined
  let headMove: number | undefined
  let headMoveTask: ThIdleFrame['headMoveTask']

  if (options.breathe) {
    mergeTemplate(
      morphs, templates.breathing, elapsedMs, options.seed, 'breathing',
      templateBaseline, templateInitial, liveCursor(samplingState, 'breathing'),
    )
  }
  if (options.headMove) {
    const head = options.speaking === true ? templates.speakingHead : templates.head
    mergeTemplate(
      morphs, head, elapsedMs, options.seed, 'head',
      templateBaseline, templateInitial, liveCursor(samplingState, 'head'),
    )
    const eyeAlternatives = setEyeContactProbability(
      options.speaking === true ? templates.speakingEyes : templates.eyes,
      eyeContactProbability,
    )
    const eyesSeed = stableSeed(`${options.seed}:eyes:${options.speaking === true}`)
    const eyes = sampleLoopedAlternativeMarkers(
      eyeAlternatives,
      elapsedMs,
      eyesSeed,
      'headMove',
      templateBaseline,
      templateInitial,
      liveCursor(samplingState, 'eyes'),
    )
    let resolvedEyes = setHeadMoveProbability(eyes.values, headMoveProbability)
    if (typeof resolvedEyes.eyeContact === 'number') eyeContact = resolvedEyes.eyeContact
    if (typeof resolvedEyes.headMove === 'number') headMove = resolvedEyes.headMove
    const headMarkers = headMarkerCutoffAt === Number.POSITIVE_INFINITY
      ? eyes.markers
      : eyes.markers.filter(({ startAt }) => startAt <= headMarkerCutoffAt)
    if (headMarkers.length > 0) {
      const headMoveFrame = sampleNativeHeadMove(
        elapsedMs,
        options.seed,
        headMarkers,
        headMoveProbability,
        (startAt, moveStartAt, eyeInterruptions) => {
          const headAtStart = sampleLoopedTemplate(
            head,
            startAt,
            stableSeed(`${options.seed}:head`),
            templateBaseline,
            templateInitial,
          )
          const eyeValues = sampleLoopedAlternatives(
            eyeAlternatives,
            startAt,
            eyesSeed,
            templateBaseline,
            templateInitial,
            eyeInterruptions,
          )
          const eyeMorphs: Record<string, number> = {}
          mergeEyes(eyeMorphs, eyeValues)
          const eyesAtMoveStart: Record<string, number> = {}
          mergeEyes(eyesAtMoveStart, sampleLoopedAlternatives(
            eyeAlternatives,
            moveStartAt,
            eyesSeed,
            templateBaseline,
            templateInitial,
            eyeInterruptions,
          ))
          return {
            eyeContact: eyeValues.eyeContact === 1,
            bodyRotateY: headAtStart.bodyRotateY ?? templateBaseline.bodyRotateY ?? 0,
            eyeYaw: (eyeMorphs.eyeLookInLeft ?? 0) - (eyeMorphs.eyeLookOutLeft ?? 0),
            eyeMorphs: eyesAtMoveStart,
            headMorphs: resolveHeadSourceAt?.(eyeValues.eyeContact === 1 ? startAt : moveStartAt) ?? {},
          }
        },
        samplingState,
      )
      if (headMoveFrame.eyeInterruptions.length > 0) {
        resolvedEyes = setHeadMoveProbability(sampleLoopedAlternatives(
          eyeAlternatives,
          elapsedMs,
          eyesSeed,
          templateBaseline,
          templateInitial,
          headMoveFrame.eyeInterruptions,
          liveCursor(samplingState, 'resolvedEyes'),
        ), headMoveProbability)
      }
      mergeEyes(morphs, resolvedEyes)
      Object.assign(morphs, headMoveFrame.morphs)
      if (headMoveFrame.endAt !== undefined) headMoveTask = {
        endAt: headMoveFrame.endAt,
        ...(headMoveFrame.lastStartedAt === undefined ? {} : { lastStartedAt: headMoveFrame.lastStartedAt }),
      }
      if (headMoveFrame.eyeContact !== undefined) eyeContact = headMoveFrame.eyeContact
    } else {
      mergeEyes(morphs, resolvedEyes)
    }
  }

  mergeTemplate(
    morphs, templates.mouth, elapsedMs, options.seed, 'mouth',
    templateBaseline, templateInitial, liveCursor(samplingState, 'mouth'),
  )
  mergeTemplate(
    morphs, templates.misc, elapsedMs, options.seed, 'misc',
    templateBaseline, templateInitial, liveCursor(samplingState, 'misc'),
  )
  if (options.view !== undefined && options.view !== 'full') {
    mergeCloseViewVariation(morphs, templateBaseline, elapsedMs, options.seed)
  }

  const frame: {
    morphs: ThIdleMorphs
    overlay: AvatarGestureOverlay | null
    eyeContact?: number
    headMove?: number
    headMoveTask?: ThIdleFrame['headMoveTask']
    pose?: string
    poseStartAt?: number
    poseHistory?: readonly Readonly<{ name: string; startAt: number }>[]
  } = {
    morphs,
    overlay: null,
    ...(eyeContact === undefined ? {} : { eyeContact }),
    ...(headMove === undefined ? {} : { headMove }),
    ...(headMoveTask === undefined ? {} : { headMoveTask }),
  }
  if (options.poseChanges === true) {
    const poseHistory = samplePoseChanges(
      mood,
      elapsedMs,
      options.seed,
      options.speaking === true,
      options.body,
      options.view,
      samplingState,
    )
    frame.poseHistory = poseHistory
    const pose = poseHistory.at(-1)
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

/** Holds the timing and source captured when a native head task begins. */
type NativeHeadTask = Readonly<{
  startAt: number
  moveStartAt: number
  moveEndAt: number
  holdEndAt: number
  endAt: number
  eyeContact: boolean
  eyeMorphs: Readonly<Record<string, number>>
  headFrom: Readonly<Record<string, number>>
  headTo: Readonly<Record<string, number>>
}>

/** Samples the extra head movement task that TH schedules from `headMove`. */
function sampleNativeHeadMove(
  elapsedMs: number,
  seed: number,
  markers: readonly Readonly<{ startAt: number; value: number }>[],
  probability: number,
  sampleTarget: (
    startAt: number,
    moveStartAt: number,
    eyeInterruptions: readonly Readonly<{ channel: string; at: number; value: number }>[],
  ) => Readonly<{
    eyeContact: boolean
    bodyRotateY: number
    eyeYaw: number
    eyeMorphs: Readonly<Record<string, number>>
    headMorphs: Readonly<Record<string, number>>
  }>,
  samplingState?: ThIdleSamplingState,
): Readonly<{
  morphs: Readonly<Record<string, number>>
  eyeContact?: number
  endAt?: number
  lastStartedAt?: number
  eyeInterruptions: readonly Readonly<{ channel: string; at: number; value: number }>[]
}> {
  let cursor = samplingState?.headTasks
  if (cursor === undefined || elapsedMs < cursor.lastElapsedMs || markers.length < cursor.markerCount) {
    cursor = {
      lastElapsedMs: -1,
      random: createRandomSource(stableSeed(`${seed}:headmove`)),
      markerCount: 0,
      tasks: [],
      nextTaskOrder: 0,
      activeTask: undefined,
      lastStartedAt: undefined,
      pendingStarts: [],
      eyeInterruptions: [],
      maxEndAt: -Infinity,
    }
    if (samplingState !== undefined) samplingState.headTasks = cursor
  }
  cursor.lastElapsedMs = elapsedMs
  const previousInterruptionCount = cursor.eyeInterruptions.length
  cursor.pendingStarts = cursor.pendingStarts.filter((pending) => {
    if (pending.startAt > elapsedMs) return true
    if (cursor.activeTask === undefined || pending.record.order > cursor.activeTask.order) {
      cursor.activeTask = pending.record
      cursor.lastStartedAt = pending.startAt
    }
    return false
  })
  for (const marker of markers.slice(cursor.markerCount)) {
    // TH creates a separate task when the eye template emits headMove. Its
    // first time slot delays the movement after that marker, not after mood 0.
    const chance = Math.max(0, Math.min(1, marker.value > 0 ? probability : 0))
    if (chance === 0 || cursor.random.random() >= chance) continue
    const delayDuration = sampleTemplateNumber([1_000, 2_000], cursor.random)
    const moveDuration = sampleTemplateNumber([1_000, 2_000, 1, 2], cursor.random)
    const holdDuration = sampleTemplateNumber([1_000, 2_000], cursor.random)
    const returnDuration = sampleTemplateNumber([1_000, 2_000, 1, 2], cursor.random)
    const moveStartAt = marker.startAt + delayDuration
    const moveEndAt = moveStartAt + moveDuration
    const holdEndAt = moveEndAt + holdDuration
    const endAt = holdEndAt + returnDuration
    const headRotateX = sampleTemplateNumber([-0.2, 0.2], cursor.random)
    const target = sampleTarget(marker.startAt, moveStartAt, cursor.eyeInterruptions)
    const headStartAt = target.eyeContact ? marker.startAt : moveStartAt
    const precedingHead = cursor.tasks.findLast(({ task }) => (
      headStartAt >= (task.eyeContact ? task.startAt : task.moveStartAt)
      && headStartAt <= task.endAt
    ))?.task
    const precedingEyes = cursor.tasks.findLast(({ task }) => (
      moveStartAt >= task.moveStartAt && moveStartAt <= task.endAt && !task.eyeContact
    ))?.task
    const headFrom = precedingHead === undefined
      ? {
        headRotateX: target.headMorphs.headRotateX ?? 0,
        headRotateY: target.headMorphs.headRotateY ?? 0,
        headRotateZ: target.headMorphs.headRotateZ ?? 0,
      }
      : sampleNativeHeadTask(precedingHead, headStartAt).morphs
    const eyeMorphs = precedingEyes === undefined
      ? target.eyeMorphs
      : sampleNativeHeadTask(precedingEyes, moveStartAt).morphs
    const headRotateY = target.eyeContact ? -target.bodyRotateY : target.eyeYaw
    const task: NativeHeadTask = {
      startAt: marker.startAt,
      moveStartAt,
      moveEndAt,
      holdEndAt,
      endAt,
      eyeContact: target.eyeContact,
      eyeMorphs,
      headFrom,
      headTo: { headRotateX, headRotateY, headRotateZ: -headRotateY / 4 },
    }
    const record = { order: cursor.nextTaskOrder, task }
    cursor.nextTaskOrder += 1
    cursor.tasks.push(record)
    cursor.maxEndAt = Math.max(cursor.maxEndAt, endAt)
    if (elapsedMs >= headStartAt) {
      cursor.activeTask = record
      cursor.lastStartedAt = headStartAt
    } else {
      cursor.pendingStarts.push({ record, startAt: headStartAt })
    }
    if (marker.value > 0 && !target.eyeContact) {
      cursor.eyeInterruptions.push({ channel: 'eyesRotateY', at: endAt, value: 0 })
    }
  }
  cursor.markerCount = markers.length
  if (cursor.eyeInterruptions.length !== previousInterruptionCount) {
    cursor.eyeInterruptions.sort((left, right) => left.at - right.at)
  }
  const activeTask = cursor.activeTask?.task
  const active = activeTask !== undefined && elapsedMs <= activeTask.endAt
    ? { ...sampleNativeHeadTask(activeTask, elapsedMs), endAt: activeTask.endAt }
    : { morphs: {} }
  cursor.tasks = cursor.tasks.filter(({ task }) => task.endAt >= elapsedMs)
  if (activeTask !== undefined && activeTask.endAt < elapsedMs) cursor.activeTask = undefined
  return {
    ...active,
    ...(Number.isFinite(cursor.maxEndAt) ? { endAt: cursor.maxEndAt } : {}),
    ...(cursor.lastStartedAt === undefined ? {} : { lastStartedAt: cursor.lastStartedAt }),
    eyeInterruptions: cursor.eyeInterruptions,
  }
}

/** Evaluates one independent TH head task, including its eye handoff. */
function sampleNativeHeadTask(
  task: NativeHeadTask,
  elapsedMs: number,
): Readonly<{ morphs: Readonly<Record<string, number>>; eyeContact?: number }> {
  const moveFrom = task.eyeContact ? task.startAt : task.moveStartAt
  const moveTo = task.eyeContact ? task.moveStartAt : task.moveEndAt
  const holdTo = task.eyeContact ? task.moveEndAt : task.holdEndAt
  const returnTo = task.eyeContact ? task.holdEndAt : task.endAt
  const head = elapsedMs <= moveTo
    ? interpolateHeadMove(task.headFrom, task.headTo, (elapsedMs - moveFrom) / (moveTo - moveFrom))
    : elapsedMs <= holdTo
      ? task.headTo
      : elapsedMs <= returnTo
        ? interpolateHeadMove(task.headTo, {
          headRotateX: 0,
          headRotateY: 0,
          headRotateZ: 0,
        }, (elapsedMs - holdTo) / (returnTo - holdTo))
        : { headRotateX: 0, headRotateY: 0, headRotateZ: 0 }
  if (task.eyeContact || elapsedMs < task.moveStartAt) return { morphs: head }

  const eyeReturn = elapsedMs <= task.moveEndAt
    ? 1 - sampleTalkingHeadEasing((elapsedMs - task.moveStartAt) / (task.moveEndAt - task.moveStartAt))
    : 0
  return {
    morphs: {
      ...head,
      eyeLookInLeft: (task.eyeMorphs.eyeLookInLeft ?? 0) * eyeReturn,
      eyeLookOutLeft: (task.eyeMorphs.eyeLookOutLeft ?? 0) * eyeReturn,
      eyeLookInRight: (task.eyeMorphs.eyeLookInRight ?? 0) * eyeReturn,
      eyeLookOutRight: (task.eyeMorphs.eyeLookOutRight ?? 0) * eyeReturn,
    },
    eyeContact: 0,
  }
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
  initialValues: Readonly<Record<string, number>>,
  cursor?: ThTemplateCursor,
): void {
  const values = sampleLoopedTemplate(template, elapsedMs, stableSeed(`${seed}:${channel}`), baseline, initialValues, cursor)
  for (const [name, value] of Object.entries(values)) {
    if (name === 'headMove' || name === 'eyeContact' || name === 'pose' || name === 'gesture') continue
    morphs[name] = value
  }
}

/** Reconstructs all delayed pose changes up to one absolute mood-relative time. */
function samplePoseChanges(
  mood: string,
  elapsedMs: number,
  seed: number,
  speaking: boolean,
  body: AvatarBody | undefined,
  view: AvatarView | undefined,
  state?: ThIdleSamplingState,
): readonly Readonly<{ name: string; startAt: number }>[] {
  const choices = getThPoseChoices(mood, speaking)
    .map((choice) => resolveThPoseChoice(choice, body, view))
  if (choices.length === 0) return []
  if (state !== undefined) {
    let cursor = state.pose
    if (cursor === undefined || elapsedMs < cursor.lastElapsedMs) {
      cursor = {
        lastElapsedMs: -1,
        random: createRandomSource(stableSeed(`${seed}:poses`)),
        changes: [],
        next: undefined,
      }
      state.pose = cursor
    }
    cursor.lastElapsedMs = elapsedMs
    while (cursor.changes.length < 10_000) {
      if (cursor.next === undefined) {
        const choice = choosePose(choices, cursor.random)
        const delay = sampleTemplateNumber(choice.delay, cursor.random)
        cursor.next = {
          name: choice.name,
          startAt: (cursor.changes.at(-1)?.startAt ?? 0) + delay,
        }
      }
      if (elapsedMs < cursor.next.startAt) break
      cursor.changes.push(cursor.next)
      cursor.next = undefined
    }
    return cursor.changes
  }
  const random = createRandomSource(stableSeed(`${seed}:poses`))
  const changes: { name: string; startAt: number }[] = []
  let cursor = 0
  for (let cycle = 0; cycle < 10_000; cycle += 1) {
    const choice = choosePose(choices, random)
    const delay = sampleTemplateNumber(choice.delay, random)
    const eventAt = cursor + delay
    if (elapsedMs < eventAt) return changes
    changes.push({ name: choice.name, startAt: eventAt })
    cursor = eventAt
  }
  return changes
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
