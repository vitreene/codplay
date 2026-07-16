/**
 * Idle animation fns + the avatar action dispatch table — used by
 * Avatar3DBaseComponent (avatar3d-base-component.ts).
 *
 * Translates CodPlay action payloads to AvatarEngine + GazeService calls.
 * No TalkingHead dependency — driven entirely by CodPlay events.
 *
 * Supported actions (configure in perso.actions in the scene):
 *   avatar:viseme     true                              — forwards event payload (viseme: string | null)
 *   avatar:morph      true                              — forwards event payload (name, value, snap?)
 *   avatar:gesture    true                              — forwards event payload (gesture: string | null)
 *   avatar:gaze       true                              — forwards event payload (enabled: boolean)
 *   avatar:mood       true                              — forwards event payload (mood: string)
 *   avatar:head-drift { headDrift: createHeadDriftFn() }
 *   avatar:blink      { blink:     createBlinkScheduleFn() }
 *   avatar:breathe    { breathe:   createBreathTriggerFn() }
 *   broadcast         { type: 'STOP' }
 */
import type { AvatarEngine, GazeService } from '@codplay/avatar-engine'
import type { BlinkScheduleFn, BreathTriggerFn, HeadDriftFn } from '@codplay/avatar-engine'

// Mulberry32 seeded PRNG — kept local so gesture seek replay is deterministic without coupling.
function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

/**
 * Sine-wave head drift, seek-aware (detects elapsed reset and stays stateless).
 * Pure function of elapsed — no mutable state needed.
 */
export function createHeadDriftFn(): HeadDriftFn {
  return ({ elapsed }) => ({
    headRotateX: Math.sin(elapsed * 0.00032) * 0.025 + Math.sin(elapsed * 0.00071) * 0.01,
    headRotateY: Math.sin(elapsed * 0.00051) * 0.035 + Math.sin(elapsed * 0.00087) * 0.015,
  })
}

/**
 * Epoch-based blink scheduler. One blink per BLINK_PERIOD, at a deterministic
 * random offset derived from the epoch index alone — pure function of elapsed,
 * no mutable state. This is what makes it resync-safe: a direct jump to any
 * elapsed value (e.g. a seek target) computes the correct in-progress phase
 * immediately, instead of misreading a jump as "blink just started now".
 */
export function createBlinkScheduleFn(): BlinkScheduleFn {
  const BLINK_PERIOD = 4500, CLOSE_MS = 80, HOLD_MS = 80, OPEN_MS = 150
  const TOTAL_MS = CLOSE_MS + HOLD_MS + OPEN_MS
  return ({ elapsed }) => {
    const epochIdx = Math.floor(elapsed / BLINK_PERIOD)
    const tInEpoch = elapsed - epochIdx * BLINK_PERIOD
    const offset = BLINK_PERIOD * (0.20 + mulberry32(0xdeadbeef ^ (epochIdx * 0x9e3779b9))() * 0.55)
    const t = tInEpoch - offset
    if (t < 0 || t >= TOTAL_MS)  return { eyesClosed: 0 }
    if (t < CLOSE_MS)            return { eyesClosed: t / CLOSE_MS }
    if (t < CLOSE_MS + HOLD_MS)  return { eyesClosed: 1 }
    return { eyesClosed: 1 - (t - CLOSE_MS - HOLD_MS) / OPEN_MS }
  }
}

/**
 * Epoch-based breath trigger, seek-aware (elapsed < prev → state reset).
 * Fires breathAnimator.trigger() once per BREATH_PERIOD at a deterministic random offset.
 */
export function createBreathTriggerFn(): BreathTriggerFn {
  const BREATH_PERIOD = 4000
  let lastEpoch = -1, prevElapsed = 0
  return ({ elapsed }) => {
    if (elapsed < prevElapsed) lastEpoch = -1
    prevElapsed = elapsed
    const epochIdx = Math.floor(elapsed / BREATH_PERIOD)
    if (epochIdx <= lastEpoch) return null
    const tInEpoch = elapsed - epochIdx * BREATH_PERIOD
    const offset = BREATH_PERIOD * (0.10 + mulberry32((0xdeadbeef ^ 0x12345678) ^ (epochIdx * 0x9e3779b9))() * 0.50)
    if (tInEpoch >= offset) { lastEpoch = epochIdx; return { triggerBreath: true } }
    return null
  }
}

export const ALL_VISEMES = [
  'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U',
  'sil',
] as const

/** Resolves an optional continuous action end time, prioritizing absolute endMs. */
export function resolveContinuousEndMs(action: Record<string, unknown>, eventMs: number): number | null {
  const endMs = action['endMs']
  if (typeof endMs === 'number' && Number.isFinite(endMs)) {
    return endMs
  }

  const durationMs = action['durationMs']
  if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
    return eventMs + durationMs
  }

  return null
}

export type ActionHandler = (action: Record<string, unknown>, eventSeq: number) => void

/** Builds the action dispatch table. Each entry: [discriminant key, handler]. */
export function buildActionHandlers(
  engine: AvatarEngine,
  gaze: GazeService,
  visemeWeight: number,
): [string, ActionHandler][] {
  return [
    ['broadcast', (action) => {
      if ((action['broadcast'] as { type?: string } | null | undefined)?.type === 'STOP') {
        engine.prepareSeek()
      }
    }],

    ['viseme', (action) => {
      const v = action['viseme']
      const active = typeof v === 'string' ? v : null
      if (active === null) {
        for (const name of ALL_VISEMES) {
          engine.morphEngine.setFixed('viseme_' + name, null)
        }
      } else {
        for (const name of ALL_VISEMES) {
          engine.morphEngine.snapFixed('viseme_' + name, name === active ? visemeWeight : 0)
        }
      }
    }],

    // avatar:morph — keyed on 'name'; handler also requires 'value' key
    ['name', (action) => {
      if (!('value' in action)) return
      const name  = action['name']  as string
      const value = action['value'] as number
      const snap  = action['snap']  as boolean | undefined
      if (snap) engine.morphEngine.snapFixed(name, value)
      else      engine.morphEngine.setFixed(name, value)
    }],

    ['gesture', (action, eventSeq) => {
      const name = action['gesture']
      if (typeof name === 'string') {
        engine.playGesture(name, { random: mulberry32(eventSeq) })
      } else {
        engine.releaseGesture()
      }
    }],

    ['enabled', (action) => {
      gaze.setEnabled(action['enabled'] === true)
    }],

    ['mood', (action) => {
      if (typeof action['mood'] !== 'string') return
      engine.setMood(action['mood'] as Parameters<AvatarEngine['setMood']>[0])
    }],

    // avatar:head-drift — the fn is in the action (from perso.actions or event payload).
    ['headDrift', (action) => {
      const fn = action['headDrift']
      engine.setHeadDriftFn(typeof fn === 'function' ? fn as HeadDriftFn : null)
    }],

    // avatar:blink — the fn is in the action (from perso.actions or event payload).
    ['blink', (action) => {
      const fn = action['blink']
      engine.setBlinkScheduleFn(typeof fn === 'function' ? fn as BlinkScheduleFn : null)
    }],

    // avatar:breathe — the fn is in the action (from perso.actions or event payload).
    ['breathe', (action) => {
      const fn = action['breathe']
      engine.setBreathTriggerFn(typeof fn === 'function' ? fn as BreathTriggerFn : null)
    }],
  ]
}
