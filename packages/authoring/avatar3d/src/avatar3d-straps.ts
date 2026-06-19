/**
 * Avatar3D idle straps — CodPlay transposition of TalkingHead's idle animations.
 *
 * Adapted from TalkingHead by Mika Suominen (met4citizen), MIT licence.
 * Source: https://github.com/met4citizen/TalkingHead
 *
 * avatar:idle fires once at t=0. It starts two live loops (blink, breathing),
 * then returns a single event to activate the continuous head drift in the engine:
 *
 *   - Head drift  : avatar:head-drift { headDrift: true } — enables HeadDriftAnimator
 *                   (incommensurate sine waves per axis, original TH constants)
 *                   Engine drives the curve each animate() tick — no periodic events.
 *
 *   - Blink       : loop at BLINK_STEP_MS — epoch detection + phase tracking in closure.
 *                   During the ~310 ms blink window, emits avatar:morph { eyesClosed, snap }
 *                   events at each step. Outside the window: 0 events.
 *                   This uses the proven avatar:morph dispatch path (same as visemes).
 *
 *   - Breathing   : fires avatar:breathe once per epoch (~4 s) at a random offset.
 *
 * Design rules:
 *   - Each loop emits the minimum number of events possible.
 *   - Low-level animation (morph curves, bone rotation) is handled by the engine.
 *   - Epoch-based seeded RNG keeps blink/breath timings deterministic and seek-safe.
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
const BLINK_PERIOD_MS = 4500  // epoch length
const BLINK_STEP_MS   = 50    // detection loop interval

// --- Breath detection parameters ---
const BREATH_PERIOD_MS = 4000
const BREATH_STEP_MS   = 250

const IDLE_UNTIL = [{ type: 'event' as const, name: 'sequence:end' }]

export function createAvatar3DStraps(): StrapCollection {
  return {
    'avatar:idle': ({ context }) => {

      // Blink — epoch detection, ONE event per blink.
      // avatar:blink triggers engine.triggerBlink() → BlinkAnimator handles the full
      // close/hold/open sequence internally via engine.animate() each frame.
      let lastBlinkEpoch = -1

      void context.live.loop({ eachMs: BLINK_STEP_MS, until: IDLE_UNTIL }, ({ elapsedMs }) => {
        const epochIdx = Math.floor(elapsedMs / BLINK_PERIOD_MS)
        if (epochIdx <= lastBlinkEpoch) return
        const tInEpoch = elapsedMs - epochIdx * BLINK_PERIOD_MS
        const rng = mulberry32(IDLE_SEED ^ (epochIdx * 0x9e3779b9))
        const blinkStart = BLINK_PERIOD_MS * (0.20 + rng() * 0.55)
        if (tInEpoch >= blinkStart) {
          lastBlinkEpoch = epochIdx
          return { event: { name: 'avatar:blink', data: { blink: true } } }
        }
      })

      // Breathing — fires avatar:breathe exactly once per epoch.
      let lastBreathEpoch = -1
      void context.live.loop({ eachMs: BREATH_STEP_MS, until: IDLE_UNTIL }, ({ elapsedMs }) => {
        const epochIdx = Math.floor(elapsedMs / BREATH_PERIOD_MS)
        if (epochIdx <= lastBreathEpoch) return
        const tInEpoch    = elapsedMs - epochIdx * BREATH_PERIOD_MS
        const rng = mulberry32((IDLE_SEED ^ 0x12345678) ^ (epochIdx * 0x9e3779b9))
        const swellStart  = BREATH_PERIOD_MS * (0.10 + rng() * 0.50)
        if (tInEpoch >= swellStart) {
          lastBreathEpoch = epochIdx
          return { event: { name: 'avatar:breathe', data: { breathe: true } } }
        }
      })

      // Head drift — single event enables HeadDriftAnimator in the engine.
      // No loop needed: the engine runs the sine-wave computation each animate() tick.
      // Disabled automatically when engine.prepareSeek() is called on stop/rewind.
      return { events: [{ name: 'avatar:head-drift', data: { headDrift: true } }] }
    },
  }
}
