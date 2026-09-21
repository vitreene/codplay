import rawMotions from './motions.json'

/** One absolute rotation delta produced by a semantic motion overlay. */
export type AvatarOverlayRotation = Readonly<{
  x: number
  y: number
  z: number
}>

/** One absolute position delta produced by a semantic motion overlay. */
export type AvatarOverlayPosition = Readonly<{
  x: number
  y: number
  z: number
}>

/** Bone deltas sampled for one Avatar motion frame. */
export type AvatarGestureOverlay = Readonly<Record<string, Readonly<{
  rotation?: AvatarOverlayRotation
  position?: AvatarOverlayPosition
}>>>

/** Frame passed from avatar-gesture to the Avatar coordinator. */
export type AvatarGestureFrame = Readonly<{
  /** Morph values owned by the current gesture action. */
  morphs: Readonly<Record<string, number>>
  /** Native hand gesture to apply for this frame, or null to release it. */
  gesture: string | null
  /** Whether the native hand gesture is applied on the opposite side. */
  mirror: boolean
  /** Procedural bone deltas for this frame, when the motion defines them. */
  overlay: AvatarGestureOverlay | null
}>

/** Public metadata describing one available semantic Avatar motion. */
export type AvatarMotionDefinition = Readonly<{
  /** Stable name used in an authored `avatar:gesture:*` or `avatar:mood:*` action. */
  name: string
  /** Component track responsible for the motion. */
  track: 'action' | 'mood'
  /** Human-readable description from the source catalogue. */
  description: string
  /** Search tags from the source catalogue. */
  tags: readonly string[]
  /** Source motion duration before the internal release tail. */
  durationMs: number
}>

/** A resolved semantic motion sampled on the CodPlay absolute clock. */
export type AvatarMotionPlayer = Readonly<{
  /** Motion name used to create the player. */
  name: string
  /** Active duration, including the internal return to the neutral action layer. */
  durationMs: number
  /** Samples the complete action layer at a local time in milliseconds. */
  sample: (timeMs: number) => AvatarGestureFrame
}>

type RawMotion = Readonly<{
  _description?: string
  _tags?: readonly string[]
  _track?: string
  dt?: readonly number[]
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
  frameTimes: readonly number[]
  frameValues: Readonly<Record<string, readonly unknown[]>>
  gestureValues: readonly unknown[]
  rescale: readonly number[] | undefined
  overlay: RawOverlay | undefined
}>

type MotionEntry = readonly [string, RawMotion]

const RELEASE_TAIL_MS = 250
const OVERLAY_FADE_MS = 300
const RAW_MOTION_ENTRIES = Object.entries(rawMotions as Record<string, RawMotion>) as MotionEntry[]

/** Internal semantic channels that belong to another Avatar capability. */
const RESERVED_CHANNELS = new Set(['headMove', 'eyeContact', 'gesture'])

