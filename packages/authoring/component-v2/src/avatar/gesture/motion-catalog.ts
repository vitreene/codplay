import rawMotions from './motions.json'
import {
  resolveThEmojiMotion,
  resolveThEmojiTemplate,
} from './th-emoji-catalog.js'
import type {
  AvatarGestureFrame,
  AvatarGestureOverlay,
  AvatarHandTarget,
  AvatarMotionDefinition,
  AvatarMotionPlayer,
  AvatarOverlayPosition,
  AvatarOverlayRotation,
  RandomSource,
  ThEmojiMotion,
} from '../avatar-types.js'
import { sampleTalkingHeadEasing } from '../avatar-easing.js'

type RawMotion = Readonly<{
  _description?: string
  _tags?: readonly string[]
  _track?: string
  dt?: readonly (number | readonly number[])[]
  delay?: number | readonly number[]
  rescale?: readonly number[]
  vs?: Readonly<Record<string, readonly unknown[]>>
  _overlay?: RawOverlay
}>

type RawOverlay = Readonly<{
  bones: Readonly<Record<string, RawOverlayBone>>
  delay?: number
  duration?: number
}>

type RawOverlayBone = Readonly<{
  freq: number
  amp: readonly number[]
  phase?: number
  custom?: string
}>

type PreparedMotion = AvatarMotionDefinition & Readonly<{
  delay: number | readonly number[] | undefined
  frameDurations: readonly (number | readonly number[])[]
  frameTimes: readonly number[]
  frameValues: Readonly<Record<string, readonly unknown[]>>
  gestureValues: readonly unknown[]
  poseValues: readonly unknown[]
  handLeftValues: readonly unknown[]
  handRightValues: readonly unknown[]
  eyeContactValues: readonly unknown[]
  headMoveValues: readonly unknown[]
  rescale: readonly number[] | undefined
  overlay: RawOverlay | undefined
  cameraContact: boolean
}>

type MotionTiming = Readonly<{
  presentationTimes: readonly number[]
  durationMs: number
  sourceAt: (presentationMs: number) => number
  presentationAt: (sourceMs: number) => number
}>

type MotionEntry = readonly [string, RawMotion]

const RELEASE_TAIL_MS = 250
const OVERLAY_FADE_MS = 300
const RAW_MOTION_ENTRIES = Object.entries(rawMotions as Record<string, RawMotion>) as MotionEntry[]

/** Internal semantic channels that belong to another Avatar capability. */
const RESERVED_CHANNELS = new Set([
  'headMove',
  'eyeContact',
  'gesture',
  'pose',
  'handLeft',
  'handRight',
])

/** Builds the adapted, immutable metadata catalogue from the external JSON. */
function createMotionCatalog(): Readonly<Record<string, PreparedMotion>> {
  const catalog: Record<string, PreparedMotion> = {}
  for (const [name, raw] of RAW_MOTION_ENTRIES) {
    catalog[name] = prepareMotion(name, raw, raw._track === 'mood' ? 'mood' : 'action')
  }
  return Object.freeze(catalog)
}

/** Converts one raw source record into the common Avatar motion representation. */
function prepareMotion(
  name: string,
  raw: RawMotion | ThEmojiMotion,
  track: 'action' | 'mood',
  cameraContact = false,
): PreparedMotion {
  const frameDurations = raw.dt ?? []
  const preparationRandom = createSeededRandom(name.length)
  const delay = raw.delay
  const frameTimes = buildFrameTimes(
    frameDurations,
    preparationRandom,
    sampleRawNumber(delay ?? 0, preparationRandom) ?? 0,
  )
  const frameValues = raw.vs ?? {}
  return {
    name,
    track,
    description: '_description' in raw ? raw._description ?? '' : '',
    tags: '_tags' in raw ? raw._tags ?? [] : [],
    durationMs: (frameTimes[frameTimes.length - 1] ?? 0) - (frameTimes[0] ?? 0),
    delay,
    frameDurations,
    frameTimes,
    frameValues,
    gestureValues: frameValues.gesture ?? [],
    poseValues: frameValues.pose ?? [],
    handLeftValues: frameValues.handLeft ?? [],
    handRightValues: frameValues.handRight ?? [],
    eyeContactValues: frameValues.eyeContact ?? [],
    headMoveValues: frameValues.headMove ?? [],
    rescale: raw.rescale,
    overlay: '_overlay' in raw ? raw._overlay : undefined,
    cameraContact,
  }
}

