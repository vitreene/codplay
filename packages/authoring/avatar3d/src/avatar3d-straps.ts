/**
 * Avatar3D idle straps — CodPlay transposition of TalkingHead's idle animations.
 *
 * Adapted from TalkingHead by Mika Suominen (met4citizen), MIT licence.
 * Source: https://github.com/met4citizen/TalkingHead
 *
 * Three concurrent live loops, all stopped by sequence:end :
 *   - Head micro-movement : aperiodic sine on headRotateX/Y
 *   - Blink              : epoch-based, deterministic without state
 *   - Breathing          : epoch-based, deterministic without state
 *
 * Design note: blink and breathing use epoch-based timing derived from elapsedMs
 * rather than persisted state. This makes them:
 *   - Seek-safe: the correct phase is computable at any elapsedMs
 *   - Simple: no story state keys to track, no race conditions
 *   - Deterministic: identical behavior on replay
 */
import type { StrapCollection } from 'codplay/player'

// Mulberry32 — seedable PRNG (public domain, Tommy Ettinger).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

const IDLE_SEED = 0xdeadbeef

// --- Blink parameters ---
// Mean inter-blink interval: ~4.5 s. Natural range: 2–8 s.
const BLINK_PERIOD_MS   = 4500  // base epoch length
const BLINK_OPEN_RATIO  = 0.3   // fraction of blink period spent closed (75ms) → varies slightly
const BLINK_CLOSE_MS    = 80    // duration of eye close (snap → very quick)
const BLINK_HOLD_MS     = 80    // hold at closed
const BLINK_OPEN_MS     = 150   // duration of eye open (eased)

// --- Breathing parameters ---
const BREATH_PERIOD_MS  = 4000  // each epoch
const BREATH_SWELL_MS   = 1500  // duration of swell rise + hold
const BREATH_PEAK       = 0.12  // max mouthShrugLower value

const IDLE_UNTIL = [{ type: 'event' as const, name: 'sequence:end' }]

/**
 * Returns blink phase info for a given elapsedMs, using epoch-based seeded RNG.
 *
 * Within each epoch (BLINK_PERIOD_MS), the blink starts at a random offset
 * that is derived deterministically from the epoch index.
 *
 * Returns: { phase: 'closed'|'opening'|'open', t: 0-1 within phase }
 */
function resolveBlink(elapsedMs: number, seed: number): {
  eyesClosed: number
} {
  const epochIdx   = Math.floor(elapsedMs / BLINK_PERIOD_MS)
  const epochStart = epochIdx * BLINK_PERIOD_MS
  const tInEpoch   = elapsedMs - epochStart

  // Deterministic random offset within epoch for this blink start
  const rng = mulberry32(seed ^ (epochIdx * 0x9e3779b9))
  // Blink starts between 20% and 75% into the epoch
  const blinkStart = BLINK_PERIOD_MS * (0.20 + rng() * 0.55)
  const blinkEnd   = blinkStart + BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS

  if (tInEpoch < blinkStart || tInEpoch > blinkEnd) {
    return { eyesClosed: 0 }
  }

  const tBlink = tInEpoch - blinkStart

  if (tBlink < BLINK_CLOSE_MS) {
    // Closing — fast (snap-like)
    return { eyesClosed: tBlink / BLINK_CLOSE_MS }
  }
  if (tBlink < BLINK_CLOSE_MS + BLINK_HOLD_MS) {
    // Held closed
    return { eyesClosed: 1 }
  }
  // Opening — eased
  const tOpen = tBlink - BLINK_CLOSE_MS - BLINK_HOLD_MS
  return { eyesClosed: 1 - tOpen / BLINK_OPEN_MS }
}

/**
 * Returns breathing weight for a given elapsedMs.
 */
function resolveBreath(elapsedMs: number, seed: number): number {
  const epochIdx   = Math.floor(elapsedMs / BREATH_PERIOD_MS)
  const epochStart = epochIdx * BREATH_PERIOD_MS
  const tInEpoch   = elapsedMs - epochStart

  const rng = mulberry32((seed ^ 0x12345678) ^ (epochIdx * 0x9e3779b9))
  // Swell starts between 10% and 60% into the epoch
  const swellStart = BREATH_PERIOD_MS * (0.10 + rng() * 0.50)
  const swellEnd   = swellStart + BREATH_SWELL_MS

  if (tInEpoch < swellStart || tInEpoch > swellEnd) {
    return 0
  }

  const t = (tInEpoch - swellStart) / BREATH_SWELL_MS
  // Triangle envelope: up in first third, hold, down in last third
  if (t < 0.33) return (t / 0.33) * BREATH_PEAK
  if (t < 0.66) return BREATH_PEAK
  return ((1 - t) / 0.34) * BREATH_PEAK
}

export function createAvatar3DStraps(): StrapCollection {
  return {
    'avatar:idle': ({ context }) => {
      // Head micro-movement — deterministic sine, fires every 50ms.
      void context.live.loop({ eachMs: 50, until: IDLE_UNTIL }, ({ elapsedMs }) => {
        const hx = Math.sin(elapsedMs * 0.00032) * 0.10 + Math.sin(elapsedMs * 0.00071) * 0.04
        const hy = Math.sin(elapsedMs * 0.00051) * 0.14 + Math.sin(elapsedMs * 0.00087) * 0.06
        return [
          { event: { name: 'avatar:morph', data: { name: 'headRotateX', value: hx } } },
          { event: { name: 'avatar:morph', data: { name: 'headRotateY', value: hy } } },
        ]
      })

      // Blink — epoch-based, no state. Fires every 16ms for smooth interpolation.
      void context.live.loop({ eachMs: 16, until: IDLE_UNTIL }, ({ elapsedMs }) => {
        const { eyesClosed } = resolveBlink(elapsedMs, IDLE_SEED)
        return { event: { name: 'avatar:morph', data: { name: 'eyesClosed', value: eyesClosed } } }
      })

      // Breathing — epoch-based, no state. Fires every 50ms.
      void context.live.loop({ eachMs: 50, until: IDLE_UNTIL }, ({ elapsedMs }) => {
        const weight = resolveBreath(elapsedMs, IDLE_SEED)
        return { event: { name: 'avatar:morph', data: { name: 'mouthShrugLower', value: weight } } }
      })
    },
  }
}