/** Builds the adapted, immutable metadata catalogue from the external JSON. */
function createMotionCatalog(): Readonly<Record<string, PreparedMotion>> {
  const catalog: Record<string, PreparedMotion> = {}
  for (const [name, raw] of RAW_MOTION_ENTRIES) {
    const frameDurations = raw.dt ?? []
    const frameTimes = buildFrameTimes(frameDurations)
    const frameValues = raw.vs ?? {}
    const rawGestureValues = frameValues.gesture ?? []
    const track = raw._track === 'mood' ? 'mood' : 'action'
    catalog[name] = {
      name,
      track,
      description: raw._description ?? '',
      tags: raw._tags ?? [],
      durationMs: frameTimes[frameTimes.length - 1] ?? 0,
      frameTimes,
      frameValues,
      gestureValues: rawGestureValues,
      rescale: raw.rescale,
      overlay: raw._overlay,
    }
  }
  return Object.freeze(catalog)
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

/** Returns the adapted baseline for one external mood motion. */
export function getAvatarMoodBaseline(name: string): Readonly<Record<string, number>> | undefined {
  const motion = PREPARED_MOTIONS[name]
  if (motion === undefined || motion.track !== 'mood') return undefined
  return createMoodBaseline(motion.frameValues)
}

/** Builds cumulative frame times from the source duration list. */
function buildFrameTimes(durations: readonly number[]): readonly number[] {
  const times = [0]
  for (const duration of durations) {
    times.push(times[times.length - 1]! + duration)
  }
  return times
}

/** Creates one deterministic source player and adapts optional duration changes. */
function createMotionPlayer(
  motion: PreparedMotion,
  seed: number,
  durationOverride: number | undefined,
): AvatarMotionPlayer {
  const random = createSeededRandom(seed)
  const timing = resolveMotionTiming(motion.frameTimes, durationOverride)
  const channels = createNumericChannels(motion.frameValues, random)
  const sourceDurationMs = motion.frameTimes[motion.frameTimes.length - 1] ?? 0
  const motionDurationMs = timing.durationMs
  const overlayDurationMs = scaleDuration(resolveOverlayEnd(motion.overlay), timing.scale)
  const activeDurationMs = Math.max(motionDurationMs, overlayDurationMs)
  const durationMs = activeDurationMs + RELEASE_TAIL_MS

  return {
    name: motion.name,
    durationMs,
    sample: (timeMs) => sampleMotion(
      motion.frameTimes,
      timing.scale,
      motionDurationMs,
      sourceDurationMs,
      activeDurationMs,
      channels,
      motion.gestureValues,
      motion.rescale,
      motion.overlay,
      timeMs,
    ),
  }
}

/** Resolves one action frame, including its return to the neutral action layer. */
function sampleMotion(
  frameTimes: readonly number[],
  timeScale: number,
  motionDurationMs: number,
  sourceDurationMs: number,
  activeDurationMs: number,
  channels: Readonly<Record<string, readonly number[]>>,
  rawGestureValues: readonly unknown[],
  rescale: readonly number[] | undefined,
  rawOverlay: RawOverlay | undefined,
  timeMs: number,
): AvatarGestureFrame {
  const localTimeMs = Math.max(0, timeMs)
  const sourceTimeMs = resolveSourceTime(localTimeMs, timeScale, sourceDurationMs)
  const morphs: Record<string, number> = {}
  const releaseProgress = activeDurationMs >= localTimeMs
    ? 0
    : clamp((localTimeMs - activeDurationMs) / RELEASE_TAIL_MS)
  const releaseFactor = 1 - releaseProgress
  const rescaleFactor = rescale === undefined
    ? 1
    : sampleChannel(frameTimes, rescale, sourceTimeMs)

  for (const [name, values] of Object.entries(channels)) {
    morphs[name] = sampleChannel(frameTimes, values, sourceTimeMs) * rescaleFactor * releaseFactor
  }

  const marker = localTimeMs <= motionDurationMs
    ? sampleGestureMarker(frameTimes, rawGestureValues, sourceTimeMs)
    : null
  const overlay = localTimeMs <= activeDurationMs
    ? sampleOverlay(rawOverlay, sourceTimeMs)
    : null

  return {
    morphs,
    gesture: marker?.name ?? null,
    mirror: marker?.mirror ?? false,
    overlay,
  }
}

/** Expands source channels and samples all deterministic ranges once per action. */
function createNumericChannels(
  source: Readonly<Record<string, readonly unknown[]>>,
  random: RandomSource,
): Readonly<Record<string, readonly number[]>> {
  const channels: Record<string, readonly number[]> = {}
  for (const [name, values] of Object.entries(source)) {
    if (RESERVED_CHANNELS.has(name) || name.startsWith('viseme_')) continue
    const sampled = values.map((value) => sampleRawNumber(value, random))
    if (name === 'eyesRotateX') {
      channels.eyesLookDown = sampled.map((value) => Math.max(0, value))
      channels.eyesLookUp = sampled.map((value) => Math.max(0, -value))
      continue
    }
    if (name === 'eyesRotateY') {
      channels.eyeLookOutLeft = sampled.map((value) => Math.max(0, value))
      channels.eyeLookInLeft = sampled.map((value) => Math.max(0, -value))
      channels.eyeLookOutRight = sampled.map((value) => Math.max(0, -value))
      channels.eyeLookInRight = sampled.map((value) => Math.max(0, value))
      continue
    }
    channels[name] = sampled
  }
  return channels
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
    if (value !== undefined) baseline[name] = value
  }
  return baseline
}