const PREPARED_MOTIONS = createMotionCatalog()

/** Metadata for every adapted motion, without exposing the source frame data. */
export const AVATAR_MOTION_CATALOG: Readonly<Record<string, AvatarMotionDefinition>> = Object.freeze(
  Object.fromEntries(
    Object.entries(PREPARED_MOTIONS).map(([name, motion]) => [name, {
      name: motion.name,
      track: motion.track,
      description: motion.description,
      tags: motion.tags,
      durationMs: motion.durationMs,
    }]),
  ),
)

/** All action names routed to the avatar-gesture component. */
export const AVATAR_GESTURE_MOTION_NAMES = Object.freeze(
  Object.values(PREPARED_MOTIONS)
    .filter((motion) => motion.track === 'action')
    .map((motion) => motion.name),
)

/** All mood names that carry usable baseline data for avatar-mood. */
export const AVATAR_MOOD_MOTION_NAMES = Object.freeze(
  Object.values(PREPARED_MOTIONS)
    .filter((motion) => motion.track === 'mood' && (motion.name === 'neutral' || motion.name === 'happy' || Object.keys(motion.frameValues).length > 0))
    .map((motion) => motion.name),
)

/** Returns one action motion player with deterministic range sampling. */
export function getAvatarActionMotion(
  name: string,
  seed: number,
  durationOverride?: number,
): AvatarMotionPlayer | undefined {
  const motion = PREPARED_MOTIONS[name]
  if (motion === undefined || motion.track !== 'action') return undefined
  return createMotionPlayer(motion, seed, durationOverride)
}

/** Resolves TalkingHead's playEmoji names through the same action catalogue. */
export function getAvatarEmojiMotion(
  name: string,
  seed: number,
  durationOverride?: number,
): AvatarMotionPlayer | undefined {
  const template = resolveThEmojiTemplate(name)
  if (template !== undefined) {
    const motion = prepareMotion(name, template, 'action', true)
    return createMotionPlayer(motion, seed, durationOverride)
  }

  const motionName = resolveThEmojiMotion(name)
  if (motionName === undefined) return undefined
  const motion = PREPARED_MOTIONS[motionName]
  return motion === undefined ? undefined : createMotionPlayer(motion, seed, durationOverride, true)
}

/** Returns the adapted baseline for one external mood motion. */
export function getAvatarMoodBaseline(name: string): Readonly<Record<string, number>> | undefined {
  const motion = PREPARED_MOTIONS[name]
  if (motion === undefined || motion.track !== 'mood') return undefined
  return createMoodBaseline(motion.frameValues)
}

/** Builds cumulative frame times from the source duration list. */
function buildFrameTimes(
  durations: readonly (number | readonly number[])[],
  random: RandomSource,
  startAt = 0,
): readonly number[] {
  const times = [startAt]
  for (const duration of durations) {
    times.push(times[times.length - 1]! + Math.max(0, sampleRawNumber(duration, random) ?? 0))
  }
  return times
}

