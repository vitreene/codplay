import type { BlinkScheduleFn } from '@codplay/avatar-engine'

const SINGLE_BLINK_PROBABILITY = 0.85
const SINGLE_DELAY_MIN_MS = 1_000
const SINGLE_DELAY_MAX_MS = 8_000
const DOUBLE_DELAY_MAX_MS = 4_000
const CLOSE_MS = 50
const SINGLE_HOLD_MIN_MS = 100
const SINGLE_HOLD_MAX_MS = 300
const DOUBLE_HOLD_MIN_MS = 100
const DOUBLE_HOLD_MAX_MS = 200
const DOUBLE_GAP_MIN_MS = 10
const DOUBLE_GAP_MAX_MS = 400
const OPEN_MS = 100

type BlinkSegment = Readonly<{
  startAt: number
  endAt: number
  from: number
  to: number
}>

type BlinkCycle = Readonly<{
  segments: readonly BlinkSegment[]
  endAt: number
}>

type RandomSource = () => number

/** Creates a deterministic random blink schedule compatible with the Avatar clock. */
export function createAvatarBlinkSchedule(seed = 0): BlinkScheduleFn {
  let random = createRandomSource(seed)
  let cycles: BlinkCycle[] = []
  let previousElapsed = -1

  return ({ elapsed }) => {
    if (!Number.isFinite(elapsed) || elapsed < 0) return { eyesClosed: 0 }

    if (elapsed < previousElapsed) {
      random = createRandomSource(seed)
      cycles = []
    }
    previousElapsed = elapsed

    ensureCyclesThrough(cycles, elapsed, random)
    const cycle = findActiveCycle(cycles, elapsed)
    return { eyesClosed: cycle === undefined ? 0 : sampleBlinkCycle(cycle, elapsed) }
  }
}

/** Extends the deterministic schedule until the requested time is covered. */
function ensureCyclesThrough(
  cycles: BlinkCycle[],
  elapsed: number,
  random: RandomSource,
): void {
  while (cycles.length === 0 || cycles[cycles.length - 1]!.endAt <= elapsed) {
    const availableAt = cycles.length === 0 ? 0 : cycles[cycles.length - 1]!.endAt
    cycles.push(createBlinkCycle(availableAt, random))
  }
}

/** Finds the blink cycle containing the current absolute time, if any. */
function findActiveCycle(cycles: readonly BlinkCycle[], elapsed: number): BlinkCycle | undefined {
  for (let index = cycles.length - 1; index >= 0; index -= 1) {
    const cycle = cycles[index]!
    if (elapsed >= cycle.segments[0]!.startAt && elapsed < cycle.endAt) return cycle
  }
  return undefined
}

/** Builds one single- or double-blink cycle after its random idle delay. */
function createBlinkCycle(availableAt: number, random: RandomSource): BlinkCycle {
  const isDoubleBlink = random() >= SINGLE_BLINK_PROBABILITY
  const delayMaxMs = isDoubleBlink ? DOUBLE_DELAY_MAX_MS : SINGLE_DELAY_MAX_MS
  const delayMs = randomInteger(random, SINGLE_DELAY_MIN_MS, delayMaxMs)
  const segments: BlinkSegment[] = []
  let cursor = availableAt + delayMs

  cursor = appendBlink(segments, cursor, CLOSE_MS, 0, 1)
  cursor = appendBlink(
    segments,
    cursor,
    randomInteger(
      random,
      isDoubleBlink ? DOUBLE_HOLD_MIN_MS : SINGLE_HOLD_MIN_MS,
      isDoubleBlink ? DOUBLE_HOLD_MAX_MS : SINGLE_HOLD_MAX_MS,
    ),
    1,
    1,
  )
  cursor = appendBlink(segments, cursor, OPEN_MS, 1, 0)

  if (isDoubleBlink) {
    cursor += randomInteger(random, DOUBLE_GAP_MIN_MS, DOUBLE_GAP_MAX_MS)
    cursor = appendBlink(segments, cursor, CLOSE_MS, 0, 1)
    cursor = appendBlink(
      segments,
      cursor,
      randomInteger(random, DOUBLE_HOLD_MIN_MS, DOUBLE_HOLD_MAX_MS),
      1,
      1,
    )
    cursor = appendBlink(segments, cursor, OPEN_MS, 1, 0)
  }

  return { segments, endAt: cursor }
}

/** Adds one linear blink segment and returns the next segment start. */
function appendBlink(
  segments: BlinkSegment[],
  startAt: number,
  durationMs: number,
  from: number,
  to: number,
): number {
  const endAt = startAt + durationMs
  segments.push({ startAt, endAt, from, to })
  return endAt
}

/** Samples one blink cycle with the morph intensity expected by AvatarEngine. */
function sampleBlinkCycle(cycle: BlinkCycle, elapsed: number): number {
  for (const segment of cycle.segments) {
    if (elapsed < segment.startAt) return 0
    if (elapsed >= segment.endAt) continue

    const progress = (elapsed - segment.startAt) / (segment.endAt - segment.startAt)
    return segment.from + (segment.to - segment.from) * progress
  }
  return 0
}

/** Creates the seeded pseudo-random source used to keep seeks reproducible. */
function createRandomSource(seed: number): RandomSource {
  let state = (seed | 0) || 0x6d2b79f5
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1)
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61)
    return ((state ^ (state >>> 14)) >>> 0) / 0x1_0000_0000
  }
}

/** Returns an inclusive integer from the supplied deterministic random source. */
function randomInteger(random: RandomSource, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}