/** Samples one MotionEngine channel with its source segment convention. */
function sampleChannel(
  frameTimes: readonly number[],
  values: readonly number[],
  timeMs: number,
): number {
  if (values.length === 0) return 0
  if (values.length === 1 || frameTimes.length < 2) return values[0] ?? 0

  const segmentCount = frameTimes.length - 1
  const hasInitialValue = values.length === segmentCount + 1
  for (let index = 0; index < segmentCount; index += 1) {
    const start = frameTimes[index]!
    const end = frameTimes[index + 1]!
    if (timeMs > end && index < segmentCount - 1) continue

    if (hasInitialValue) {
      const from = values[index] ?? 0
      const to = values[index + 1] ?? from
      return interpolateSegment(from, to, start, end, timeMs)
    }

    const to = values[Math.min(index, values.length - 1)] ?? 0
    if (index === 0) return to
    const from = values[Math.min(index - 1, values.length - 1)] ?? to
    return interpolateSegment(from, to, start, end, timeMs)
  }
  return values[values.length - 1] ?? 0
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
  return from + (to - from) * clamp((timeMs - start) / span)
}

/** Resolves the latest native hand gesture marker at one local motion time. */
function sampleGestureMarker(
  frameTimes: readonly number[],
  values: readonly unknown[],
  timeMs: number,
): { name: string; mirror: boolean } | undefined {
  let result: { name: string; mirror: boolean } | undefined
  const markerCount = Math.min(values.length, Math.max(0, frameTimes.length - 1))
  for (let index = 0; index < markerCount; index += 1) {
    const frameTime = frameTimes[index + 1]!
    if (frameTime > timeMs) break
    const value = values[index]
    if (!Array.isArray(value)) {
      result = undefined
      continue
    }
    const name = value[0]
    if (typeof name !== 'string') {
      result = undefined
      continue
    }
    result = { name, mirror: value[2] === true }
  }
  return result
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
  durationOverride: number | undefined,
): Readonly<{ durationMs: number; scale: number }> {
  const sourceDuration = sourceTimes[sourceTimes.length - 1] ?? 0
  if (durationOverride === undefined || sourceDuration <= 0) {
    return { durationMs: sourceDuration, scale: 1 }
  }
  const durationMs = Math.max(0, durationOverride)
  return { durationMs, scale: durationMs / sourceDuration }
}

/** Converts a presentation time back to the source motion clock. */
function resolveSourceTime(timeMs: number, scale: number, sourceDurationMs: number): number {
  if (scale <= 0) return sourceDurationMs
  return Math.min(timeMs / scale, sourceDurationMs)
}

/** Applies the same authored time scaling to an optional procedural overlay. */
function scaleDuration(durationMs: number, scale: number): number {
  return durationMs * scale
}

/** Converts one raw numeric frame or range into a repeatable number. */
function sampleRawNumber(value: unknown, random: RandomSource): number {
  if (typeof value === 'number') return value
  if (!Array.isArray(value) || value.length < 2) return 0
  const min = typeof value[0] === 'number' ? value[0] : 0
  const max = typeof value[1] === 'number' ? value[1] : min
  const skewFrom = typeof value[2] === 'number' ? value[2] : 1
  const skewTo = typeof value[3] === 'number' ? value[3] : 1
  const sample = random.random()
  const power = skewFrom + (skewTo - skewFrom) * sample
  return min + (max - min) * Math.pow(sample, 1 / Math.max(0.001, power))
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

type RandomSource = Readonly<{
  random: () => number
}>