/** Creates one deterministic source player and adapts optional duration changes. */
function createMotionPlayer(
  motion: PreparedMotion,
  seed: number,
  durationOverride: number | undefined,
  cameraContact = motion.cameraContact,
): AvatarMotionPlayer {
  const random = createSeededRandom(seed)
  const delay = sampleRawNumber(motion.delay ?? 0, random) ?? 0
  const frameTimes = buildFrameTimes(motion.frameDurations, random, delay)
  const timing = resolveMotionTiming(frameTimes, motion.rescale, durationOverride)
  const channels = createNumericChannels(motion.frameValues, random)
  const eyeContactValues = createNullableChannel(motion.eyeContactValues, random)
  const headMoveValues = createHeadMoveChannel(motion.headMoveValues, random)
  const motionDurationMs = timing.durationMs
  const overlayDurationMs = timing.presentationAt(resolveOverlayEnd(motion.overlay))
  const handDurationMs = resolveHandTargetEnd(
    timing.presentationTimes,
    motion.handLeftValues,
    motion.handRightValues,
  )
  const activeDurationMs = Math.max(motionDurationMs, overlayDurationMs, handDurationMs)
  const durationMs = Math.max(motionDurationMs + RELEASE_TAIL_MS, activeDurationMs)

  return {
    name: motion.name,
    durationMs,
    sample: (timeMs) => sampleMotion(
      timing,
      motionDurationMs,
      activeDurationMs,
      channels,
      motion.gestureValues,
      motion.poseValues,
      motion.handLeftValues,
      motion.handRightValues,
      eyeContactValues,
      headMoveValues,
      motion.overlay,
      cameraContact,
      timeMs,
    ),
  }
}

/** Resolves one action frame, including its return to the neutral action layer. */
function sampleMotion(
  timing: MotionTiming,
  motionDurationMs: number,
  activeDurationMs: number,
  channels: Readonly<Record<string, readonly (number | null)[]>>,
  rawGestureValues: readonly unknown[],
  rawPoseValues: readonly unknown[],
  rawHandLeftValues: readonly unknown[],
  rawHandRightValues: readonly unknown[],
  eyeContactValues: readonly (number | null)[],
  headMoveValues: readonly (number | null)[],
  rawOverlay: RawOverlay | undefined,
  cameraContact: boolean,
  timeMs: number,
): AvatarGestureFrame {
  const localTimeMs = Math.max(0, timeMs)
  const sourceTimeMs = timing.sourceAt(localTimeMs)
  const morphs: Record<string, number | null> = {}
  const releaseProgress = motionDurationMs >= localTimeMs
    ? 0
    : clamp((localTimeMs - motionDurationMs) / RELEASE_TAIL_MS)
  const releaseFactor = 1 - releaseProgress
  const sampleTimeMs = Math.min(localTimeMs, motionDurationMs)

  for (const [name, values] of Object.entries(channels)) {
    const value = sampleChannel(timing.presentationTimes, values, sampleTimeMs)
    if (localTimeMs > motionDurationMs) {
      morphs[name] = (value ?? 0) * releaseFactor
    } else {
      morphs[name] = value ?? null
    }
  }

  const released = localTimeMs >= activeDurationMs + RELEASE_TAIL_MS
  const marker = released
    ? { name: null, mirror: false, startAt: localTimeMs }
    : sampleGestureMarker(
      timing.presentationTimes,
      rawGestureValues,
      Math.min(localTimeMs, motionDurationMs),
    )
  const poseTask = localTimeMs <= motionDurationMs
    ? sampleTaskString(timing.presentationTimes, rawPoseValues, localTimeMs)
    : undefined
  const handTargets = sampleHandTargets(
    timing.presentationTimes,
    rawHandLeftValues,
    rawHandRightValues,
    localTimeMs,
  )
  const overlay = localTimeMs <= activeDurationMs
    ? sampleOverlay(rawOverlay, sourceTimeMs)
    : null
  const eyeContact = localTimeMs <= motionDurationMs
    ? sampleDiscreteControl(timing.presentationTimes, eyeContactValues, sampleTimeMs)
    : undefined
  const headMove = localTimeMs <= motionDurationMs
    ? sampleDiscreteControl(timing.presentationTimes, headMoveValues, sampleTimeMs)
    : undefined
  const gazeTarget = cameraContact
    ? localTimeMs <= 500 ? 'camera' as const : null
    : undefined

  return {
    morphs,
    gesture: marker.name,
    gestureStartMs: marker.startAt,
    mirror: marker.mirror,
    overlay,
    ...(eyeContact === undefined ? {} : { eyeContact }),
    ...(headMove === undefined ? {} : { headMove }),
    ...(gazeTarget === undefined ? {} : { gazeTarget }),
    ...(cameraContact ? { gazeTransitionMs: 500 } : {}),
    ...(poseTask === undefined ? {} : {
      pose: poseTask.name,
      poseStartMs: poseTask.startAt,
    }),
    handTargets,
    released,
  }
}

/** Expands source channels and samples all deterministic ranges once per action. */
function createNumericChannels(
  source: Readonly<Record<string, readonly unknown[]>>,
  random: RandomSource,
): Readonly<Record<string, readonly (number | null)[]>> {
  const channels: Record<string, readonly (number | null)[]> = {}
  for (const [name, values] of Object.entries(source)) {
    if (RESERVED_CHANNELS.has(name)) continue
    const sampled = values.map((value) => sampleRawNumber(value, random))
    if (name === 'eyesRotateX') {
      channels.eyesLookDown = [null, ...sampled.map((value) => value === null ? null : Math.max(0, value))]
      channels.eyesLookUp = [null, ...sampled.map((value) => value === null ? null : Math.max(0, -value))]
      continue
    }
    if (name === 'eyesRotateY') {
      channels.eyeLookOutLeft = [null, ...sampled.map((value) => value === null ? null : Math.max(0, value))]
      channels.eyeLookInLeft = [null, ...sampled.map((value) => value === null ? null : Math.max(0, -value))]
      channels.eyeLookOutRight = [null, ...sampled.map((value) => value === null ? null : Math.max(0, -value))]
      channels.eyeLookInRight = [null, ...sampled.map((value) => value === null ? null : Math.max(0, value))]
      continue
    }
    channels[name] = [null, ...sampled]
  }
  return channels
}

/** Creates one nullable control channel while preserving the source hold frame. */
function createNullableChannel(
  values: readonly unknown[],
  random: RandomSource,
): readonly (number | null)[] {
  return [null, ...values.map((value) => sampleRawNumber(value, random))]
}

/** Converts TH's head-movement probability into one deterministic switch. */
function createHeadMoveChannel(
  values: readonly unknown[],
  random: RandomSource,
): readonly (number | null)[] {
  return [null, ...values.map((value) => {
    const sampled = sampleRawNumber(value, random)
    if (sampled === null) return null
    return sampled === 0 ? 0 : random.random() < sampled ? 1 : 0
  })]
}

/** Adapts one external mood frame map to stable baseline values. */
function createMoodBaseline(
  source: Readonly<Record<string, readonly unknown[]>>,
): Readonly<Record<string, number>> {
  const channels = createNumericChannels(source, { random: () => 0.5 })
  const baseline: Record<string, number> = {}
  for (const [name, values] of Object.entries(channels)) {
    const index = values.length > 1 ? 1 : 0
    const value = values[index]
    if (typeof value === 'number') baseline[name] = value
  }
  return baseline
}

/** Samples one MotionEngine channel with its source segment convention. */
function sampleChannel(
  frameTimes: readonly number[],
  values: readonly (number | null)[],
  timeMs: number,
): number | undefined {
  if (values.length === 0 || frameTimes.length < 2) return undefined

  const segmentCount = frameTimes.length - 1
  let current: number | undefined
  for (let index = 0; index < segmentCount; index += 1) {
    const start = frameTimes[index]!
    const end = frameTimes[index + 1]!
    const target = values[Math.min(index + 1, values.length - 1)]
    if (target !== null && target !== undefined) {
      if (timeMs <= end || end <= start) {
        const source = values[index]
        const from = source === null || source === undefined
          ? current ?? 0
          : source
        return interpolateSegment(from, target, start, end, timeMs)
      }
      current = target
    }
    if (timeMs <= end) return current
  }
  return current
}

/** Samples a TH control at its discrete event slot instead of interpolating it. */
function sampleDiscreteControl(
  frameTimes: readonly number[],
  values: readonly (number | null)[],
  timeMs: number,
): number | undefined {
  let current: number | undefined
  const count = Math.min(frameTimes.length, values.length)
  for (let index = 0; index < count; index += 1) {
    if (timeMs < frameTimes[index]!) break
    const value = values[index]
    if (value !== null && value !== undefined) current = value
  }
  return current
}

/** Interpolates one source segment while preserving a constant zero-length segment. */
function interpolateSegment(
  from: number,
  to: number,
  start: number,
  end: number,
  timeMs: number,
): number {
  const span = end - start
  if (span <= 0) return to
  return from + (to - from) * sampleTalkingHeadEasing((timeMs - start) / span)
}

/** Resolves the latest native hand gesture command at one local motion time. */
function sampleGestureMarker(
  frameTimes: readonly number[],
  values: readonly unknown[],
  timeMs: number,
): { name: string | null; mirror: boolean; startAt: number } {
  let result: { name: string | null; mirror: boolean; startAt: number } = {
    name: null,
    mirror: false,
    startAt: 0,
  }
  const markerCount = Math.min(values.length, Math.max(0, frameTimes.length - 1))
  for (let index = 0; index < markerCount; index += 1) {
    const frameTime = frameTimes[index]!
    if (frameTime > timeMs) break
    const value = values[index]
    if (!Array.isArray(value)) continue
    const name = value[0]
    if (typeof name !== 'string') continue
    result = { name, mirror: value[2] === true, startAt: frameTime }
  }
  return result
}

/** Samples the latest string task emitted by a native animation template. */
function sampleTaskString(
  frameTimes: readonly number[],
  values: readonly unknown[],
  timeMs: number,
): { name: string; startAt: number } | undefined {
  let result: { name: string; startAt: number } | undefined
  const count = Math.min(values.length, Math.max(0, frameTimes.length - 1))
  for (let index = 0; index < count; index += 1) {
    if (frameTimes[index + 1]! > timeMs) break
    const value = values[index]
    if (typeof value === 'string') result = { name: value, startAt: frameTimes[index + 1]! }
  }
  return result
}

/** Samples the latest explicit hand IK task for each side. */
function sampleHandTargets(
  frameTimes: readonly number[],
  leftValues: readonly unknown[],
  rightValues: readonly unknown[],
  timeMs: number,
): readonly AvatarHandTarget[] {
  const left = sampleHandTarget('Left', frameTimes, leftValues, timeMs)
  const right = sampleHandTarget('Right', frameTimes, rightValues, timeMs)
  return [left, right].filter((target): target is AvatarHandTarget => target !== undefined)
}

/** Resolves one hand task and keeps its target while the native return runs. */
function sampleHandTarget(
  side: AvatarHandTarget['side'],
  frameTimes: readonly number[],
  values: readonly unknown[],
  timeMs: number,
): AvatarHandTarget | undefined {
  let target: AvatarHandTarget | undefined
  let previousPosition: AvatarHandTarget['position'] | undefined
  const count = Math.min(values.length, Math.max(0, frameTimes.length - 1))

  for (let index = 0; index < count; index += 1) {
    const startAt = frameTimes[index + 1]!
    if (startAt > timeMs) break
    const value = values[index]
    const task = readHandTask(value)
    if (task === undefined) continue
    if (task.position !== undefined) previousPosition = task.position
    if (previousPosition === undefined) continue
    target = {
      side,
      position: previousPosition,
      startAt,
      durationMs: task.durationMs,
      release: task.position === undefined,
    }
  }

  if (target === undefined) return undefined
  if (target.release && timeMs >= target.startAt + target.durationMs) return undefined
  return target
}

/** Finds the latest end time of the explicit hand tasks in a motion. */
function resolveHandTargetEnd(
  frameTimes: readonly number[],
  leftValues: readonly unknown[],
  rightValues: readonly unknown[],
): number {
  return Math.max(
    resolveHandSideEnd(frameTimes, leftValues),
    resolveHandSideEnd(frameTimes, rightValues),
  )
}

/** Calculates one hand task stream's active duration. */
function resolveHandSideEnd(
  frameTimes: readonly number[],
  values: readonly unknown[],
): number {
  let endAt = 0
  const count = Math.min(values.length, Math.max(0, frameTimes.length - 1))
  for (let index = 0; index < count; index += 1) {
    const task = readHandTask(values[index])
    if (task === undefined) continue
    endAt = Math.max(endAt, (frameTimes[index + 1] ?? 0) + task.durationMs)
  }
  return endAt
}

/** Reads a native `handLeft` or `handRight` task without exposing its object data. */
function readHandTask(value: unknown): Readonly<{
  position?: AvatarHandTarget['position']
  durationMs: number
}> | undefined {
  if (!isRecord(value)) return undefined
  const durationMs = typeof value.d === 'number' && Number.isFinite(value.d)
    ? Math.max(0, value.d)
    : 1_000
  const hasPosition = ['x', 'y', 'z'].every((name) => typeof value[name] === 'number')
  if (!hasPosition) return { durationMs }
  return {
    position: {
      x: value.x as number,
      y: value.y as number,
      z: value.z as number,
    },
    durationMs,
  }
}

/** Identifies the plain objects used by the TH task channels. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Samples a deterministic sine overlay in the same absolute-time frame. */
function sampleOverlay(raw: RawOverlay | undefined, timeMs: number): AvatarGestureOverlay | null {
  if (raw === undefined) return null
  const delay = raw.delay ?? 0
  const duration = raw.duration ?? 0
  if (timeMs < delay || timeMs > delay + duration || duration <= 0) return null

  const elapsed = timeMs - delay
  const fadeIn = clamp(elapsed / OVERLAY_FADE_MS)
  const fadeOut = clamp((duration - elapsed) / OVERLAY_FADE_MS)
  const envelope = fadeIn * fadeOut
  const timeSeconds = elapsed / 1000
  const overlay: Record<string, { rotation?: AvatarOverlayRotation; position?: AvatarOverlayPosition }> = {}

  for (const [boneName, bone] of Object.entries(raw.bones)) {
    if (bone.custom === 'jump') {
      overlay[boneName] = {
        position: { x: 0, y: Math.sin((elapsed / duration) * Math.PI) * 0.12, z: 0 },
      }
      continue
    }
    const amplitude = bone.amp
    const signal = Math.sin(timeSeconds * bone.freq) * envelope
    const phase = bone.phase ?? 0
    overlay[boneName] = {
      rotation: {
        x: signal * (amplitude[0] ?? 0),
        y: signal * (amplitude[1] ?? 0),
        z: Math.sin(timeSeconds * bone.freq + phase) * (amplitude[2] ?? 0) * envelope,
      },
    }
  }
  return overlay
}

/** Computes the end of an overlay relative to the motion start. */
function resolveOverlayEnd(raw: RawOverlay | undefined): number {
  if (raw === undefined) return 0
  return (raw.delay ?? 0) + (raw.duration ?? 0)
}

/** Resolves the authored duration without changing a motion's amplitude envelope. */
function resolveMotionTiming(
  sourceTimes: readonly number[],
  rescale: readonly number[] | undefined,
  durationOverride: number | undefined,
): MotionTiming {
  const sourceStart = sourceTimes[0] ?? 0
  const sourceEnd = sourceTimes[sourceTimes.length - 1] ?? sourceStart
  const sourceDuration = sourceEnd - sourceStart
  if (durationOverride === undefined || sourceDuration <= 0) {
    return createMotionTiming(sourceTimes, sourceTimes)
  }
  const durationMs = Math.max(0, durationOverride)
  const presentationTimes = durationMs > sourceDuration
    ? stretchLongMotion(sourceTimes, rescale, durationMs)
    : sourceTimes.map((time) => sourceStart + (time - sourceStart) * (sourceDuration === 0 ? 0 : durationMs / sourceDuration))
  return createMotionTiming(sourceTimes, presentationTimes)
}

/** Applies TalkingHead's `rescale` allocation when a motion is lengthened. */
function stretchLongMotion(
  sourceTimes: readonly number[],
  rescale: readonly number[] | undefined,
  targetDuration: number,
): readonly number[] {
  const first = sourceTimes[0] ?? 0
  const sourceEnd = sourceTimes[sourceTimes.length - 1] ?? first
  const sourceDuration = sourceEnd - first
  const excess = targetDuration - sourceDuration
  const result = [first]
  for (let index = 1; index < sourceTimes.length; index += 1) {
    const sourceSegment = (sourceTimes[index] ?? first) - (sourceTimes[index - 1] ?? first)
    const allocation = rescale?.[index - 1] ?? (sourceDuration === 0 ? 0 : sourceSegment / sourceDuration)
    result.push((result[index - 1] ?? first) + sourceSegment + allocation * excess)
  }
  return result
}

/** Creates the bidirectional mapping between source and presentation clocks. */
function createMotionTiming(
  sourceTimes: readonly number[],
  presentationTimes: readonly number[],
): MotionTiming {
  const sourceStart = sourceTimes[0] ?? 0
  const sourceOffsets = sourceTimes.map((time) => time - sourceStart)
  return {
    presentationTimes,
    durationMs: presentationTimes[presentationTimes.length - 1] ?? 0,
    sourceAt: (presentationMs) => mapTime(presentationMs, presentationTimes, sourceOffsets),
    presentationAt: (sourceMs) => mapTime(sourceMs, sourceOffsets, presentationTimes),
  }
}

/** Maps one point through two equal-length piecewise-linear time series. */
function mapTime(
  timeMs: number,
  sourceTimes: readonly number[],
  targetTimes: readonly number[],
): number {
  if (sourceTimes.length === 0 || targetTimes.length === 0) return 0
  if (timeMs <= sourceTimes[0]!) return targetTimes[0] ?? 0
  const last = sourceTimes.length - 1
  if (timeMs >= sourceTimes[last]!) return targetTimes[last] ?? 0
  for (let index = 0; index < last; index += 1) {
    const start = sourceTimes[index]!
    const end = sourceTimes[index + 1]!
    if (timeMs > end) continue
    const targetStart = targetTimes[index] ?? targetTimes[0] ?? 0
    const targetEnd = targetTimes[index + 1] ?? targetStart
    if (end <= start) return targetEnd
    return targetStart + (targetEnd - targetStart) * clamp((timeMs - start) / (end - start))
  }
  return targetTimes[last] ?? 0
}

/** Converts one raw numeric frame or range into a repeatable number. */
function sampleRawNumber(value: unknown, random: RandomSource): number | null {
  if (typeof value === 'number') return value
  if (value === null) return null
  if (!Array.isArray(value) || value.length < 2) return 0
  const min = typeof value[0] === 'number' ? value[0] : 0
  const max = typeof value[1] === 'number' ? value[1] : min
  const skew = typeof value[2] === 'number' ? value[2] : 1
  const samples = Math.max(1, Math.round(typeof value[3] === 'number' ? value[3] : 5))
  let total = 0
  for (let index = 0; index < samples; index += 1) total += random.random()
  return min + Math.pow(total / samples, skew) * (max - min)
}

/** Creates the deterministic random source used for one motion occurrence. */
function createSeededRandom(seed: number): RandomSource {
  let state = seed | 0
  return {
    random: () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state)
      state = (state + Math.imul(state ^ (state >>> 7), 61 | state)) ^ state
      return ((state ^ (state >>> 14)) >>> 0) / 0x1_0000_0000
    },
  }
}

/** Clamps one interpolation ratio without constraining authored motion values. */
function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
